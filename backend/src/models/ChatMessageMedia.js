const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

module.exports = sequelize.define("ChatMessageMedia", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    messageId: { type: DataTypes.UUID, allowNull: false, unique: true },
    contentType: { type: DataTypes.STRING(100), allowNull: false },
    data: { type: DataTypes.BLOB, allowNull: false }
}, {
    tableName: "ChatMessageMedia"
});
