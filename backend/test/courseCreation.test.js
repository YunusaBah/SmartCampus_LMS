process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const Course = require("../src/models/Course");
const Lesson = require("../src/models/Lesson");
const AuditLog = require("../src/models/AuditLog");
const { sequelize } = require("../src/config/db");
const courseController = require("../src/controllers/courseController");

const originalCourseCreate = Course.create;
const originalCourseFindOne = Course.findOne;
const originalLessonCreate = Lesson.create;
const originalAuditLogCreate = AuditLog.create;
const originalTransaction = sequelize.transaction;

afterEach(() => {
    Course.create = originalCourseCreate;
    Course.findOne = originalCourseFindOne;
    Lesson.create = originalLessonCreate;
    AuditLog.create = originalAuditLogCreate;
    sequelize.transaction = originalTransaction;
});

test("lecturer can create a course without a description or course material", async () => {
    let createdCourse;
    Course.findOne = async () => null;
    Course.create = async (data) => {
        createdCourse = data;
        return {
            ...data,
            id: 21,
            toJSON() {
                return { ...this };
            }
        };
    };
    Lesson.create = async () => assert.fail("Course creation must not create a course material");
    AuditLog.create = async () => ({});
    sequelize.transaction = async (callback) => callback({});

    const response = {
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
    };

    await courseController.createCourse({
        user: { id: 7 },
        body: {
            title: "Test course",
            classDays: "[1,3]",
            classStartTime: "09:00",
            classEndTime: "10:00",
            classTimeZone: "UTC"
        }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(createdCourse.description, "");
    assert.equal(createdCourse.lecturerId, 7);
});

test("courses automatically capture their creation timestamp", () => {
    assert.equal(Course.options.timestamps, true);
    assert.ok(Course.rawAttributes.createdAt);
});
