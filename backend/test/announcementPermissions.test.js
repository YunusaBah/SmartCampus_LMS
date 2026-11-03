process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const Course = require("../src/models/Course");
const Enrollment = require("../src/models/Enrollment");
const Announcement = require("../src/models/Announcement");
const AnnouncementReaction = require("../src/models/AnnouncementReaction");
const AnnouncementView = require("../src/models/AnnouncementView");
const AnnouncementComment = require("../src/models/AnnouncementComment");
const AnnouncementCommentReaction = require("../src/models/AnnouncementCommentReaction");
const CalendarEvent = require("../src/models/CalendarEvent");
const User = require("../src/models/User");
const { sequelize } = require("../src/config/db");
const lmsController = require("../src/controllers/lmsController");

const originals = {
    courseFindByPk: Course.findByPk,
    enrollmentFindOne: Enrollment.findOne,
    enrollmentFindAll: Enrollment.findAll,
    announcementCreate: Announcement.create,
    announcementFindByPk: Announcement.findByPk,
    reactionCreate: AnnouncementReaction.create,
    reactionFindOne: AnnouncementReaction.findOne,
    viewFindOrCreate: AnnouncementView.findOrCreate,
    commentCreate: AnnouncementComment.create,
    commentFindByPk: AnnouncementComment.findByPk,
    commentReactionFindOne: AnnouncementCommentReaction.findOne,
    commentReactionCreate: AnnouncementCommentReaction.create,
    userFindByPk: User.findByPk,
    calendarEventCreate: CalendarEvent.create,
    transaction: sequelize.transaction
};

test.afterEach(() => {
    Course.findByPk = originals.courseFindByPk;
    Enrollment.findOne = originals.enrollmentFindOne;
    Enrollment.findAll = originals.enrollmentFindAll;
    Announcement.create = originals.announcementCreate;
    Announcement.findByPk = originals.announcementFindByPk;
    AnnouncementReaction.create = originals.reactionCreate;
    AnnouncementReaction.findOne = originals.reactionFindOne;
    AnnouncementView.findOrCreate = originals.viewFindOrCreate;
    AnnouncementComment.create = originals.commentCreate;
    AnnouncementComment.findByPk = originals.commentFindByPk;
    AnnouncementCommentReaction.findOne = originals.commentReactionFindOne;
    AnnouncementCommentReaction.create = originals.commentReactionCreate;
    User.findByPk = originals.userFindByPk;
    CalendarEvent.create = originals.calendarEventCreate;
    sequelize.transaction = originals.transaction;
});

const responseFor = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test("student without lecturer permission cannot post course announcements", async () => {
    let created = false;
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3, canPostAnnouncements: false });
    Announcement.create = async () => {
        created = true;
    };
    const response = responseFor();

    await lmsController.createAnnouncement({
        params: { courseId: "3" },
        body: { title: "Student announcement", body: "Message" },
        user: { id: 7, role: "student" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.equal(created, false);
});

test("student with lecturer permission can post an announcement in that course", async () => {
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({
        studentId: 7,
        courseId: 3,
        canPostAnnouncements: true,
        announcementRoleName: "Class Rep"
    });
    Enrollment.findAll = async () => [];
    sequelize.transaction = (callback) => callback({});
    Announcement.create = async (values) => ({ id: 12, ...values, toJSON() { return this; } });
    const response = responseFor();

    await lmsController.createAnnouncement({
        params: { courseId: "3" },
        body: { title: "Course update", body: "Message" },
        user: { id: 7, role: "student" }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.title, "Course update");
    assert.equal(response.body.createdById, 7);
    assert.equal(response.body.authorRoleName, "Class Rep");
});

test("student with a permission flag but no assigned role cannot post", async () => {
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3, canPostAnnouncements: true });
    let created = false;
    Announcement.create = async () => {
        created = true;
    };
    const response = responseFor();

    await lmsController.createAnnouncement({
        params: { courseId: "3" },
        body: { title: "Course update", body: "Message" },
        user: { id: 7, role: "student" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.equal(created, false);
});

test("opening an announcement records one student view receipt", async () => {
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3 });
    let query = null;
    AnnouncementView.findOrCreate = async (values) => {
        query = values;
        return [{ viewedAt: new Date("2026-01-01T00:00:00Z") }];
    };
    const response = responseFor();

    await lmsController.markAnnouncementViewed({
        params: { id: "12" },
        user: { id: 7, role: "student" }
    }, response);

    assert.deepEqual(query.where, { announcementId: 12, userId: 7 });
    assert.ok(response.body.viewedAt);
});

test("announcement reactions accept only the available positive emoji set", async () => {
    let createdReaction = null;
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3 });
    AnnouncementReaction.findOne = async () => null;
    AnnouncementReaction.create = async (values) => {
        createdReaction = values;
        return values;
    };
    const allowedResponse = responseFor();

    await lmsController.setAnnouncementReaction({
        params: { id: "12" },
        body: { emoji: "🎉" },
        user: { id: 7, role: "student" }
    }, allowedResponse);
    assert.equal(allowedResponse.statusCode, 200);
    assert.equal(createdReaction.emoji, "🎉");

    const rejectedResponse = responseFor();
    await lmsController.setAnnouncementReaction({
        params: { id: "12" },
        body: { emoji: "😡" },
        user: { id: 7, role: "student" }
    }, rejectedResponse);
    assert.equal(rejectedResponse.statusCode, 400);
});

test("selecting another announcement emoji updates the stored reaction", async () => {
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3 });
    const existingReaction = {
        emoji: "👍",
        saved: false,
        async save() {
            this.saved = true;
        }
    };
    AnnouncementReaction.findOne = async () => existingReaction;
    const response = responseFor();

    await lmsController.setAnnouncementReaction({
        params: { id: "12" },
        body: { emoji: "🎉" },
        user: { id: 7, role: "student" }
    }, response);

    assert.equal(existingReaction.emoji, "🎉");
    assert.equal(existingReaction.saved, true);
    assert.equal(response.body.reaction, existingReaction);
});

test("enrolled students can comment on course announcements", async () => {
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3 });
    AnnouncementComment.create = async (values) => ({
        ...values,
        id: 41,
        toJSON() { return this; }
    });
    User.findByPk = async () => ({ id: 7, fullName: "Student", role: "student" });
    const response = responseFor();

    await lmsController.createAnnouncementComment({
        params: { id: "12" },
        body: { body: "Thank you for the update." },
        user: { id: 7, role: "student" }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.announcementId, 12);
    assert.equal(response.body.parentCommentId, null);
    assert.equal(response.body.author.fullName, "Student");
});

test("comment replies must belong to the same announcement and be top-level", async () => {
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3 });
    AnnouncementComment.findByPk = async () => ({
        id: 40,
        announcementId: 12,
        parentCommentId: 39
    });
    let created = false;
    AnnouncementComment.create = async () => { created = true; };
    const response = responseFor();

    await lmsController.createAnnouncementComment({
        params: { id: "12" },
        body: { body: "Reply", parentCommentId: 40 },
        user: { id: 7, role: "student" }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(created, false);
});

test("enrolled students cannot reply to announcement comments", async () => {
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3 });
    AnnouncementComment.findByPk = async () => ({
        id: 40,
        announcementId: 12,
        parentCommentId: null
    });
    let created = false;
    AnnouncementComment.create = async () => { created = true; };
    const response = responseFor();

    await lmsController.createAnnouncementComment({
        params: { id: "12" },
        body: { body: "Student reply", parentCommentId: 40 },
        user: { id: 7, role: "student" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.equal(created, false);
});

test("the course lecturer can reply to a top-level announcement comment", async () => {
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    AnnouncementComment.findByPk = async () => ({
        id: 40,
        announcementId: 12,
        parentCommentId: null
    });
    AnnouncementComment.create = async (values) => ({
        ...values,
        id: 41,
        toJSON() { return this; }
    });
    User.findByPk = async () => ({ id: 10, fullName: "Lecturer", role: "lecturer" });
    const response = responseFor();

    await lmsController.createAnnouncementComment({
        params: { id: "12" },
        body: { body: "Thanks for your comment.", parentCommentId: 40 },
        user: { id: 10, role: "lecturer" }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.parentCommentId, 40);
    assert.equal(response.body.author.fullName, "Lecturer");
});

test("students who are not enrolled cannot comment on an announcement", async () => {
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => null;
    let created = false;
    AnnouncementComment.create = async () => { created = true; };
    const response = responseFor();

    await lmsController.createAnnouncementComment({
        params: { id: "12" },
        body: { body: "Not enrolled" },
        user: { id: 8, role: "student" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.equal(created, false);
});

test("course participants can toggle a like on an announcement comment", async () => {
    AnnouncementComment.findByPk = async () => ({ id: 41, announcementId: 12 });
    Announcement.findByPk = async () => ({ id: 12, courseId: 3 });
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    Enrollment.findOne = async () => ({ studentId: 7, courseId: 3 });
    let created = null;
    AnnouncementCommentReaction.findOne = async () => null;
    AnnouncementCommentReaction.create = async (values) => { created = values; };
    const response = responseFor();

    await lmsController.setAnnouncementCommentReaction({
        params: { id: "41" },
        user: { id: 7, role: "student" }
    }, response);

    assert.deepEqual(created, { commentId: 41, userId: 7 });
    assert.deepEqual(response.body, { liked: true });
});

test("no-school calendar events require a description before scheduling", async () => {
    Course.findByPk = async () => ({ id: 3, lecturerId: 10 });
    let created = false;
    CalendarEvent.create = async () => { created = true; };
    sequelize.transaction = async () => {
        throw new Error("A calendar event without details must not be persisted");
    };
    const response = responseFor();

    await lmsController.createCalendarEvent({
        params: { courseId: "3" },
        body: {
            eventType: "no-school",
            title: "No school",
            startsAt: "2026-11-03T09:00:00.000Z",
            endsAt: "2026-11-03T10:00:00.000Z"
        },
        user: { id: 10, role: "lecturer" }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(created, false);
});
