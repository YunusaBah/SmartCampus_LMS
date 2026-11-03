process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const Assignment = require("../src/models/Assignment");
const Enrollment = require("../src/models/Enrollment");
const Quiz = require("../src/models/Quiz");
const QuizResult = require("../src/models/QuizResult");
const QuizAssessment = require("../src/models/QuizAssessment");
const QuizAttempt = require("../src/models/QuizAttempt");
const QuizAttemptAnswer = require("../src/models/QuizAttemptAnswer");
const Submission = require("../src/models/Submission");
const { sequelize } = require("../src/config/db");
const assignmentController = require("../src/controllers/assignmentController");
const assessmentController = require("../src/controllers/assessmentController");
const dashboardController = require("../src/controllers/dashboardController");

const originals = {
    assignmentFindAll: Assignment.findAll,
    assignmentCount: Assignment.count,
    enrollmentCount: Enrollment.count,
    enrollmentFindAll: Enrollment.findAll,
    enrollmentFindOne: Enrollment.findOne,
    quizAssessmentFindByPk: QuizAssessment.findByPk,
    quizAttemptFindByPk: QuizAttempt.findByPk,
    quizAttemptFindOne: QuizAttempt.findOne,
    quizFindAll: Quiz.findAll,
    quizAttemptAnswerFindAll: QuizAttemptAnswer.findAll,
    quizResultFindOne: QuizResult.findOne,
    submissionFindAll: Submission.findAll,
    submissionCount: Submission.count,
    transaction: sequelize.transaction
};

afterEach(() => {
    Assignment.findAll = originals.assignmentFindAll;
    Assignment.count = originals.assignmentCount;
    Enrollment.count = originals.enrollmentCount;
    Enrollment.findAll = originals.enrollmentFindAll;
    Enrollment.findOne = originals.enrollmentFindOne;
    QuizAssessment.findByPk = originals.quizAssessmentFindByPk;
    QuizAttempt.findByPk = originals.quizAttemptFindByPk;
    QuizAttempt.findOne = originals.quizAttemptFindOne;
    Quiz.findAll = originals.quizFindAll;
    QuizAttemptAnswer.findAll = originals.quizAttemptAnswerFindAll;
    QuizResult.findOne = originals.quizResultFindOne;
    Submission.findAll = originals.submissionFindAll;
    Submission.count = originals.submissionCount;
    sequelize.transaction = originals.transaction;
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

test("student assignment APIs exclude grade and feedback fields", async () => {
    Enrollment.findAll = async () => [{ courseId: 3, permissions: [], canPostAnnouncements: false }];
    let assignmentOptions;
    Assignment.findAll = async (options) => {
        assignmentOptions = options;
        return [];
    };
    const assignmentsResponse = response();
    await assignmentController.getMyAssignments({ user: { id: 8 } }, assignmentsResponse);

    const studentSubmissionAttributes = assignmentOptions.include.find((include) => include.as === "submissions").attributes;
    assert.equal(studentSubmissionAttributes.includes("grade"), false);
    assert.equal(studentSubmissionAttributes.includes("feedback"), false);

    let submissionsOptions;
    Submission.findAll = async (options) => {
        submissionsOptions = options;
        return [];
    };
    const submissionsResponse = response();
    await assignmentController.getMySubmissions({ user: { id: 8 } }, submissionsResponse);
    assert.equal(submissionsOptions.attributes.includes("grade"), false);
    assert.equal(submissionsOptions.attributes.includes("feedback"), false);
});

test("student dashboard statistics do not expose grade averages", async () => {
    Enrollment.findAll = async () => [];
    Enrollment.count = async () => 0;
    Submission.count = async () => 0;
    QuizResult.findOne = async () => ({ average: 0.9 });
    const res = response();

    await dashboardController.getStats({ user: { id: 8, role: "student" } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal("quizAverage" in res.body, false);
});

test("completed timed-assessment attempt lookup hides marks and answer correctness", async () => {
    QuizAssessment.findByPk = async () => ({ id: 4, courseId: 3 });
    Enrollment.findOne = async () => ({ studentId: 8, courseId: 3 });
    const completedAttempt = {
        id: 12,
        assessmentId: 4,
        startedAt: new Date("2026-01-01T10:00:00Z"),
        deadlineAt: new Date("2026-01-01T11:00:00Z"),
        submittedAt: new Date("2026-01-01T10:30:00Z"),
        score: 9,
        totalMarks: 10,
        answers: { 5: "B" }
    };
    QuizAttempt.findOne = async ({ where }) => Object.hasOwn(where, "submittedAt") ? null : completedAttempt;

    const res = response();
    await assessmentController.getMyAttempt({
        params: { id: "4" },
        user: { id: 8, role: "student" }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.body.attempt).sort(), [
        "assessmentId", "deadlineAt", "id", "startedAt", "submittedAt"
    ]);
    assert.deepEqual(res.body.questions, []);
});

test("timed-assessment submission acknowledges completion without returning marks", async () => {
    const attempt = {
        id: 12,
        studentId: 8,
        assessmentId: 4,
        deadlineAt: new Date(Date.now() + 60_000),
        submittedAt: null,
        answers: { 5: "B" },
        async save() {}
    };
    QuizAttempt.findByPk = async () => attempt;
    Quiz.findAll = async () => [{
        id: 5,
        correctAnswer: "B",
        questionType: "MCQ",
        marks: 10
    }];
    QuizAttemptAnswer.findAll = async () => [];
    sequelize.transaction = (callback) => callback({ LOCK: { UPDATE: "UPDATE" } });

    const res = response();
    await assessmentController.submitAttempt({
        params: { attemptId: "12" },
        body: {},
        user: { id: 8, role: "student" }
    }, res);

    assert.deepEqual(res.body, { message: "Assessment submitted" });
    assert.equal("score" in res.body, false);
    assert.equal("results" in res.body, false);
});
