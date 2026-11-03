const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const uploadController = require("../controllers/uploadController");

const router = express.Router();

router.post("/sign", authMiddleware, uploadController.signUpload);

module.exports = router;
