const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("LessonProgress", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    lessonId: { type: DataTypes.INTEGER, allowNull: false },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    readingPosition: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    readingProgress: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
    lastReadAt: { type: DataTypes.DATE, allowNull: true }
}, {
    indexes: [{ unique: true, fields: ["studentId", "lessonId"] }]
});
