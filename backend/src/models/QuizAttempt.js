const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("QuizAttempt", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    assessmentId: { type: DataTypes.INTEGER, allowNull: false },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    deadlineAt: { type: DataTypes.DATE, allowNull: false },
    submittedAt: { type: DataTypes.DATE, allowNull: true },
    answers: { type: DataTypes.JSON, allowNull: false },
    score: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    totalQuestions: { type: DataTypes.INTEGER, allowNull: true },
    totalMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    theoryPending: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
    indexes: [{ fields: ["studentId", "assessmentId", "submittedAt"] }]
});
