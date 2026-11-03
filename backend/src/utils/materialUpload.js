const path = require("node:path");
const validateMaterialFile = require("./validateMaterialFile");
const objectStorage = require("./objectStorage");

module.exports = async (file, body, userId) => {
    if (file) {
        const metadata = await validateMaterialFile(file);
        return {
            fileUrl: `/uploads/${file.filename}`,
            fileName: path.basename(file.originalname),
            mimeType: metadata.mimeType,
            fileSize: metadata.fileSize
        };
    }

    if (!body.fileStorageKey) return null;
    return objectStorage.resolveMaterialUpload(body, userId);
};
