const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

module.exports = sequelize.define("ChatMessage", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    courseId: { type: DataTypes.INTEGER, allowNull: true },
    senderProfileId: { type: DataTypes.UUID, allowNull: false },
    receiverProfileId: { type: DataTypes.UUID, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    type: {
        type: DataTypes.ENUM("text", "emoji", "gif", "sticker", "voice", "image", "file", "contact"),
        allowNull: false,
        defaultValue: "text"
    },
    mentions: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    replyTo: { type: DataTypes.UUID, allowNull: true },
    deliveredAt: { type: DataTypes.DATE, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
});
