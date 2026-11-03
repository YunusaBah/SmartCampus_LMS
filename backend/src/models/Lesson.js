const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Lesson = sequelize.define("Lesson", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    title: {
        type: DataTypes.STRING,
        allowNull: false
    },

    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    videoUrl: {
        type: DataTypes.STRING(2048),
        allowNull: true
    },

    fileName: {
        type: DataTypes.STRING
    },

    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    mimeType: {
        type: DataTypes.STRING(127),
        allowNull: true
    },

    fileSize: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    uploadedById: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    fileUrl: {
        type: DataTypes.STRING
    },

    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    moduleId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    orderIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }

});

module.exports = Lesson;