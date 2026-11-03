const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("AnnouncementView", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    announcementId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    viewedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    indexes: [{
        unique: true,
        fields: ["announcementId", "userId"],
        name: "announcement_view_user_unique"
    }]
});
