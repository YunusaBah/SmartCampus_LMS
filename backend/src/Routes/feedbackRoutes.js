const express = require("express");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("../middlewares/authMiddleware");
const feedbackController = require("../controllers/feedbackController");

const router = express.Router();
const collaborationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many collaboration messages. Please wait before trying again." }
});

router.post("/", authMiddleware, feedbackController.createFeedback);
router.post("/collaboration", collaborationLimiter, feedbackController.submitCollaboration);

module.exports = router;
