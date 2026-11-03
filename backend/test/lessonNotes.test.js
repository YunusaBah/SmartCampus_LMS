process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const courseAccessPath = require.resolve("../src/utils/courseAccess");
require(courseAccessPath);
let courseAccessResult = { course: { id: 8 } };
require.cache[courseAccessPath].exports = async () => courseAccessResult;

const Lesson = require("../src/models/Lesson");
const LessonNote = require("../src/models/LessonNote");
const lessonController = require("../src/controllers/lessonController");

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

test("private material notes load only for the authenticated viewer", async () => {
    const originalFindByPk = Lesson.findByPk;
    const originalFindOne = LessonNote.findOne;
    let query;
    try {
        Lesson.findByPk = async () => ({ id: 17, courseId: 8 });
        LessonNote.findOne = async (options) => {
            query = options.where;
            return { content: "Remember this point." };
        };
        const res = response();
        await lessonController.getPrivateNote({
            params: { id: "17" },
            user: { id: 42, role: "student" }
        }, res);

        assert.deepEqual(query, { lessonId: 17, userId: 42 });
        assert.deepEqual(res.body, { note: "Remember this point." });
    } finally {
        Lesson.findByPk = originalFindByPk;
        LessonNote.findOne = originalFindOne;
    }
});

test("private material notes save with a unique lesson and viewer key", async () => {
    const originalFindByPk = Lesson.findByPk;
    const originalUpsert = LessonNote.upsert;
    let values;
    let options;
    try {
        Lesson.findByPk = async () => ({ id: 17, courseId: 8 });
        LessonNote.upsert = async (noteValues, upsertOptions) => {
            values = noteValues;
            options = upsertOptions;
        };
        const res = response();
        await lessonController.savePrivateNote({
            params: { id: "17" },
            user: { id: 42, role: "student" },
            body: { note: "Review this later." }
        }, res);

        assert.deepEqual(values, { lessonId: 17, userId: 42, content: "Review this later." });
        assert.deepEqual(options, { conflictFields: ["lessonId", "userId"] });
        assert.deepEqual(res.body, { message: "Private note saved", note: "Review this later." });
    } finally {
        Lesson.findByPk = originalFindByPk;
        LessonNote.upsert = originalUpsert;
    }
});

test("private material notes cannot be saved for inaccessible courses", async () => {
    const originalFindByPk = Lesson.findByPk;
    const originalUpsert = LessonNote.upsert;
    let upsertCalled = false;
    try {
        courseAccessResult = { status: 403, message: "Course access denied" };
        Lesson.findByPk = async () => ({ id: 17, courseId: 8 });
        LessonNote.upsert = async () => { upsertCalled = true; };
        const res = response();
        await lessonController.savePrivateNote({
            params: { id: "17" },
            user: { id: 42, role: "student" },
            body: { note: "Review this later." }
        }, res);

        assert.equal(res.statusCode, 403);
        assert.equal(upsertCalled, false);
    } finally {
        courseAccessResult = { course: { id: 8 } };
        Lesson.findByPk = originalFindByPk;
        LessonNote.upsert = originalUpsert;
    }
});
