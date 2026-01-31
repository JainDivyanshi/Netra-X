const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "netrax_secret");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid/Expired token" });
  }
}

module.exports = { authRequired };