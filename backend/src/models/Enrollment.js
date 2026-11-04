const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Enrollment = sequelize.define("Enrollment", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    studentId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    canPostAnnouncements: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },

    announcementRoleName: {
        type: DataTypes.STRING(80),
        allowNull: true
    },

    permissionRole: {
        type: DataTypes.ENUM("student_assistant", "class_representative"),
        allowNull: true
    },

    permissions: {
        type: DataTypes.JSON,
        allowNull: false
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ["studentId", "courseId"]
        },
        { fields: ["courseId", "studentId"] }
    ]
});

module.exports = Enrollment;
