const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("QuizAttemptAnswer", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    attemptId: { type: DataTypes.INTEGER, allowNull: false },
    questionId: { type: DataTypes.INTEGER, allowNull: false },
    answer: { type: DataTypes.TEXT, allowNull: false },
    marksAwarded: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    feedback: { type: DataTypes.TEXT, allowNull: true }
}, {
    indexes: [{ unique: true, fields: ["attemptId", "questionId"], name: "quiz_attempt_question_unique" }]
});
