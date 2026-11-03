const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Quiz = sequelize.define("Quiz", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    question: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    optionA: {
        type: DataTypes.STRING,
        allowNull: true
    },

    optionB: {
        type: DataTypes.STRING,
        allowNull: true
    },

    optionC: {
        type: DataTypes.STRING,
        allowNull: true
    },

    optionD: {
        type: DataTypes.STRING,
        allowNull: true
    },

    correctAnswer: {
        type: DataTypes.STRING,
        allowNull: true
    },

    questionType: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "MCQ"
    },

    marks: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 1
    },

    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    assessmentId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }

});

module.exports = Quiz;