const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isValidJwtSecret } = require("../utils/authConfiguration");

require("../config/env");

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (typeof authHeader !== "string" || !authHeader) {
        return res.status(401).json({ message: "No token provided" });
    }

    const tokenMatch = authHeader.match(/^Bearer\s+([^\s]+)$/i);
    if (!tokenMatch || tokenMatch[1].length > 8192) {
        return res.status(401).json({ message: "A valid bearer token is required" });
    }

    if (!isValidJwtSecret(process.env.JWT_SECRET)) {
        console.error("JWT_SECRET is not configured");
        return res.status(500).json({ message: "Authentication is not configured" });
    }

    let payload;
    try {
        payload = jwt.verify(tokenMatch[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }

    if (!payload || typeof payload !== "object" ||
        !Number.isSafeInteger(payload.id) || payload.id < 1 ||
        !["student", "lecturer"].includes(payload.role) ||
        !Number.isSafeInteger(payload.tokenVersion) || payload.tokenVersion < 0 ||
        !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) {
        return res.status(401).json({ message: "Invalid token" });
    }

    try {
        const user = await User.findByPk(payload.id, { attributes: ["id", "role", "tokenVersion"] });
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }
        if (payload.tokenVersion !== user.tokenVersion || payload.role !== user.role) {
            return res.status(401).json({ message: "Session has been revoked; please log in again" });
        }
        req.user = { id: user.id, role: user.role };
        return next();
    } catch (error) {
        return next(error);
    }
};

module.exports = authMiddleware;