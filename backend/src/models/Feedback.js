const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

module.exports = sequelize.define("Feedback", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.ENUM("student", "lecturer"), allowNull: false },
    type: { type: DataTypes.ENUM("product", "helpfulness"), allowNull: false },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 5, isInt: true }
    },
    comment: { type: DataTypes.TEXT, allowNull: true },
    topic: { type: DataTypes.STRING(120), allowNull: true },
    helpful: { type: DataTypes.BOOLEAN, allowNull: true }
}, {
    indexes: [
        { fields: ["userId", "createdAt"] },
        { fields: ["role", "createdAt"] }
    ]
});
