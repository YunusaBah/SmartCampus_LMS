process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const Feedback = require("../src/models/Feedback");
const feedbackController = require("../src/controllers/feedbackController");

const originalCreate = Feedback.create;

afterEach(() => {
    Feedback.create = originalCreate;
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

test("product feedback stores the authenticated user and role with an optional comment", async () => {
    let saved = null;
    Feedback.create = async (values) => { saved = values; };
    const response = responseFor();

    await feedbackController.createFeedback({
        user: { id: 12, role: "lecturer" },
        body: { type: "product", rating: 4, comment: "  Good experience  " }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.deepEqual(saved, {
        userId: 12,
        role: "lecturer",
        type: "product",
        rating: 4,
        comment: "Good experience"
    });
});

test("helpfulness feedback validates the article response and records the role", async () => {
    let saved = null;
    Feedback.create = async (values) => { saved = values; };
    const response = responseFor();

    await feedbackController.createFeedback({
        user: { id: 7, role: "student" },
        body: { type: "helpfulness", rating: 1, topic: "assignments-student", helpful: false }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.deepEqual(saved, {
        userId: 7,
        role: "student",
        type: "helpfulness",
        rating: 1,
        topic: "assignments-student",
        helpful: false
    });
});

test("feedback rejects ratings outside the 1-to-5 scale without saving", async () => {
    let saved = false;
    Feedback.create = async () => { saved = true; };
    const response = responseFor();

    await feedbackController.createFeedback({
        user: { id: 7, role: "student" },
        body: { type: "product", rating: 6 }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(saved, false);
});
