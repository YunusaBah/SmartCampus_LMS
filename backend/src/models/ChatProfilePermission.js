const { DataTypes } = require("sequelize");
const sequelize = require("../config/db").sequelize;

module.exports = sequelize.define("ChatProfilePermission", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    profileId: { type: DataTypes.UUID, allowNull: false },
    viewerProfileId: { type: DataTypes.UUID, allowNull: false },
    canViewPhone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canViewContactDetails: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
    indexes: [{ unique: true, fields: ["profileId", "viewerProfileId"], name: "chat_profile_viewer_unique" }]
});
