const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const validateMaterialFile = require("./validateMaterialFile");

const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "smartcampus-files";
const maxMaterialSize = 20 * 1024 * 1024;
const maxChatMediaSize = 5 * 1024 * 1024;
const materialTypes = new Map([
    [".pdf", "application/pdf"],
    [".doc", "application/msword"],
    [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    [".ppt", "application/vnd.ms-powerpoint"],
    [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    [".xls", "application/vnd.ms-excel"],
    [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    [".txt", "text/plain"],
    [".csv", "text/csv"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".gif", "image/gif"],
    [".webp", "image/webp"],
    [".zip", "application/zip"]
]);
let client;

const isConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const getClient = () => {
    if (!isConfigured()) {
        throw new Error("Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }
    if (!client) {
        client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }
    return client;
};

const validateStorageKey = (key, userId) => typeof key === "string" &&
    key.length <= 160 &&
    key.startsWith(`${userId}/`) &&
    /^[1-9]\d*\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/i.test(key);

const signUpload = async ({ userId, fileName, fileSize, purpose, mediaType }) => {
    if (typeof fileName !== "string" || fileName.length > 255 || /[\u0000-\u001f\u007f]/.test(fileName)) {
        throw new Error("Choose a valid file name.");
    }
    const extension = path.extname(fileName).toLowerCase();
    const storageExtension = extension || (purpose === "chat-media" && mediaType === "file" ? ".bin" : "");
    let contentType;
    let maxSize = maxMaterialSize;

    if (purpose === "chat-media") {
        maxSize = maxChatMediaSize;
        if (mediaType === "voice" && mediaTypeFromName(fileName, mediaType)) {
            contentType = mediaTypeFromName(fileName, mediaType);
        } else if (mediaType === "image" && mediaTypeFromName(fileName, mediaType)) {
            contentType = mediaTypeFromName(fileName, mediaType);
        } else if (mediaType === "file") {
            contentType = "application/octet-stream";
        } else {
            throw new Error("Unsupported chat attachment format.");
        }
    } else {
        contentType = materialTypes.get(extension);
        if (!contentType) throw new Error("Unsupported file type.");
        if (purpose === "question-import" && ![".pdf", ".docx", ".pptx", ".txt", ".xlsx", ".csv"].includes(extension)) {
            throw new Error("Unsupported quiz document format.");
        }
    }

    if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > maxSize) {
        throw new Error(`Files must be ${maxSize / 1024 / 1024} MB or smaller.`);
    }

    const key = `${userId}/${crypto.randomUUID()}${storageExtension}`;
    const { data, error } = await getClient().storage.from(bucketName)
        .createSignedUploadUrl(key, { upsert: false });
    if (error) throw new Error(`Unable to prepare file upload: ${error.message}`);

    return { bucket: bucketName, key, token: data.token, contentType };
};

const mediaTypeFromName = (fileName, mediaType) => {
    const extension = path.extname(fileName).toLowerCase();
    const types = mediaType === "voice"
        ? new Map([[".webm", "audio/webm"], [".m4a", "audio/mp4"], [".mp4", "audio/mp4"],
            [".ogg", "audio/ogg"], [".mp3", "audio/mpeg"], [".wav", "audio/wav"]])
        : new Map([[".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"],
            [".webp", "image/webp"], [".gif", "image/gif"]]);
    return types.get(extension);
};

const download = async (key) => {
    const { data, error } = await getClient().storage.from(bucketName).download(key);
    if (error) throw new Error(`Unable to read stored file: ${error.message}`);
    const buffer = Buffer.from(await data.arrayBuffer());
    if (!buffer.length || buffer.length > maxMaterialSize) {
        throw new Error("Stored file is empty or exceeds the 20 MB limit.");
    }
    return buffer;
};

const resolveMaterialUpload = async (body, userId) => {
    const key = body.fileStorageKey;
    if (!validateStorageKey(key, userId)) {
        throw new Error("The uploaded file is invalid or does not belong to your account.");
    }
    try {
        const fileName = typeof body.fileName === "string" ? path.basename(body.fileName) : "";
        if (!fileName || fileName.length > 255) throw new Error("Choose a valid file name.");
        const buffer = await download(key);
        if (body.fileSize !== undefined && Number(body.fileSize) !== buffer.length) {
            throw new Error("The uploaded file size did not match the selected file.");
        }
        const metadata = await validateMaterialFile({ buffer, originalname: fileName, size: buffer.length });
        return {
            fileUrl: `/uploads/${key}`,
            fileName,
            mimeType: metadata.mimeType,
            fileSize: metadata.fileSize,
            buffer
        };
    } catch (error) {
        try {
            await remove(key);
        } catch (cleanupError) {
            console.error("Failed to remove invalid uploaded file:", cleanupError.message);
        }
        throw error;
    }
};

const resolveChatUpload = async (body, userId) => {
    const key = body.fileStorageKey;
    if (!validateStorageKey(key, userId)) {
        throw new Error("The uploaded attachment is invalid or does not belong to your account.");
    }
    const fileName = typeof body.fileName === "string" ? path.basename(body.fileName) : "";
    if (!fileName || fileName.length > 255) throw new Error("Choose a valid attachment name.");
    const buffer = await download(key);
    if (buffer.length > maxChatMediaSize ||
        (body.fileSize !== undefined && Number(body.fileSize) !== buffer.length)) {
        throw new Error("The chat attachment exceeds the 5 MB limit or has an invalid size.");
    }
    const type = mediaTypeFromName(fileName, body.mediaType) || "application/octet-stream";
    return { key, file: { buffer, originalname: fileName, mimetype: type, size: buffer.length } };
};

const signedDownloadUrl = async (key, fileName) => {
    const { data, error } = await getClient().storage.from(bucketName)
        .createSignedUrl(key, 60, { download: path.basename(fileName || "download") });
    if (error) throw new Error(`Unable to create a file download link: ${error.message}`);
    return data.signedUrl;
};

const remove = async (key) => {
    const { error } = await getClient().storage.from(bucketName).remove([key]);
    if (error) throw new Error(`Unable to remove stored file: ${error.message}`);
};

module.exports = {
    bucketName,
    isConfigured,
    signUpload,
    validateStorageKey,
    resolveMaterialUpload,
    resolveChatUpload,
    download,
    signedDownloadUrl,
    remove
};
