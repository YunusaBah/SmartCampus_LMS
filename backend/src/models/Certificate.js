const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("Certificate", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    certificateCode: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    issuedAt: { type: DataTypes.DATE, allowNull: false }
}, {
    indexes: [{ unique: true, fields: ["studentId", "courseId"] }]
});
