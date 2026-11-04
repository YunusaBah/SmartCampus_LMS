const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("AnnouncementReaction", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    announcementId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    emoji: { type: DataTypes.STRING(16), allowNull: false }
}, {
    indexes: [{
        unique: true,
        fields: ["announcementId", "userId"],
        name: "announcement_reaction_user_unique"
    }]
});
