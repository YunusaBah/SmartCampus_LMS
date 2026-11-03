const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Quiz = require("../models/Quiz");
const Assignment = require("../models/Assignment");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const getCourseAccess = require("../utils/courseAccess");
const generateClassCode = require("../utils/generateClassCode");
const Department = require("../models/Department");
const Module = require("../models/Module");
const LessonProgress = require("../models/LessonProgress");
const QuizResult = require("../models/QuizResult");
const QuizAttempt = require("../models/QuizAttempt");
const Submission = require("../models/Submission");
const Certificate = require("../models/Certificate");
const Announcement = require("../models/Announcement");
const Message = require("../models/Message");
const CalendarEvent = require("../models/CalendarEvent");
const QuizAssessment = require("../models/QuizAssessment");
const { sequelize } = require("../config/db");
const recordAuditLog = require("../utils/recordAuditLog");
const materialUpload = require("../utils/materialUpload");
const { removeStoredUpload } = require("../utils/storedUpload");
const { fn, col } = require("sequelize");
const {
    COURSE_PERMISSIONS,
    COURSE_PERMISSION_ROLES,
    normalizePermissions
} = require("../utils/coursePermissions");
const optionalText = (value, maxLength, fieldName) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || value.trim().length > maxLength) {
        throw new Error(`${fieldName} must be no longer than ${maxLength} characters`);
    }
    return value.trim() || null;
};

const parseCourseDates = (startDate, endDate) => {
    const isValidDate = (value) => {
        if (value === undefined || value === null || value === "") return true;
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        throw new Error("Course dates must use YYYY-MM-DD format");
    }
    if (startDate && endDate && startDate > endDate) {
        throw new Error("Course end date must be on or after its start date");
    }
    return { startDate: startDate || null, endDate: endDate || null };
};

const parseEnrollmentEnabled = (value) => {
    if (value === undefined) return true;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    throw new Error("Enrollment setting must be true or false");
};

const parseClassSchedule = (body, creating = false) => {
    const scheduleProvided = ["classDays", "classStartTime", "classEndTime", "classTimeZone"]
        .some((field) => body[field] !== undefined);
    if (!scheduleProvided && !creating) return {};

    let classDays = body.classDays;
    if (typeof classDays === "string") {
        try {
            classDays = JSON.parse(classDays);
        } catch {
            throw new Error("Class days must be a list of weekdays");
        }
    }
    if (!Array.isArray(classDays) || !classDays.length ||
        classDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
        new Set(classDays).size !== classDays.length) {
        throw new Error("Choose at least one valid class day");
    }
    const validTime = (value) => typeof value === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validTime(body.classStartTime) || !validTime(body.classEndTime) ||
        body.classStartTime >= body.classEndTime) {
        throw new Error("Enter a valid class start and end time");
    }
    const classTimeZone = body.classTimeZone || "UTC";
    try {
        new Intl.DateTimeFormat("en", { timeZone: classTimeZone });
    } catch {
        throw new Error("Choose a valid class time zone");
    }
    return {
        classDays: [...classDays].sort((left, right) => left - right),
        classStartTime: body.classStartTime,
        classEndTime: body.classEndTime,
        classTimeZone
    };
};

const validateCourseFields = (body, creating = false) => {
    const title = body.title;
    if (creating && (typeof title !== "string" || !title.trim())) {
        throw new Error("Course name is required");
    }
    if (title !== undefined && (typeof title !== "string" || !title.trim() || title.trim().length > 255)) {
        throw new Error("Course name must be between 1 and 255 characters");
    }
    const status = body.status;
    if (status !== undefined && !["active", "archived"].includes(status)) {
        throw new Error("Course status must be active or archived");
    }
    return {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(body.description !== undefined
            ? { description: optionalText(body.description, 10000, "Description") || "" }
            : creating ? { description: "" } : {}),
        ...(body.academicCode !== undefined ? { academicCode: optionalText(body.academicCode, 50, "Academic course code") } : {}),
        ...(body.category !== undefined ? { category: optionalText(body.category, 100, "Course category") } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(body.enrollmentEnabled !== undefined
            ? { enrollmentEnabled: parseEnrollmentEnabled(body.enrollmentEnabled) }
            : {}),
        ...((body.startDate !== undefined || body.endDate !== undefined)
            ? parseCourseDates(body.startDate, body.endDate)
            : {}),
        ...parseClassSchedule(body, creating)
    };
};

const idValue = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

exports.createCourse = async (req, res) => {
    let uploadedFile;
    try {
        const { departmentId } = req.body;
        const fields = validateCourseFields(req.body, true);
        const introContent = optionalText(req.body.introContent ?? req.body.contents, 60000, "Introductory content") || "";
        uploadedFile = await materialUpload(req.file, req.body, req.user.id);
        let validDepartmentId = null;
        if (departmentId !== undefined && departmentId !== null) {
            const parsedDepartmentId = Number(departmentId);
            if (!Number.isSafeInteger(parsedDepartmentId) || parsedDepartmentId <= 0) {
                if (uploadedFile) await removeStoredUpload(uploadedFile.fileUrl);
                return res.status(400).json({ message: "Department not found" });
            }
            const department = await Department.findByPk(parsedDepartmentId);
            if (!department) {
                if (uploadedFile) await removeStoredUpload(uploadedFile.fileUrl);
                return res.status(400).json({ message: "Department not found" });
            }
            validDepartmentId = department.id;
        }

        let course;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const classCode = await generateClassCode();
            try {
                course = await sequelize.transaction(async (transaction) => {
                    const created = await Course.create({
                        ...fields,
                        contentFileUrl: null,
                        contentFileName: null,
                        lecturerId: req.user.id,
                        classCode,
                        departmentId: validDepartmentId
                    }, { transaction });
                    if (introContent || uploadedFile) {
                        await Lesson.create({
                            title: uploadedFile?.fileName || "Course introduction",
                            content: introContent || "Download the attached course material.",
                            fileUrl: uploadedFile?.fileUrl || null,
                            fileName: uploadedFile?.fileName || null,
                            description: null,
                            mimeType: uploadedFile?.mimeType || null,
                            fileSize: uploadedFile?.fileSize || null,
                            uploadedById: req.user.id,
                            courseId: created.id,
                            orderIndex: 0
                        }, { transaction });
                    }
                    await recordAuditLog({
                        actorId: req.user.id,
                        action: "course.created",
                        entityType: "Course",
                        entityId: created.id,
                        newValues: { title: created.title, departmentId: created.departmentId, status: created.status },
                        transaction
                    });
                    return created;
                });
                break;
            } catch (error) {
                if (error.name !== "SequelizeUniqueConstraintError" || attempt === 2) throw error;
            }
        }
        const courseData = course.toJSON();
        courseData.hasContentFile = Boolean(courseData.contentFileUrl);
        delete courseData.contentFileUrl;
        res.status(201).json(courseData);
    } catch (error) {
        if (uploadedFile) {
            try {
                await removeStoredUpload(uploadedFile.fileUrl);
            } catch (cleanupError) {
                console.error("Failed to remove unused course file:", cleanupError);
            }
        } else if (req.file) {
            try {
                await removeStoredUpload(`/uploads/${req.file.filename}`);
            } catch (cleanupError) {
                console.error("Failed to remove unused course file:", cleanupError);
            }
        }
        if (error.message === "File contents do not match a supported material file type" ||
            error.message.startsWith("The uploaded file") ||
            error.message.startsWith("Choose a valid file name") ||
            error.message?.includes("required") || error.message?.includes("characters") ||
            error.message?.includes("format") || error.message?.includes("date") ||
            error.message?.includes("setting") || error.message?.includes("status") ||
            error.message?.includes("class")) {
            return res.status(400).json({ message: error.message });
        }
        console.error("Failed to create course:", error);
        res.status(500).json({ message: "Failed to create course" });
    }
};

exports.updateCourse = async (req, res) => {
    try {
        const course = await Course.findOne({ where: { id: req.params.id, lecturerId: req.user.id } });
        if (!course) return res.status(404).json({ message: "Course not found" });
        const updates = validateCourseFields(req.body);
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "At least one course field must be provided" });
        }
        const oldValues = {
            title: course.title,
            academicCode: course.academicCode,
            category: course.category,
            status: course.status,
            enrollmentEnabled: course.enrollmentEnabled
        };
        await sequelize.transaction(async (transaction) => {
            await course.update(updates, { transaction });
            await recordAuditLog({
                actorId: req.user.id,
                action: "course.updated",
                entityType: "Course",
                entityId: course.id,
                oldValues,
                newValues: updates,
                transaction
            });
        });
        const courseData = course.toJSON();
        courseData.hasContentFile = Boolean(courseData.contentFileUrl);
        delete courseData.contentFileUrl;
        return res.json(courseData);
    } catch (error) {
        if (error.message?.includes("characters") || error.message?.includes("format") ||
            error.message?.includes("date") || error.message?.includes("setting") ||
            error.message?.includes("status") || error.message?.includes("class")) {
            return res.status(400).json({ message: error.message });
        }
        console.error("Failed to update course:", error);
        return res.status(500).json({ message: "Failed to update course" });
    }
};

exports.regenerateClassCode = async (req, res) => {
    try {
        const course = await Course.findOne({ where: { id: req.params.id, lecturerId: req.user.id } });
        if (!course) return res.status(404).json({ message: "Course not found" });
        const oldCode = course.classCode;
        let classCode;
        let regenerated = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                classCode = await generateClassCode();
                await sequelize.transaction(async (transaction) => {
                    await course.update({ classCode }, { transaction });
                    await recordAuditLog({
                        actorId: req.user.id,
                        action: "course.class_code_regenerated",
                        entityType: "Course",
                        entityId: course.id,
                        oldValues: { classCode: oldCode },
                        newValues: { classCode },
                        transaction
                    });
                });
                regenerated = true;
                break;
            } catch (error) {
                if (error.name !== "SequelizeUniqueConstraintError" || attempt === 2) throw error;
            }
        }
        if (!regenerated) return res.status(409).json({ message: "Unable to generate a unique class code" });
        return res.json({ classCode });
    } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(409).json({ message: "Class code collision. Please try again." });
        }
        console.error("Failed to regenerate class code:", error);
        return res.status(500).json({ message: "Failed to regenerate class code" });
    }
};

exports.deleteCourse = async (req, res) => {
    const transaction = await sequelize.transaction();
    let contentFileUrl = null;
    try {
        const course = await Course.findOne({
            where: { id: req.params.id, lecturerId: req.user.id },
            transaction
        });
        if (!course) {
            await transaction.rollback();
            return res.status(404).json({ message: "Course not found" });
        }

        contentFileUrl = course.contentFileUrl;
        await recordAuditLog({
            actorId: req.user.id,
            action: "course.deleted",
            entityType: "Course",
            entityId: course.id,
            oldValues: { title: course.title, departmentId: course.departmentId },
            transaction
        });
        const [lessons, quizzes, assignments, assessments] = await Promise.all([
            Lesson.findAll({ where: { courseId: course.id }, attributes: ["id", "fileUrl"], transaction }),
            Quiz.findAll({ where: { courseId: course.id }, attributes: ["id"], transaction }),
            Assignment.findAll({ where: { courseId: course.id }, attributes: ["id", "fileUrl"], transaction }),
            QuizAssessment.findAll({
                where: { courseId: course.id }, attributes: ["id"], transaction
            })
        ]);
        const lessonIds = lessons.map((lesson) => lesson.id);
        const quizIds = quizzes.map((quiz) => quiz.id);
        const assignmentIds = assignments.map((assignment) => assignment.id);
        const assessmentIds = assessments.map((assessment) => assessment.id);
        const submissions = assignmentIds.length
            ? await Submission.findAll({
                where: { assignmentId: assignmentIds }, attributes: ["fileUrl"], transaction
            })
            : [];
        const uploadedFiles = [
            contentFileUrl,
            ...lessons.map((lesson) => lesson.fileUrl),
            ...assignments.map((assignment) => assignment.fileUrl),
            ...submissions.map((submission) => submission.fileUrl)
        ].filter(Boolean);

        await Promise.all([
            lessonIds.length && LessonProgress.destroy({ where: { lessonId: lessonIds }, transaction }),
            quizIds.length && QuizResult.destroy({ where: { quizId: quizIds }, transaction }),
            assessmentIds.length && QuizAttempt.destroy({ where: { assessmentId: assessmentIds }, transaction }),
            assignmentIds.length && Submission.destroy({ where: { assignmentId: assignmentIds }, transaction })
        ]);
        await Quiz.destroy({ where: { courseId: course.id }, transaction });
        await QuizAssessment.destroy({ where: { courseId: course.id }, transaction });
        await Lesson.destroy({ where: { courseId: course.id }, transaction });
        await Module.destroy({ where: { courseId: course.id }, transaction });
        await Promise.all([
            Assignment.destroy({ where: { courseId: course.id }, transaction }),
            Enrollment.destroy({ where: { courseId: course.id }, transaction }),
            Announcement.destroy({ where: { courseId: course.id }, transaction }),
            Message.destroy({ where: { courseId: course.id }, transaction }),
            CalendarEvent.destroy({ where: { courseId: course.id }, transaction }),
            Certificate.destroy({ where: { courseId: course.id }, transaction })
        ]);
        await course.destroy({ transaction });
        await transaction.commit();

        for (const fileUrl of new Set(uploadedFiles)) {
            try {
                await removeStoredUpload(fileUrl);
            } catch (error) {
                console.error("Failed to remove deleted course file:", error);
            }
        }
        return res.json({ message: "Course deleted successfully" });
    } catch (error) {
        await transaction.rollback();
        console.error("Failed to delete course:", error);
        return res.status(500).json({ message: "Failed to delete course" });
    }
};

exports.getCourses = async (req, res) => {
    try {
        const courses = await Course.findAll({
            where: { status: "active", enrollmentEnabled: true },
            attributes: { exclude: ["classCode"] },
            include: [{
                model: User,
                as: "lecturer",
                attributes: ["id", "fullName"]
            }, {
                model: Department,
                as: "department",
                attributes: ["id", "name"]
            }],
            order: [["id", "DESC"]]
        });
        res.json(courses.map((course) => {
            const data = course.toJSON();
            data.hasContentFile = Boolean(data.contentFileUrl);
            delete data.contentFileUrl;
            return data;
        }));
    } catch (error) {
        console.error("Failed to list courses:", error);
        res.status(500).json({ message: "Failed to load courses" });
    }
};

exports.getMyCourses = async (req, res) => {
    try {
        const courses = await Course.findAll({
            where: { lecturerId: req.user.id },
            include: [{ model: Department, as: "department", attributes: ["id", "name"] }],
            order: [["id", "DESC"]]
        });
        const courseIds = courses.map((course) => course.id);
        if (!courseIds.length) return res.json([]);
        const [enrollmentCounts, materialCounts, assignmentCounts, pendingCounts] = await Promise.all([
            Enrollment.findAll({
                attributes: ["courseId", [fn("COUNT", fn("DISTINCT", col("studentId"))), "count"]],
                where: { courseId: courseIds },
                group: ["courseId"],
                raw: true
            }),
            Lesson.findAll({
                attributes: ["courseId", [fn("COUNT", col("id")), "count"]],
                where: { courseId: courseIds },
                group: ["courseId"],
                raw: true
            }),
            Assignment.findAll({
                attributes: ["courseId", [fn("COUNT", col("id")), "count"]],
                where: { courseId: courseIds },
                group: ["courseId"],
                raw: true
            }),
            Submission.findAll({
                attributes: [
                    [col("assignment.courseId"), "courseId"],
                    [fn("COUNT", col("Submission.id")), "count"]
                ],
                where: { grade: "Pending" },
                include: [{
                    model: Assignment,
                    as: "assignment",
                    required: true,
                    attributes: [],
                    where: { courseId: courseIds }
                }],
                group: [col("assignment.courseId")],
                raw: true
            })
        ]);
        const asMap = (rows) => new Map(rows.map((row) => [Number(row.courseId), Number(row.count)]));
        const students = asMap(enrollmentCounts);
        const materials = asMap(materialCounts);
        const assignments = asMap(assignmentCounts);
        const pending = asMap(pendingCounts);
        res.json(courses.map((course) => {
            const data = course.toJSON();
            const hasLegacyMaterial = Boolean(data.contentFileUrl);
            data.hasContentFile = hasLegacyMaterial;
            delete data.contentFileUrl;
            return {
                ...data,
                enrollmentCount: students.get(course.id) || 0,
                materialCount: (materials.get(course.id) || 0) + Number(hasLegacyMaterial),
                assignmentCount: assignments.get(course.id) || 0,
                pendingSubmissions: pending.get(course.id) || 0
            };
        }));
    } catch (error) {
        console.error("Failed to load managed courses:", error);
        res.status(500).json({ message: "Failed to load courses" });
    }
};

exports.getMyCourseStats = async (req, res) => {
    try {
        const courses = await Course.findAll({
            where: { lecturerId: req.user.id },
            attributes: ["id", "status"]
        });
        const courseIds = courses.map((course) => course.id);
        if (courseIds.length === 0) {
            return res.json({ totalCourses: 0, uniqueStudents: 0, activeCourses: 0, pendingSubmissions: 0 });
        }
        const [uniqueStudents, pendingSubmissions] = await Promise.all([
            Enrollment.count({
                distinct: true,
                col: "studentId",
                include: [{
                    model: Course,
                    as: "course",
                    where: { lecturerId: req.user.id },
                    attributes: []
                }]
            }),
            Submission.count({
                where: { grade: "Pending" },
                include: [{
                    model: Assignment,
                    as: "assignment",
                    required: true,
                    include: [{
                        model: Course,
                        as: "course",
                        where: { lecturerId: req.user.id },
                        attributes: []
                    }]
                }]
            })
        ]);
        return res.json({
            totalCourses: courses.length,
            uniqueStudents,
            activeCourses: courses.filter((course) => course.status === "active").length,
            pendingSubmissions
        });
    } catch (error) {
        console.error("Failed to load course statistics:", error);
        return res.status(500).json({ message: "Failed to load course statistics" });
    }
};

exports.getMyStudents = async (req, res) => {
    try {
        const courses = await Course.findAll({
            where: { lecturerId: req.user.id },
            attributes: ["id", "title"],
            include: [{
                model: Enrollment,
                as: "enrollments",
                attributes: ["createdAt", "permissionRole", "permissions", "canPostAnnouncements"],
                include: [{
                    model: User,
                    as: "student",
                    attributes: ["id", "fullName", "email", "matNumber", "phone"]
                }]
            }],
            order: [["title", "ASC"], [{ model: Enrollment, as: "enrollments" }, "createdAt", "ASC"]]
        });

        const students = courses.flatMap((course) =>
            course.enrollments
                .filter((enrollment) => enrollment.student)
                .map((enrollment) => ({
                    ...enrollment.student.toJSON(),
                    courseTitle: course.title,
                    courseId: course.id,
                    enrolledAt: enrollment.createdAt,
                    permissionRole: enrollment.permissionRole,
                    permissions: normalizePermissions(enrollment.permissions, enrollment.canPostAnnouncements)
                }))
        );

        res.json(students);
    } catch (error) {
        console.error("Failed to load students:", error);
        res.status(500).json({ message: "Failed to load students" });
    }
};

exports.getCourseDetail = async (req, res) => {
    try {
        const access = await getCourseAccess(req.params.id, req.user);
        if (access.status) return res.status(access.status).json({ message: access.message });
        const { course, isManager, isEnrolled } = access;

        const lessons = await Lesson.findAll({
            where: { courseId: course.id },
            include: [{ model: User, as: "uploader", attributes: ["id", "fullName"], required: false }],
            order: [["moduleId", "ASC"], ["orderIndex", "ASC"], ["id", "ASC"]]
        });
        const lessonData = lessons.map((lesson) => {
            const data = lesson.toJSON();
            data.hasFile = Boolean(data.fileUrl);
            delete data.fileUrl;
            return data;
        });

        const quizzes = await Quiz.findAll({
            where: { courseId: course.id, assessmentId: null },
            attributes: isManager ? undefined : { exclude: ["correctAnswer"] },
            order: [["id", "DESC"]]
        });
        if (!isManager && quizzes.length) {
            const results = await QuizResult.findAll({
                where: {
                    studentId: req.user.id,
                    quizId: quizzes.map((quiz) => quiz.id)
                },
                attributes: ["quizId"]
            });
            const submittedQuizIds = new Set(results.map((result) => result.quizId));
            quizzes.forEach((quiz) => {
                quiz.setDataValue("submitted", submittedQuizIds.has(quiz.id));
            });
        }

        const assignments = await Assignment.findAll({
            where: { courseId: course.id },
            order: [["dueDate", "ASC"]]
        });

        let students = [];
        let classmates = [];
        if (isManager) {
            const enrollments = await Enrollment.findAll({
                where: { courseId: course.id },
                include: [{
                    model: User, as: "student",
                    attributes: ["id", "fullName", "email", "matNumber"]
                }]
            });
            students = enrollments.filter((enrollment) => enrollment.student).map((enrollment) => ({
                ...enrollment.student.toJSON(),
                enrolledAt: enrollment.createdAt,
                canPostAnnouncements: enrollment.canPostAnnouncements,
                announcementRoleName: enrollment.announcementRoleName,
                permissionRole: enrollment.permissionRole,
                permissions: normalizePermissions(enrollment.permissions, enrollment.canPostAnnouncements)
            }));
        } else {
            const enrollments = await Enrollment.findAll({
                where: { courseId: course.id },
                include: [{
                    model: User,
                    as: "student",
                    attributes: ["id", "fullName"]
                }]
            });
            classmates = enrollments
                .filter((enrollment) => enrollment.student && enrollment.student.id !== req.user.id)
                .map((enrollment) => enrollment.student);
        }

        const courseData = course.toJSON();
        courseData.department = course.departmentId
            ? await Department.findByPk(course.departmentId, { attributes: ["id", "name"] })
            : null;
        courseData.lecturer = await User.findByPk(course.lecturerId, {
            attributes: ["id", "fullName"]
        });
        courseData.hasContentFile = Boolean(courseData.contentFileUrl);
        delete courseData.contentFileUrl;
        if (!isManager && !isEnrolled) delete courseData.classCode;
        res.json({
            course: courseData,
            lessons: lessonData,
            quizzes,
            assignments,
            students,
            classmates,
            isLecturer: isManager,
            isEnrolled,
            canPostAnnouncements: Boolean(access.enrollment &&
                normalizePermissions(access.enrollment.permissions, access.enrollment.canPostAnnouncements)
                    .includes("postAnnouncements")),
            permissions: normalizePermissions(access.enrollment?.permissions, access.enrollment?.canPostAnnouncements),
            permissionRole: access.enrollment?.permissionRole || null
        });
    } catch (error) {
        console.error("Failed to load course:", error);
        res.status(500).json({ message: "Failed to load course" });
    }
};

exports.updateStudentCoursePermissions = async (req, res) => {
    const courseId = idValue(req.params.id);
    const studentId = idValue(req.params.studentId);
    const { role, permissions } = req.body;
    if (!courseId || !studentId ||
        (role !== null && !COURSE_PERMISSION_ROLES.includes(role)) ||
        !Array.isArray(permissions) ||
        permissions.some((permission) => !COURSE_PERMISSIONS.includes(permission)) ||
        (permissions.length > 0 && !role) ||
        (role === null && permissions.length > 0)) {
        return res.status(400).json({ message: "Choose a valid student role and course permissions" });
    }
    const course = await Course.findOne({ where: { id: courseId, lecturerId: req.user.id } });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const enrollment = await Enrollment.findOne({ where: { courseId, studentId } });
    if (!enrollment) return res.status(404).json({ message: "Student is not enrolled in this course" });
    const normalizedPermissions = normalizePermissions(permissions);
    enrollment.permissionRole = role || null;
    enrollment.permissions = normalizedPermissions;
    enrollment.canPostAnnouncements = normalizedPermissions.includes("postAnnouncements");
    enrollment.announcementRoleName = enrollment.canPostAnnouncements
        ? (role === "class_representative" ? "Class Representative" : "Student Assistant")
        : null;
    await enrollment.save();
    res.json({
        message: role
            ? "Student role and course permissions saved"
            : "Student role and course permissions removed",
        canPostAnnouncements: enrollment.canPostAnnouncements,
        announcementRoleName: enrollment.announcementRoleName,
        permissionRole: enrollment.permissionRole,
        permissions: normalizedPermissions
    });
};

exports.removeCourseStudent = async (req, res) => {
    const courseId = Number(req.params.id);
    const studentId = Number(req.params.studentId);
    if (!Number.isSafeInteger(courseId) || courseId <= 0 ||
        !Number.isSafeInteger(studentId) || studentId <= 0) {
        return res.status(400).json({ message: "Invalid course or student ID" });
    }
    try {
        const course = await Course.findOne({
            where: { id: courseId, lecturerId: req.user.id }
        });
        if (!course) return res.status(404).json({ message: "Course not found" });
        const enrollment = await Enrollment.findOne({ where: { courseId, studentId } });
        if (!enrollment) return res.status(404).json({ message: "Student is not enrolled in this course" });
        await sequelize.transaction(async (transaction) => {
            await enrollment.destroy({ transaction });
            await recordAuditLog({
                actorId: req.user.id,
                action: "course.student_removed",
                entityType: "Enrollment",
                entityId: enrollment.id,
                oldValues: { courseId, studentId },
                transaction
            });
        });
        return res.json({ message: "Student removed from the course" });
    } catch (error) {
        console.error("Failed to remove student from course:", error);
        return res.status(500).json({ message: "Failed to remove student from course" });
    }
};