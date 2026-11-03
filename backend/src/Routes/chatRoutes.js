const express = require("express");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const authMiddleware = require("../middlewares/authMiddleware");
const chatAccessMiddleware = require("../middlewares/chatAccessMiddleware");
const chatController = require("../controllers/chatController");

const router = express.Router();
const chatMediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter(req, file, callback) {
        const contentType = file.mimetype.split(";")[0].toLowerCase();
        file.mimetype = contentType;
        const allowed = new Set([
            "audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav",
            "image/jpeg", "image/png", "image/webp", "image/gif"
        ]);
        callback(allowed.has(contentType) || file.fieldname === "attachment" ? null : new Error("Unsupported media format"),
            allowed.has(contentType) || file.fieldname === "attachment");
    }
});
const receiveChatMedia = (req, res, next) => chatMediaUpload.fields([
    { name: "voice", maxCount: 1 },
    { name: "attachment", maxCount: 1 }
])(req, res, (error) => {
    if (error) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        message: error.code === "LIMIT_FILE_SIZE"
            ? "Chat attachments must be 5 MB or smaller."
            : "Unsupported chat attachment."
    });
    req.file = req.files?.voice?.[0] || req.files?.attachment?.[0];
    next();
});
const messageLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (req) => String(req.user.id),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Chat is limited to 30 messages per minute. Please wait before sending again." }
});
const typingLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    keyGenerator: (req) => String(req.user.id),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Typing updates are temporarily limited. Please wait a moment." }
});
const profileSearchLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    keyGenerator: (req) => String(req.user.id),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Profile search is temporarily limited. Please try again shortly." }
});
const mediaSearchLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    keyGenerator: (req) => String(req.user.id),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Media search is temporarily limited. Please try again shortly." }
});
const realtimeTokenLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 12,
    keyGenerator: (req) => String(req.user.id),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Realtime token refresh is temporarily limited." }
});

router.use(authMiddleware, chatAccessMiddleware);
router.get("/me", chatController.getMe);
router.get("/events", chatController.streamEvents);
router.get("/realtime-token", realtimeTokenLimiter, chatController.getRealtimeToken);
router.get("/profile/settings", chatController.getProfileSettings);
router.get("/profile/username-availability", profileSearchLimiter, chatController.checkUsernameAvailability);
router.put("/profile", chatController.saveProfile);
router.put("/profile/visibility", chatController.updateProfileVisibility);
router.get("/profile/private-contact/:profileId", chatController.getPrivateContactApproval);
router.put("/profile/private-contact/:profileId", chatController.updatePrivateContactApproval);
router.get("/coursemates", chatController.listCoursemates);
router.get("/profiles/search", profileSearchLimiter, chatController.searchProfiles);
router.get("/profiles/:profileId", chatController.getSharedProfile);
router.get("/media/search", mediaSearchLimiter, chatController.searchMedia);
router.get("/saved", chatController.listSaved);
router.get("/courses/:courseId/messages", chatController.listCourseMessages);
router.get("/private/:profileId/messages", chatController.listPrivateMessages);
router.get("/messages/:id/media", chatController.getMessageMedia);
router.post("/typing", typingLimiter, chatController.sendTyping);
router.post("/messages", messageLimiter, receiveChatMedia, chatController.sendMessage);
router.post("/messages/:id/save", chatController.toggleSaved);
router.delete("/messages/:id/save", chatController.removeSaved);
router.delete("/messages/:id/hide", chatController.hideMessage);
router.patch("/messages/:id/read", chatController.markRead);
router.post("/messages/:id/reactions", chatController.toggleReaction);

module.exports = router;
