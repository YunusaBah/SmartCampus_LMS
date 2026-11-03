const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const QuizResult = sequelize.define("QuizResult", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    studentId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    quizId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    selectedAnswer: {
        type: DataTypes.STRING,
        allowNull: false
    },

    score: {
        type: DataTypes.INTEGER,
        allowNull: false
    }

}, {
    indexes: [
        { fields: ["studentId", "createdAt"] },
        { fields: ["quizId"] }
    ]
});

module.exports = QuizResult;