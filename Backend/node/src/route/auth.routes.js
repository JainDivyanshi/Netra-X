const router = require("express").Router();

const { register, login, logout, me } = require("../controllers/auth.controller");
const { authRequired } = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", authRequired, me);

module.exports = router;
