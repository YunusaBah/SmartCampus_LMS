const fs = require("node:fs/promises");
const path = require("node:path");
const uploadsDirectory = require("./uploadsDirectory");
const objectStorage = require("./objectStorage");

const objectKeyFor = (fileUrl) => {
    if (typeof fileUrl !== "string" || !fileUrl.startsWith("/uploads/")) return null;
    const key = fileUrl.slice("/uploads/".length);
    const ownerId = key.split("/")[0];
    return objectStorage.validateStorageKey(key, ownerId) ? key : null;
};

const removeStoredUpload = async (fileUrl) => {
    const key = objectKeyFor(fileUrl);
    if (key) {
        await objectStorage.remove(key);
        return;
    }
    if (typeof fileUrl !== "string" || !fileUrl.startsWith("/uploads/")) return;
    try {
        await fs.unlink(path.join(uploadsDirectory, path.basename(fileUrl)));
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
};

module.exports = { objectKeyFor, removeStoredUpload };
