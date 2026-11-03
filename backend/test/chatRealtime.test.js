const { test } = require("node:test");
const assert = require("node:assert/strict");
const { subscribe, updateUserCourses, publishCourse, publishProfiles } = require("../src/utils/chatRealtime");

const captureStream = () => {
    const events = [];
    return {
        events,
        writableEnded: false,
        destroyed: false,
        write(chunk) {
            events.push(chunk);
        }
    };
};

const eventNames = (stream) => stream.events
    .map((chunk) => chunk.match(/^event: ([^\n]+)/)?.[1])
    .filter(Boolean);

test("course events reach enrolled chat streams only", () => {
    const enrolled = captureStream();
    const unrelated = captureStream();
    const closeEnrolled = subscribe({
        userId: 9101,
        profileId: "profile-enrolled",
        courseIds: [17],
        response: enrolled
    });
    const closeUnrelated = subscribe({
        userId: 9102,
        profileId: "profile-unrelated",
        courseIds: [19],
        response: unrelated
    });

    publishCourse(17, "message", { id: "message-1" });

    assert.ok(eventNames(enrolled).includes("message"));
    assert.ok(!eventNames(unrelated).includes("message"));
    closeEnrolled();
    closeUnrelated();
});

test("private events target the selected profile and removed course membership stops delivery", () => {
    const recipient = captureStream();
    const formerMember = captureStream();
    const closeRecipient = subscribe({
        userId: 9201,
        profileId: "profile-recipient",
        courseIds: [23],
        response: recipient
    });
    const closeFormerMember = subscribe({
        userId: 9202,
        profileId: "profile-former-member",
        courseIds: [23],
        response: formerMember
    });

    publishProfiles(["profile-recipient"], "message", { id: "private-message" });
    updateUserCourses(9202, []);
    publishCourse(23, "typing", { profileId: "profile-sender", isTyping: true });

    assert.ok(eventNames(recipient).includes("message"));
    assert.ok(!eventNames(formerMember).includes("message"));
    assert.ok(!eventNames(formerMember).includes("typing"));
    closeRecipient();
    closeFormerMember();
});
