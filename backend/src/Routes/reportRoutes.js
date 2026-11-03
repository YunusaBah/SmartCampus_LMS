const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/roleMiddleware");
const reportController = require("../controllers/reportController");

router.post("/excel", authMiddleware, requireRole("lecturer"), reportController.exportExcel);

module.exports = router;
