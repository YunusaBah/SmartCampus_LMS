const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Course = sequelize.define("Course", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    contentFileUrl: { type: DataTypes.STRING, allowNull: true },
    contentFileName: { type: DataTypes.STRING, allowNull: true },
    lecturerId: { type: DataTypes.INTEGER, allowNull: false },
    departmentId: { type: DataTypes.INTEGER, allowNull: true },
    academicCode: { type: DataTypes.STRING(50), allowNull: true },
    category: { type: DataTypes.STRING(100), allowNull: true },
    status: { type: DataTypes.ENUM("active", "archived"), allowNull: false, defaultValue: "active" },
    enrollmentEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate: { type: DataTypes.DATEONLY, allowNull: true },
    classDays: { type: DataTypes.JSON, allowNull: true },
    classStartTime: { type: DataTypes.STRING(5), allowNull: true },
    classEndTime: { type: DataTypes.STRING(5), allowNull: true },
    classTimeZone: { type: DataTypes.STRING(100), allowNull: true },
    classCode: { type: DataTypes.STRING(8), unique: true }
}, {
    indexes: [{ fields: ["lecturerId", "createdAt"] }]
});

module.exports = Course;