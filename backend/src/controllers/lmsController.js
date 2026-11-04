const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { getOccurrences, dateTimeInZone } = require("../utils/classSchedule");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const Lesson = require("../models/Lesson");
const Module = require("../models/Module");
const LessonProgress = require("../models/LessonProgress");
const Announcement = require("../models/Announcement");
const AnnouncementReaction = require("../models/AnnouncementReaction");
const AnnouncementView = require("../models/AnnouncementView");
const AnnouncementComment = require("../models/AnnouncementComment");
const AnnouncementCommentReaction = require("../models/AnnouncementCommentReaction");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const CalendarEvent = require("../models/CalendarEvent");
const QuizAssessment = require("../models/QuizAssessment");
const Department = require("../models/Department");
const Certificate = require("../models/Certificate");
const User = require("../models/User");
const getCourseAccess = require("../utils/courseAccess");
const createNotifications = require("../utils/createNotifications");
const { hasCoursePermission } = require("../utils/coursePermissions");

const idValue = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const nonEmpty = (value, max = 255) =>
    typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const announcementEmojis = new Set(["👍", "❤️", "🎉", "👏", "😊", "🙌", "💯", "✅", "🤩", "🚀"]);

const accessResponse = (res, access) =>
    access.status ? res.status(access.status).json({ message: access.message }) : null;

const managerAccess = async (courseId, user, res) => {
    const access = await getCourseAccess(courseId, user);
    if (access.status) {
        accessResponse(res, access);
        return null;
    }
    if (!access.isManager) {
        res.status(403).json({ message: "Only the course lecturer can manage this resource" });
        return null;
    }
    return access;
};

const courseParticipant = async (courseId, user) => {
    return getCourseAccess(courseId, user);
};

exports.listModules = async (req, res) => {
    const access = await courseParticipant(req.params.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    const modules = await Module.findAll({
        where: { courseId: access.course.id },
        include: [{ model: Lesson, as: "lessons" }],
        order: [
            ["orderIndex", "ASC"],
            ["id", "ASC"],
            [{ model: Lesson, as: "lessons" }, "orderIndex", "ASC"],
            [{ model: Lesson, as: "lessons" }, "id", "ASC"]
        ]
    });
    res.json(modules);
};

exports.createModule = async (req, res) => {
    const access = await managerAccess(req.params.courseId, req.user, res);
    if (!access) return;
    const { title, description, orderIndex } = req.body;
    if (!nonEmpty(title) || (description != null && typeof description !== "string") ||
        (orderIndex != null && (!Number.isInteger(orderIndex) || orderIndex < 0))) {
        return res.status(400).json({ message: "A title and valid module details are required" });
    }
    const module = await Module.create({
        title: title.trim(),
        description: typeof description === "string" ? description.trim() : null,
        orderIndex: orderIndex ?? 0,
        courseId: access.course.id
    });
    res.status(201).json(module);
};

exports.updateModule = async (req, res) => {
    const module = await Module.findByPk(req.params.id);
    if (!module) return res.status(404).json({ message: "Module not found" });
    const access = await managerAccess(module.courseId, req.user, res);
    if (!access) return;
    const { title, description, orderIndex } = req.body;
    if (title !== undefined && !nonEmpty(title)) return res.status(400).json({ message: "Invalid module title" });
    if (description !== undefined && description !== null && typeof description !== "string") {
        return res.status(400).json({ message: "Invalid module description" });
    }
    if (orderIndex !== undefined && (!Number.isInteger(orderIndex) || orderIndex < 0)) {
        return res.status(400).json({ message: "Invalid module order" });
    }
    if (title !== undefined) module.title = title.trim();
    if (description !== undefined) module.description = description?.trim() || null;
    if (orderIndex !== undefined) module.orderIndex = orderIndex;
    await module.save();
    res.json(module);
};

exports.deleteModule = async (req, res) => {
    const module = await Module.findByPk(req.params.id);
    if (!module) return res.status(404).json({ message: "Module not found" });
    const access = await managerAccess(module.courseId, req.user, res);
    if (!access) return;
    await sequelize.transaction(async (transaction) => {
        await Lesson.update({ moduleId: null }, { where: { moduleId: module.id }, transaction });
        await module.destroy({ transaction });
    });
    res.json({ message: "Module deleted; lessons remain in the course" });
};

exports.setLessonOrder = async (req, res) => {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    const access = await managerAccess(lesson.courseId, req.user, res);
    if (!access) return;
    const { orderIndex, moduleId } = req.body;
    if (orderIndex !== undefined && (!Number.isInteger(orderIndex) || orderIndex < 0)) {
        return res.status(400).json({ message: "Invalid lesson order" });
    }
    if (moduleId !== undefined && moduleId !== null) {
        const module = await Module.findOne({ where: { id: idValue(moduleId), courseId: lesson.courseId } });
        if (!module) return res.status(400).json({ message: "Module must belong to the lesson course" });
        lesson.moduleId = module.id;
    } else if (moduleId === null) {
        lesson.moduleId = null;
    }
    if (orderIndex !== undefined) lesson.orderIndex = orderIndex;
    await lesson.save();
    res.json(lesson);
};

exports.completeLesson = async (req, res) => {
    const lesson = await Lesson.findByPk(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required" });
    const enrollment = await Enrollment.findOne({
        where: { studentId: req.user.id, courseId: lesson.courseId }
    });
    if (!enrollment) return res.status(403).json({ message: "Enroll in the course first" });
    const completedAt = new Date();
    try {
        await LessonProgress.upsert({
            studentId: req.user.id,
            lessonId: lesson.id,
            completedAt
        }, { fields: ["completedAt"] });
        res.json({ lessonId: lesson.id, completed: true, completedAt });
    } catch (error) {
        console.error("Failed to mark lesson complete:", error);
        res.status(500).json({ message: "Failed to save lesson progress" });
    }
};

exports.updateLessonReadingProgress = async (req, res) => {
    const lesson = await Lesson.findByPk(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required" });
    const enrollment = await Enrollment.findOne({
        where: { studentId: req.user.id, courseId: lesson.courseId }
    });
    if (!enrollment) return res.status(403).json({ message: "Enroll in the course first" });

    const { readingPosition, readingProgress } = req.body;
    if (!Number.isSafeInteger(readingPosition) || readingPosition < 0 ||
        readingPosition > 100_000_000 ||
        !Number.isInteger(readingProgress) || readingProgress < 0 || readingProgress > 100) {
        return res.status(400).json({ message: "Reading position or progress is invalid" });
    }

    try {
        const now = new Date();
        await LessonProgress.upsert({
            studentId: req.user.id,
            lessonId: lesson.id,
            readingPosition,
            readingProgress,
            lastReadAt: now
        }, { fields: ["readingPosition", "readingProgress", "lastReadAt"] });
        return res.json({
            lessonId: lesson.id,
            readingPosition,
            readingProgress,
            lastReadAt: now
        });
    } catch (error) {
        console.error("Failed to save lesson reading progress:", error);
        return res.status(500).json({ message: "Failed to save reading progress" });
    }
};

exports.getCourseProgress = async (req, res) => {
    const access = await courseParticipant(req.params.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    const lessons = await Lesson.findAll({
        where: { courseId: access.course.id },
        attributes: ["id", "title"],
        order: [["moduleId", "ASC"], ["orderIndex", "ASC"], ["id", "ASC"]]
    });
    if (access.isManager && !req.query.studentId) {
        const enrollments = await Enrollment.findAll({
            where: { courseId: access.course.id },
            include: [{ model: User, as: "student", attributes: ["id", "fullName"] }]
        });
        const progressRows = await LessonProgress.findAll({
            where: { lessonId: { [Op.in]: lessons.map((lesson) => lesson.id) } }
        });
        const completedByStudent = new Map();
        for (const row of progressRows) {
            if (!row.completedAt) continue;
            completedByStudent.set(row.studentId, (completedByStudent.get(row.studentId) || 0) + 1);
        }
        return res.json({
            courseId: access.course.id,
            totalLessons: lessons.length,
            students: enrollments.filter((item) => item.student).map((item) => {
                const completedLessons = completedByStudent.get(item.studentId) || 0;
                return {
                    student: item.student,
                    completedLessons,
                    totalLessons: lessons.length,
                    completionPercent: lessons.length ? Math.round(completedLessons * 100 / lessons.length) : 0
                };
            })
        });
    }

    const studentId = access.isManager ? idValue(req.query.studentId) : req.user.id;
    if (!studentId) return res.status(400).json({ message: "Invalid student ID" });
    const enrollment = await Enrollment.findOne({
        where: { courseId: access.course.id, studentId }
    });
    if (!enrollment) return res.status(404).json({ message: "Student is not enrolled in this course" });
    const progressRows = await LessonProgress.findAll({
        where: { studentId, lessonId: { [Op.in]: lessons.map((lesson) => lesson.id) } }
    });
    const progressByLesson = new Map(progressRows.map((row) => [row.lessonId, row]));
    const completedLessons = progressRows.filter((row) => row.completedAt).length;
    res.json({
        courseId: access.course.id,
        studentId,
        totalLessons: lessons.length,
        completedLessons,
        completionPercent: lessons.length ? Math.round(completedLessons * 100 / lessons.length) : 0,
        lessons: lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            completed: Boolean(progressByLesson.get(lesson.id)?.completedAt),
            completedAt: progressByLesson.get(lesson.id)?.completedAt || null,
            readingPosition: progressByLesson.get(lesson.id)?.readingPosition || 0,
            readingProgress: progressByLesson.get(lesson.id)?.readingProgress || 0,
            lastReadAt: progressByLesson.get(lesson.id)?.lastReadAt || null
        }))
    });
};

exports.listAnnouncements = async (req, res) => {
    const access = await courseParticipant(req.params.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    res.json(await Announcement.findAll({
        where: { courseId: access.course.id },
        include: [{ model: User, as: "author", attributes: ["id", "fullName", "role"] }],
        order: [["createdAt", "DESC"]]
    }));
};

exports.listMyAnnouncements = async (req, res) => {
    const enrollments = await Enrollment.findAll({
        where: { studentId: req.user.id },
        attributes: ["courseId"]
    });
    const courseIds = enrollments.map((enrollment) => enrollment.courseId);
    if (!courseIds.length) return res.json([]);
    const announcements = await Announcement.findAll({
        where: { courseId: { [Op.in]: courseIds } },
        include: [
            { model: User, as: "author", attributes: ["id", "fullName", "role"] },
            { model: Course, as: "course", attributes: ["id", "title"] }
        ],
        order: [["createdAt", "DESC"]]
    });
    res.json(announcements.map((announcement) => ({
        ...announcement.toJSON(),
        courseId: announcement.course.id,
        courseTitle: announcement.course.title
    })));
};

const publishAnnouncement = async ({ course, title, body, authorId, authorRoleName = null, transaction }) => {
    const announcement = await Announcement.create({
        title: title.trim(),
        body: body.trim(),
        courseId: course.id,
        createdById: authorId,
        authorRoleName
    }, { transaction });
    await createNotifications({
        courseId: course.id,
        type: "announcement",
        title: `Announcement: ${announcement.title}`,
        body: announcement.body.slice(0, 500),
        resourceType: "announcement",
        resourceId: announcement.id,
        transaction
    });
    return announcement;
};

exports.createAnnouncement = async (req, res) => {
    const access = await courseParticipant(req.params.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    if (!access.isManager && !hasCoursePermission(access.enrollment, "postAnnouncements")) {
        return res.status(403).json({ message: "Your lecturer has not granted announcement posting permission for this course" });
    }
    const authorRoleName = access.isManager ? null : access.enrollment.announcementRoleName;
    if (!access.isManager && !nonEmpty(authorRoleName, 80)) {
        return res.status(403).json({ message: "Your lecturer must assign you an announcement role before you can post" });
    }
    const { title, body } = req.body;
    if (!nonEmpty(title) || !nonEmpty(body, 20000)) {
        return res.status(400).json({ message: "Announcement title and body are required" });
    }
    const announcement = await sequelize.transaction((transaction) =>
        publishAnnouncement({
            course: access.course,
            title,
            body,
            authorId: req.user.id,
            authorRoleName,
            transaction
        })
    );
    res.status(201).json(announcement);
};

const announcementParticipant = async (announcementId, user) => {
    const announcement = await Announcement.findByPk(announcementId);
    if (!announcement) return { status: 404, message: "Announcement not found" };
    const access = await courseParticipant(announcement.courseId, user);
    if (access.status) return access;
    return { announcement, access };
};

exports.markAnnouncementViewed = async (req, res) => {
    const result = await announcementParticipant(req.params.id, req.user);
    if (result.status) return res.status(result.status).json({ message: result.message });
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required" });
    const [view] = await AnnouncementView.findOrCreate({
        where: { announcementId: result.announcement.id, userId: req.user.id },
        defaults: { announcementId: result.announcement.id, userId: req.user.id }
    });
    res.json({ viewedAt: view.viewedAt });
};

exports.setAnnouncementReaction = async (req, res) => {
    const result = await announcementParticipant(req.params.id, req.user);
    if (result.status) return res.status(result.status).json({ message: result.message });
    const { emoji } = req.body;
    if (typeof emoji !== "string" || !announcementEmojis.has(emoji)) {
        return res.status(400).json({ message: "Choose one of the available positive reactions" });
    }
    const where = { announcementId: result.announcement.id, userId: req.user.id };
    const current = await AnnouncementReaction.findOne({ where });
    if (current?.emoji === emoji) {
        await current.destroy();
        return res.json({ reaction: null });
    }
    if (current) {
        current.emoji = emoji;
        await current.save();
        return res.json({ reaction: current });
    }
    const reaction = await AnnouncementReaction.create({ ...where, emoji });
    res.json({ reaction });
};

exports.createAnnouncementComment = async (req, res) => {
    const result = await announcementParticipant(req.params.id, req.user);
    if (result.status) return res.status(result.status).json({ message: result.message });
    const { body, parentCommentId } = req.body;
    if (!nonEmpty(body, 2000)) {
        return res.status(400).json({ message: "Comment must contain 1 to 2000 characters" });
    }

    let parent = null;
    if (parentCommentId !== undefined && parentCommentId !== null && parentCommentId !== "") {
        const parsedParentId = idValue(parentCommentId);
        if (!parsedParentId) return res.status(400).json({ message: "Invalid parent comment" });
        parent = await AnnouncementComment.findByPk(parsedParentId);
        if (!parent || parent.announcementId !== result.announcement.id || parent.parentCommentId) {
            return res.status(400).json({ message: "Replies must belong to this announcement and a top-level comment" });
        }
        if (!result.access.isManager) {
            return res.status(403).json({ message: "Only the course lecturer can reply to comments" });
        }
    }

    const comment = await AnnouncementComment.create({
        announcementId: result.announcement.id,
        authorId: req.user.id,
        parentCommentId: parent?.id || null,
        body: body.trim()
    });
    const author = await User.findByPk(req.user.id, { attributes: ["id", "fullName", "role"] });
    res.status(201).json({ ...comment.toJSON(), author });
};

exports.setAnnouncementCommentReaction = async (req, res) => {
    const comment = await AnnouncementComment.findByPk(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    const result = await announcementParticipant(comment.announcementId, req.user);
    if (result.status) return res.status(result.status).json({ message: result.message });
    const where = { commentId: comment.id, userId: req.user.id };
    const current = await AnnouncementCommentReaction.findOne({ where });
    if (current) {
        await current.destroy();
        return res.json({ liked: false });
    }
    await AnnouncementCommentReaction.create(where);
    res.json({ liked: true });
};

exports.getAnnouncementActivity = async (req, res) => {
    const result = await announcementParticipant(req.params.id, req.user);
    if (result.status) return res.status(result.status).json({ message: result.message });
    const [views, reactions, comments] = await Promise.all([
        AnnouncementView.findAll({
            where: { announcementId: result.announcement.id },
            include: [{ model: User, as: "user", attributes: ["id", "fullName"] }],
            order: [["viewedAt", "ASC"]]
        }),
        AnnouncementReaction.findAll({
            where: { announcementId: result.announcement.id },
            include: [{ model: User, as: "user", attributes: ["id", "fullName"] }],
            order: [["createdAt", "ASC"]]
        }),
        AnnouncementComment.findAll({
            where: { announcementId: result.announcement.id },
            include: [
                { model: User, as: "author", attributes: ["id", "fullName", "role"] },
                {
                    model: AnnouncementCommentReaction,
                    as: "reactions",
                    attributes: ["userId"]
                }
            ],
            order: [["createdAt", "ASC"]]
        })
    ]);
    const enrollments = await Enrollment.findAll({
        where: {
            courseId: result.announcement.courseId,
            studentId: { [Op.in]: [...new Set(views.map((view) => view.userId))] }
        },
        attributes: ["studentId", "announcementRoleName"]
    });
    const rolesByStudent = new Map(enrollments.map((enrollment) => [
        enrollment.studentId, enrollment.announcementRoleName
    ]));
    const grouped = new Map();
    for (const reaction of reactions) {
        if (!grouped.has(reaction.emoji)) grouped.set(reaction.emoji, []);
        grouped.get(reaction.emoji).push({
            id: reaction.user?.id,
            fullName: reaction.user?.fullName || "Course member"
        });
    }
    res.json({
        viewers: result.access.isManager ? views.filter((view) => view.user).map((view) => ({
            id: view.user.id,
            fullName: view.user.fullName,
            roleName: rolesByStudent.get(view.userId) || null,
            viewedAt: view.viewedAt
        })) : [],
        reactions: [...grouped].map(([emoji, users]) => ({ emoji, users })),
        myReaction: reactions.find((reaction) => reaction.userId === req.user.id)?.emoji || null,
        comments: comments.map((comment) => ({
            id: comment.id,
            announcementId: comment.announcementId,
            authorId: comment.authorId,
            parentCommentId: comment.parentCommentId,
            body: comment.body,
            createdAt: comment.createdAt,
            author: comment.author,
            likeCount: comment.reactions.length,
            likedByMe: comment.reactions.some((reaction) => reaction.userId === req.user.id)
        }))
    });
};

exports.broadcastAnnouncement = async (req, res) => {
    const { title, body } = req.body;
    if (!nonEmpty(title) || !nonEmpty(body, 20000)) {
        return res.status(400).json({ message: "Announcement title and body are required" });
    }
    const courses = await Course.findAll({
        where: { lecturerId: req.user.id },
        order: [["id", "ASC"]]
    });
    if (!courses.length) {
        return res.status(400).json({ message: "Create a course before broadcasting an announcement" });
    }
    const announcements = await sequelize.transaction(async (transaction) => {
        const published = [];
        for (const course of courses) {
            published.push(await publishAnnouncement({
                course,
                title,
                body,
                authorId: req.user.id,
                transaction
            }));
        }
        return published;
    });
    res.status(201).json({ message: "Announcement sent to all your courses", announcements });
};

exports.updateAnnouncement = async (req, res) => {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    const access = await managerAccess(announcement.courseId, req.user, res);
    if (!access) return;
    const { title, body } = req.body;
    if ((title !== undefined && !nonEmpty(title)) || (body !== undefined && !nonEmpty(body, 20000))) {
        return res.status(400).json({ message: "Invalid announcement details" });
    }
    if (title !== undefined) announcement.title = title.trim();
    if (body !== undefined) announcement.body = body.trim();
    await announcement.save();
    res.json(announcement);
};

exports.deleteAnnouncement = async (req, res) => {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    const access = await managerAccess(announcement.courseId, req.user, res);
    if (!access) return;
    await sequelize.transaction(async (transaction) => {
        await Promise.all([
            AnnouncementReaction.destroy({ where: { announcementId: announcement.id }, transaction }),
            AnnouncementView.destroy({ where: { announcementId: announcement.id }, transaction })
        ]);
        await announcement.destroy({ transaction });
    });
    res.json({ message: "Announcement deleted" });
};

const getStudentMessageRoom = async (courseId, user, otherId = null) => {
    if (user.role !== "student") {
        return { error: { status: 403, message: "Student messaging is only available to students" } };
    }
    const enrollment = await Enrollment.findOne({
        where: { courseId, studentId: user.id }
    });
    if (!enrollment) {
        return { error: { status: 403, message: "Join this class before messaging classmates" } };
    }
    const classEnrollments = await Enrollment.findAll({
        where: { courseId },
        attributes: ["studentId"]
    });
    const classmateIds = classEnrollments
        .map((item) => item.studentId)
        .filter((studentId) => studentId !== user.id);
    if (otherId != null && !classmateIds.includes(otherId)) {
        return { error: { status: 403, message: "You can only message students in this class" } };
    }
    return { classmateIds };
};

exports.listConversations = async (req, res) => {
    const courseId = idValue(req.params.courseId);
    if (!courseId) return res.status(400).json({ message: "Invalid course ID" });
    const room = await getStudentMessageRoom(courseId, req.user);
    if (room.error) return accessResponse(res, room.error);
    if (!room.classmateIds.length) return res.json([]);
    const messages = await Message.findAll({
        where: {
            courseId,
            [Op.or]: [
                { senderId: req.user.id, recipientId: { [Op.in]: room.classmateIds } },
                { recipientId: req.user.id, senderId: { [Op.in]: room.classmateIds } }
            ]
        },
        include: [
            { model: User, as: "sender", attributes: ["id", "fullName", "role"] },
            { model: User, as: "recipient", attributes: ["id", "fullName", "role"] }
        ],
        order: [["createdAt", "DESC"]]
    });
    const grouped = new Map();
    const classmates = await User.findAll({
        where: { id: { [Op.in]: room.classmateIds } },
        attributes: ["id", "fullName", "role"],
        order: [["fullName", "ASC"]]
    });
    for (const classmate of classmates) {
        grouped.set(classmate.id, { participant: classmate, latestMessage: null });
    }
    for (const message of messages) {
        const otherId = message.senderId === req.user.id ? message.recipientId : message.senderId;
        const conversation = grouped.get(otherId);
        if (conversation && !conversation.latestMessage) {
            conversation.latestMessage = message;
        }
    }
    res.json([...grouped.values()]);
};

exports.listMessages = async (req, res) => {
    const courseId = idValue(req.params.courseId);
    const otherId = idValue(req.params.userId);
    if (!courseId || !otherId) return res.status(400).json({ message: "Invalid conversation" });
    const room = await getStudentMessageRoom(courseId, req.user, otherId);
    if (room.error) return accessResponse(res, room.error);
    const messages = await Message.findAll({
        where: { courseId, [Op.or]: [
            { senderId: req.user.id, recipientId: otherId },
            { senderId: otherId, recipientId: req.user.id }
        ] },
        order: [["createdAt", "ASC"]]
    });
    const readAt = new Date();
    await Message.update({ readAt }, {
        where: { courseId, senderId: otherId, recipientId: req.user.id, readAt: null }
    });
    for (const message of messages) {
        if (message.senderId === otherId && !message.readAt) message.readAt = readAt;
    }
    res.json(messages);
};

exports.sendMessage = async (req, res) => {
    const courseId = idValue(req.params.courseId);
    const recipientId = idValue(req.body.recipientId);
    if (!courseId || !recipientId || !nonEmpty(req.body.body, 20000)) {
        return res.status(400).json({ message: "Recipient and message body are required" });
    }
    const room = await getStudentMessageRoom(courseId, req.user, recipientId);
    if (room.error) return accessResponse(res, room.error);
    const message = await sequelize.transaction(async (transaction) => {
        const created = await Message.create({
            courseId,
            senderId: req.user.id,
            recipientId,
            body: req.body.body.trim()
        }, { transaction });
        await createNotifications({
            userIds: [recipientId],
            type: "message",
            title: "New course message",
            body: req.body.body.trim().slice(0, 500),
            resourceType: "message",
            resourceId: created.id,
            transaction
        });
        return created;
    });
    res.status(201).json(message);
};

const lecturerMessageAccess = async (courseId, user) => {
    const course = await Course.findByPk(courseId);
    if (!course) return { status: 404, message: "Course not found" };
    if (user.role === "lecturer" && course.lecturerId === user.id) return { course, isManager: true };
    if (user.role !== "student") return { status: 403, message: "Course messaging access denied" };
    const enrollment = await Enrollment.findOne({ where: { courseId, studentId: user.id } });
    if (!hasCoursePermission(enrollment, "messageLecturer")) {
        return { status: 403, message: "Your lecturer has not enabled private course messages" };
    }
    return { course, enrollment, isManager: false };
};

const lecturerMessageStudentIds = async (courseId) => {
    const enrollments = await Enrollment.findAll({ where: { courseId } });
    return enrollments
        .filter((enrollment) => hasCoursePermission(enrollment, "messageLecturer"))
        .map((enrollment) => enrollment.studentId);
};

exports.listLecturerMessages = async (req, res) => {
    const courseId = idValue(req.params.courseId);
    if (!courseId) return res.status(400).json({ message: "Invalid course ID" });
    const access = await lecturerMessageAccess(courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    const permittedStudentIds = access.isManager ? await lecturerMessageStudentIds(courseId) : [];
    if (access.isManager && !permittedStudentIds.length) {
        return res.json({ messages: [], students: [] });
    }
    const where = access.isManager
        ? {
            courseId,
            [Op.or]: [
                { senderId: access.course.lecturerId, recipientId: { [Op.in]: permittedStudentIds } },
                { recipientId: access.course.lecturerId, senderId: { [Op.in]: permittedStudentIds } }
            ]
        }
        : {
            courseId,
            [Op.or]: [
                { senderId: req.user.id, recipientId: access.course.lecturerId },
                { senderId: access.course.lecturerId, recipientId: req.user.id }
            ]
        };
    const messages = await Message.findAll({
        where,
        include: [
            { model: User, as: "sender", attributes: ["id", "fullName", "role"] },
            { model: User, as: "recipient", attributes: ["id", "fullName", "role"] }
        ],
        order: [["createdAt", "ASC"]]
    });
    if (!access.isManager) {
        const readAt = new Date();
        await Message.update({ readAt }, {
            where: { courseId, senderId: access.course.lecturerId, recipientId: req.user.id, readAt: null }
        });
        messages.forEach((message) => {
            if (message.senderId === access.course.lecturerId && !message.readAt) message.readAt = readAt;
        });
        return res.json(messages);
    }
    const enrollments = await Enrollment.findAll({
        where: { courseId, studentId: { [Op.in]: permittedStudentIds } },
        include: [{ model: User, as: "student", attributes: ["id", "fullName", "email"] }],
        order: [[{ model: User, as: "student" }, "fullName", "ASC"]]
    });
    res.json({
        messages,
        students: enrollments.filter((item) => item.student).map((item) => item.student)
    });
};

exports.sendLecturerMessage = async (req, res) => {
    const courseId = idValue(req.params.courseId);
    if (!courseId || !nonEmpty(req.body.body, 20000)) {
        return res.status(400).json({ message: "A course and message body are required" });
    }
    const access = await lecturerMessageAccess(courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    let recipientId;
    if (access.isManager) {
        recipientId = idValue(req.body.recipientId);
        const enrollment = recipientId
            ? await Enrollment.findOne({ where: { courseId, studentId: recipientId } })
            : null;
        if (!enrollment || !hasCoursePermission(enrollment, "messageLecturer")) {
            return res.status(403).json({ message: "Choose a student who has lecturer messaging permission" });
        }
    } else {
        recipientId = access.course.lecturerId;
    }
    const message = await sequelize.transaction(async (transaction) => {
        const created = await Message.create({
            courseId,
            senderId: req.user.id,
            recipientId,
            body: req.body.body.trim()
        }, { transaction });
        await createNotifications({
            userIds: [recipientId],
            type: "message",
            title: "New course message",
            body: req.body.body.trim().slice(0, 500),
            resourceType: "message",
            resourceId: created.id,
            transaction
        });
        return created;
    });
    res.status(201).json(message);
};

exports.listNotifications = async (req, res) => {
    res.json(await Notification.findAll({
        where: { userId: req.user.id },
        order: [["createdAt", "DESC"]],
        limit: 100
    }));
};

exports.markNotificationRead = async (req, res) => {
    const notification = await Notification.findOne({
        where: { id: req.params.id, userId: req.user.id }
    });
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    if (!notification.readAt) {
        notification.readAt = new Date();
        await notification.save();
    }
    res.json(notification);
};

exports.markAllNotificationsRead = async (req, res) => {
    const [updated] = await Notification.update({ readAt: new Date() }, {
        where: { userId: req.user.id, readAt: null }
    });
    res.json({ updated });
};

exports.listCalendarEvents = async (req, res) => {
    const access = await courseParticipant(req.params.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    const storedEvents = await CalendarEvent.findAll({
        where: { courseId: access.course.id },
        order: [["startsAt", "ASC"]]
    });
    const from = new Date();
    const to = new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);
    const recurringEvents = getOccurrences(
        access.course,
        from,
        to,
        storedEvents.filter((event) => event.occurrenceDate)
    ).map((event) => ({
        ...event,
        eventType: event.type
    }));
    const recurringEventIds = new Set(recurringEvents.map((event) => event.id));
    const movedEvents = storedEvents.filter((event) =>
        event.occurrenceDate && event.status === "rescheduled" &&
        !recurringEventIds.has(event.id) &&
        new Date(event.startsAt) >= from && new Date(event.startsAt) < to
    );
    res.json([
        ...storedEvents.filter((event) => !event.occurrenceDate),
        ...recurringEvents,
        ...movedEvents
    ].sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt)));
};

exports.listMyCalendar = async (req, res) => {
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) ||
        (from && to && from > to)) {
        return res.status(400).json({ message: "Invalid calendar date range" });
    }

    let courses;
    if (req.user.role === "student") {
        const enrollments = await Enrollment.findAll({
            where: { studentId: req.user.id },
            attributes: ["courseId"]
        });
        courses = await Course.findAll({
            where: { id: { [Op.in]: enrollments.map((enrollment) => enrollment.courseId) } },
            attributes: ["id", "title", "classDays", "classStartTime", "classEndTime", "classTimeZone", "startDate", "endDate"]
        });
    } else {
        courses = await Course.findAll({
            where: { lecturerId: req.user.id },
            attributes: ["id", "title", "classDays", "classStartTime", "classEndTime", "classTimeZone", "startDate", "endDate"]
        });
    }

    const courseIds = courses.map((course) => course.id);
    if (!courseIds.length) return res.json([]);
    const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
    const [events, assignments] = await Promise.all([
        CalendarEvent.findAll({
            where: {
                courseId: { [Op.in]: courseIds },
                ...(from || to ? { [Op.or]: [
                    { occurrenceDate: { ...(from ? { [Op.gte]: from.toISOString().slice(0, 10) } : {}), ...(to ? { [Op.lte]: to.toISOString().slice(0, 10) } : {}) } },
                    { startsAt: { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lt]: to } : {}) } }
                ] } : {})
            },
            order: [["startsAt", "ASC"]]
        }),
        Assignment.findAll({
            where: {
                courseId: { [Op.in]: courseIds },
                ...(from || to ? {
                    dueDate: {
                        ...(from ? { [Op.gte]: from } : {}),
                        ...(to ? { [Op.lte]: to } : {})
                    }
                } : {})
            },
            order: [["dueDate", "ASC"]]
        })
    ]);

    const recurringEvents = courses.flatMap((course) => getOccurrences(
        course,
        from || new Date(),
        to || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        events.filter((event) => event.courseId === course.id && event.occurrenceDate)
    ));
    const recurringEventIds = new Set(recurringEvents.map((event) => event.id));
    const rescheduledOccurrences = events.filter((event) =>
        event.occurrenceDate && event.status === "rescheduled" &&
        !recurringEventIds.has(event.id) &&
        (!from || new Date(event.startsAt) >= from) &&
        (!to || new Date(event.startsAt) < to)
    ).map((event) => ({
        id: event.id,
        type: "class",
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        courseId: event.courseId,
        courseTitle: courseTitles.get(event.courseId),
        status: event.status,
        recurring: true,
        scheduledDate: event.occurrenceDate
    }));
    const agenda = [
        ...events.filter((event) => !event.occurrenceDate && (!from || new Date(event.startsAt) >= from) && (!to || new Date(event.startsAt) < to)).map((event) => ({
            id: `event-${event.id}`,
            eventId: event.id,
            type: event.eventType,
            title: event.title,
            description: event.description,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            courseId: event.courseId,
            courseTitle: courseTitles.get(event.courseId),
            assessmentId: event.assessmentId,
            status: event.status
        })),
        ...recurringEvents,
        ...rescheduledOccurrences,
        ...assignments.map((assignment) => ({
            id: `assignment-${assignment.id}`,
            type: "assignment",
            assignmentId: assignment.id,
            title: assignment.title,
            description: assignment.description,
            startsAt: assignment.dueDate,
            endsAt: assignment.dueDate,
            courseId: assignment.courseId,
            courseTitle: courseTitles.get(assignment.courseId),
            canReschedule: req.user.role === "lecturer"
        }))
    ];
    agenda.sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
    res.json(agenda);
};

const validEventTimes = (startsAt, endsAt) => {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
};

exports.createCalendarEvent = async (req, res) => {
    const access = await managerAccess(req.params.courseId, req.user, res);
    if (!access) return;
    const { title, description, startsAt, endsAt, eventType = "event" } = req.body;
    const validTypes = ["event", "class", "exam", "deadline", "assessment", "quiz", "no-school", "other"];
    let assessment = null;
    if (["assessment", "quiz"].includes(eventType)) {
        assessment = await QuizAssessment.findOne({
            where: { id: idValue(req.body.assessmentId), courseId: access.course.id }
        });
        if (!assessment) return res.status(400).json({ message: "Select a timed assessment from this course" });
    }
    if (!nonEmpty(title) || !validEventTimes(startsAt, endsAt) ||
        !validTypes.includes(eventType) ||
        (description != null && typeof description !== "string") ||
        (eventType === "no-school" && !nonEmpty(description, 20000))) {
        return res.status(400).json({ message: "Valid title, start, and end times are required" });
    }
    const event = await sequelize.transaction(async (transaction) => {
        const created = await CalendarEvent.create({
            courseId: access.course.id, createdById: req.user.id, eventType,
            title: eventType === "no-school" ? "No school" : title.trim(),
            description: description?.trim() || null, startsAt: new Date(startsAt), endsAt: new Date(endsAt),
            assessmentId: assessment?.id || null
        }, { transaction });
        await createNotifications({
            courseId: access.course.id,
            type: "calendar",
            title: `New course event: ${created.title}`,
            body: created.description || created.startsAt.toISOString(),
            resourceType: "calendarEvent",
            resourceId: created.id,
            transaction
        });
        return created;
    });
    res.status(201).json(event);
};

exports.updateClassOccurrence = async (req, res) => {
    const access = await managerAccess(req.params.courseId, req.user, res);
    if (!access) return;
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !access.course.classStartTime ||
        !Array.isArray(access.course.classDays)) {
        return res.status(400).json({ message: "This course has no valid recurring class schedule" });
    }
    const [year, month, day] = date.split("-").map(Number);
    const scheduledDate = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.toISOString().slice(0, 10) !== date ||
        !access.course.classDays.includes(scheduledDate.getUTCDay())) {
        return res.status(400).json({ message: "Choose a scheduled class date" });
    }
    const status = req.body.status;
    if (!["cancelled", "rescheduled"].includes(status)) {
        return res.status(400).json({ message: "Choose cancelled or rescheduled for this class" });
    }
    const zone = access.course.classTimeZone || "UTC";
    const originalStart = dateTimeInZone(date, access.course.classStartTime, zone);
    const originalEnd = dateTimeInZone(date, access.course.classEndTime, zone);
    const startsAt = status === "cancelled" ? originalStart : new Date(req.body.startsAt);
    const endsAt = status === "cancelled" ? originalEnd : new Date(req.body.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        return res.status(400).json({ message: "Enter valid replacement class start and end times" });
    }
    const details = req.body.description;
    const title = req.body.title;
    if ((details != null && typeof details !== "string") ||
        (title !== undefined && !nonEmpty(title))) {
        return res.status(400).json({ message: "Enter a valid class title and details" });
    }
    const event = await sequelize.transaction(async (transaction) => {
        const [record] = await CalendarEvent.findOrCreate({
            where: { courseId: access.course.id, occurrenceDate: date },
            defaults: {
                courseId: access.course.id,
                createdById: req.user.id,
                eventType: "class",
                occurrenceDate: date,
                status,
                title: `${access.course.title} class`,
                description: details?.trim() || null,
                startsAt,
                endsAt
            },
            transaction
        });
        await record.update({
            status,
            title: nonEmpty(title) ? title.trim() : record.title,
            description: details?.trim() || null,
            startsAt,
            endsAt
        }, { transaction });
        return record;
    });
    res.json(event);
};

exports.updateCalendarEvent = async (req, res) => {
    const event = await CalendarEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json({ message: "Calendar event not found" });
    const access = await managerAccess(event.courseId, req.user, res);
    if (!access) return;
    const startsAt = req.body.startsAt ?? event.startsAt;
    const endsAt = req.body.endsAt ?? event.endsAt;
    const validTypes = ["event", "class", "exam", "deadline", "assessment", "quiz", "no-school", "other"];
    const nextEventType = req.body.eventType ?? event.eventType;
    const nextDescription = req.body.description ?? event.description;
    if (!validEventTimes(startsAt, endsAt) ||
        (req.body.eventType !== undefined && !validTypes.includes(req.body.eventType)) ||
        (req.body.title !== undefined && !nonEmpty(req.body.title)) ||
        (req.body.description !== undefined && req.body.description !== null && typeof req.body.description !== "string") ||
        (nextEventType === "no-school" && !nonEmpty(nextDescription, 20000))) {
        return res.status(400).json({ message: "Invalid calendar event details" });
    }
    if (["assessment", "quiz"].includes(req.body.eventType ?? event.eventType)) {
        const assessment = await QuizAssessment.findOne({
            where: { id: event.assessmentId, courseId: event.courseId }
        });
        if (!assessment) return res.status(400).json({ message: "This calendar item must be linked to an assessment in its course" });
    }
    if (nextEventType === "no-school") event.title = "No school";
    else if (req.body.title !== undefined) event.title = req.body.title.trim();
    if (req.body.eventType !== undefined) event.eventType = req.body.eventType;
    if (req.body.description !== undefined) event.description = req.body.description?.trim() || null;
    event.startsAt = startsAt;
    event.endsAt = endsAt;
    await event.save();
    res.json(event);
};

exports.deleteCalendarEvent = async (req, res) => {
    const event = await CalendarEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json({ message: "Calendar event not found" });
    const access = await managerAccess(event.courseId, req.user, res);
    if (!access) return;
    await event.destroy();
    res.json({ message: "Calendar event deleted" });
};

exports.listDepartments = async (req, res) => {
    res.json(await Department.findAll({ order: [["name", "ASC"]] }));
};

exports.listCertificates = async (req, res) => {
    res.json(await Certificate.findAll({
        where: { studentId: req.user.id },
        include: [{ model: Course, as: "course", attributes: ["id", "title"] }],
        order: [["issuedAt", "DESC"]]
    }));
};

exports.issueCertificate = async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required" });
    const courseId = idValue(req.params.courseId);
    if (!courseId) return res.status(400).json({ message: "Invalid course ID" });
    const enrollment = await Enrollment.findOne({ where: { studentId: req.user.id, courseId } });
    if (!enrollment) return res.status(403).json({ message: "Enroll in the course first" });
    const lessons = await Lesson.findAll({ where: { courseId }, attributes: ["id"] });
    if (!lessons.length) return res.status(409).json({ message: "Complete all course lessons before requesting a certificate" });
    const completed = await LessonProgress.count({
        where: { studentId: req.user.id, lessonId: { [Op.in]: lessons.map((lesson) => lesson.id) }, completedAt: { [Op.ne]: null } }
    });
    if (completed !== lessons.length) {
        return res.status(409).json({ message: "Complete all course lessons before requesting a certificate" });
    }
    const code = `${courseId}-${req.user.id}-${require("crypto").randomUUID()}`;
    const [certificate, created] = await Certificate.findOrCreate({
        where: { studentId: req.user.id, courseId },
        defaults: { studentId: req.user.id, courseId, certificateCode: code, issuedAt: new Date() }
    });
    res.status(created ? 201 : 200).json(certificate);
};

exports.updateCourseDepartment = async (req, res) => {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    const access = await managerAccess(course.id, req.user, res);
    if (!access) return;
    const departmentId = req.body.departmentId;
    if (departmentId !== null && departmentId !== undefined) {
        const id = idValue(departmentId);
        if (!id || !(await Department.findByPk(id))) {
            return res.status(400).json({ message: "Department not found" });
        }
        course.departmentId = id;
    } else {
        course.departmentId = null;
    }
    await course.save();
    res.json(course);
};
