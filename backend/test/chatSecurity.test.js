process.env.DB_DIALECT = "postgres";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

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


test("production chat security keeps policy helpers private and the public Data API read-only", async () => {
    process.env.NODE_ENV = "production";
    let sqlExecuted = "";
    let firstCall = true;
    sequelize.query = async (sql) => {
        if (firstCall) {
            firstCall = false;
            return [{ authSchema: true }];
        }
        sqlExecuted = sql;
        return [];
    };

    await configureChatSecurity();

    assert.match(sqlExecuted, /CREATE SCHEMA IF NOT EXISTS private/);
    assert.match(sqlExecuted, /CREATE OR REPLACE FUNCTION private\.smartcampus_chat_can_access_course/);
    assert.match(sqlExecuted, /SET search_path = ''/);
    assert.match(sqlExecuted, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public/);
    assert.match(sqlExecuted, /GRANT SELECT ON TABLE public\."ChatMessages" TO authenticated/);
    assert.match(sqlExecuted, /DROP FUNCTION IF EXISTS public\.smartcampus_chat_can_access_course/);
    assert.match(sqlExecuted, /REVOKE ALL ON FUNCTION public\.rls_auto_enable\(\)/);
    assert.match(sqlExecuted, /private\.smartcampus_chat_can_view_profile\(\(SELECT auth\.uid\(\)\), id\)/);
});
