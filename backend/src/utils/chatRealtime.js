const subscribers = new Map();
const presence = new Map();

const writeEvent = (response, type, data) => {
    if (response.writableEnded || response.destroyed) return;
    response.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
};

const publishCourse = (courseId, type, data, exceptUserId = null) => {
    const subscribersInRoom = [...subscribers.values()].flat();
    for (const subscriber of subscribersInRoom) {
        if (subscriber.userId !== exceptUserId && subscriber.courseIds.has(Number(courseId))) {
            writeEvent(subscriber.response, type, data);
        }
    }
};

const publishProfiles = (profileIds, type, data, exceptProfileId = null) => {
    const targets = new Set(profileIds.map(String));
    for (const subscriber of [...subscribers.values()].flat()) {
        if (subscriber.profileId !== exceptProfileId && targets.has(subscriber.profileId)) {
            writeEvent(subscriber.response, type, data);
        }
    }
};

const subscribe = ({ userId, profileId, courseIds, response }) => {
    const subscriber = {
        userId,
        profileId: String(profileId),
        courseIds: new Set(courseIds.map(Number)),
        response
    };
    const userSubscribers = subscribers.get(userId) || [];
    userSubscribers.push(subscriber);
    subscribers.set(userId, userSubscribers);

    const previousCourses = new Set(presence.get(subscriber.profileId) || []);
    const currentCourses = new Set(previousCourses);
    subscriber.courseIds.forEach((courseId) => currentCourses.add(courseId));
    presence.set(subscriber.profileId, currentCourses);
    for (const courseId of subscriber.courseIds) {
        if (!previousCourses.has(courseId)) {
            publishCourse(courseId, "presence", {
                profileId: subscriber.profileId,
                online: true
            }, userId);
        }
    }

    writeEvent(response, "ready", {
        onlineProfileIds: [...presence.keys()].filter((id) =>
            [...(presence.get(id) || [])].some((courseId) => subscriber.courseIds.has(courseId))
        )
    });

    return () => {
        const remaining = (subscribers.get(userId) || []).filter((item) => item !== subscriber);
        if (remaining.length) subscribers.set(userId, remaining);
        else subscribers.delete(userId);

        const previousCourses = presence.get(subscriber.profileId) || new Set();
        if (!remaining.length) {
            presence.delete(subscriber.profileId);
            previousCourses.forEach((courseId) => publishCourse(courseId, "presence", {
                profileId: subscriber.profileId,
                online: false
            }));
        } else {
            const stillJoined = new Set(remaining.flatMap((item) => [...item.courseIds]));
            presence.set(subscriber.profileId, stillJoined);
            for (const courseId of previousCourses) {
                if (!stillJoined.has(courseId)) {
                    publishCourse(courseId, "presence", {
                        profileId: subscriber.profileId,
                        online: false
                    });
                }
            }
        }
    };
};

const updateUserCourses = (userId, courseIds) => {
    const userSubscribers = subscribers.get(userId) || [];
    if (!userSubscribers.length) return;
    const profileId = userSubscribers[0].profileId;
    const previousCourses = presence.get(profileId) || new Set();
    const nextCourses = new Set(courseIds.map(Number));
    userSubscribers.forEach((subscriber) => {
        subscriber.courseIds = new Set(nextCourses);
    });
    presence.set(profileId, nextCourses);
    for (const courseId of previousCourses) {
        if (!nextCourses.has(courseId)) {
            publishCourse(courseId, "presence", { profileId, online: false }, userId);
        }
    }
    for (const courseId of nextCourses) {
        if (!previousCourses.has(courseId)) {
            publishCourse(courseId, "presence", { profileId, online: true }, userId);
        }
    }
};

module.exports = { subscribe, updateUserCourses, publishCourse, publishProfiles };
