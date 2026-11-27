process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { STORAGE_QUOTA_BYTES, MAX_BUCKET_OBJECT_BYTES } = require("../src/utils/storageQuota");

test("SmartCampus storage safety cap remains below Supabase Free storage allowance", () => {
    assert.equal(STORAGE_QUOTA_BYTES, 800_000_000);
    assert.ok(STORAGE_QUOTA_BYTES < 1_000_000_000);
    assert.equal(MAX_BUCKET_OBJECT_BYTES, 20 * 1024 * 1024);
});
