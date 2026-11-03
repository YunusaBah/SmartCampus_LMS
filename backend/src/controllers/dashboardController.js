const { Op, col, fn } = require("sequelize");
const Enrollment = require("../models/Enrollment");
const Assignment = require("../models/Assignment");
const QuizResult = require("../models/QuizResult");
const Submission = require("../models/Submission");
const Course = require("../models/Course");
const Quiz = require("../models/Quiz");
const QuizAssessment = require("../models/QuizAssessment");
const QuizAttempt = require("../models/QuizAttempt");
const Lesson = require("../models/Lesson");
const Announcement = require("../models/Announcement");
const User = require("../models/User");
const { normalizePermissions } = require("../utils/coursePermissions");

const mapGroupedCounts = (rows) => new Map(rows.map((row) => [
    Number(row.courseId),
    Number(row.count)
]));

exports.getDashboard = async (req, res) => {
    res.set({
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0"
    });
    try {
        const now = new Date();
        const displayName = (await User.findByPk(req.user.id, {
            attributes: ["fullName"]
        }))?.fullName?.trim() || "";

        if (req.user.role === "lecturer") {
            const [courses, myCourses, studentsEnrolled, activeAssignments, submissionsToGrade, upcomingAssignments, pendingSubmissions, recentSubmissions, recentEnrollments, recentMaterials, recentAnnouncements] = await Promise.all([
                Course.findAll({
                    where: { lecturerId: req.user.id },
                    attributes: ["id", "title", "description", "createdAt"],
                    order: [["createdAt", "DESC"]],
                    limit: 6
                }),
                Course.count({ where: { lecturerId: req.user.id } }),
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
                Assignment.count({
                    where: { dueDate: { [Op.gt]: now } },
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
                }),
                Assignment.findAll({
                    where: { dueDate: { [Op.gt]: now } },
                    include: [{
                        model: Course,
                        as: "course",
                        where: { lecturerId: req.user.id },
                        attributes: ["id", "title"]
                    }],
                    order: [["dueDate", "ASC"]],
                    limit: 5
                }),
                Submission.findAll({
                    where: { grade: "Pending" },
                    include: [{
                        model: Assignment,
                        as: "assignment",
                        required: true,
                        include: [{
                            model: Course,
                            as: "course",
                            where: { lecturerId: req.user.id },
                            attributes: ["id", "title"]
                        }]
                    }],
                    order: [["createdAt", "ASC"]],
                    limit: 50
                }),
                Submission.findAll({
                    include: [
                        { model: User, as: "student", attributes: ["id", "fullName"] },
                        {
                            model: Assignment,
                            as: "assignment",
                            required: true,
                            include: [{
                                model: Course,
                                as: "course",
                                where: { lecturerId: req.user.id },
                                attributes: ["id", "title"]
                            }]
                        }
                    ],
                    order: [["createdAt", "DESC"]],
                    limit: 5
                }),
                Enrollment.findAll({
                    include: [
                        { model: User, as: "student", attributes: ["id", "fullName"] },
                        {
                            model: Course,
                            as: "course",
                            where: { lecturerId: req.user.id },
                            attributes: ["id", "title"]
                        }
                    ],
                    order: [["createdAt", "DESC"]],
                    limit: 5
                }),
                Lesson.findAll({
                    include: [{
                        model: Course,
                        as: "course",
                        where: { lecturerId: req.user.id },
                        attributes: ["id", "title"]
                    }],
                    order: [["createdAt", "DESC"]],
                    limit: 5
                }),
                Announcement.findAll({
                    include: [{
                        model: Course,
                        as: "course",
                        where: { lecturerId: req.user.id },
                        attributes: ["id", "title"]
                    }],
                    order: [["createdAt", "DESC"]],
                    limit: 5
                })
            ]);

            const courseIds = courses.map((course) => course.id);
            const groupedResults = courseIds.length
                ? await Promise.all([
                    Enrollment.findAll({
                        attributes: ["courseId", [fn("COUNT", fn("DISTINCT", col("studentId"))), "count"]],
                        where: { courseId: { [Op.in]: courseIds } },
                        group: ["courseId"],
                        raw: true
                    }),
                    Lesson.findAll({
                        attributes: ["courseId", [fn("COUNT", col("id")), "count"]],
                        where: { courseId: { [Op.in]: courseIds } },
                        group: ["courseId"],
                        raw: true
                    }),
                    Assignment.findAll({
                        attributes: ["courseId", [fn("COUNT", col("id")), "count"]],
                        where: { courseId: { [Op.in]: courseIds } },
                        group: ["courseId"],
                        raw: true
                    })
                ])
                : [[], [], []];
            const [studentCounts, materialCounts, assignmentCounts] = groupedResults.map(mapGroupedCounts);

            const activities = [
                ...submissionsToGradeToActivities(submissionsToGrade, pendingSubmissions),
                ...upcomingAssignments.map((assignment) => ({
                    id: `assignment-${assignment.id}`,
                    type: "assignment-deadline",
                    title: assignment.title,
                    courseId: assignment.course.id,
                    courseTitle: assignment.course.title,
                    startsAt: assignment.dueDate,
                    priority: 2
                }))
            ].sort((left, right) => left.priority - right.priority ||
                new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()).slice(0, 8);

            const recentActivity = [
                ...recentSubmissions.map((submission) => ({
                    id: `submission-${submission.id}`,
                    type: "submission",
                    title: `${submission.student?.fullName || "A student"} submitted work`,
                    courseTitle: submission.assignment?.course?.title || "Your course",
                    startsAt: submission.createdAt,
                    href: "/assignments"
                })),
                ...recentEnrollments.map((enrollment) => ({
                    id: `enrollment-${enrollment.id}`,
                    type: "enrollment",
                    title: `${enrollment.student?.fullName || "A student"} joined a course`,
                    courseTitle: enrollment.course?.title || "Your course",
                    startsAt: enrollment.createdAt,
                    href: `/courses/${enrollment.courseId}`
                })),
                ...recentMaterials.map((lesson) => ({
                    id: `material-${lesson.id}`,
                    type: "material",
                    title: `New material: ${lesson.title}`,
                    courseTitle: lesson.course?.title || "Your course",
                    startsAt: lesson.createdAt,
                    href: `/courses/${lesson.courseId}?section=materials`
                })),
                ...recentAnnouncements.map((announcement) => ({
                    id: `announcement-${announcement.id}`,
                    type: "announcement",
                    title: `Announcement: ${announcement.title}`,
                    courseTitle: announcement.course?.title || "Your course",
                    startsAt: announcement.createdAt,
                    href: `/courses/${announcement.courseId}?section=announcements`
                }))
            ].sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()).slice(0, 6);

            return res.json({
                role: "lecturer",
                profile: { displayName },
                summary: {
                    myCourses,
                    studentsEnrolled,
                    activeAssignments,
                    submissionsToGrade
                },
                courses: courses.slice(0, 6).map((course) => ({
                    id: course.id,
                    title: course.title,
                    description: course.description,
                    createdAt: course.createdAt,
                    studentCount: studentCounts.get(course.id) || 0,
                    materialCount: materialCounts.get(course.id) || 0,
                    assignmentCount: assignmentCounts.get(course.id) || 0
                })),
                upcomingActivities: activities,
                recentActivity
            });
        }

        const [enrollments, myCourses] = await Promise.all([
            Enrollment.findAll({
                where: { studentId: req.user.id },
                attributes: ["courseId", "permissionRole", "permissions", "canPostAnnouncements"],
                include: [{
                    model: Course,
                    as: "course",
                    attributes: ["id", "title", "description", "classCode", "createdAt"],
                    include: [{ model: User, as: "lecturer", attributes: ["fullName", "email"] }]
                }],
                order: [["createdAt", "DESC"]]
            }),
            Enrollment.count({ where: { studentId: req.user.id } })
        ]);
        const studentCourses = enrollments.map((enrollment) => enrollment.course).filter(Boolean);
        const courseIds = studentCourses.map((course) => course.id);
        const [allFutureAssignments, assessments, announcements, gradedSubmissions, gradedQuizAttempts, recentMaterials] = courseIds.length
            ? await Promise.all([
                Assignment.findAll({
                    where: { courseId: { [Op.in]: courseIds }, dueDate: { [Op.gt]: now } },
                    include: [{ model: Course, as: "course", attributes: ["id", "title"] }],
                    order: [["dueDate", "ASC"]],
                }),
                QuizAssessment.findAll({
                    where: { courseId: { [Op.in]: courseIds } },
                    attributes: ["id", "title", "courseId", "maxAttempts", "createdAt"],
                    include: [
                        {
                            model: QuizAttempt,
                            as: "attempts",
                            where: { studentId: req.user.id },
                            attributes: ["id", "submittedAt"],
                            required: false
                        },
                        { model: Course, as: "course", attributes: ["id", "title"] }
                    ]
                }),
                Announcement.findAll({
                    where: { courseId: { [Op.in]: courseIds } },
                    include: [{ model: Course, as: "course", attributes: ["id", "title"] }],
                    order: [["createdAt", "DESC"]],
                    limit: 3
                }),
                Submission.count({
                    distinct: true,
                    col: "assignmentId",
                    where: { studentId: req.user.id, grade: { [Op.ne]: "Pending" } }
                }),
                QuizAttempt.count({
                    distinct: true,
                    col: "assessmentId",
                    where: { studentId: req.user.id, submittedAt: { [Op.ne]: null } }
                }),
                Lesson.findAll({
                    where: { courseId: { [Op.in]: courseIds } },
                    include: [{ model: Course, as: "course", attributes: ["id", "title"] }],
                    order: [["createdAt", "DESC"]],
                    limit: 5
                })
            ])
            : [[], [], [], 0, 0, []];

        const submittedAssignmentIds = allFutureAssignments.length
            ? new Set((await Submission.findAll({
                where: {
                    studentId: req.user.id,
                    assignmentId: { [Op.in]: allFutureAssignments.map((assignment) => assignment.id) }
                },
                attributes: ["assignmentId"],
                raw: true
            })).map((submission) => submission.assignmentId))
            : new Set();
        const pendingAssignments = allFutureAssignments.filter((assignment) => !submittedAssignmentIds.has(assignment.id));
        const eligibleAssessments = assessments.filter((assessment) =>
            (assessment.attempts || []).every((attempt) => attempt.submittedAt !== null) &&
            (assessment.attempts || []).filter((attempt) => attempt.submittedAt !== null).length < assessment.maxAttempts
        );
        const assignmentsByCourse = new Map();
        for (const assignment of pendingAssignments) {
            assignmentsByCourse.set(
                assignment.courseId,
                (assignmentsByCourse.get(assignment.courseId) || 0) + 1
            );
        }

        return res.json({
            role: "student",
            profile: { displayName },
            summary: {
                myCourses,
                pendingAssignments: pendingAssignments.length,
                upcomingQuizzes: eligibleAssessments.length,
                gradedAssessments: gradedSubmissions + gradedQuizAttempts
            },
            courses: studentCourses.slice(0, 6).map((course) => ({
                id: course.id,
                title: course.title,
                description: course.description,
                courseCode: course.classCode,
                lecturerName: course.lecturer?.fullName || "Lecturer",
                lecturerEmail: course.lecturer?.email || null,
                pendingAssignments: assignmentsByCourse.get(course.id) || 0
            })),
            delegatedPermissions: enrollments
                .filter((enrollment) => enrollment.permissionRole || normalizePermissions(
                    enrollment.permissions,
                    enrollment.canPostAnnouncements
                ).length)
                .map((enrollment) => ({
                    courseId: enrollment.courseId,
                    courseTitle: enrollment.course?.title || "Course",
                    role: enrollment.permissionRole,
                    permissions: normalizePermissions(enrollment.permissions, enrollment.canPostAnnouncements)
                })),
            upcomingActivities: [
                ...pendingAssignments.slice(0, 6).map((assignment) => ({
                    id: `assignment-${assignment.id}`,
                    type: "assignment",
                    title: assignment.title,
                    courseId: assignment.courseId,
                    courseTitle: assignment.course?.title || "Course",
                    startsAt: assignment.dueDate,
                    status: "Not started"
                })),
                ...eligibleAssessments.map((assessment) => ({
                    id: `quiz-${assessment.id}`,
                    type: "quiz",
                    title: assessment.title,
                    courseId: assessment.courseId,
                    courseTitle: assessment.course?.title || "Course",
                    startsAt: now,
                    status: "Available now"
                }))
            ].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()).slice(0, 8),
            recentAnnouncements: announcements.map((announcement) => ({
                id: announcement.id,
                title: announcement.title,
                preview: announcement.body.slice(0, 180),
                courseId: announcement.courseId,
                courseTitle: announcement.course?.title || "Course",
                createdAt: announcement.createdAt
            })),
            recentActivity: [
                ...announcements.map((announcement) => ({
                    id: `announcement-${announcement.id}`,
                    type: "announcement",
                    title: announcement.title,
                    body: announcement.body,
                    createdAt: announcement.createdAt,
                    courseId: announcement.courseId,
                    courseTitle: announcement.course?.title || "Course",
                    href: `/courses/${announcement.courseId}?section=announcements`
                })),
                ...recentMaterials.map((lesson) => ({
                    id: `material-${lesson.id}`,
                    type: "material",
                    title: `New material: ${lesson.title}`,
                    createdAt: lesson.createdAt,
                    courseId: lesson.courseId,
                    courseTitle: lesson.course?.title || "Course",
                    href: `/courses/${lesson.courseId}?section=materials`
                }))
            ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 6)
        });
    } catch (error) {
        console.error("Failed to load personalized dashboard:", error);
        return res.status(500).json({ message: "Unable to load your dashboard" });
    }
};

const submissionsToGradeToActivities = (count, submissions) => {
    if (count <= 0) return [];
    const pending = submissions.filter((submission) => submission.grade === "Pending");
    const courseCounts = new Map();
    for (const submission of pending) {
        const assignment = submission.assignment;
        if (!assignment?.course) continue;
        const key = `${assignment.course.id}:${assignment.id}`;
        const summary = courseCounts.get(key) || {
            id: `grading-${assignment.id}`,
            type: "grading",
            title: assignment.title,
            courseId: assignment.course.id,
            courseTitle: assignment.course.title,
            startsAt: submission.createdAt,
            priority: 1,
            submissionCount: 0
        };
        summary.submissionCount += 1;
        if (new Date(submission.createdAt) < new Date(summary.startsAt)) summary.startsAt = submission.createdAt;
        courseCounts.set(key, summary);
    }
    return [...courseCounts.values()].sort((left, right) => right.submissionCount - left.submissionCount).slice(0, 5);
};

exports.getStats = async (req, res) => {
    try {
        if (req.user.role === "lecturer") {
            const [totalCourses, students, assignments, pendingGrades] = await Promise.all([
                Course.count({ where: { lecturerId: req.user.id } }),
                Enrollment.count({
                    include: [{ model: Course, as: "course", where: { lecturerId: req.user.id }, attributes: [] }]
                }),
                Assignment.count({
                    include: [{ model: Course, as: "course", where: { lecturerId: req.user.id }, attributes: [] }]
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
                role: req.user.role,
                totalCourses,
                students,
                assignments,
                pendingGrades
            });
        }

        const enrollments = await Enrollment.findAll({
            where: { studentId: req.user.id }
        });

        const courseIds = enrollments.map((e) => e.courseId);

        let assignmentCount = 0;
        if (courseIds.length > 0) {
            assignmentCount = await Assignment.count({
                where: { courseId: { [Op.in]: courseIds } }
            });
        }

        const gradedAssignments = await Submission.count({
            where: { studentId: req.user.id, grade: { [Op.ne]: "Pending" } }
        });

        res.json({
            role: "student",
            totalCourses: enrollments.length,
            assignments: assignmentCount,
            completedCourses: enrollments.length,
            gradedAssignments
        });

    } catch (error) {
        console.error("Failed to load dashboard stats:", error);
        res.status(500).json({ message: "Failed to load dashboard stats" });
    }
};

exports.getGrades = async (req, res) => {
    try {
        const quizPage = Number(req.query.quizPage || 1);
        const assessmentPage = Number(req.query.assessmentPage || 1);
        const submissionPage = Number(req.query.submissionPage || 1);
        const pageSize = Number(req.query.pageSize || 20);
        if (!Number.isSafeInteger(quizPage) || quizPage < 1 ||
            !Number.isSafeInteger(assessmentPage) || assessmentPage < 1 ||
            !Number.isSafeInteger(submissionPage) || submissionPage < 1 ||
            !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
            return res.status(400).json({ message: "Page numbers must be positive and pageSize must be between 1 and 100" });
        }

        const [quizResults, assessmentResults, submissions, quizAggregate, gradedSubmissions, pendingSubmissions] = await Promise.all([
            QuizResult.findAndCountAll({
                where: { studentId: req.user.id },
                include: [{
                    model: Quiz,
                    as: "quiz",
                    attributes: { exclude: ["correctAnswer"] },
                    include: [{ model: Course, as: "course", attributes: ["title"] }]
                }],
                order: [["id", "DESC"]],
                limit: pageSize,
                offset: (quizPage - 1) * pageSize
            }),
            QuizAttempt.findAndCountAll({
                where: { studentId: req.user.id, submittedAt: { [Op.ne]: null } },
                include: [{
                    model: QuizAssessment,
                    as: "assessment",
                    attributes: ["id", "title"],
                    include: [{ model: Course, as: "course", attributes: ["title"] }]
                }],
                order: [["submittedAt", "DESC"]],
                limit: pageSize,
                offset: (assessmentPage - 1) * pageSize
            }),
            Submission.findAndCountAll({
                where: { studentId: req.user.id },
                include: [
                    {
                        model: Assignment,
                        as: "assignment",
                        include: [{ model: Course, as: "course", attributes: ["title"] }]
                    }
                ],
                order: [["id", "DESC"]],
                limit: pageSize,
                offset: (submissionPage - 1) * pageSize
            }),
            QuizResult.findOne({
                where: { studentId: req.user.id },
                attributes: [[fn("AVG", col("score")), "average"]],
                raw: true
            }),
            Submission.count({
                where: { studentId: req.user.id, grade: { [Op.ne]: "Pending" } }
            }),
            Submission.count({
                where: { studentId: req.user.id, grade: "Pending" }
            })
        ]);

        return res.json({
            quizResults: quizResults.rows,
            assessmentResults: assessmentResults.rows,
            submissions: submissions.rows,
            summary: {
                quizAverage: quizAggregate?.average == null
                    ? null
                    : Math.round(Number(quizAggregate.average) * 100),
                quizCount: quizResults.count,
                assessmentCount: assessmentResults.count,
                gradedSubmissions,
                pendingSubmissions,
                submissionCount: submissions.count
            },
            pagination: {
                pageSize,
                quizPage,
                quizPages: Math.ceil(quizResults.count / pageSize),
                assessmentPage,
                assessmentPages: Math.ceil(assessmentResults.count / pageSize),
                submissionPage,
                submissionPages: Math.ceil(submissions.count / pageSize)
            }
        });

    } catch (error) {
        console.error("Failed to load grades:", error);
        res.status(500).json({ message: "Failed to load grades" });
    }
};
