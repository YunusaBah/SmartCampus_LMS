const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("Message", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    senderId: { type: DataTypes.INTEGER, allowNull: false },
    recipientId: { type: DataTypes.INTEGER, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true }
});
