const Lesson = require("../models/Lesson");
const LessonNote = require("../models/LessonNote");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const getCourseAccess = require("../utils/courseAccess");
const discardUpload = require("../utils/discardUpload");
const Module = require("../models/Module");
const LessonProgress = require("../models/LessonProgress");
const { sequelize } = require("../config/db");
const materialUpload = require("../utils/materialUpload");
const { removeStoredUpload } = require("../utils/storedUpload");
const { hasCoursePermission } = require("../utils/coursePermissions");

const isValidResourceUrl = (value) => {
    if (typeof value !== "string" || value.length > 2048) return false;
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};

const toMaterialResponse = (lesson) => {
    const data = lesson.toJSON();
    data.hasFile = Boolean(data.fileUrl);
    if (data.videoUrl && !isValidResourceUrl(data.videoUrl)) data.videoUrl = null;
    delete data.fileUrl;
    return data;
};

exports.createLesson = async (req, res) => {
    let uploadedFile;
    try {
        const { title, content, videoUrl, courseId, moduleId, orderIndex } = req.body;

        const resourceUrl = typeof videoUrl === "string" ? videoUrl.trim() : "";
        if (typeof title !== "string" || !title.trim() ||
            (typeof content !== "undefined" && typeof content !== "string") ||
            (videoUrl !== undefined && typeof videoUrl !== "string") ||
            (!resourceUrl && (typeof content !== "string" || !content.trim()) &&
                !req.file && !req.body.fileStorageKey) ||
            !Number.isSafeInteger(Number(courseId)) || Number(courseId) <= 0 ||
            (orderIndex !== undefined && (!Number.isInteger(orderIndex) || orderIndex < 0))) {
            await discardUpload(req.file);
            return res.status(400).json({ message: videoUrl !== undefined && typeof videoUrl !== "string"
                ? "Resource link must be text"
                : "Add a file, resource link, or written content" });
        }
        if (resourceUrl && !isValidResourceUrl(resourceUrl)) {
            await discardUpload(req.file);
            return res.status(400).json({ message: "Resource link must be a valid HTTP or HTTPS URL" });
        }

        const course = await Course.findByPk(courseId);
        if (!course) {
            await discardUpload(req.file);
            return res.status(404).json({ message: "Course not found" });
        }
        const isLecturer = course.lecturerId === req.user.id && req.user.role === "lecturer";
        if (req.user.role === "lecturer" && !isLecturer) {
            await discardUpload(req.file);
            return res.status(403).json({ message: "You can only add lessons to your courses" });
        }
        if (!isLecturer) {
            const enrollment = req.user.role === "student"
                ? await Enrollment.findOne({
                    where: { studentId: req.user.id, courseId: course.id }
                })
                : null;
            if (!hasCoursePermission(enrollment, "uploadMaterials")) {
                await discardUpload(req.file);
                return res.status(403).json({ message: "Your lecturer has not granted course material upload permission" });
            }
        }
        if (req.user.role !== "lecturer" && req.user.role !== "student") {
            await discardUpload(req.file);
            return res.status(403).json({ message: "Course material upload access denied" });
        }
        if (typeof title !== "string" || title.trim().length > 255 ||
            (content !== undefined && typeof content !== "string") ||
            (req.body.description !== undefined && typeof req.body.description !== "string") ||
            (typeof content === "string" && content.trim().length > 60000) ||
            (typeof req.body.description === "string" && req.body.description.trim().length > 10000)) {
            await discardUpload(req.file);
            return res.status(400).json({ message: "Material title, content, or description exceeds the allowed length" });
        }
        let validModuleId = null;
        if (moduleId !== undefined && moduleId !== null) {
            const parsedModuleId = Number(moduleId);
            if (!Number.isSafeInteger(parsedModuleId) || parsedModuleId <= 0) {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Invalid module ID" });
            }
            const module = await Module.findOne({
                where: { id: parsedModuleId, courseId: course.id }
            });
            if (!module) {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Module must belong to the lesson course" });
            }
            validModuleId = module.id;
        }

        uploadedFile = await materialUpload(req.file, req.body, req.user.id);
        const lesson = await Lesson.create({
            title: title.trim(),
            content: typeof content === "string" ? content.trim() : "",
            description: typeof req.body.description === "string" ? req.body.description.trim() || null : null,
            videoUrl: typeof videoUrl === "string" && videoUrl.trim() ? videoUrl.trim() : null,
            courseId: course.id,
            moduleId: validModuleId,
            orderIndex: orderIndex ?? 0,
            fileUrl: uploadedFile?.fileUrl || null,
            fileName: uploadedFile?.fileName || null,
            mimeType: uploadedFile?.mimeType || null,
            fileSize: uploadedFile?.fileSize || null,
            uploadedById: req.user.id
        });

        res.status(201).json({
            message: "Lesson created successfully",
            lesson: toMaterialResponse(lesson)
        });

    } catch (error) {
        await discardUpload(req.file);
        if (uploadedFile && !req.file) {
            try {
                await removeMaterialFile(uploadedFile.fileUrl);
            } catch (cleanupError) {
                console.error("Failed to remove rejected course material:", cleanupError);
            }
        }
        if (error.message === "File contents do not match a supported material file type" ||
            error.message.startsWith("The uploaded file") ||
            error.message.startsWith("Choose a valid file name")) {
            return res.status(400).json({ message: error.message });
        }
        console.error("Failed to create lesson:", error);
        res.status(500).json({ message: "Failed to create lesson" });
    }
};

exports.updateLesson = async (req, res) => {
    let previousFileUrl;
    let uploadedFile;
    try {
        const lesson = await Lesson.findByPk(req.params.id);
        if (!lesson) {
            await discardUpload(req.file);
            return res.status(404).json({ message: "Course material not found" });
        }
        const course = await Course.findByPk(lesson.courseId);
        if (!course || course.lecturerId !== req.user.id) {
            await discardUpload(req.file);
            return res.status(404).json({ message: "Course material not found" });
        }
        const updates = {};
        if (req.body.title !== undefined) {
            if (typeof req.body.title !== "string" || !req.body.title.trim() || req.body.title.trim().length > 255) {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Material title is required and must be at most 255 characters" });
            }
            updates.title = req.body.title.trim();
        }
        if (req.body.description !== undefined) {
            if (typeof req.body.description !== "string" || req.body.description.trim().length > 10000) {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Material description must be at most 10000 characters" });
            }
            updates.description = req.body.description.trim() || null;
        }
        if (req.body.content !== undefined) {
            if (typeof req.body.content !== "string" || req.body.content.trim().length > 60000 ||
                (!req.body.content.trim() && !req.file && !req.body.fileStorageKey && !lesson.fileUrl &&
                    !(typeof req.body.videoUrl === "string" ? req.body.videoUrl.trim() : lesson.videoUrl))) {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Add a file, resource link, or written content" });
            }
            updates.content = req.body.content.trim();
        }
        if (req.body.videoUrl !== undefined) {
            if (typeof req.body.videoUrl !== "string") {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Resource link must be text" });
            }
            if (req.body.videoUrl.trim() && !isValidResourceUrl(req.body.videoUrl.trim())) {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Resource link must be a valid HTTP or HTTPS URL" });
            }
            if (!req.body.videoUrl.trim() && !req.file && !req.body.fileStorageKey && !lesson.fileUrl &&
                !(typeof req.body.content === "string" ? req.body.content.trim() : lesson.content?.trim())) {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Add a file, resource link, or written content" });
            }
            updates.videoUrl = req.body.videoUrl.trim() || null;
        }
        if (req.body.moduleId !== undefined) {
            const moduleId = req.body.moduleId === "" ? null : Number(req.body.moduleId);
            if (moduleId !== null && (!Number.isSafeInteger(moduleId) || moduleId <= 0 ||
                !await Module.findOne({ where: { id: moduleId, courseId: course.id } }))) {
                await discardUpload(req.file);
                return res.status(400).json({ message: "Module must belong to the lesson course" });
            }
            updates.moduleId = moduleId;
        }
        uploadedFile = await materialUpload(req.file, req.body, req.user.id);
        if (uploadedFile) {
            previousFileUrl = lesson.fileUrl;
            updates.fileUrl = uploadedFile.fileUrl;
            updates.fileName = uploadedFile.fileName;
            updates.mimeType = uploadedFile.mimeType;
            updates.fileSize = uploadedFile.fileSize;
            updates.uploadedById = req.user.id;
        }
        if (!Object.keys(updates).length) {
            await discardUpload(req.file);
            return res.status(400).json({ message: "At least one material field must be provided" });
        }
        await lesson.update(updates);
        if (previousFileUrl) {
            try {
                await removeMaterialFile(previousFileUrl);
            } catch (cleanupError) {
                console.error("Failed to remove replaced material file:", cleanupError);
            }
        }
        return res.json({ message: "Course material updated successfully", lesson: toMaterialResponse(lesson) });
    } catch (error) {
        await discardUpload(req.file);
        if (uploadedFile && !req.file) {
            try {
                await removeMaterialFile(uploadedFile.fileUrl);
            } catch (cleanupError) {
                console.error("Failed to remove rejected course material:", cleanupError);
            }
        }
        if (error.message === "File contents do not match a supported material file type" ||
            error.message.startsWith("The uploaded file") ||
            error.message.startsWith("Choose a valid file name")) {
            return res.status(400).json({ message: error.message });
        }
        console.error("Failed to update course material:", error);
        return res.status(500).json({ message: "Failed to update course material" });
    }
};

exports.deleteLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findByPk(req.params.id);
        if (!lesson) return res.status(404).json({ message: "Course material not found" });
        const course = await Course.findByPk(lesson.courseId);
        if (!course || course.lecturerId !== req.user.id) {
            return res.status(404).json({ message: "Course material not found" });
        }
        const fileUrl = lesson.fileUrl;
        await sequelize.transaction(async (transaction) => {
            await LessonNote.destroy({ where: { lessonId: lesson.id }, transaction });
            await LessonProgress.destroy({ where: { lessonId: lesson.id }, transaction });
            await lesson.destroy({ transaction });
        });
        if (fileUrl) await removeMaterialFile(fileUrl);
        return res.json({ message: "Course material deleted successfully" });
    } catch (error) {
        console.error("Failed to delete course material:", error);
        return res.status(500).json({ message: "Failed to delete course material" });
    }
};

exports.getPrivateNote = async (req, res) => {
    try {
        const lesson = await Lesson.findByPk(req.params.id);
        if (!lesson) return res.status(404).json({ message: "Course material not found" });

        const access = await getCourseAccess(lesson.courseId, req.user);
        if (access.status) return res.status(access.status).json({ message: access.message });

        const note = await LessonNote.findOne({
            where: { lessonId: lesson.id, userId: req.user.id }
        });
        return res.json({ note: note?.content || "" });
    } catch (error) {
        console.error("Failed to load private material note:", error);
        return res.status(500).json({ message: "Failed to load private material note" });
    }
};

exports.savePrivateNote = async (req, res) => {
    try {
        const lesson = await Lesson.findByPk(req.params.id);
        if (!lesson) return res.status(404).json({ message: "Course material not found" });

        const access = await getCourseAccess(lesson.courseId, req.user);
        if (access.status) return res.status(access.status).json({ message: access.message });

        if (typeof req.body.note !== "string" || req.body.note.length > 60000) {
            return res.status(400).json({ message: "Private notes must be text of at most 60000 characters" });
        }

        await LessonNote.upsert({
            lessonId: lesson.id,
            userId: req.user.id,
            content: req.body.note
        }, { conflictFields: ["lessonId", "userId"] });
        return res.json({ message: "Private note saved", note: req.body.note });
    } catch (error) {
        console.error("Failed to save private material note:", error);
        return res.status(500).json({ message: "Failed to save private material note" });
    }
};

const removeMaterialFile = async (fileUrl) => {
    return removeStoredUpload(fileUrl);
};

exports.getLessons = async (req, res) => {
    try {
        const access = await getCourseAccess(req.params.courseId, req.user);
        if (access.status) return res.status(access.status).json({ message: access.message });

        const lessons = await Lesson.findAll({
            where: { courseId: access.course.id },
            include: [{ model: User, as: "uploader", attributes: ["id", "fullName"], required: false }],
            order: [["moduleId", "ASC"], ["orderIndex", "ASC"], ["id", "ASC"]]
        });

        res.json(lessons.map(toMaterialResponse));

    } catch (error) {
        console.error("Failed to load lessons:", error);
        res.status(500).json({ message: "Failed to load lessons" });
    }
};
