const { test } = require("node:test");
const assert = require("node:assert/strict");
const objectStorage = require("../src/utils/objectStorage");

const userId = 42;
const validKey = "42/7e57d004-2b97-4e7a-9c2d-3c45f30e2b7a.pdf";

test("storage object keys must be generated and scoped to their owner", () => {
    assert.equal(objectStorage.validateStorageKey(validKey, userId), true);
    assert.equal(objectStorage.validateStorageKey(validKey, 43), false);
    assert.equal(objectStorage.validateStorageKey("../secret.pdf", userId), false);
});

test("signed material uploads enforce the 20 MB file limit", async () => {
    await assert.rejects(objectStorage.signUpload({
        userId,
        fileName: "lecture.pdf",
        fileSize: 20 * 1024 * 1024 + 1,
        purpose: "lesson"
    }), /20 MB or smaller/);
});

test("signed chat media uploads retain the 5 MB limit", async () => {
    await assert.rejects(objectStorage.signUpload({
        userId,
        fileName: "voice-note.webm",
        fileSize: 5 * 1024 * 1024 + 1,
        purpose: "chat-media",
        mediaType: "voice"
    }), /5 MB or smaller/);
});
