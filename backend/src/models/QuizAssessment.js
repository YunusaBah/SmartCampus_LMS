const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("QuizAssessment", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    instructions: { type: DataTypes.TEXT, allowNull: true },
    timeLimitMinutes: { type: DataTypes.INTEGER, allowNull: false },
    maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    courseId: { type: DataTypes.INTEGER, allowNull: false }
});
