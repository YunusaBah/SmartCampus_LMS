const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const uploadsDir = require("../utils/uploadsDirectory");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(8).toString("hex");
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, uniqueSuffix + ext);
    },
});

const allowedTypes = new Map([
    [".pdf", ["application/pdf"]],
    [".doc", ["application/msword", "application/octet-stream"]],
    [".docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"]],
    [".ppt", ["application/vnd.ms-powerpoint", "application/octet-stream"]],
    [".pptx", ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"]],
    [".xls", ["application/vnd.ms-excel", "application/octet-stream"]],
    [".xlsx", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]],
    [".txt", ["text/plain", "application/octet-stream"]],
    [".csv", ["text/csv", "application/vnd.ms-excel", "application/octet-stream"]],
    [".png", ["image/png"]],
    [".jpg", ["image/jpeg"]],
    [".jpeg", ["image/jpeg"]],
    [".gif", ["image/gif"]],
    [".webp", ["image/webp"]],
    [".zip", ["application/zip", "application/x-zip-compressed", "application/octet-stream"]]
]);

module.exports = multer({
    storage,
    limits: { fileSize: process.env.VERCEL ? 4 * 1024 * 1024 : 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = allowedTypes.get(path.extname(file.originalname).toLowerCase());
        if (!allowedMimeTypes || !allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error("Invalid file type"));
        }
        cb(null, true);
    }
});