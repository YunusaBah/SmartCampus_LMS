const Assignment = require("../models/Assignment");
const ChatProfile = require("../models/ChatProfile");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Lesson = require("../models/Lesson");
const Submission = require("../models/Submission");
const { hasCoursePermission } = require("../utils/coursePermissions");
const objectStorage = require("../utils/objectStorage");

const parseId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const deny = (res, status, message) => res.status(status).json({ message });

exports.signUpload = async (req, res, next) => {
    const { purpose } = req.body;
    try {
        if (purpose === "lesson") {
            const lessonId = req.body.lessonId == null ? null : parseId(req.body.lessonId);
            const courseId = req.body.courseId == null ? null : parseId(req.body.courseId);
            if ((req.body.lessonId != null && !lessonId) || (req.body.courseId != null && !courseId) ||
                (!lessonId && !courseId)) {
                return deny(res, 400, "A valid course or lesson ID is required.");
            }
            const lesson = lessonId ? await Lesson.findByPk(lessonId) : null;
            if (lessonId && !lesson) return deny(res, 404, "Course material not found.");
            const course = await Course.findByPk(lesson?.courseId || courseId);
            if (!course) return deny(res, 404, "Course not found.");
            if (lessonId && (req.user.role !== "lecturer" || course.lecturerId !== req.user.id)) {
                return deny(res, 403, "Only the course lecturer can replace this material file.");
            }
            const isLecturer = req.user.role === "lecturer" && course.lecturerId === req.user.id;
            const enrollment = req.user.role === "student"
                ? await Enrollment.findOne({ where: { studentId: req.user.id, courseId: course.id } })
                : null;
            if (!isLecturer && !hasCoursePermission(enrollment, "uploadMaterials")) {
                return deny(res, 403, "You do not have permission to upload course materials.");
            }
        } else if (purpose === "assignment") {
            const courseId = parseId(req.body.courseId);
            if (!courseId) return deny(res, 400, "A valid course ID is required.");
            const course = await Course.findByPk(courseId);
            if (!course) return deny(res, 404, "Course not found.");
            const isLecturer = req.user.role === "lecturer" && course.lecturerId === req.user.id;
            const enrollment = req.user.role === "student"
                ? await Enrollment.findOne({ where: { studentId: req.user.id, courseId } })
                : null;
            if (!isLecturer && !hasCoursePermission(enrollment, "createAssignments")) {
                return deny(res, 403, "You do not have permission to create assignments in this course.");
            }
        } else if (purpose === "submission") {
            const assignmentId = parseId(req.body.assignmentId);
            if (!assignmentId) return deny(res, 400, "A valid assignment ID is required.");
            if (req.user.role !== "student") return deny(res, 403, "Only students can upload submissions.");
            const assignment = await Assignment.findByPk(assignmentId);
            if (!assignment) return deny(res, 404, "Assignment not found.");
            const [enrollment, submission] = await Promise.all([
                Enrollment.findOne({ where: { studentId: req.user.id, courseId: assignment.courseId } }),
                Submission.findOne({ where: { assignmentId, studentId: req.user.id } })
            ]);
            if (!enrollment) return deny(res, 403, "Enroll in the course first.");
            if (Date.now() > new Date(assignment.dueDate).getTime()) {
                return deny(res, 409, "You cannot submit this assignment after its due date.");
            }
            if (submission) return deny(res, 409, "You have already submitted this assignment.");
        } else if (purpose === "question-import") {
            if (req.user.role !== "lecturer") return deny(res, 403, "Only lecturers can import quiz documents.");
        } else if (purpose === "chat-media") {
            if (!(await ChatProfile.findOne({
                where: { userId: req.user.id },
                attributes: ["id"]
            }))) {
                return deny(res, 403, "Create your chat username before uploading an attachment.");
            }
        } else {
            return deny(res, 400, "Unsupported file upload purpose.");
        }

        try {
            const upload = await objectStorage.signUpload({
                userId: req.user.id,
                fileName: req.body.fileName,
                fileSize: Number(req.body.fileSize),
                purpose,
                mediaType: req.body.mediaType
            });
            res.set("Cache-Control", "no-store");
            return res.json(upload);
        } catch (error) {
            if (error.message.startsWith("Choose a valid") ||
                error.message.startsWith("Unsupported") ||
                error.message.startsWith("Files must")) {
                return deny(res, 400, error.message);
            }
            console.error("Unable to create signed storage upload:", error.message);
            return deny(res, 503, "File storage is temporarily unavailable.");
        }
    } catch (error) {
        return next(error);
    }
};
