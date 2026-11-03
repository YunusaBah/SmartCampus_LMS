const { Op } = require("sequelize");
const Assignment = require("../models/Assignment");
const AssignmentRead = require("../models/AssignmentRead");
const SubmissionRead = require("../models/SubmissionRead");
const Submission = require("../models/Submission");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const User = require("../models/User");
const recordAuditLog = require("../utils/recordAuditLog");
const getCourseAccess = require("../utils/courseAccess");
const discardUpload = require("../utils/discardUpload");
const { sequelize } = require("../config/db");
const createNotifications = require("../utils/createNotifications");
const validateMaterialFile = require("../utils/validateMaterialFile");
const { hasCoursePermission, normalizePermissions } = require("../utils/coursePermissions");

const assignmentDeadline = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (parsed.toISOString().slice(0, 10) !== value) return null;
        parsed.setUTCHours(23, 59, 59, 999);
    }
    return parsed;
};

exports.createAssignment = async (req, res) => {
    try {
        const { title, description, dueDate, courseId } = req.body;
        const workType = req.body.workType || "assignment";
        const parsedDueDate = assignmentDeadline(dueDate);

        if (typeof title !== "string" || !title.trim() ||
            typeof description !== "string" || !description.trim() ||
            !dueDate || !Number.isSafeInteger(Number(courseId)) || Number(courseId) <= 0 || !parsedDueDate ||
            !["assignment", "classwork"].includes(workType)) {
            await discardUpload(req.file);
            return res.status(400).json({ message: "All assignment fields are required" });
        }

        if (req.file) await validateMaterialFile(req.file);
        const course = await Course.findByPk(courseId);
        if (!course) {
            await discardUpload(req.file);
            return res.status(404).json({ message: "Course not found" });
        }
        const isManager = req.user.role === "lecturer" && course.lecturerId === req.user.id;
        const enrollment = req.user.role === "student"
            ? await Enrollment.findOne({ where: { studentId: req.user.id, courseId: course.id } })
            : null;
        if (!isManager && !hasCoursePermission(enrollment, "createAssignments")) {
            await discardUpload(req.file);
            return res.status(403).json({ message: "Your lecturer has not granted assignment creation permission" });
        }

        const assignment = await sequelize.transaction(async (transaction) => {
            const created = await Assignment.create({
                title: title.trim(),
                description: description.trim(),
                dueDate: parsedDueDate,
                workType,
                courseId,
                fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
                fileName: req.file?.originalname || null
            }, { transaction });
            await recordAuditLog({
                actorId: req.user.id,
                action: "assignment.created",
                entityType: "Assignment",
                entityId: created.id,
                newValues: {
                    title: created.title,
                    description: created.description,
                    dueDate: created.dueDate,
                    courseId: created.courseId
                },
                transaction
            });
            await createNotifications({
                courseId: course.id,
                type: "assignment",
                title: `New assignment: ${created.title}`,
                body: created.description.slice(0, 500),
                resourceType: "assignment",
                resourceId: created.id,
                transaction
            });
            return created;
        });

        res.status(201).json({
            message: "Assignment created successfully",
            assignment
        });

    } catch (error) {
        await discardUpload(req.file);
        if (error.message === "File contents do not match a supported material file type") {
            return res.status(400).json({ message: error.message });
        }
        console.error("Failed to create assignment:", error);
        res.status(500).json({ message: "Failed to create assignment" });
    }
};

exports.updateAssignment = async (req, res) => {
    const assignment = await Assignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const course = await Course.findByPk(assignment.courseId);
    if (!course || course.lecturerId !== req.user.id) {
        return res.status(403).json({ message: "Only the course lecturer can reschedule this assignment" });
    }
    if (req.body.dueDate === undefined) {
        return res.status(400).json({ message: "A new due date is required" });
    }
    const dueDate = assignmentDeadline(req.body.dueDate);
    if (!dueDate) return res.status(400).json({ message: "Enter a valid assignment due date" });
    const previousDueDate = assignment.dueDate;
    assignment.dueDate = dueDate;
    await sequelize.transaction(async (transaction) => {
        await assignment.save({ transaction });
        await recordAuditLog({
            actorId: req.user.id,
            action: "assignment.due_date.updated",
            entityType: "Assignment",
            entityId: assignment.id,
            oldValues: { dueDate: previousDueDate },
            newValues: { dueDate },
            transaction
        });
        await createNotifications({
            courseId: course.id,
            type: "assignment",
            title: `Assignment due date updated: ${assignment.title}`,
            body: `New due date: ${dueDate.toLocaleString()}`,
            resourceType: "assignment",
            resourceId: assignment.id,
            transaction
        });
    });
    res.json({ message: "Assignment due date updated", assignment });
};

exports.getAssignments = async (req, res) => {
    try {
        const access = await getCourseAccess(req.params.courseId, req.user);
        if (access.status) return res.status(access.status).json({ message: access.message });

        const assignments = await Assignment.findAll({
            where: { courseId: access.course.id },
            order: [["dueDate", "ASC"]]
        });

        res.json(assignments);

    } catch (error) {
        console.error("Failed to load assignments:", error);
        res.status(500).json({ message: "Failed to load assignments" });
    }
};

exports.getMyAssignments = async (req, res) => {
    try {
        const enrollments = await Enrollment.findAll({
            where: { studentId: req.user.id },
            attributes: ["courseId", "permissionRole", "permissions", "canPostAnnouncements"]
        });

        const courseIds = enrollments.map((e) => e.courseId);

        if (courseIds.length === 0) {
            return res.json([]);
        }

        const assignments = await Assignment.findAll({
            where: { courseId: { [Op.in]: courseIds } },
            include: [
                {
                    model: Course,
                    as: "course",
                    attributes: ["id", "title"],
                    include: [{ model: User, as: "lecturer", attributes: ["email"] }]
                },
                {
                    model: Submission,
                    as: "submissions",
                    where: { studentId: req.user.id },
                    required: false,
                    attributes: ["id", "studentId", "assignmentId", "fileUrl", "fileName", "answerText", "createdAt"],
                    include: [{
                        model: SubmissionRead,
                        as: "lecturerViews",
                        attributes: ["viewedAt"],
                        required: false
                    }]
                },
                {
                    model: AssignmentRead,
                    as: "reads",
                    where: { studentId: req.user.id },
                    required: false,
                    attributes: ["readAt"]
                }
            ],
            order: [["dueDate", "ASC"]]
        });

        const permissionsByCourse = new Map(enrollments.map((enrollment) => [
            enrollment.courseId,
            {
                permissionRole: enrollment.permissionRole,
                permissions: normalizePermissions(enrollment.permissions, enrollment.canPostAnnouncements)
            }
        ]));
        res.json(assignments.map((assignment) => {
            const data = assignment.toJSON();
            if (data.course) {
                Object.assign(data.course, permissionsByCourse.get(data.course.id));
                data.course.lecturerEmail = data.course.lecturer?.email || null;
                delete data.course.lecturer;
            }
            return data;
        }));

    } catch (error) {
        console.error("Failed to load student assignments:", error);
        res.status(500).json({ message: "Failed to load assignments" });
    }
};

exports.markAssignmentRead = async (req, res) => {
    const assignment = await Assignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const enrolled = await Enrollment.findOne({
        where: { studentId: req.user.id, courseId: assignment.courseId }
    });
    if (!enrolled) return res.status(403).json({ message: "Enroll in the course first" });
    const [read] = await AssignmentRead.findOrCreate({
        where: { assignmentId: assignment.id, studentId: req.user.id },
        defaults: { assignmentId: assignment.id, studentId: req.user.id, readAt: new Date() }
    });
    res.json({ readAt: read.readAt });
};

exports.markSubmissionViewed = async (req, res) => {
    const submission = await Submission.findByPk(req.params.id, {
        include: [{
            model: Assignment,
            as: "assignment",
            include: [{ model: Course, as: "course", attributes: ["id", "lecturerId"] }]
        }]
    });
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    const course = submission.assignment?.course;
    if (!course || course.lecturerId !== req.user.id) {
        return res.status(403).json({ message: "Only the course lecturer can mark this submission viewed" });
    }
    const [view] = await SubmissionRead.findOrCreate({
        where: { submissionId: submission.id, lecturerId: req.user.id },
        defaults: { submissionId: submission.id, lecturerId: req.user.id, viewedAt: new Date() }
    });
    res.json({ viewedAt: view.viewedAt });
};

exports.getCourseSubmissions = async (req, res) => {
    try {
        const course = await Course.findByPk(req.params.courseId);

        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }
        const isManager = req.user.role === "lecturer" && course.lecturerId === req.user.id;
        const enrollment = req.user.role === "student"
            ? await Enrollment.findOne({ where: { studentId: req.user.id, courseId: course.id } })
            : null;
        if (!isManager && !hasCoursePermission(enrollment, "gradeAssignments")) {
            return res.status(403).json({ message: "Your lecturer has not granted assignment grading permission" });
        }

        const assignments = await Assignment.findAll({
            where: { courseId: course.id },
            include: [
                {
                    model: Submission,
                    as: "submissions",
                    include: [
                        {
                            model: User,
                            as: "student",
                            attributes: ["id", "fullName", "email", "matNumber"]
                        }
                    ]
                }
            ]
        });

        res.json(assignments);

    } catch (error) {
        console.error("Failed to load course submissions:", error);
        res.status(500).json({ message: "Failed to load submissions" });
    }
};

exports.gradeSubmission = async (req, res) => {
    try {
        const { grade, feedback } = req.body;

        if (typeof grade !== "string" || !grade.trim() || grade.trim().length > 50 ||
            (feedback !== undefined && (typeof feedback !== "string" || feedback.length > 20000))) {
            return res.status(400).json({ message: "Grade is required" });
        }

        const submission = await Submission.findByPk(req.params.id, {
            include: [
                {
                    model: Assignment,
                    as: "assignment",
                    include: [{ model: Course, as: "course" }]
                }
            ]
        });

        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        const course = submission.assignment?.course;
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        const isManager = req.user.role === "lecturer" && course.lecturerId === req.user.id;
        const enrollment = req.user.role === "student"
            ? await Enrollment.findOne({ where: { studentId: req.user.id, courseId: course.id } })
            : null;
        if (!isManager && !hasCoursePermission(enrollment, "gradeAssignments")) {
            return res.status(403).json({ message: "Your lecturer has not granted assignment grading permission" });
        }
        if (!isManager && submission.studentId === req.user.id) {
            return res.status(403).json({ message: "You cannot grade your own assignment submission" });
        }

        const oldValues = {
            grade: submission.grade,
            feedback: submission.feedback
        };
        submission.grade = grade.trim();
        if (feedback !== undefined) submission.feedback = feedback.trim() || null;
        const newValues = {
            grade: submission.grade,
            feedback: submission.feedback
        };
        await sequelize.transaction(async (transaction) => {
            await submission.save({ transaction });
            await recordAuditLog({
                actorId: req.user.id,
                action: "assignment.grade.updated",
                entityType: "Submission",
                entityId: submission.id,
                oldValues,
                newValues,
                transaction
            });
            await createNotifications({
                userIds: [submission.studentId],
                type: "grade",
                title: "Assignment graded",
                body: feedback?.trim() || `Your assignment grade is ${submission.grade}.`,
                resourceType: "submission",
                resourceId: submission.id,
                transaction
            });
        });

        res.json({
            message: "Grade updated",
            submission
        });

    } catch (error) {
        console.error("Failed to grade submission:", error);
        res.status(500).json({ message: "Failed to update grade" });
    }
};

exports.getMySubmissions = async (req, res) => {
    const submissions = await Submission.findAll({
        where: { studentId: req.user.id },
        attributes: ["id", "studentId", "assignmentId", "fileUrl", "fileName", "answerText", "createdAt"],
        include: [{
            model: Assignment,
            as: "assignment",
            attributes: ["id", "title", "dueDate", "courseId"]
        }],
        order: [["createdAt", "DESC"]]
    });
    res.json(submissions);
};

exports.submitAssignment = async (req, res) => {
    try {
        const { assignmentId, answerText } = req.body;

        if (!assignmentId || !Number.isSafeInteger(Number(assignmentId)) || Number(assignmentId) <= 0) {
            await discardUpload(req.file);
            return res.status(400).json({ message: "assignmentId is required" });
        }

        if ((answerText !== undefined && (typeof answerText !== "string" || answerText.length > 20000)) ||
            (!req.file && (typeof answerText !== "string" || !answerText.trim()))) {
            await discardUpload(req.file);
            return res.status(400).json({ message: "Enter a reply or attach a submission file" });
        }

        const assignment = await Assignment.findByPk(assignmentId);
        if (!assignment) {
            await discardUpload(req.file);
            return res.status(404).json({ message: "Assignment not found" });
        }

        const enrolled = await Enrollment.findOne({
            where: {
                studentId: req.user.id,
                courseId: assignment.courseId
            }
        });

        if (!enrolled) {
            await discardUpload(req.file);
            return res.status(403).json({ message: "Enroll in the course first" });
        }

        if (Date.now() > new Date(assignment.dueDate).getTime()) {
            await discardUpload(req.file);
            return res.status(409).json({ message: "You cannot submit this assignment after its due date. Contact your lecturer if the deadline needs to be extended." });
        }
        const existingSubmission = await Submission.findOne({
            where: { assignmentId: assignment.id, studentId: req.user.id }
        });
        if (existingSubmission) {
            await discardUpload(req.file);
            return res.status(409).json({ message: "You have already submitted this assignment." });
        }
        if (req.file) await validateMaterialFile(req.file);
        await Submission.create({
            studentId: req.user.id,
            assignmentId,
            fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
            fileName: req.file?.originalname || null,
            answerText: answerText?.trim() || null
        });

        res.status(201).json({ message: "Assignment submitted successfully" });

    } catch (error) {
        await discardUpload(req.file);
        if (error.message === "File contents do not match a supported material file type") {
            return res.status(400).json({ message: error.message });
        }
        console.error("Failed to submit assignment:", error);
        res.status(500).json({ message: "Failed to submit assignment" });
    }
};
