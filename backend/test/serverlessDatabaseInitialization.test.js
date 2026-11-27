process.env.DB_DIALECT = "postgres";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const { sequelize } = require("../src/config/db");

const initializerPath = require.resolve("../src/utils/initializeDatabase");
const originalAuthenticate = sequelize.authenticate;
const originalSync = sequelize.sync;
const initializationCalls = [];
let connectionAttempts = 0;

sequelize.authenticate = async () => {
    connectionAttempts += 1;
    initializationCalls.push("connect");
    if (connectionAttempts === 1) {
        throw new Error("simulated temporary database failure");
    }
};
sequelize.sync = async () => initializationCalls.push("sync");

const initializeDatabase = require(initializerPath);

after(() => {
    sequelize.authenticate = originalAuthenticate;
    sequelize.sync = originalSync;
    delete require.cache[initializerPath];
});

test("serverless initialization retries a failed connection and caches success", async () => {
    await assert.rejects(initializeDatabase(), /simulated temporary database failure/);

    await Promise.all([
        initializeDatabase(),
        initializeDatabase(),
        initializeDatabase()
    ]);

    assert.equal(connectionAttempts, 2);
    assert.deepEqual(initializationCalls, ["connect", "connect"]);
});

test("serverless initialization does not mutate the production schema", async () => {
    await initializeDatabase();
    assert.deepEqual(initializationCalls, ["connect", "connect"]);
});
