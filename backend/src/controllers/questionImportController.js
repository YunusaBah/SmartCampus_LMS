const { extractQuestionsFromDocument } = require("../utils/extractQuestionsFromDocument");
const objectStorage = require("../utils/objectStorage");

exports.extractQuestions = async (req, res) => {
    let file = req.file;
    let storageKey;
    if (!file && req.body.fileStorageKey) {
        if (objectStorage.validateStorageKey(req.body.fileStorageKey, req.user.id)) {
            storageKey = req.body.fileStorageKey;
        }
        try {
            const uploaded = await objectStorage.resolveMaterialUpload(req.body, req.user.id);
            file = {
                buffer: uploaded.buffer,
                originalname: uploaded.fileName,
                size: uploaded.fileSize
            };
        } catch (error) {
            if (error.message.startsWith("The uploaded file") ||
                error.message.startsWith("Choose a valid file name") ||
                error.message === "File contents do not match a supported material file type") {
                return res.status(400).json({ message: error.message });
            }
            console.error("Unable to read quiz import document from storage:", error.message);
            return res.status(503).json({ message: "File storage is temporarily unavailable." });
        }
    }
    if (!file) return res.status(400).json({ message: "Choose a supported document to upload." });
    try {
        const result = await extractQuestionsFromDocument(file);
        res.json(result);
    } catch (error) {
        const knownClientError = error.message.startsWith("Unsupported") ||
            error.message.includes("corrupted") ||
            error.message.includes("empty") ||
            error.message.includes("limit") ||
            error.message.includes("UTF-8") ||
            error.message.includes("No questions");
        if (knownClientError) return res.status(422).json({ message: error.message });
        console.error("Question document extraction failed:", error.message);
        return res.status(422).json({ message: "This document could not be processed. Check the file and try again." });
    } finally {
        if (storageKey) {
            try {
                await objectStorage.remove(storageKey);
            } catch (error) {
                console.error("Failed to remove processed quiz import document:", error.message);
            }
        }
    }
};
