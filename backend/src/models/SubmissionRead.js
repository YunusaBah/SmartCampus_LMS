const { DataTypes } = require("sequelize");
const sequelize = require("../config/db").sequelize;

module.exports = sequelize.define("SubmissionRead", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    submissionId: { type: DataTypes.INTEGER, allowNull: false },
    lecturerId: { type: DataTypes.INTEGER, allowNull: false },
    viewedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    indexes: [{
        unique: true,
        fields: ["submissionId", "lecturerId"],
        name: "submission_read_lecturer_unique"
    }]
});
