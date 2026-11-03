const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

module.exports = sequelize.define("CalendarEvent", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    assessmentId: { type: DataTypes.INTEGER, allowNull: true },
    createdById: { type: DataTypes.INTEGER, allowNull: false },
    eventType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "event" },
    occurrenceDate: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "scheduled" },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    startsAt: { type: DataTypes.DATE, allowNull: false },
    endsAt: { type: DataTypes.DATE, allowNull: false }
}, {
    indexes: [{ fields: ["courseId", "startsAt"] }]
});
