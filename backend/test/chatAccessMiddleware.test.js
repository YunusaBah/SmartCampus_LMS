process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const chatAccessMiddleware = require("../src/middlewares/chatAccessMiddleware");

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
    let nextCalls = 0;

    await chatAccessMiddleware({ user: { id: 8, role: "student" } }, makeResponse(), () => {
        nextCalls += 1;
    });

    assert.equal(nextCalls, 1);
});

test("lecturer accounts cannot use chat based on their email address", () => {
    const response = makeResponse();
    let nextCalls = 0;

    chatAccessMiddleware({ user: { id: 8, role: "lecturer", email: "developer@example.edu" } }, response, () => {
        nextCalls += 1;
    });

    assert.equal(nextCalls, 0);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, { message: "Access denied" });
});
