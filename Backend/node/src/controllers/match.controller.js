const axios = require("axios");
const FormData = require("form-data");

async function matchSketch(req, res) {
  /*
    EXPECTED REQUEST FROM FRONTEND:
    POST /api/match
    Content-Type: multipart/form-data
    form-data field: "sketch" = image file (png/jpg)

    Example from frontend:
    const fd = new FormData()
    fd.append("sketch", file)

    Backend then calls ML API:
    POST {ML_BASE_URL}/ai/match
    form-data: sketch=<file>

    EXPECTED RESPONSE FROM ML (PRD contract) :contentReference[oaicite:3]{index=3}:
    {
      "matched_person_id": "P001",
      "matched_image_url": "/static/criminal/P001.png",
      "similarity_score": 0.83,
      "confidence_percentage": 90.7,
      "inference_time_ms": 640
    }
  */

  if (!req.file) return res.status(400).json({ error: "sketch file required (field name: sketch)" });

  const mlBase = process.env.ML_BASE_URL || "http://127.0.0.1:8000";

  const form = new FormData();
  form.append("sketch", req.file.buffer, {
    filename: req.file.originalname || "sketch.png",
    contentType: req.file.mimetype
  });

  try {
    const response = await axios.post(`${mlBase}/ai/match`, form, {
      headers: form.getHeaders(),
      timeout: 30000
    });

    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || { error: "ML service failure" };

    return res.status(status).json({
      error: "Match failed",
      ml_detail: detail
    });
  }
}

module.exports = { matchSketch };
