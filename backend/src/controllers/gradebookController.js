const { Op } = require("sequelize");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");
const QuizAssessment = require("../models/QuizAssessment");
const QuizAttempt = require("../models/QuizAttempt");
const Lesson = require("../models/Lesson");
const getCourseAccess = require("../utils/courseAccess");

const managerCourse = async (courseId, user, res) => {
    const access = await getCourseAccess(courseId, user);
    if (access.status) {
        res.status(access.status).json({ message: access.message });
        return null;
    }
    if (!access.isManager) {
        res.status(403).json({ message: "Only course managers can access this report" });
        return null;
    }
    return access.course;
};

exports.getGradebook = async (req, res) => {
    const course = await managerCourse(req.params.courseId, req.user, res);
    if (!course) return;
    const [enrollments, assignments, questions, results, assessmentAttempts, assessments] = await Promise.all([
        Enrollment.findAll({
            where: { courseId: course.id },
            include: [{ model: User, as: "student", attributes: ["id", "fullName", "email", "matNumber"] }],
            order: [["createdAt", "ASC"]]
        }),
        Assignment.findAll({
            where: { courseId: course.id },
            include: [{ model: Submission, as: "submissions" }],
            order: [["dueDate", "ASC"]]
        }),
        Quiz.findAll({ where: { courseId: course.id }, attributes: ["id", "question"] }),
        QuizResult.findAll({
            include: [
                { model: Quiz, as: "quiz", where: { courseId: course.id }, attributes: ["id", "question"] },
                { model: User, as: "student", attributes: ["id", "fullName", "matNumber"] }
            ],
            order: [["createdAt", "DESC"]]
        }),
        QuizAttempt.findAll({
            where: { submittedAt: { [Op.ne]: null } },
            include: [
                { model: QuizAssessment, as: "assessment", where: { courseId: course.id }, attributes: ["id", "title"] },
                { model: User, as: "student", attributes: ["id", "fullName", "matNumber"] }
            ],
            order: [["submittedAt", "DESC"]]
        }),
        QuizAssessment.findAll({
            where: { courseId: course.id },
            attributes: ["id", "title", "timeLimitMinutes"],
            order: [["createdAt", "ASC"]]
        })
    ]);
    const students = enrollments.filter((item) => item.student).map((item) => {
        const student = item.student.toJSON();
        return {
            ...student,
            enrolledAt: item.createdAt,
            assignments: assignments.map((assignment) => ({
                assignmentId: assignment.id,
                title: assignment.title,
                workType: assignment.workType,
                submission: assignment.submissions.find((submission) => submission.studentId === student.id) || null
            })),
            quizResults: results.filter((result) => result.studentId === student.id)
                .map((result) => result.toJSON()),
            assessmentAttempts: assessmentAttempts.filter((attempt) => attempt.studentId === student.id)
                .map((attempt) => attempt.toJSON())
        };
    });
    res.json({
        course: { id: course.id, title: course.title },
        assignmentColumns: assignments.map(({ id, title, dueDate, workType }) => ({ id, title, dueDate, workType })),
        legacyQuizQuestions: questions.map(({ id, question }) => ({ id, question })),
        assessmentColumns: assessments,
        students
    });
};

exports.getAnalytics = async (req, res) => {
    const course = await managerCourse(req.params.courseId, req.user, res);
    if (!course) return;
    const [enrolledStudents, lessonCount, assignmentCount, submissionCount, gradedCount, quizQuestionCount, assessmentCount] =
        await Promise.all([
            Enrollment.count({ where: { courseId: course.id } }),
            Lesson.count({ where: { courseId: course.id } }),
            Assignment.count({ where: { courseId: course.id } }),
            Submission.count({ include: [{ model: Assignment, as: "assignment", where: { courseId: course.id } }] }),
            Submission.count({
                where: { grade: { [Op.ne]: "Pending" } },
                include: [{ model: Assignment, as: "assignment", where: { courseId: course.id } }]
            }),
            Quiz.count({ where: { courseId: course.id } }),
            QuizAssessment.count({ where: { courseId: course.id } })
        ]);
    res.json({
        courseId: course.id,
        enrolledStudents,
        lessonCount,
        assignmentCount,
        submissionCount,
        gradedSubmissionCount: gradedCount,
        quizQuestionCount,
        assessmentCount
    });
};
