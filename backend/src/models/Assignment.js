const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Assignment = sequelize.define("Assignment", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    title: {
        type: DataTypes.STRING,
        allowNull: false
    },

    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    dueDate: {
        type: DataTypes.DATE,
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

    workType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "assignment",
        validate: { isIn: [["assignment", "classwork"]] }
    },

    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }

}, {
    indexes: [
        { fields: ["courseId", "dueDate"] },
        { fields: ["dueDate"] }
    ]
});

module.exports = Assignment;