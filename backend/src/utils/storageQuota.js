const { Op, QueryTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const StorageUploadReservation = require("../models/StorageUploadReservation");
const objectStorage = require("./objectStorage");

const STORAGE_QUOTA_BYTES = 800 * 1000 * 1000;
const MAX_BUCKET_OBJECT_BYTES = 20 * 1024 * 1024;
const RESERVATION_TTL_HOURS = 24;
const QUOTA_LOCK_ID = 749203881;

const bytesFrom = (value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const readUsage = async (userId, transaction) => {
    const options = {
        type: QueryTypes.SELECT,
        replacements: {
            bucketName: objectStorage.bucketName,
            userId: Number(userId)
        },
        ...(transaction ? { transaction } : {})
    };

    // The Supabase Storage allowance is shared by all buckets in this project.
    const usageSql = [
        "SELECT",
        "    COUNT(*)::BIGINT AS object_count,",
        "    COUNT(*) FILTER (WHERE COALESCE(metadata->>'size', '') !~ '^[0-9]+$')::BIGINT AS unknown_size_object_count,",
        "    COALESCE(SUM(CASE WHEN COALESCE(metadata->>'size', '') ~ '^[0-9]+$' THEN (metadata->>'size')::BIGINT ELSE 0 END), 0)::TEXT AS used_bytes,",
        "    COALESCE(SUM(CASE WHEN bucket_id = :bucketName AND split_part(name, '/', 1) = :userId AND COALESCE(metadata->>'size', '') ~ '^[0-9]+$' THEN (metadata->>'size')::BIGINT ELSE 0 END), 0)::TEXT AS user_used_bytes,",
        "    COUNT(*) FILTER (WHERE bucket_id = :bucketName AND split_part(name, '/', 1) = :userId)::BIGINT AS user_object_count",
        "FROM storage.objects"
    ].join("\n");
    const [usage] = await sequelize.query(usageSql, options);

    const reservationSql = [
        "SELECT COALESCE(SUM(r.\"reservedBytes\"), 0)::TEXT AS reserved_bytes",
        "FROM \"StorageUploadReservations\" r",
        "WHERE r.status = 'pending'",
        "  AND r.\"expiresAt\" > NOW()",
        "  AND NOT EXISTS (",
        "      SELECT 1 FROM storage.objects o",
        "      WHERE o.bucket_id = :bucketName AND o.name = r.\"objectKey\"",
        "  )"
    ].join("\n");
    const [reservations] = await sequelize.query(reservationSql, options);

    const userReservationSql = [
        "SELECT COALESCE(SUM(r.\"reservedBytes\"), 0)::TEXT AS user_reserved_bytes",
        "FROM \"StorageUploadReservations\" r",
        "WHERE r.status = 'pending'",
        "  AND r.\"userId\" = :userId",
        "  AND r.\"expiresAt\" > NOW()",
        "  AND NOT EXISTS (",
        "      SELECT 1 FROM storage.objects o",
        "      WHERE o.bucket_id = :bucketName AND o.name = r.\"objectKey\"",
        "  )"
    ].join("\n");
    const [userReservations] = await sequelize.query(userReservationSql, options);

    return {
        usedBytes: bytesFrom(usage?.used_bytes),
        objectCount: bytesFrom(usage?.object_count),
        unknownSizeObjectCount: bytesFrom(usage?.unknown_size_object_count),
        userUsedBytes: bytesFrom(usage?.user_used_bytes),
        userObjectCount: bytesFrom(usage?.user_object_count),
        reservedBytes: bytesFrom(reservations?.reserved_bytes),
        userReservedBytes: bytesFrom(userReservations?.user_reserved_bytes)
    };
};

const getStorageUsage = async (userId) => {
    if (!objectStorage.isConfigured()) {
        const error = new Error("Supabase Storage is not configured.");
        error.code = "STORAGE_USAGE_UNAVAILABLE";
        throw error;
    }

    const usage = await readUsage(userId);
    if (usage.unknownSizeObjectCount > 0) {
        const error = new Error("One or more Supabase Storage objects have no readable size metadata.");
        error.code = "STORAGE_USAGE_UNAVAILABLE";
        throw error;
    }

    const accountedBytes = usage.usedBytes + usage.reservedBytes;
    return {
        provider: "Supabase Storage",
        bucket: objectStorage.bucketName,
        quotaBytes: STORAGE_QUOTA_BYTES,
        usedBytes: usage.usedBytes,
        reservedBytes: usage.reservedBytes,
        accountedBytes,
        availableBytes: Math.max(0, STORAGE_QUOTA_BYTES - accountedBytes),
        percentUsed: Math.min(100, Math.round((accountedBytes / STORAGE_QUOTA_BYTES) * 100)),
        overLimit: accountedBytes > STORAGE_QUOTA_BYTES,
        objectCount: usage.objectCount,
        userUsedBytes: usage.userUsedBytes,
        userReservedBytes: usage.userReservedBytes,
        userObjectCount: usage.userObjectCount
    };
};

const reserveStorageUpload = async ({ userId, objectKey, sizeBytes, purpose }) => {
    if (!objectStorage.isConfigured()) {
        const error = new Error("Supabase Storage is not configured.");
        error.code = "STORAGE_USAGE_UNAVAILABLE";
        throw error;
    }

    await cleanupAbandonedUploads();

    return sequelize.transaction(async (transaction) => {
        // Serialize reservations so concurrent uploads cannot overbook the cap.
        await sequelize.query("SELECT pg_advisory_xact_lock(:lockId)", {
            replacements: { lockId: QUOTA_LOCK_ID },
            transaction
        });

        const usage = await readUsage(userId, transaction);
        if (usage.unknownSizeObjectCount > 0) {
            const error = new Error("Storage usage cannot be verified because an existing object has no readable size.");
            error.code = "STORAGE_USAGE_UNAVAILABLE";
            throw error;
        }

        const requestedBytes = bytesFrom(sizeBytes);
        const accountedBytes = usage.usedBytes + usage.reservedBytes;

        // Reserve the full bucket maximum until the uploaded object is checked.
        if (accountedBytes + MAX_BUCKET_OBJECT_BYTES > STORAGE_QUOTA_BYTES) {
            const error = new Error(
                "SmartCampus has insufficient free storage remaining for another upload. Remove unused files first."
            );
            error.code = "STORAGE_QUOTA_EXCEEDED";
            throw error;
        }

        await StorageUploadReservation.create({
            userId,
            objectKey,
            sizeBytes: requestedBytes,
            reservedBytes: MAX_BUCKET_OBJECT_BYTES,
            purpose,
            status: "pending",
            expiresAt: new Date(Date.now() + RESERVATION_TTL_HOURS * 60 * 60 * 1000)
        }, { transaction });
    });
};

const releaseStorageReservation = async (objectKey) => {
    await StorageUploadReservation.destroy({ where: { objectKey, status: "pending" } });
};

const cleanupAbandonedUploads = async (limit = 10) => {
    const expired = await StorageUploadReservation.findAll({
        where: {
            status: "pending",
            expiresAt: { [Op.lt]: new Date() }
        },
        attributes: ["id", "objectKey"],
        order: [["expiresAt", "ASC"]],
        limit
    });

    let removed = 0;
    for (const reservation of expired) {
        try {
            await objectStorage.remove(reservation.objectKey);
            removed += 1;
        } catch (error) {
            // Keep the reservation for another attempt; do not free quota on failure.
            console.warn("Abandoned storage upload cleanup will retry:", error.message);
        }
    }
    return removed;
};

const recordStorageDownload = async (objectKey) => {
    try {
        await StorageUploadReservation.increment("downloadCount", {
            by: 1,
            where: { objectKey, status: "active" }
        });
        await StorageUploadReservation.update(
            { lastDownloadedAt: new Date() },
            { where: { objectKey, status: "active" } }
        );
    } catch (error) {
        // Download access must not fail because an optional metric update is unavailable.
        console.warn("Unable to record storage download:", error.message);
    }
};

module.exports = {
    STORAGE_QUOTA_BYTES,
    MAX_BUCKET_OBJECT_BYTES,
    getStorageUsage,
    reserveStorageUpload,
    releaseStorageReservation,
    cleanupAbandonedUploads,
    recordStorageDownload
};
