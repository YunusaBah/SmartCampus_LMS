const test = require("node:test");
const assert = require("node:assert/strict");
const connectDatabaseWithRetry = require("../src/utils/connectDatabaseWithRetry");

test("database startup retries failures and continues after connection succeeds", async () => {
    let attempts = 0;
    const messages = [];
    const logger = { error: (message) => messages.push(message) };

    await connectDatabaseWithRetry(async () => {
        attempts += 1;
        if (attempts < 2) throw new Error("timeout expired");
    }, logger);

    assert.equal(attempts, 2);
    assert.match(messages[0], /timeout expired/);
    assert.match(messages[1], /Retrying in 2s/);
});
