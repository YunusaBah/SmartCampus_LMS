const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("AuditLog", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    actorId: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING(100), allowNull: false },
    entityType: { type: DataTypes.STRING(50), allowNull: false },
    entityId: { type: DataTypes.INTEGER, allowNull: false },
    oldValues: { type: DataTypes.JSON, allowNull: true },
    newValues: { type: DataTypes.JSON, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    timestamps: false,
    indexes: [
        { name: "audit_logs_entity_created", fields: ["entityType", "entityId", "createdAt"] },
        { name: "audit_logs_actor_created", fields: ["actorId", "createdAt"] }
    ],
    hooks: {
        beforeUpdate: () => {
            throw new Error("Audit log entries are append-only");
        },
        beforeDestroy: () => {
            throw new Error("Audit log entries are append-only");
        },
        beforeBulkUpdate: () => {
            throw new Error("Audit log entries are append-only");
        },
        beforeBulkDestroy: () => {
            throw new Error("Audit log entries are append-only");
        }
    }
});
