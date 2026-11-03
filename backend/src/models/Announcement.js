const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("Announcement", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    createdById: { type: DataTypes.INTEGER, allowNull: false },
    automaticKey: { type: DataTypes.STRING(255), allowNull: true },
    authorRoleName: { type: DataTypes.STRING(80), allowNull: true }
}, {
    indexes: [{ fields: ["courseId", "createdAt"] }]
});
