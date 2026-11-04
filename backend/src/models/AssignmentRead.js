const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("AssignmentRead", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    assignmentId: { type: DataTypes.INTEGER, allowNull: false },
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    indexes: [{
        unique: true,
        fields: ["assignmentId", "studentId"],
        name: "assignment_read_student_unique"
    }]
});
