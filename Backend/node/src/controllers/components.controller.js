const Component = require("../models/Component");

async function searchComponents(req, res) {
  /*
    EXPECTED REQUEST FROM FRONTEND (Builder):
    GET /api/components/search?type=eyes&tags=male,angry&q=sharp&page=1&limit=24

    RESPONSE:
    {
      "items": [
        {
          "_id": "...",
          "type": "eyes",
          "title": "Eyes 01",
          "tags": ["male","angry"],
          "image_url": "/assets/components/eyes1.png"
        }
      ],
      "page": 1,
      "limit": 24,
      "total": 120
    }

    ASSUMPTION:
    image_url points to frontend CDN/public OR backend static mount.
    For now, frontend already has assets at:
    Frontend/public/assets/components/*
  */

  const { type, tags, q } = req.query;
  const page = parseInt(req.query.page || "1");
  const limit = Math.min(parseInt(req.query.limit || "24"), 60);

  const filter = {};

  if (type) filter.type = type;

  if (tags) {
    const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
    if (tagList.length > 0) filter.tags = { $in: tagList };
  }

  if (q) {
    filter.title = { $regex: q, $options: "i" };
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Component.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Component.countDocuments(filter)
  ]);

  res.json({ items, page, limit, total });
}

module.exports = { searchComponents };
