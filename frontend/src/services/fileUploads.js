import { createClient } from "@supabase/supabase-js";
import API from "./api";

const materialLimit = 20 * 1024 * 1024;
const chatMediaLimit = 5 * 1024 * 1024;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useObjectStorage = import.meta.env.PROD || import.meta.env.VITE_SUPABASE_STORAGE_UPLOADS === "true";

let storageClient;

const getStorageClient = () => {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("File storage is not configured for this site.");
    }
    if (!storageClient) {
        storageClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
    }
    return storageClient;
};

export const appendUploadedFile = async (formData, file, context) => {
    if (!file) return;
    const maxSize = context.purpose === "chat-media" ? chatMediaLimit : materialLimit;
    if (file.size < 1 || file.size > maxSize) {
        throw new Error(`Files must be ${maxSize / 1024 / 1024} MB or smaller.`);
    }

    if (!useObjectStorage) {
        let fieldName = "file";
        if (context.purpose === "chat-media") {
            fieldName = context.mediaType === "voice" ? "voice" : "attachment";
        } else if (context.purpose === "course") {
            fieldName = "contentFile";
        }
        formData.append(fieldName, file);
        return;
    }
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("File storage is not configured. Contact the site administrator.");
    }

    const { data: signedUpload } = await API.post("/uploads/sign", {
        ...context,
        fileName: file.name,
        fileSize: file.size
    });
    const { error } = await getStorageClient().storage
        .from(signedUpload.bucket)
        .uploadToSignedUrl(signedUpload.key, signedUpload.token, file, {
            contentType: signedUpload.contentType,
            upsert: false
        });
    if (error) throw new Error(`File upload failed: ${error.message}`);

    formData.append("fileStorageKey", signedUpload.key);
    formData.append("fileName", file.name);
    formData.append("fileSize", String(file.size));
    if (context.purpose === "chat-media") {
        formData.append("fileMimeType", signedUpload.contentType);
        formData.append("mediaType", context.mediaType);
    }
};
