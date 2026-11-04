const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== "production",
    message: { message: "Too many authentication attempts. Try again later." }
});

/*
  AUTH ROUTES
*/
router.get("/config", authController.getAuthConfig);
router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/password/forgot", authLimiter, authController.requestPasswordReset);
router.post("/password/reset", authLimiter, authController.resetPassword);
router.post("/logout", authMiddleware, authController.logout);
router.post("/google/register", authLimiter, authController.googleRegister);
router.post("/google/login", authLimiter, authController.googleLogin);
router.patch("/profile", authMiddleware, authController.updateProfile);
router.patch("/password", authMiddleware, authController.updatePassword);

module.exports = router;