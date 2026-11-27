const { Op, QueryTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const StorageUploadReservation = require("../models/StorageUploadReservation");
const objectStorage = require("./objectStorage");

const STORAGE_QUOTA_BYTES = 800 * 1000 * 1000;
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
            userId: String(userId)
        },
        ...(transaction ? { transaction } : {})
    };

    // Count all buckets in this Supabase project because Supabase's storage
    // allowance is shared by the project's buckets, not just this bucket.
    const [usage] = await sequelize.query(`
        SELECT
            COUNT(*)::BIGINT AS "objectCount",
            COALESCE(SUM(
                CASE
                    WHEN COALESCE(metadata->>'size', '') ~ '^[0-9]+$'
                    THEN (metadata->>'size')::BIGINT
                    ELSE 0
                END
            ), 0)::TEXT AS "usedBytes",
            COALESCE(SUM(
                CASE
                    WHEN bucket_id = :bucketName
                        AND split_part(name, '/', 1) = :userId
                        AND COALESCE(metadata->>'size', '') ~ '^[0-9]+$'
                    THEN (metadata->>'size')::BIGINT
                    ELSE 0
                END
            ), 0)::TEXT AS "userUsedBytes",
            COUNT(*) FILTER (
                WHERE bucket_id = :bucketName
                    AND split_part(name, '/', 1) = :userId
            )::BIGINT AS "userObjectCount"
        FROM storage.objects
    `, options);

    const [reservations] = await sequelize.query(`
        SELECT
            COALESCE(SUM(r."sizeBytes"), 0)::TEXT AS "reservedBytes"
        FROM "StorageUploadReservations" r
        WHERE r.status = 'pending'
            AND r."expiresAt" > NOW()
            AND NOT EXISTS (
                SELECT 1
                FROM storage.objects o
                WHERE o.bucket_id = :bucketName
                    AND o.name = r."objectKey"
            )
    `, options);

    const [userReservations] = await sequelize.query(`
        SELECT
            COALESCE(SUM(r."sizeBytes"), 0)::TEXT AS "userReservedBytes"
        FROM "StorageUploadReservations" r
        WHERE r.status = 'pending'
            AND r."userId" = :userId
            AND r."expiresAt" > NOW()
            AND NOT EXISTS (
                SELECT 1
                FROM storage.objects o
                WHERE o.bucket_id = :bucketName
                    AND o.name = r."objectKey"
            )
    `, options);

    return {
        usedBytes: bytesFrom(usage?.usedBytes),
        objectCount: bytesFrom(usage?.objectCount),
        userUsedBytes: bytesFrom(usage?.userUsedBytes),
        userObjectCount: bytesFrom(usage?.userObjectCount),
        reservedBytes: bytesFrom(reservations?.reservedBytes),
        userReservedBytes: bytesFrom(userReservations?.userReservedBytes)
    };
};

const getStorageUsage = async (userId) => {
    if (!objectStorage.isConfigured()) {
        const error = new Error("Supabase Storage is not configured.");
        error.code = "STORAGE_USAGE_UNAVAILABLE";
        throw error;
    }

    const usage = await readUsage(userId);
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
        // Serialise upload reservations so two simultaneous upload requests
        // cannot both consume the same remaining capacity.
        await sequelize.query("SELECT pg_advisory_xact_lock(:lockId)", {
            replacements: { lockId: QUOTA_LOCK_ID },
            transaction
        });

        const usage = await readUsage(userId, transaction);
        const requestedBytes = bytesFrom(sizeBytes);
        const accountedBytes = usage.usedBytes + usage.reservedBytes;

        if (accountedBytes + requestedBytes > STORAGE_QUOTA_BYTES) {
            const remainingBytes = Math.max(0, STORAGE_QUOTA_BYTES - accountedBytes);
            const error = new Error(
                remainingBytes > 0
                    ? `SmartCampus has ${Math.floor(remainingBytes / (1000 * 1000))} MB of free storage remaining. This file will exceed the 800 MB safety limit.`
                    : "SmartCampus has reached its 800 MB storage safety limit. Remove unused files before uploading more."
            );
            error.code = "STORAGE_QUOTA_EXCEEDED";
            throw error;
        }

        await StorageUploadReservation.create({
            userId,
            objectKey,
            sizeBytes: requestedBytes,
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
            // Keep the reservation for another attempt; never release quota
            // for an object that we failed to delete.
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
        // Download access must not fail just because an optional metric update
        // is unavailable.
        console.warn("Unable to record storage download:", error.message);
    }
};

module.exports = {
    STORAGE_QUOTA_BYTES,
    getStorageUsage,
    reserveStorageUpload,
    releaseStorageReservation,
    cleanupAbandonedUploads,
    recordStorageDownload
};
