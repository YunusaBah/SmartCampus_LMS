const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("Module", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
});
