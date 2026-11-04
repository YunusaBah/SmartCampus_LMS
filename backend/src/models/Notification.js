const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("Notification", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(40), allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    resourceType: { type: DataTypes.STRING(40), allowNull: true },
    resourceId: { type: DataTypes.INTEGER, allowNull: true },
    readAt: { type: DataTypes.DATE, allowNull: true }
}, {
    indexes: [{ fields: ["userId", "readAt", "createdAt"] }]
});
