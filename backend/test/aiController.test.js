require("../src/config/env");

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const aiController = require("../src/controllers/aiController");

const originalApiKey = process.env.OPENAI_API_KEY;
const originalFetch = global.fetch;

afterEach(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    global.fetch = originalFetch;
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

test("AI requests use the server-side OpenAI key and return the generated reply", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    let request;
    global.fetch = async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({ choices: [{ message: { content: "A helpful reply" } }] })
        };
    };
    const response = makeResponse();

    await aiController.askAI({
        user: { role: "student" },
        body: {
            message: "Explain this topic",
            context: { courseName: "Computing", lessonContent: "Variables store values." }
        }
    }, response);

    assert.equal(request.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(request.options.headers.Authorization, "Bearer test-openai-key");
    assert.equal(request.options.redirect, "error");
    assert.equal(request.options.signal instanceof AbortSignal, true);
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.model, "gpt-4o-mini");
    assert.equal(payload.messages[0].role, "system");
    assert.match(payload.messages[0].content, /Variables store values/);
    assert.deepEqual(payload.messages[1], { role: "user", content: "Explain this topic" });
    assert.deepEqual(response.body, { reply: "A helpful reply" });
});

test("AI requests fail clearly when the OpenAI key is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = async () => assert.fail("OpenAI must not be called without a configured key");
    const response = makeResponse();

    await aiController.askAI({
        user: { role: "student" },
        body: { message: "Help me study" }
    }, response);

    assert.equal(response.statusCode, 503);
    assert.match(response.body.message, /not configured/i);
});

test("AI requests explain when OpenAI rejects the configured API key", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    global.fetch = async () => ({ ok: false, status: 401 });
    const response = makeResponse();

    await aiController.askAI({
        user: { role: "student" },
        body: { message: "Help me study" }
    }, response);

    assert.equal(response.statusCode, 502);
    assert.match(response.body.message, /rejected the API key/i);
    assert.match(response.body.message, /restart the backend/i);
});

test("AI requests explain when the OpenAI project has exhausted its quota", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    global.fetch = async () => ({ ok: false, status: 429 });
    const response = makeResponse();

    await aiController.askAI({
        user: { role: "student" },
        body: { message: "Help me study" }
    }, response);

    assert.equal(response.statusCode, 503);
    assert.match(response.body.message, /quota or rate limit/i);
});

test("AI request validation rejects empty or oversized messages", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    global.fetch = async () => assert.fail("Invalid messages must be rejected before the API call");
    const response = makeResponse();

    await aiController.askAI({
        user: { role: "student" },
        body: { message: " " }
    }, response);

    assert.equal(response.statusCode, 400);
});
