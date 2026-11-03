const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const LessonNote = sequelize.define("LessonNote", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    lessonId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
    }
}, {
    indexes: [{
        unique: true,
        fields: ["lessonId", "userId"],
        name: "lesson_notes_user_unique"
    }]
});

module.exports = LessonNote;
