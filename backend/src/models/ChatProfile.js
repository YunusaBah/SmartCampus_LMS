const { DataTypes } = require("sequelize");
const sequelize = require("../config/db").sequelize;

module.exports = sequelize.define("ChatProfile", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    username: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: { len: [1, 20], notEmpty: true }
    },
    fullName: { type: DataTypes.STRING(255), allowNull: false },
    avatarUrl: { type: DataTypes.TEXT, allowNull: true },
    about: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    phoneVisibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "private_contacts" },
    emailVisibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "private_contacts" },
    matNumberVisibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "private_contacts" }
});
