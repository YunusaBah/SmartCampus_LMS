const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const storageController = require("../controllers/storageController");

router.get("/usage", authMiddleware, storageController.getUsage);

module.exports = router;
