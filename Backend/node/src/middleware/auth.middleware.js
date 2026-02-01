const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const token = req.cookies?.authtoken;

  if (!token) {
    return res.status(401).json({ error: "Missing auth cookie" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "netrax_secret");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid/Expired token" });
  }
}

module.exports = { authRequired };
