const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const { sequelize } = require("../src/config/db");
const configureChatSecurity = require("../src/utils/chatSecurity");

const originalQuery = sequelize.query;
const originalNodeEnv = process.env.NODE_ENV;

after(() => {
    sequelize.query = originalQuery;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
});

test("local PostgreSQL skips Supabase chat security when Auth schema is absent", async () => {
    process.env.NODE_ENV = "development";
    sequelize.query = async () => [{ authSchema: false }];
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(message);

    try {
        await configureChatSecurity();
    } finally {
        console.warn = originalWarn;
    }

    assert.match(warnings[0], /skipping Supabase chat row-level security/);
});

test("production requires the Supabase Auth schema for chat security", async () => {
    process.env.NODE_ENV = "production";
    sequelize.query = async () => [{ authSchema: false }];

    await assert.rejects(
        configureChatSecurity(),
        /Supabase auth schema is required to enable chat row-level security/
    );
});
