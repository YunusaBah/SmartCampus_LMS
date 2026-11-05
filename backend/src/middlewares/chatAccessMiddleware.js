module.exports = (req, res, next) => {
    if (req.user.role === "student") return next();
    return res.status(403).json({ message: "Access denied" });
};
