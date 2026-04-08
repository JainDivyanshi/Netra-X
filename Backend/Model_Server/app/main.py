"""
Sketch-to-Photo Recognition Backend Server

Local Usage:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

API Endpoints:
    POST /match   - Upload a sketch, get top-5 photo matches back
    GET  /health  - Health check
    GET  /docs    - Auto-generated Swagger UI
"""

import os
import io
import logging
from pathlib import Path
from typing import List

import torch
import torch.nn as nn
import torch.nn.functional as torchF
import cv2
import numpy as np
from torchvision import models, transforms
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─────────────────────────────────────────────
# CONFIG 
# ─────────────────────────────────────────────
MODEL_PATH   = r"models\colab\sketch_photo_triplet_model.pth"   # path to your .pth file
PHOTO_DIR    = r"../dataset/photos"                               # directory of reference photos
TOP_K        = 5                                                  # number of results to return
EMBED_DIM    = 128
IMG_SIZE     = 224
DEVICE       = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# MODEL DEFINITION
# ─────────────────────────────────────────────
class Encoder(nn.Module):
    def __init__(self, embed_dim: int = EMBED_DIM):
        super().__init__()
        self.backbone = models.resnet50(pretrained=True)
        self.backbone.fc = nn.Linear(2048, embed_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.backbone(x)
        x = torchF.normalize(x, p=2, dim=1)
        return x

# ─────────────────────────────────────────────
# IMAGE TRANSFORM
# ─────────────────────────────────────────────
transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
])

# ─────────────────────────────────────────────
# STARTUP: Load model + build photo index
# ─────────────────────────────────────────────
model: Encoder = None
photo_embeddings: torch.Tensor = None
photo_paths: List[str] = []

def load_model() -> Encoder:
    """Load the trained encoder from disk."""
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model file not found at '{MODEL_PATH}'. "
            "Update MODEL_PATH at the top of main.py."
        )
    enc = Encoder().to(DEVICE)
    state_dict = torch.load(MODEL_PATH, map_location=DEVICE)
    enc.load_state_dict(state_dict)
    enc.eval()
    logger.info("✅ Model loaded from %s", MODEL_PATH)
    return enc

def build_photo_index(enc: Encoder):
    """
    Pre-compute and cache embeddings for every photo in PHOTO_DIR.
    This runs once at startup so inference stays fast.
    """
    if not os.path.isdir(PHOTO_DIR):
        raise NotADirectoryError(
            f"Photo directory not found: '{PHOTO_DIR}'. "
            "Update PHOTO_DIR at the top of main.py."
        )

    paths, embeddings = [], []
    with torch.no_grad():
        for fname in sorted(os.listdir(PHOTO_DIR)):
            if not fname.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            full_path = os.path.join(PHOTO_DIR, fname)
            img = cv2.imread(full_path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                logger.warning("Could not read %s – skipping", full_path)
                continue
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
            tensor = transform(img).unsqueeze(0).to(DEVICE)
            emb = enc(tensor).cpu()
            embeddings.append(emb)
            paths.append(full_path)

    logger.info("✅ Photo index built: %d photos indexed", len(paths))
    return paths, torch.cat(embeddings, dim=0)

# ─────────────────────────────────────────────
# FastAPI APP
# ─────────────────────────────────────────────
app = FastAPI(
    title="Sketch-to-Photo API",
    description="Upload a sketch → get back the top matching photo URLs from your dataset.",
    version="1.0.0",
)

# CORS SETUP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Load the model and build the photo index once when the server starts."""
    global model, photo_embeddings, photo_paths
    model = load_model()
    photo_paths, photo_embeddings = build_photo_index(model)

# ─────────────────────────────────────────────
# RESPONSE SCHEMA
# ─────────────────────────────────────────────
class MatchResult(BaseModel):
    match_found: bool
    best_photo: str
    similarity: float
    gap: float
    z_score: float
    percentile: float
    top5_photos: List[str]

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def embed_sketch(image_bytes: bytes) -> torch.Tensor:
    """Decode uploaded bytes → embed with the model."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Could not decode image. Make sure it is a valid JPEG/PNG.")
    img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    tensor = transform(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        emb = model(tensor)
    return emb.cpu()

def match_embedding(sketch_emb: torch.Tensor, k: int = TOP_K) -> MatchResult:
    """Compare sketch embedding against all photo embeddings and return top-k."""
    sims = torchF.cosine_similarity(sketch_emb, photo_embeddings)

    topk = torch.topk(sims, k=k)
    best_score  = topk.values[0].item()
    second_score = topk.values[1].item() if k > 1 else 0.0

    best_photo = photo_paths[topk.indices[0].item()]
    top_k_photos = [photo_paths[i] for i in topk.indices.tolist()]

    gap        = best_score - second_score
    mean       = sims.mean().item()
    std        = sims.std().item() + 1e-8
    z_score    = (best_score - mean) / std
    percentile = (sims < best_score).float().mean().item()

    match_found = (
        best_score > 0.30
        and gap > 0.06
        and z_score > 1.5
    )

    return MatchResult(
        match_found  = match_found,
        best_photo   = best_photo,
        similarity   = round(best_score, 4),
        gap          = round(gap, 4),
        z_score      = round(z_score, 4),
        percentile   = round(percentile, 4),
        top5_photos  = top_k_photos,
    )

# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────
@app.get("/health", tags=["Utility"])
def health_check():
    """Returns server status and how many photos are indexed."""
    return {
        "status": "ok",
        "device": str(DEVICE),
        "photos_indexed": len(photo_paths),
    }


@app.post("/match", response_model=MatchResult, tags=["Matching"])
async def match_sketch(file: UploadFile = File(..., description="Sketch image (JPEG or PNG)")):
    """
    Upload a sketch image and receive the top-5 closest photo matches.

    - **file**: The sketch image file (JPEG or PNG).

    Returns:
    - `match_found`  – whether a confident match was detected
    - `best_photo`   – path to the best matching photo
    - `similarity`   – cosine similarity score of the best match
    - `gap`          – difference between top-1 and top-2 similarity
    - `z_score`      – how far above the mean the best score is
    - `percentile`   – fraction of photos with lower similarity
    - `top5_photos`  – ordered list of the top-5 matching photo paths
    """
    # Validate content type
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file.content_type}'. Upload a JPEG or PNG.",
        )

    try:
        image_bytes = await file.read()
        sketch_emb  = embed_sketch(image_bytes)
        result      = match_embedding(sketch_emb, k=TOP_K)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error during matching")
        raise HTTPException(status_code=500, detail="Internal server error")

    return result