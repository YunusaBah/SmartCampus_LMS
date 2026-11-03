process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const Enrollment = require("../src/models/Enrollment");
const Lesson = require("../src/models/Lesson");
const LessonProgress = require("../src/models/LessonProgress");
const enrollmentController = require("../src/controllers/enrollmentController");
const lmsController = require("../src/controllers/lmsController");

const originalEnrollmentDestroy = Enrollment.destroy;
const originalEnrollmentFindOne = Enrollment.findOne;
const originalLessonFindByPk = Lesson.findByPk;
const originalProgressUpsert = LessonProgress.upsert;

afterEach(() => {
    Enrollment.destroy = originalEnrollmentDestroy;
    Enrollment.findOne = originalEnrollmentFindOne;
    Lesson.findByPk = originalLessonFindByPk;
    LessonProgress.upsert = originalProgressUpsert;
});

const response = () => ({
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

test("leaving a course removes only the student's enrollment", async () => {
    let destroyOptions;
    Enrollment.destroy = async (options) => {
        destroyOptions = options;
        return 1;
    };
    const res = response();

    await enrollmentController.leaveCourse({
        params: { courseId: "23" },
        user: { id: 8, role: "student" }
    }, res);

    assert.deepEqual(destroyOptions.where, { studentId: 8, courseId: 23 });
    assert.equal(res.statusCode, 200);
    assert.match(res.body.message, /submissions, grades, and reading progress have been preserved/);
});

test("leaving an invalid or unenrolled course does not change records", async () => {
    Enrollment.destroy = async () => 0;
    const invalid = response();
    await enrollmentController.leaveCourse({
        params: { courseId: "invalid" },
        user: { id: 8, role: "student" }
    }, invalid);
    assert.equal(invalid.statusCode, 400);

    const notEnrolled = response();
    await enrollmentController.leaveCourse({
        params: { courseId: "23" },
        user: { id: 8, role: "student" }
    }, notEnrolled);
    assert.equal(notEnrolled.statusCode, 404);
});

test("students can save validated reading positions only for enrolled-course lessons", async () => {
    let upsertValues;
    let upsertOptions;
    Lesson.findByPk = async () => ({ id: 4, courseId: 23 });
    Enrollment.findOne = async () => ({ studentId: 8, courseId: 23 });
    LessonProgress.upsert = async (values, options) => {
        upsertValues = values;
        upsertOptions = options;
    };
    const res = response();

    await lmsController.updateLessonReadingProgress({
        params: { lessonId: "4" },
        body: { readingPosition: 642, readingProgress: 37 },
        user: { id: 8, role: "student" }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(upsertValues.studentId, 8);
    assert.equal(upsertValues.lessonId, 4);
    assert.equal(upsertValues.readingPosition, 642);
    assert.equal(upsertValues.readingProgress, 37);
    assert.deepEqual(upsertOptions.fields, ["readingPosition", "readingProgress", "lastReadAt"]);
});

test("reading progress rejects invalid values and un-enrolled students", async () => {
    Lesson.findByPk = async () => ({ id: 4, courseId: 23 });
    Enrollment.findOne = async () => null;
    const unEnrolled = response();
    await lmsController.updateLessonReadingProgress({
        params: { lessonId: "4" },
        body: { readingPosition: 10, readingProgress: 10 },
        user: { id: 8, role: "student" }
    }, unEnrolled);
    assert.equal(unEnrolled.statusCode, 403);

    Enrollment.findOne = async () => ({ studentId: 8, courseId: 23 });
    const invalid = response();
    await lmsController.updateLessonReadingProgress({
        params: { lessonId: "4" },
        body: { readingPosition: -1, readingProgress: 101 },
        user: { id: 8, role: "student" }
    }, invalid);
    assert.equal(invalid.statusCode, 400);
});
