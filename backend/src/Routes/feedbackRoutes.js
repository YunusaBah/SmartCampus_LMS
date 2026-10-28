const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const feedbackController = require("../controllers/feedbackController");

const router = express.Router();

router.post("/", authMiddleware, feedbackController.createFeedback);

module.exports = router;
