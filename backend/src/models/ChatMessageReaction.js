const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("ChatMessageReaction", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    messageId: { type: DataTypes.UUID, allowNull: false },
    profileId: { type: DataTypes.UUID, allowNull: false },
    emoji: { type: DataTypes.STRING(16), allowNull: false }
}, {
    indexes: [{
        unique: true,
        fields: ["messageId", "profileId", "emoji"],
        name: "chat_message_reaction_unique"
    }]
});
