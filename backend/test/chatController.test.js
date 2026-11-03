process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const ChatProfile = require("../src/models/ChatProfile");
const ChatProfilePermission = require("../src/models/ChatProfilePermission");
const ChatMessage = require("../src/models/ChatMessage");
const ChatMessageReaction = require("../src/models/ChatMessageReaction");
const ChatHiddenMessage = require("../src/models/ChatHiddenMessage");
const ChatReadState = require("../src/models/ChatReadState");
const Course = require("../src/models/Course");
const { sequelize } = require("../src/config/db");
const chatRealtime = require("../src/utils/chatRealtime");
const Enrollment = require("../src/models/Enrollment");
const User = require("../src/models/User");
const chatController = require("../src/controllers/chatController");

const originalFindOne = ChatProfile.findOne;
const originalProfileFindAll = ChatProfile.findAll;
const originalFindByPk = ChatProfile.findByPk;
const originalProfileFindOrCreate = ChatProfile.findOrCreate;
const originalPermissionFindOne = ChatProfilePermission.findOne;
const originalPermissionCreate = ChatProfilePermission.create;
const originalPermissionUpsert = ChatProfilePermission.upsert;
const originalMessageFindOne = ChatMessage.findOne;
const originalMessageFindAll = ChatMessage.findAll;
const originalMessageCreate = ChatMessage.create;
const originalMessageFindByPk = ChatMessage.findByPk;
const originalMessageUpdate = ChatMessage.update;
const originalReactionFindOne = ChatMessageReaction.findOne;
const originalReactionFindAll = ChatMessageReaction.findAll;
const originalReactionCreate = ChatMessageReaction.create;
const originalHiddenMessageFindAll = ChatHiddenMessage.findAll;
const originalReadStateFindOne = ChatReadState.findOne;
const originalReadStateUpsert = ChatReadState.upsert;
const originalCourseFindByPk = Course.findByPk;
const originalTransaction = sequelize.transaction;
const originalPublishProfiles = chatRealtime.publishProfiles;
const originalEnrollmentFindAll = Enrollment.findAll;
const originalEnrollmentFindOne = Enrollment.findOne;
const originalUserFindByPk = User.findByPk;
const originalUserFindOne = User.findOne;
const originalSupabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;

afterEach(() => {
    ChatProfile.findOne = originalFindOne;
    ChatProfile.findAll = originalProfileFindAll;
    ChatProfile.findByPk = originalFindByPk;
    ChatProfile.findOrCreate = originalProfileFindOrCreate;
    ChatProfilePermission.findOne = originalPermissionFindOne;
    ChatProfilePermission.create = originalPermissionCreate;
    ChatProfilePermission.upsert = originalPermissionUpsert;
    ChatMessage.findOne = originalMessageFindOne;
    ChatMessage.findAll = originalMessageFindAll;
    ChatMessage.create = originalMessageCreate;
    ChatMessage.findByPk = originalMessageFindByPk;
    ChatMessage.update = originalMessageUpdate;
    ChatMessageReaction.findOne = originalReactionFindOne;
    ChatMessageReaction.findAll = originalReactionFindAll;
    ChatMessageReaction.create = originalReactionCreate;
    ChatHiddenMessage.findAll = originalHiddenMessageFindAll;
    ChatReadState.findOne = originalReadStateFindOne;
    ChatReadState.upsert = originalReadStateUpsert;
    Course.findByPk = originalCourseFindByPk;
    sequelize.transaction = originalTransaction;
    chatRealtime.publishProfiles = originalPublishProfiles;
    Enrollment.findAll = originalEnrollmentFindAll;
    Enrollment.findOne = originalEnrollmentFindOne;
    User.findByPk = originalUserFindByPk;
    User.findOne = originalUserFindOne;
    if (originalSupabaseJwtSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
    else process.env.SUPABASE_JWT_SECRET = originalSupabaseJwtSecret;
});

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test("private chat unread counts are loaded in one grouped query", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    User.findByPk = async () => ({ id: 7, fullName: "Student Seven" });
    Enrollment.findAll = async () => [];
    ChatHiddenMessage.findAll = async () => [];
    const privateMessages = [
        {
            senderProfileId: "contact-a",
            receiverProfileId: "viewer-profile",
            sender: { id: "contact-a", username: "student_a" },
            content: "Hi",
            type: "text",
            isRead: false,
            createdAt: new Date()
        },
        {
            senderProfileId: "contact-b",
            receiverProfileId: "viewer-profile",
            sender: { id: "contact-b", username: "student_b" },
            content: "Hello",
            type: "text",
            isRead: false,
            createdAt: new Date()
        }
    ];
    let unreadAggregateQueries = 0;
    ChatMessage.findAll = async (options) => {
        if (options.group) {
            unreadAggregateQueries += 1;
            assert.deepEqual(options.group, ["senderProfileId"]);
            return [
                { senderProfileId: "contact-a", unreadCount: "2" },
                { senderProfileId: "contact-b", unreadCount: "1" }
            ];
        }
        return privateMessages;
    };
    const response = makeResponse();

    await chatController.getMe({ user: { id: 7 } }, response);

    assert.equal(unreadAggregateQueries, 1);
    assert.deepEqual(response.body.privateChats.map((chat) => chat.unreadCount), [2, 1]);
});

test("realtime tokens use the authenticated chat profile UUID and no account credentials", async () => {
    process.env.SUPABASE_JWT_SECRET = "test-supabase-jwt-secret";
    ChatProfile.findOne = async () => ({
        id: "c79c323d-9e03-419e-8ee8-f2d31542d923",
        userId: 7,
        username: "student_7",
        fullName: "Student Seven",
        avatarUrl: null
    });
    const response = makeResponse();

    await chatController.getRealtimeToken({ user: { id: 7 } }, response);

    const payload = jwt.verify(response.body.token, process.env.SUPABASE_JWT_SECRET);
    assert.equal(payload.sub, "c79c323d-9e03-419e-8ee8-f2d31542d923");
    assert.equal(payload.role, "authenticated");
    assert.equal(payload.aud, "authenticated");
    assert.equal(payload.user_metadata.username, "student_7");
    assert.equal("userId" in payload, false);
    assert.equal("email" in payload, false);
});

test("Realtime token endpoint explicitly falls back when Supabase signing is unconfigured", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    ChatProfile.findOne = async () => ({ id: "c79c323d-9e03-419e-8ee8-f2d31542d923" });
    const response = makeResponse();

    await chatController.getRealtimeToken({ user: { id: 7 } }, response);

    assert.equal(response.statusCode, 503);
    assert.match(response.body.message, /server event stream remains available/i);
});

test("duplicate usernames are rejected with a clear conflict response", async () => {
    User.findByPk = async () => ({ id: 7, fullName: "Student Seven" });
    ChatProfile.findOne = async () => null;
    ChatProfile.findOrCreate = async () => {
        const error = new Error("username must be unique");
        error.name = "SequelizeUniqueConstraintError";
        throw error;
    };
    const response = makeResponse();

    await chatController.saveProfile(
        {
            user: { id: 7 },
            body: { username: "already_taken", avatarUrl: null, about: "" }
        },
        response
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /username is already taken/i);
});

test("chat usernames accept punctuation and spaces while preserving entered case", async () => {
    User.findByPk = async () => ({ id: 7, fullName: "Student Seven" });
    ChatProfile.findOne = async () => null;
    ChatProfile.findOrCreate = async ({ defaults }) => {
        assert.equal(defaults.username, "Student !+.");
        return [{
            id: "profile-seven",
            username: defaults.username,
            fullName: defaults.fullName,
            avatarUrl: defaults.avatarUrl,
            about: defaults.about
        }, true];
    };
    const response = makeResponse();

    await chatController.saveProfile({
        user: { id: 7 },
        body: { username: " Student !+. ", avatarUrl: null, about: "" }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.profile.username, "Student !+.");
});

test("chat username availability checks names without a profile and rejects taken names", async () => {
    ChatProfile.findOne = async () => ({ userId: 8 });
    const response = makeResponse();

    await chatController.checkUsernameAvailability({
        user: { id: 7 },
        query: { username: "  Name !  " }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { available: false });
});

test("chat username availability allows the current user's own username", async () => {
    ChatProfile.findOne = async () => ({ userId: 7 });
    const response = makeResponse();

    await chatController.checkUsernameAvailability({
        user: { id: 7 },
        query: { username: "My Name" }
    }, response);

    assert.deepEqual(response.body, { available: true });
});

test("the developer username is reserved for its verified account", async () => {
    User.findByPk = async () => ({ email: "student@example.edu" });
    const response = makeResponse();

    await chatController.checkUsernameAvailability({
        user: { id: 7 },
        query: { username: "yunusa bah" }
    }, response);

    assert.deepEqual(response.body, { available: false });
});

test("the developer account receives its seeded chat profile when opening chats", async () => {
    const developer = {
        id: "developer-profile",
        userId: 42,
        username: "Yunusa Bah",
        fullName: "Yunusa Bah",
        avatarUrl: "/developer-profile.jpg",
        about: "the brain behind the smartcampus",
        phoneVisibility: "private_contacts",
        emailVisibility: "private_contacts",
        matNumberVisibility: "private_contacts"
    };
    ChatProfile.findOne = async ({ where }) => where.userId ? developer : null;
    ChatProfile.findOrCreate = async ({ defaults }) => {
        assert.equal(defaults.username, "Yunusa Bah");
        return [developer, true];
    };
    User.findByPk = async () => ({
        id: 42,
        email: "BAHY1878@GMAIL.COM",
        fullName: "Account Name"
    });
    Enrollment.findAll = async () => [];
    ChatHiddenMessage.findAll = async () => [];
    ChatMessage.findAll = async () => [];
    const response = makeResponse();

    await chatController.getMe({ user: { id: 42 } }, response);

    assert.equal(response.body.profile.username, "Yunusa Bah");
    assert.equal(response.body.profile.about, "the brain behind the smartcampus");
    assert.equal(response.body.profile.avatarUrl, "/developer-profile.jpg");
});

test("username search finds SmartCampus students outside the requester's courses", async () => {
    ChatProfile.findOne = async ({ where }) => where.userId
        ? { id: "viewer-profile", userId: 7 }
        : {
            id: "other-profile",
            userId: 8,
            username: "student_8",
            fullName: "Student Eight",
            avatarUrl: null,
            about: "Hello"
        };
    Enrollment.findAll = async () => {
        throw new Error("Global username search must not require course membership.");
    };
    Enrollment.findOne = async () => {
        throw new Error("Global username search must not require course membership.");
    };
    const response = makeResponse();

    await chatController.searchProfiles(
        { user: { id: 7 }, query: { username: "@student_8" } },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.profile, {
        id: "other-profile",
        username: "student_8",
        fullName: "Student Eight",
        avatarUrl: null,
        about: "Hello"
    });
});

test("coursemate discovery includes unique students from every enrolled course", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    User.findOne = async () => null;
    Enrollment.findAll = async ({ attributes }) => (
        attributes.includes("courseId")
            ? [{ courseId: 3 }, { courseId: 5 }]
            : [{ studentId: 8 }, { studentId: 8 }, { studentId: 9 }]
    );
    ChatProfile.findAll = async ({ where }) => {
        assert.deepEqual(where.userId[Op.in], [8, 9]);
        return [
            { id: "student-8", username: "student_8", fullName: "Student Eight" },
            { id: "student-9", username: "student_9", fullName: "Student Nine" }
        ];
    };
    const response = makeResponse();

    await chatController.listCoursemates({ user: { id: 7 }, query: {} }, response);

    assert.deepEqual(response.body.profiles.map((item) => item.id), ["student-8", "student-9"]);
});

test("new chat lists the seeded SmartCampus developer profile before coursemates", async () => {
    ChatProfile.findOne = async ({ where }) => where.userId
        ? { id: "viewer-profile", userId: 7 }
        : null;
    User.findOne = async () => ({
        id: 42,
        email: "bahy1878@gmail.com",
        fullName: "Original Account Name"
    });
    ChatProfile.findOrCreate = async ({ where, defaults }) => {
        assert.deepEqual(where, { userId: 42 });
        assert.equal(defaults.username, "Yunusa Bah");
        assert.equal(defaults.fullName, "Yunusa Bah");
        assert.equal(defaults.about, "the brain behind the smartcampus");
        assert.equal(defaults.avatarUrl, "/developer-profile.jpg");
        assert.equal(defaults.emailVisibility, "private_contacts");
        return [{
            id: "developer-profile",
            ...defaults
        }, true];
    };
    Enrollment.findAll = async ({ attributes }) => (
        attributes.includes("courseId") ? [] : []
    );
    const response = makeResponse();

    await chatController.listCoursemates({ user: { id: 7 }, query: {} }, response);

    assert.deepEqual(response.body.profiles, []);
    assert.equal(response.body.featuredProfile.id, "developer-profile");
    assert.equal(response.body.featuredProfile.username, "Yunusa Bah");
});

test("course messages include an unread divider marker for messages received since last visit", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    Enrollment.findOne = async () => ({ id: 1 });
    Course.findByPk = async () => ({ id: 3, title: "Course Three" });
    ChatHiddenMessage.findAll = async () => [];
    ChatReadState.findOne = async () => ({ lastReadAt: new Date("2026-10-31T12:00:00.000Z") });
    ChatReadState.upsert = async () => {};
    ChatMessage.findAll = async () => [
        {
            id: "own-message",
            senderProfileId: "viewer-profile",
            createdAt: new Date("2026-11-01T12:01:00.000Z"),
            toJSON() {
                return { id: this.id, senderProfileId: this.senderProfileId, createdAt: this.createdAt };
            }
        },
        {
            id: "unread-message",
            senderProfileId: "other-profile",
            createdAt: new Date("2026-11-01T12:00:00.000Z"),
            toJSON() {
                return { id: this.id, senderProfileId: this.senderProfileId, createdAt: this.createdAt };
            }
        }
    ];
    const response = makeResponse();

    await chatController.listCourseMessages(
        { user: { id: 7 }, params: { courseId: "3" } },
        response
    );

    assert.deepEqual(response.body.map((message) => [message.id, message.isNew]), [
        ["unread-message", true],
        ["own-message", false]
    ]);
});

test("private chat history can be opened with a non-coursemate", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    ChatProfile.findByPk = async () => ({
        id: "other-profile",
        username: "student_8",
        fullName: "Student Eight",
        userId: 8
    });
    Enrollment.findAll = async () => {
        throw new Error("Private chat history must not require course membership.");
    };
    ChatHiddenMessage.findAll = async () => [];
    ChatMessage.findAll = async () => [];
    ChatMessage.update = async () => [0];
    const response = makeResponse();

    await chatController.listPrivateMessages(
        { user: { id: 7 }, params: { profileId: "other-profile" } },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, []);
});

test("private messages can be sent to a non-coursemate", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    ChatProfile.findByPk = async () => ({ id: "other-profile", userId: 8 });
    Enrollment.findAll = async () => {
        throw new Error("Sending a private message must not require course membership.");
    };
    const savedMessage = {
        id: "message-1",
        courseId: null,
        senderProfileId: "viewer-profile",
        receiverProfileId: "other-profile",
        content: "Hello",
        type: "text"
    };
    ChatMessage.create = async (attributes) => {
        assert.equal(attributes.receiverProfileId, "other-profile");
        return savedMessage;
    };
    ChatMessage.findByPk = async () => savedMessage;
    sequelize.transaction = async (callback) => callback({});
    chatRealtime.publishProfiles = () => {};
    const response = makeResponse();

    await chatController.sendMessage(
        {
            user: { id: 7 },
            body: { receiverProfileId: "other-profile", content: "Hello", type: "text" }
        },
        response
    );

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.receiverProfileId, "other-profile");
});

test("private chat participants can add a reaction to a message", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    ChatMessage.findByPk = async () => ({
        id: "message-1",
        courseId: null,
        senderProfileId: "other-profile",
        receiverProfileId: "viewer-profile"
    });
    ChatMessageReaction.findOne = async () => null;
    let createdReaction;
    ChatMessageReaction.create = async (attributes) => { createdReaction = attributes; };
    ChatMessageReaction.findAll = async () => [{
        toJSON: () => ({ profileId: "viewer-profile", emoji: "❤️" })
    }];
    chatRealtime.publishProfiles = () => {};
    const response = makeResponse();

    await chatController.toggleReaction({
        user: { id: 7 },
        params: { id: "message-1" },
        body: { emoji: "❤️" }
    }, response);

    assert.deepEqual(createdReaction, {
        messageId: "message-1",
        profileId: "viewer-profile",
        emoji: "❤️"
    });
    assert.deepEqual(response.body.reactions, [{
        emoji: "❤️",
        count: 1,
        reactedByMe: true
    }]);
});

test("chat message reactions reject unsupported emoji", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    let messageQueried = false;
    ChatMessage.findByPk = async () => { messageQueried = true; };
    const response = makeResponse();

    await chatController.toggleReaction({
        user: { id: 7 },
        params: { id: "message-1" },
        body: { emoji: "🧨" }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(messageQueried, false);
});

test("private profile data is hidden unless the visibility setting allows it", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    ChatProfile.findByPk = async () => ({
        id: "owner-profile",
        userId: 8,
        username: "student_8",
        fullName: "Student Eight",
        avatarUrl: null,
        about: "",
        phoneVisibility: "private_contacts",
        emailVisibility: "private_contacts",
        matNumberVisibility: "private_contacts"
    });
    ChatMessage.findOne = async () => null;
    ChatProfilePermission.findOne = async () => null;
    User.findByPk = async () => {
        throw new Error("Hidden credentials must not be queried.");
    };
    const response = makeResponse();

    await chatController.getSharedProfile(
        { user: { id: 7 }, params: { profileId: "owner-profile" } },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.profile, {
        id: "owner-profile",
        username: "student_8",
        fullName: "Student Eight",
        avatarUrl: null,
        about: ""
    });
});

test("approved private contacts can see credentials set to contacts-only", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    ChatProfile.findByPk = async () => ({
        id: "owner-profile",
        userId: 8,
        username: "student_8",
        fullName: "Student Eight",
        avatarUrl: null,
        about: "",
        phoneVisibility: "private_contacts",
        emailVisibility: "private_contacts",
        matNumberVisibility: "private_contacts"
    });
    ChatMessage.findOne = async () => ({ id: "prior-private-message" });
    ChatProfilePermission.findOne = async () => ({ id: "approved-contact" });
    User.findByPk = async () => ({
        phone: "+15551234567",
        email: "student8@example.com",
        matNumber: "STU008"
    });
    const response = makeResponse();

    await chatController.getSharedProfile(
        { user: { id: 7 }, params: { profileId: "owner-profile" } },
        response
    );

    assert.equal(response.body.profile.phone, "+15551234567");
    assert.equal(response.body.profile.email, "student8@example.com");
    assert.equal(response.body.profile.matNumber, "STU008");
});

test("private chat without owner approval cannot reveal contacts-only credentials", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    ChatProfile.findByPk = async () => ({
        id: "owner-profile",
        userId: 8,
        username: "student_8",
        fullName: "Student Eight",
        avatarUrl: null,
        about: "",
        phoneVisibility: "private_contacts",
        emailVisibility: "private_contacts",
        matNumberVisibility: "private_contacts"
    });
    ChatMessage.findOne = async () => ({ id: "prior-private-message" });
    ChatProfilePermission.findOne = async () => null;
    User.findByPk = async () => {
        throw new Error("Unapproved credentials must not be queried.");
    };
    const response = makeResponse();

    await chatController.getSharedProfile(
        { user: { id: 7 }, params: { profileId: "owner-profile" } },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.equal("phone" in response.body.profile, false);
    assert.equal("email" in response.body.profile, false);
    assert.equal("matNumber" in response.body.profile, false);
});

test("profile owners can explicitly approve a private chat contact", async () => {
    ChatProfile.findOne = async () => ({ id: "owner-profile", userId: 7 });
    ChatProfile.findByPk = async () => ({ id: "contact-profile" });
    ChatMessage.findOne = async () => ({ id: "private-message" });
    let approval;
    ChatProfilePermission.upsert = async (values) => {
        approval = values;
    };
    const response = makeResponse();

    await chatController.updatePrivateContactApproval({
        user: { id: 7 },
        params: { profileId: "contact-profile" },
        body: { approved: true }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(approval, {
        profileId: "owner-profile",
        viewerProfileId: "contact-profile",
        canViewContactDetails: true
    });
    assert.deepEqual(response.body, { approved: true });
});

test("course visibility is limited to students sharing a course", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    ChatProfile.findByPk = async () => ({
        id: "owner-profile",
        userId: 8,
        username: "student_8",
        fullName: "Student Eight",
        avatarUrl: null,
        about: "",
        phoneVisibility: "course",
        emailVisibility: "private_contacts",
        matNumberVisibility: "private_contacts"
    });
    Enrollment.findAll = async () => [{ courseId: 3 }];
    Enrollment.findOne = async () => ({ id: 1 });
    ChatMessage.findOne = async () => null;
    ChatProfilePermission.findOne = async () => null;
    User.findByPk = async (_userId, { attributes }) => {
        assert.deepEqual(attributes, ["phone"]);
        return { phone: "+15551234567" };
    };
    const coursemateResponse = makeResponse();

    await chatController.getSharedProfile(
        { user: { id: 7 }, params: { profileId: "owner-profile" } },
        coursemateResponse
    );

    assert.equal(coursemateResponse.body.profile.phone, "+15551234567");

    Enrollment.findOne = async () => null;
    User.findByPk = async () => {
        throw new Error("Course-only credentials must not be queried for non-coursemates.");
    };
    const nonCoursemateResponse = makeResponse();

    await chatController.getSharedProfile(
        { user: { id: 7 }, params: { profileId: "owner-profile" } },
        nonCoursemateResponse
    );

    assert.equal("phone" in nonCoursemateResponse.body.profile, false);
});

test("everyone visibility exposes only the selected credentials", async () => {
    ChatProfile.findOne = async () => ({ id: "viewer-profile", userId: 7 });
    ChatProfile.findByPk = async () => ({
        id: "owner-profile",
        userId: 8,
        username: "student_8",
        fullName: "Student Eight",
        avatarUrl: null,
        about: "",
        phoneVisibility: "everyone",
        emailVisibility: "private_contacts",
        matNumberVisibility: "everyone"
    });
    ChatMessage.findOne = async () => null;
    ChatProfilePermission.findOne = async () => null;
    User.findByPk = async (_userId, { attributes }) => {
        assert.deepEqual(attributes, ["phone", "matNumber"]);
        return { phone: "+15551234567", matNumber: "STU008", email: "private@example.com" };
    };
    const response = makeResponse();

    await chatController.getSharedProfile(
        { user: { id: 7 }, params: { profileId: "owner-profile" } },
        response
    );

    assert.equal(response.body.profile.phone, "+15551234567");
    assert.equal(response.body.profile.matNumber, "STU008");
    assert.equal("email" in response.body.profile, false);
});

test("profile visibility updates accept only supported scopes", async () => {
    const profile = {
        id: "viewer-profile",
        userId: 7,
        save: async () => {}
    };
    ChatProfile.findOne = async () => profile;
    const response = makeResponse();

    await chatController.updateProfileVisibility(
        {
            user: { id: 7 },
            body: {
                phoneVisibility: "everyone",
                emailVisibility: "course",
                matNumberVisibility: "everyone"
            }
        },
        response
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.visibility, {
        phoneVisibility: "everyone",
        emailVisibility: "course",
        matNumberVisibility: "everyone"
    });

    const invalidResponse = makeResponse();
    await chatController.updateProfileVisibility(
        { user: { id: 7 }, body: { emailVisibility: "public" } },
        invalidResponse
    );
    assert.equal(invalidResponse.statusCode, 400);
});
