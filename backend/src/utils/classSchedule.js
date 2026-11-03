const dateParts = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);
    return Object.fromEntries(parts.filter((part) => part.type !== "literal").map(({ type, value }) => [type, Number(value)]));
};

const dateStringInZone = (date, timeZone) => {
    const parts = dateParts(date, timeZone);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const dateTimeInZone = (date, time, timeZone) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = target;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const parts = dateParts(new Date(timestamp), timeZone);
        const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
        const adjustment = target - represented;
        timestamp += adjustment;
        if (adjustment === 0) break;
    }
    return new Date(timestamp);
};

const addDate = (date, offset) => {
    const [year, month, day] = date.split("-").map(Number);
    const value = new Date(Date.UTC(year, month - 1, day + offset));
    return value.toISOString().slice(0, 10);
};

const getOccurrences = (course, from, to, exceptions = []) => {
    if (!Array.isArray(course.classDays) || !course.classDays.length ||
        !course.classStartTime || !course.classEndTime) return [];
    const timeZone = course.classTimeZone || "UTC";
    const startDate = course.startDate && course.startDate > dateStringInZone(from, timeZone)
        ? course.startDate
        : addDate(dateStringInZone(from, timeZone), -1);
    const endDate = course.endDate && course.endDate < dateStringInZone(to, timeZone)
        ? course.endDate
        : addDate(dateStringInZone(to, timeZone), 1);
    const exceptionsByDate = new Map(exceptions.map((event) => [event.occurrenceDate, event]));
    const events = [];
    for (let date = startDate; date <= endDate; date = addDate(date, 1)) {
        const [year, month, day] = date.split("-").map(Number);
        if (!course.classDays.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay())) continue;
        const exception = exceptionsByDate.get(date);
        const startsAt = exception?.startsAt || dateTimeInZone(date, course.classStartTime, timeZone);
        const endsAt = exception?.endsAt || dateTimeInZone(date, course.classEndTime, timeZone);
        if (new Date(startsAt) < from || new Date(startsAt) >= to) continue;
        events.push({
            id: exception?.id || `class-${course.id}-${date}`,
            type: "class",
            title: exception?.status === "cancelled" ? "Cancelled class" : exception?.title || `${course.title} class`,
            description: exception?.description || null,
            startsAt,
            endsAt,
            courseId: course.id,
            courseTitle: course.title,
            status: exception?.status || "scheduled",
            recurring: true,
            scheduledDate: date,
            timeZone
        });
    }
    return events;
};

module.exports = { getOccurrences, dateTimeInZone };
