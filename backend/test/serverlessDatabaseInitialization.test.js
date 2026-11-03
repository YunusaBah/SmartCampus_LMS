process.env.DB_DIALECT = "postgres";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/config/db");

const migrationPath = require.resolve("../src/utils/runMigrations");
const chatSecurityPath = require.resolve("../src/utils/chatSecurity");
const initializerPath = require.resolve("../src/utils/initializeDatabase");
const migrations = require(migrationPath);
const chatSecurity = require(chatSecurityPath);
const originalAuthenticate = db.sequelize.authenticate;
const originalSync = db.sequelize.sync;
const originalMigrations = migrations;
const originalChatSecurity = chatSecurity;

const initializationCalls = [];
db.sequelize.authenticate = async () => initializationCalls.push("connect");
db.sequelize.sync = async () => initializationCalls.push("sync");
require.cache[migrationPath].exports = async () => initializationCalls.push("migrations");
require.cache[chatSecurityPath].exports = async () => initializationCalls.push("chat security");
const initializeDatabase = require(initializerPath);

after(() => {
    db.sequelize.authenticate = originalAuthenticate;
    db.sequelize.sync = originalSync;
    require.cache[migrationPath].exports = originalMigrations;
    require.cache[chatSecurityPath].exports = originalChatSecurity;
    delete require.cache[initializerPath];
});

test("serverless database initialization applies chat security after schema sync", async () => {
    await initializeDatabase();

    assert.deepEqual(initializationCalls, ["connect", "migrations", "sync", "chat security"]);
});
