const storageQuota = require("../utils/storageQuota");

exports.getUsage = async (req, res) => {
    try {
        await storageQuota.cleanupAbandonedUploads();
        const usage = await storageQuota.getStorageUsage(req.user.id);
        res.set("Cache-Control", "private, no-store");
        return res.json({
            ...usage,
            refreshedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Unable to calculate Supabase Storage usage:", error.message);
        return res.status(503).json({
            message: "Storage usage is temporarily unavailable. Uploads remain protected until capacity can be verified."
        });
    }
};
