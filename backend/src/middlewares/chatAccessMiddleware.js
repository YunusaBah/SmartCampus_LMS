const User = require("../models/User");

const developerEmail = "bahy1878@gmail.com";

module.exports = async (req, res, next) => {
    if (req.user.role === "student") return next();
    try {
        const user = await User.findByPk(req.user.id, { attributes: ["email"] });
        if (user?.email?.trim().toLowerCase() === developerEmail) return next();
        return res.status(403).json({ message: "Access denied" });
    } catch (error) {
        return next(error);
    }
};
