process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const Course = require("../src/models/Course");
const Enrollment = require("../src/models/Enrollment");
const Lesson = require("../src/models/Lesson");
const Assignment = require("../src/models/Assignment");
const Submission = require("../src/models/Submission");
const Message = require("../src/models/Message");
const Notification = require("../src/models/Notification");
const { sequelize } = require("../src/config/db");
const lessonController = require("../src/controllers/lessonController");
const assignmentController = require("../src/controllers/assignmentController");
const lmsController = require("../src/controllers/lmsController");
const courseController = require("../src/controllers/courseController");
const { hasCoursePermission } = require("../src/utils/coursePermissions");

const originals = {
    courseFindByPk: Course.findByPk,
    courseFindOne: Course.findOne,
    courseFindAll: Course.findAll,
    enrollmentFindOne: Enrollment.findOne,
    enrollmentFindAll: Enrollment.findAll,
    lessonCreate: Lesson.create,
    assignmentCreate: Assignment.create,
    submissionFindByPk: Submission.findByPk,
    messageFindAll: Message.findAll,
    messageCreate: Message.create,
    notificationBulkCreate: Notification.bulkCreate,
    transaction: sequelize.transaction
};

test.afterEach(() => {
    Course.findByPk = originals.courseFindByPk;
    Course.findOne = originals.courseFindOne;
    Course.findAll = originals.courseFindAll;
    Enrollment.findOne = originals.enrollmentFindOne;
    Enrollment.findAll = originals.enrollmentFindAll;
    Lesson.create = originals.lessonCreate;
    Assignment.create = originals.assignmentCreate;
    Submission.findByPk = originals.submissionFindByPk;
    Message.findAll = originals.messageFindAll;
    Message.create = originals.messageCreate;
    Notification.bulkCreate = originals.notificationBulkCreate;
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

test("course permissions are granular and revoked permissions stop granting access", () => {
    const enrollment = {
        permissions: ["uploadMaterials", "messageLecturer"],
        canPostAnnouncements: false
    };
    assert.equal(hasCoursePermission(enrollment, "uploadMaterials"), true);
    assert.equal(hasCoursePermission(enrollment, "postAnnouncements"), false);
    assert.equal(hasCoursePermission(enrollment, "messageLecturer"), false);
    enrollment.permissions = [];
    assert.equal(hasCoursePermission(enrollment, "uploadMaterials"), false);
});

test("lecturer permission changes save role and rights and can revoke them", async () => {
    Course.findOne = async () => ({ id: 4 });
    const enrollment = {
        permissionRole: null,
        permissions: [],
        canPostAnnouncements: false,
        announcementRoleName: null,
        async save() {
            this.saved = true;
        }
    };
    Enrollment.findOne = async () => enrollment;
    const response = responseFor();

    await courseController.updateStudentCoursePermissions({
        params: { id: "4", studentId: "8" },
        body: {
            role: "student_assistant",
            permissions: ["uploadMaterials", "gradeAssignments"]
        },
        user: { id: 2, role: "lecturer" }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(enrollment.permissionRole, "student_assistant");
    assert.deepEqual(enrollment.permissions, ["uploadMaterials", "gradeAssignments"]);
    assert.equal(hasCoursePermission(enrollment, "gradeAssignments"), true);

    const revokeResponse = responseFor();
    await courseController.updateStudentCoursePermissions({
        params: { id: "4", studentId: "8" },
        body: { role: null, permissions: [] },
        user: { id: 2, role: "lecturer" }
    }, revokeResponse);

    assert.equal(revokeResponse.statusCode, 200);
    assert.equal(enrollment.permissionRole, null);
    assert.deepEqual(enrollment.permissions, []);
    assert.equal(hasCoursePermission(enrollment, "gradeAssignments"), false);
});

test("lecturer cannot grant the removed private-message permission", async () => {
    let courseLookupCalled = false;
    Course.findOne = async () => {
        courseLookupCalled = true;
        return { id: 4 };
    };
    const response = responseFor();

    await courseController.updateStudentCoursePermissions({
        params: { id: "4", studentId: "8" },
        body: { role: "student_assistant", permissions: ["messageLecturer"] },
        user: { id: 2, role: "lecturer" }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(courseLookupCalled, false);
});

test("lecturer student list includes each enrollment's saved permissions", async () => {
    let query = null;
    Course.findAll = async (options) => {
        query = options;
        return [{
            id: 4,
            title: "Course One",
            enrollments: [{
                createdAt: new Date("2026-10-01T00:00:00Z"),
                permissionRole: "student_assistant",
                permissions: ["uploadMaterials", "messageLecturer"],
                canPostAnnouncements: false,
                student: {
                    toJSON: () => ({ id: 8, fullName: "Student One", email: "student@example.com" })
                }
            }]
        }];
    };
    const response = responseFor();

    await courseController.getMyStudents({
        user: { id: 2, role: "lecturer" }
    }, response);

    assert.deepEqual(query.include[0].attributes, [
        "createdAt", "permissionRole", "permissions", "canPostAnnouncements"
    ]);
    assert.equal(response.body[0].permissionRole, "student_assistant");
    assert.deepEqual(response.body[0].permissions, ["uploadMaterials"]);
});

test("a student with material permission can add a resource to an enrolled course", async () => {
    Course.findByPk = async () => ({ id: 4, lecturerId: 2 });
    Enrollment.findOne = async () => ({ studentId: 8, courseId: 4, permissions: ["uploadMaterials"] });
    Lesson.create = async (values) => ({ toJSON: () => ({ id: 6, ...values }) });
    const response = responseFor();

    await lessonController.createLesson({
        body: {
            title: "Recommended reading",
            content: "",
            videoUrl: "https://example.com/book",
            courseId: "4"
        },
        user: { id: 8, role: "student" }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.lesson.videoUrl, "https://example.com/book");
});

test("a student without assignment permission cannot create course assignments", async () => {
    Course.findByPk = async () => ({ id: 4, lecturerId: 2 });
    Enrollment.findOne = async () => ({ studentId: 8, courseId: 4, permissions: [] });
    let created = false;
    Assignment.create = async () => {
        created = true;
    };
    const response = responseFor();

    await assignmentController.createAssignment({
        body: {
            title: "Practice work",
            description: "Complete the exercise",
            dueDate: "2026-11-01",
            courseId: "4"
        },
        user: { id: 8, role: "student" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.equal(created, false);
});

test("a student without message permission cannot message the lecturer", async () => {
    Course.findByPk = async () => ({ id: 4, lecturerId: 2 });
    Enrollment.findOne = async () => ({ studentId: 8, courseId: 4, permissions: [] });
    const response = responseFor();

    await lmsController.sendLecturerMessage({
        params: { courseId: "4" },
        body: { body: "Please clarify the assignment" },
        user: { id: 8, role: "student" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /not enabled private course messages/i);
});

test("legacy private-message permission no longer grants course messaging", async () => {
    Course.findByPk = async () => ({ id: 4, lecturerId: 2 });
    Enrollment.findOne = async () => ({ studentId: 8, courseId: 4, permissions: ["messageLecturer"] });
    const response = responseFor();

    await lmsController.sendLecturerMessage({
        params: { courseId: "4" },
        body: { body: "Please clarify the assignment" },
        user: { id: 8, role: "student" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /not enabled private course messages/i);
});

test("lecturer inbox excludes legacy private-message permissions", async () => {
    Course.findByPk = async () => ({ id: 4, lecturerId: 2 });
    Enrollment.findAll = async () => [
        { studentId: 8, permissions: ["messageLecturer"] },
        { studentId: 9, permissions: [] }
    ];
    Message.findAll = async () => [];
    const response = responseFor();

    await lmsController.listLecturerMessages({
        params: { courseId: "4" },
        user: { id: 2, role: "lecturer" }
    }, response);

    assert.deepEqual(response.body.students, []);
});

test("a student with grading permission cannot grade their own submission", async () => {
    Enrollment.findOne = async () => ({ permissions: ["gradeAssignments"] });
    Submission.findByPk = async () => ({
        id: 15,
        studentId: 8,
        assignment: { course: { id: 4, lecturerId: 2 } }
    });
    const response = responseFor();

    await assignmentController.gradeSubmission({
        params: { id: "15" },
        body: { grade: "A" },
        user: { id: 8, role: "student" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /cannot grade your own/i);
});
