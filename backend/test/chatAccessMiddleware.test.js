process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/User");
const chatAccessMiddleware = require("../src/middlewares/chatAccessMiddleware");

const originalFindByPk = User.findByPk;

afterEach(() => {
    User.findByPk = originalFindByPk;
});

const makeResponse = () => ({
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

test("students can use chat without an extra account lookup", async () => {
    User.findByPk = async () => assert.fail("Student access should not need a database lookup.");
    let nextCalls = 0;

    await chatAccessMiddleware({ user: { id: 8, role: "student" } }, makeResponse(), () => {
        nextCalls += 1;
    });

    assert.equal(nextCalls, 1);
});

test("the verified developer account can use chat with any LMS role", async () => {
    User.findByPk = async () => ({ email: "BAHY1878@GMAIL.COM" });
    let nextCalls = 0;

    await chatAccessMiddleware({ user: { id: 8, role: "lecturer" } }, makeResponse(), () => {
        nextCalls += 1;
    });

    assert.equal(nextCalls, 1);
});

test("other lecturer accounts remain excluded from chat", async () => {
    User.findByPk = async () => ({ email: "lecturer@example.edu" });
    const response = makeResponse();
    let nextCalls = 0;

    await chatAccessMiddleware({ user: { id: 8, role: "lecturer" } }, response, () => {
        nextCalls += 1;
    });

    assert.equal(nextCalls, 0);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, { message: "Access denied" });
});
