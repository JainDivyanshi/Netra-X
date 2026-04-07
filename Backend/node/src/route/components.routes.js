const router = require("express").Router();
const { searchComponents } = require("../controllers/components.controller");

router.get("/search", searchComponents);

module.exports = router;
