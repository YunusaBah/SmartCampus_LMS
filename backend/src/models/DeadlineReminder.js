const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("DeadlineReminder", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    assignmentId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    window: { type: DataTypes.STRING(10), allowNull: false }
}, {
    indexes: [{
        unique: true,
        fields: ["assignmentId", "userId", "window"],
        name: "deadline_reminders_once_per_window"
    }]
});
