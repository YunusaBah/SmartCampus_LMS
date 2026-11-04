const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

module.exports = sequelize.define("ChatHiddenMessage", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    profileId: { type: DataTypes.UUID, allowNull: false },
    messageId: { type: DataTypes.UUID, allowNull: false }
}, {
    indexes: [{ unique: true, fields: ["profileId", "messageId"] }]
});
