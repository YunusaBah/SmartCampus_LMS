const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const sequelize = require("../config/db");
const getCourseAccess = require("../utils/courseAccess");

exports.createQuiz = async (req, res) => {
    try {
        const {
            question,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer,
            courseId
        } = req.body;

        const options = [optionA, optionB, optionC, optionD];
        if (typeof question !== "string" || !question.trim() ||
            options.some(option => typeof option !== "string" || !option.trim()) ||
            typeof correctAnswer !== "string" || !/^[A-D]$/i.test(correctAnswer) ||
            !courseId) {
            return res.status(400).json({ message: "All quiz fields are required" });
        }

        const course = await Course.findByPk(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }
        if (course.lecturerId !== req.user.id) {
            return res.status(403).json({ message: "You can only add quizzes to your courses" });
        }

        const quiz = await Quiz.create({
            question: question.trim(),
            optionA: optionA.trim(),
            optionB: optionB.trim(),
            optionC: optionC.trim(),
            optionD: optionD.trim(),
            correctAnswer: correctAnswer.toUpperCase(),
            courseId
        });

        res.status(201).json({
            message: "Quiz created successfully",
            quiz
        });

    } catch (error) {
        console.error("Failed to create quiz:", error);
        res.status(500).json({ message: "Failed to create quiz" });
    }
};

exports.getCourseQuizzes = async (req, res) => {
    try {
        const access = await getCourseAccess(req.params.courseId, req.user);
        if (access.status) return res.status(access.status).json({ message: access.message });

        const quizzes = await Quiz.findAll({
            where: { courseId: access.course.id, assessmentId: null },
            attributes: access.isManager ? undefined : { exclude: ["correctAnswer"] },
            order: [["id", "DESC"]]
        });

        res.json(quizzes);

    } catch (error) {
        console.error("Failed to load quizzes:", error);
        res.status(500).json({ message: "Failed to load quizzes" });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        const { quizId, selectedAnswer } = req.body;

        if (!quizId || typeof selectedAnswer !== "string" || !/^[A-D]$/i.test(selectedAnswer)) {
            return res.status(400).json({ message: "quizId and selectedAnswer are required" });
        }

        const outcome = await sequelize.transaction(async (transaction) => {
            const quiz = await Quiz.findByPk(quizId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!quiz) return { status: 404, message: "Quiz not found" };
            if (quiz.assessmentId) {
                return { status: 400, message: "Submit this question through its timed assessment" };
            }
            const enrolled = await Enrollment.findOne({
                where: { studentId: req.user.id, courseId: quiz.courseId },
                transaction
            });
            if (!enrolled) return { status: 403, message: "Enroll in the course first" };

            const previousResult = await QuizResult.findOne({
                where: { studentId: req.user.id, quizId: quiz.id },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (previousResult) {
                return { status: 409, message: "You have already submitted this quiz question. Submissions are final." };
            }

            const score = selectedAnswer.toUpperCase() === quiz.correctAnswer.toUpperCase() ? 1 : 0;
            const result = await QuizResult.create({
                studentId: req.user.id,
                quizId,
                selectedAnswer: selectedAnswer.toUpperCase(),
                score
            }, { transaction });
            return { result };
        });

        if (outcome.status) return res.status(outcome.status).json({ message: outcome.message });
        res.json({ message: "Quiz submitted" });

    } catch (error) {
        console.error("Failed to submit quiz:", error);
        res.status(500).json({ message: "Failed to submit quiz" });
    }
};
