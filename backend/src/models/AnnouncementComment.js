const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("AnnouncementComment", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    announcementId: { type: DataTypes.INTEGER, allowNull: false },
    authorId: { type: DataTypes.INTEGER, allowNull: false },
    parentCommentId: { type: DataTypes.INTEGER, allowNull: true },
    body: { type: DataTypes.STRING(2000), allowNull: false }
}, {
    indexes: [
        { fields: ["announcementId", "createdAt"], name: "announcement_comments_post_created" },
        { fields: ["parentCommentId"], name: "announcement_comments_parent" }
    ]
});
