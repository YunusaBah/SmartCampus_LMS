const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("ChatProfile", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    username: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: { is: /^[a-z0-9_]{3,20}$/ }
    },
    fullName: { type: DataTypes.STRING(255), allowNull: false },
    avatarUrl: { type: DataTypes.TEXT, allowNull: true },
    about: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    phoneVisibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "private_contacts" },
    emailVisibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "private_contacts" },
    matNumberVisibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "private_contacts" }
});
