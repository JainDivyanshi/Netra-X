const router = require("express").Router();
const multer = require("multer");

const { matchSketch } = require("../controllers/match.controller");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post("/match", upload.single("sketch"), matchSketch);

module.exports = router;
