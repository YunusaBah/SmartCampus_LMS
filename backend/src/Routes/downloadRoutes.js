const express = require("express");
const router = express.Router();

const downloadController = require("../controllers/downloadController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/:resourceType/:id/archive", authMiddleware, downloadController.listArchive);
router.get("/:resourceType/:id/archive-entry", authMiddleware, downloadController.downloadArchiveEntry);
router.get("/:resourceType/:id/preview", authMiddleware, downloadController.previewOfficeDocument);
router.get("/:resourceType/:id", authMiddleware, downloadController.download);

module.exports = router;
