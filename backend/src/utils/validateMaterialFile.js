const path = require("path");
const fs = require("fs/promises");
const { TextDecoder } = require("util");

const types = new Map([
    [".zip", { mimeType: "application/zip", verify: isZip }],
    [".pdf", { mimeType: "application/pdf", verify: (buffer) => buffer.subarray(0, 5).toString() === "%PDF-" }],
    [".doc", { mimeType: "application/msword", verify: isOleDocument }],
    [".ppt", { mimeType: "application/vnd.ms-powerpoint", verify: isOleDocument }],
    [".xls", { mimeType: "application/vnd.ms-excel", verify: isOleDocument }],
    [".docx", { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", verify: isZip }],
    [".pptx", { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", verify: isZip }],
    [".xlsx", { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", verify: isZip }],
    [".txt", { mimeType: "text/plain", verify: isText }],
    [".csv", { mimeType: "text/csv", verify: isText }],
    [".png", { mimeType: "image/png", verify: (buffer) =>
        buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
    [".jpg", { mimeType: "image/jpeg", verify: (buffer) => buffer.length >= 3 &&
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
    [".jpeg", { mimeType: "image/jpeg", verify: (buffer) => buffer.length >= 3 &&
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
    [".gif", { mimeType: "image/gif", verify: (buffer) =>
        ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString()) }],
    [".webp", { mimeType: "image/webp", verify: (buffer) =>
        buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" &&
        buffer.subarray(8, 12).toString() === "WEBP" }]
]);

function isOleDocument(buffer) {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    );
}

function isZip(buffer) {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b &&
        [0x03, 0x05, 0x07].includes(buffer[2]) && [0x04, 0x06, 0x08].includes(buffer[3]);
}

function isText(buffer) {
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        return !buffer.includes(0);
    } catch {
        return false;
    }
}

module.exports = async (file) => {
    if (!file) {
        throw new Error("Material file could not be read");
    }
    const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : await fs.readFile(file.path);
    const extension = path.extname(file.originalname || "").toLowerCase();
    const type = types.get(extension);
    if (!type || !type.verify(buffer)) {
        throw new Error("File contents do not match a supported material file type");
    }
    return { mimeType: type.mimeType, fileSize: file.size };
};
