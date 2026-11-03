const test = require("node:test");
const assert = require("node:assert/strict");
const { dateTimeInZone, getOccurrences } = require("../src/utils/classSchedule");

test("course class schedules produce weekly occurrences inside the requested date range", () => {
    const course = {
        id: 8,
        title: "Operating Systems",
        classDays: [1, 3],
        classStartTime: "09:00",
        classEndTime: "10:30",
        classTimeZone: "UTC"
    };

    const events = getOccurrences(
        course,
        new Date("2026-11-02T00:00:00.000Z"),
        new Date("2026-11-05T00:00:00.000Z")
    );

    assert.deepEqual(events.map((event) => event.scheduledDate), ["2026-11-02", "2026-11-04"]);
    assert.equal(events[0].startsAt.toISOString(), "2026-11-02T09:00:00.000Z");
});

test("class schedules convert local time using their configured time zone", () => {
    assert.equal(
        dateTimeInZone("2026-11-02", "09:00", "America/New_York").toISOString(),
        "2026-11-02T14:00:00.000Z"
    );
});

test("class schedule exceptions preserve cancellations and rescheduled times", () => {
    const course = {
        id: 8,
        title: "Operating Systems",
        classDays: [1],
        classStartTime: "09:00",
        classEndTime: "10:30",
        classTimeZone: "UTC"
    };

    const events = getOccurrences(
        course,
        new Date("2026-11-02T00:00:00.000Z"),
        new Date("2026-11-03T00:00:00.000Z"),
        [{
            id: 12,
            occurrenceDate: "2026-11-02",
            status: "cancelled",
            startsAt: new Date("2026-11-02T09:00:00.000Z"),
            endsAt: new Date("2026-11-02T10:30:00.000Z")
        }]
    );

    assert.equal(events.length, 1);
    assert.equal(events[0].status, "cancelled");
    assert.equal(events[0].title, "Cancelled class");
});
