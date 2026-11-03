process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const Feedback = require("../src/models/Feedback");
const feedbackController = require("../src/controllers/feedbackController");
const emailService = require("../src/utils/emailService");

const originalCreate = Feedback.create;
const originalSendAppEmail = emailService.sendAppEmail;

afterEach(() => {
    Feedback.create = originalCreate;
    emailService.sendAppEmail = originalSendAppEmail;
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

test("product feedback emails the personal recipient and stores the rating and required message", async () => {
    let saved = null;
    let email = null;
    Feedback.create = async (values) => { saved = values; };
    emailService.sendAppEmail = async (values) => { email = values; };
    const response = responseFor();

    await feedbackController.createFeedback({
        user: { id: 12, role: "lecturer" },
        body: { type: "product", rating: 4, comment: "  Good experience  " }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(email.to, "bahy1878@gmail.com");
    assert.match(email.subject, /4\/5 stars/);
    assert.match(email.text, /Good experience/);
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
    let sent = false;
    Feedback.create = async () => { saved = true; };
    emailService.sendAppEmail = async () => { sent = true; };
    const response = responseFor();

    await feedbackController.createFeedback({
        user: { id: 7, role: "student" },
        body: { type: "product", rating: 6 }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(saved, false);
    assert.equal(sent, false);
});

test("product feedback requires a written message", async () => {
    let sent = false;
    emailService.sendAppEmail = async () => { sent = true; };
    const response = responseFor();

    await feedbackController.createFeedback({
        user: { id: 7, role: "student" },
        body: { type: "product", rating: 5, comment: " " }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(sent, false);
});

test("product feedback reports email delivery failures instead of claiming success", async () => {
    let saved = false;
    Feedback.create = async () => { saved = true; };
    emailService.sendAppEmail = async () => {
        const error = new Error("Email delivery is not configured. Missing settings: SMTP_PASSWORD.");
        error.code = "EMAIL_NOT_CONFIGURED";
        throw error;
    };
    const response = responseFor();

    await feedbackController.createFeedback({
        user: { id: 7, role: "student" },
        body: { type: "product", rating: 5, comment: "Helpful app." }
    }, response);

    assert.equal(response.statusCode, 503);
    assert.match(response.body.message, /SMTP_PASSWORD/);
    assert.equal(saved, false);
});

test("email configuration errors identify missing setting names without exposing credentials", async () => {
    const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
    const previousValues = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "465",
        SMTP_SECURE: "true",
        SMTP_USER: "sender@example.com",
        SMTP_PASSWORD: "",
        SMTP_FROM: "sender@example.com"
    });

    try {
        await assert.rejects(
            emailService.sendAppEmail({ to: "recipient@example.com", subject: "Test", text: "Test" }),
            (error) => {
                assert.equal(error.code, "EMAIL_NOT_CONFIGURED");
                assert.match(error.message, /SMTP_PASSWORD/);
                assert.doesNotMatch(error.message, /sender@example\.com/);
                return true;
            }
        );
    } finally {
        keys.forEach((key) => {
            if (previousValues[key] === undefined) delete process.env[key];
            else process.env[key] = previousValues[key];
        });
    }
});

test("collaboration messages go to the school email and include reply details", async () => {
    let email = null;
    emailService.sendAppEmail = async (values) => { email = values; };
    const response = responseFor();

    await feedbackController.submitCollaboration({
        body: { name: "Yunusa", email: "sender@example.com", message: "Let's collaborate." }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(email.to, "yb22423255@utg.edu.gm");
    assert.equal(email.replyTo, "sender@example.com");
    assert.match(email.text, /Let's collaborate\./);
});
