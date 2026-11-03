process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const Quiz = require("../src/models/Quiz");
const QuizResult = require("../src/models/QuizResult");
const Enrollment = require("../src/models/Enrollment");
const { sequelize } = require("../src/config/db");
const quizController = require("../src/controllers/quizController");

const originals = {
    quizFindByPk: Quiz.findByPk,
    resultFindOne: QuizResult.findOne,
    resultCreate: QuizResult.create,
    enrollmentFindOne: Enrollment.findOne,
    transaction: sequelize.transaction
};

test.afterEach(() => {
    Quiz.findByPk = originals.quizFindByPk;
    QuizResult.findOne = originals.resultFindOne;
    QuizResult.create = originals.resultCreate;
    Enrollment.findOne = originals.enrollmentFindOne;
    sequelize.transaction = originals.transaction;
});

test("quick quiz answer can be submitted only once", async () => {
    let savedResult = null;
    let createCount = 0;
    Quiz.findByPk = async () => ({ id: 5, courseId: 2, assessmentId: null, correctAnswer: "B" });
    Enrollment.findOne = async () => ({ studentId: 8, courseId: 2 });
    QuizResult.findOne = async () => savedResult;
    QuizResult.create = async (values) => {
        createCount += 1;
        savedResult = { id: 11, ...values };
        return savedResult;
    };
    sequelize.transaction = (callback) => callback({ LOCK: { UPDATE: "UPDATE" } });

    const submit = async () => {
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
        await quizController.submitQuiz({
            body: { quizId: 5, selectedAnswer: "B" },
            user: { id: 8, role: "student" }
        }, response);
        return response;
    };

    const first = await submit();
    const second = await submit();

    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.body, { message: "Quiz submitted" });
    assert.equal("score" in first.body, false);
    assert.equal("passed" in first.body, false);
    assert.equal("result" in first.body, false);
    assert.equal(second.statusCode, 409);
    assert.match(second.body.message, /already submitted.*final/i);
    assert.equal(createCount, 1);
});
