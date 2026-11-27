const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const StorageUploadReservation = sequelize.define("StorageUploadReservation", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    objectKey: { type: DataTypes.STRING(180), allowNull: false },
    sizeBytes: { type: DataTypes.BIGINT, allowNull: false },
    reservedBytes: { type: DataTypes.BIGINT, allowNull: false },
    purpose: { type: DataTypes.STRING(32), allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "pending" },
    expiresAt: { type: DataTypes.DATE, allowNull: true },
    downloadCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastDownloadedAt: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: "StorageUploadReservations",
    indexes: [
        { unique: true, fields: ["objectKey"], name: "storage_upload_key_unique" },
        { fields: ["status", "expiresAt"], name: "storage_upload_status_expiry" },
        { fields: ["userId", "createdAt"], name: "storage_upload_user_created" }
    ]
});

module.exports = StorageUploadReservation;
