const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("AnnouncementCommentReaction", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    commentId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false }
}, {
    indexes: [{
        unique: true,
        fields: ["commentId", "userId"],
        name: "announcement_comment_reaction_user_unique"
    }]
});
