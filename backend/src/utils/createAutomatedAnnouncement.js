const Announcement = require("../models/Announcement");
const Enrollment = require("../models/Enrollment");
const createNotifications = require("./createNotifications");
const sequelize = require("../config/db");

const createAutomatedAnnouncement = async ({
    automaticKey,
    courseId,
    lecturerId,
    title,
    body,
    resourceType,
    resourceId
}) => sequelize.transaction(async (transaction) => {
    const [announcement, created] = await Announcement.findOrCreate({
        where: { automaticKey },
        defaults: {
            automaticKey,
            courseId,
            createdById: lecturerId,
            title,
            body
        },
        transaction
    });
    if (!created) return announcement;

    const enrollments = await Enrollment.findAll({
        where: { courseId },
        attributes: ["studentId"],
        transaction
    });
    const userIds = enrollments.map((enrollment) => enrollment.studentId);
    if (userIds.length) {
        await createNotifications({
            userIds,
            type: "announcement",
            title,
            body,
            resourceType,
            resourceId: resourceId || announcement.id,
            transaction
        });
    }
    return announcement;
});

module.exports = createAutomatedAnnouncement;
