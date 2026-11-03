const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("ChatReadState", {
    profileId: { type: DataTypes.UUID, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    lastReadAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    indexes: [{ unique: true, fields: ["profileId", "courseId"] }]
});
