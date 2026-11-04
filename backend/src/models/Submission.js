const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Submission = sequelize.define("Submission", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    studentId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    assignmentId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    fileUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },

    fileName: {
        type: DataTypes.STRING,
        allowNull: true
    },

    answerText: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    grade: {
        type: DataTypes.STRING,
        defaultValue: "Pending"
    },

    feedback: {
        type: DataTypes.TEXT,
        allowNull: true
    }

}, {
    indexes: [
        { fields: ["studentId", "createdAt"] },
        { fields: ["assignmentId", "createdAt"] },
        { fields: ["assignmentId", "grade"] }
    ]
});

module.exports = Submission;