const sequelize = require("../config/db");
const Quiz = require("../models/Quiz");
const QuizAssessment = require("../models/QuizAssessment");
const QuizAttempt = require("../models/QuizAttempt");
const QuizAttemptAnswer = require("../models/QuizAttemptAnswer");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const getCourseAccess = require("../utils/courseAccess");
const createNotifications = require("../utils/createNotifications");

const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const validText = (value) => typeof value === "string" && value.trim().length > 0;
const publicQuestion = (question) => {
    const item = question.toJSON ? question.toJSON() : question;
    delete item.correctAnswer;
    return item;
};

const studentAttemptSummary = (attempt) => ({
    id: attempt.id,
    assessmentId: attempt.assessmentId,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    submittedAt: attempt.submittedAt
});

const numberValue = (value) => Number(value || 0);

const finalizeAttempt = async (attempt, transaction, submittedAt = new Date()) => {
    const questions = await Quiz.findAll({
        where: { assessmentId: attempt.assessmentId },
        attributes: ["id", "correctAnswer", "questionType", "marks"],
        transaction
    });
    const responses = await QuizAttemptAnswer.findAll({
        where: { attemptId: attempt.id },
        transaction
    });
    const responseMap = new Map(responses.map((response) => [response.questionId, response]));
    const totalMarks = questions.reduce((total, question) => total + numberValue(question.marks), 0);
    let score = 0;
    let theoryPending = false;
    for (const question of questions) {
        if (question.questionType === "THEORY") {
            const response = responseMap.get(question.id);
            if (response?.marksAwarded == null) theoryPending = true;
            else score += numberValue(response.marksAwarded);
        } else if (attempt.answers?.[String(question.id)] === question.correctAnswer?.toUpperCase()) {
            score += numberValue(question.marks);
        }
    }
    attempt.score = score;
    attempt.totalQuestions = questions.length;
    attempt.totalMarks = totalMarks;
    attempt.theoryPending = theoryPending;
    attempt.submittedAt = submittedAt;
    await attempt.save({ transaction });
    return { questions, attempt };
};

const loadAttemptQuestions = async (assessmentId) => Quiz.findAll({
    where: { assessmentId },
    attributes: { exclude: ["correctAnswer"] },
    order: [["id", "ASC"]]
});

const loadAttemptAnswers = async (attemptId, transaction) => {
    const answers = await QuizAttemptAnswer.findAll({ where: { attemptId }, transaction });
    return Object.fromEntries(answers.map((answer) => [String(answer.questionId), answer.answer]));
};

const persistAttemptAnswers = async (attempt, answers, transaction) => {
    const questions = await Quiz.findAll({
        where: { assessmentId: attempt.assessmentId },
        attributes: ["id", "questionType", "optionA", "optionB", "optionC", "optionD"],
        transaction
    });
    const questionMap = new Map(questions.map((question) => [String(question.id), question]));
    const incoming = {};
    const theoryAnswers = [];
    for (const [questionId, answer] of Object.entries(answers)) {
        const question = questionMap.get(questionId);
        if (!question || typeof answer !== "string") {
            return { status: 400, message: "Each answer must reference an assessment question and contain text" };
        }
        if (question.questionType === "THEORY") {
            if (answer.length > 20000) return { status: 400, message: "Theory answers cannot exceed 20,000 characters" };
            theoryAnswers.push({ questionId: question.id, answer });
        } else {
            const normalized = answer.toUpperCase();
            if (!/^[A-D]$/.test(normalized) || !question[`option${normalized}`]) {
                return { status: 400, message: "Multiple-choice answers must select an available option" };
            }
            incoming[questionId] = normalized;
        }
    }
    attempt.answers = { ...(attempt.answers || {}), ...incoming };
    await attempt.save({ transaction });
    for (const theoryAnswer of theoryAnswers) {
        await QuizAttemptAnswer.upsert({
            attemptId: attempt.id,
            questionId: theoryAnswer.questionId,
            answer: theoryAnswer.answer
        }, { transaction });
    }
    return null;
};

exports.createAssessment = async (req, res) => {
    const { title, instructions, timeLimitMinutes, maxAttempts = 1, courseId, questions } = req.body;
    if (!validText(title) || !validId(courseId) ||
        !Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 600 ||
        !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10 ||
        (instructions != null && typeof instructions !== "string") ||
        !Array.isArray(questions) || questions.length < 1 || questions.length > 100) {
        return res.status(400).json({ message: "Assessment details and 1-100 valid questions are required" });
    }
    if (questions.some((question) => question?.questionType === "THEORY")) {
        return res.status(400).json({ message: "Timed assessments support multiple-choice questions only" });
    }
    for (const question of questions) {
        if (!question || typeof question !== "object" || Array.isArray(question)) {
            return res.status(400).json({ message: "Each assessment question must be an object" });
        }
        if (question.questionType != null && question.questionType !== "MCQ") {
            return res.status(400).json({ message: "Timed assessments support multiple-choice questions only" });
        }
        const marks = question.marks == null ? 1 : Number(question.marks);
        if (!validText(question.question) || !Number.isFinite(marks) || marks <= 0 || marks > 10000) {
            return res.status(400).json({ message: "Each question requires text and positive marks" });
        }
        const options = ["A", "B", "C", "D"]
            .map((letter) => [letter, question[`option${letter}`]])
            .filter(([, option]) => validText(option));
        if (options.some(([, option]) => option.trim().length > 255)) {
            return res.status(400).json({ message: "Answer options cannot exceed 255 characters" });
        }
        if (options.length < 2 || typeof question.correctAnswer !== "string" ||
            !/^[A-D]$/i.test(question.correctAnswer) ||
            !options.some(([letter]) => letter === question.correctAnswer.toUpperCase())) {
            return res.status(400).json({ message: "Each multiple-choice question requires at least two options and a correct answer" });
        }
    }
    const access = await getCourseAccess(courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    if (!access.isManager) return res.status(403).json({ message: "Only course managers can create assessments" });

    const result = await sequelize.transaction(async (transaction) => {
        const assessment = await QuizAssessment.create({
            title: title.trim(),
            instructions: instructions?.trim() || null,
            timeLimitMinutes,
            maxAttempts,
            courseId: access.course.id
        }, { transaction });
        await Quiz.bulkCreate(questions.map((question) => ({
            question: question.question.trim(),
            optionA: validText(question.optionA) ? question.optionA.trim() : null,
            optionB: validText(question.optionB) ? question.optionB.trim() : null,
            optionC: validText(question.optionC) ? question.optionC.trim() : null,
            optionD: validText(question.optionD) ? question.optionD.trim() : null,
            correctAnswer: question.correctAnswer.toUpperCase(),
            questionType: "MCQ",
            marks: question.marks == null ? 1 : Number(question.marks),
            courseId: access.course.id,
            assessmentId: assessment.id
        })), { transaction, returning: true });
        const createdQuestions = await Quiz.findAll({
            where: { assessmentId: assessment.id },
            order: [["id", "ASC"]],
            transaction
        });
        await createNotifications({
            courseId: access.course.id,
            type: "assessment",
            title: `New assessment: ${assessment.title}`,
            body: "A timed assessment is available in your course.",
            resourceType: "assessment",
            resourceId: assessment.id,
            transaction
        });
        return { assessment, questions: createdQuestions };
    });
    res.status(201).json({
        ...result.assessment.toJSON(),
        questions: result.questions.map((question) => publicQuestion(question))
    });
};

exports.listAssessments = async (req, res) => {
    const access = await getCourseAccess(req.params.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    const assessments = await QuizAssessment.findAll({
        where: { courseId: access.course.id },
        include: [{ model: Quiz, as: "questions", attributes: access.isManager
            ? undefined
            : { exclude: ["correctAnswer"] } }],
        order: [["createdAt", "DESC"]]
    });
    res.json(assessments);
};

exports.getAssessment = async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid assessment ID" });
    const assessment = await QuizAssessment.findByPk(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    const access = await getCourseAccess(assessment.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    const questions = await loadAttemptQuestions(assessment.id);
    const data = assessment.toJSON();
    data.questions = access.isManager
        ? await Quiz.findAll({ where: { assessmentId: assessment.id }, order: [["id", "ASC"]] })
        : questions;
    res.json(data);
};

exports.listAssessmentAttempts = async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid assessment ID" });
    const assessment = await QuizAssessment.findByPk(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    const access = await getCourseAccess(assessment.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    if (!access.isManager) return res.status(403).json({ message: "Only course managers can view attempts" });
    const attempts = await QuizAttempt.findAll({
        where: { assessmentId: assessment.id },
        include: [{ model: User, as: "student", attributes: ["id", "fullName"] }],
        order: [["startedAt", "DESC"]]
    });
    const attemptIds = attempts.map((attempt) => attempt.id);
    const [responses, questions] = await Promise.all([
        QuizAttemptAnswer.findAll({ where: { attemptId: attemptIds.length ? attemptIds : [-1] } }),
        Quiz.findAll({
            where: { assessmentId: assessment.id },
            attributes: ["id", "question", "questionType", "marks", "optionA", "optionB", "optionC", "optionD"],
            order: [["id", "ASC"]]
        })
    ]);
    const responseMap = new Map(responses.map((response) => [`${response.attemptId}:${response.questionId}`, response]));
    res.json(attempts.map((attempt) => ({
        ...attempt.toJSON(),
        responses: questions.filter((question) => question.questionType === "THEORY")
            .map((question) => ({
                question: question.toJSON(),
                response: responseMap.get(`${attempt.id}:${question.id}`)?.toJSON() || null
            }))
    })));
};

exports.gradeTheoryAnswer = async (req, res) => {
    if (!validId(req.params.attemptId) || !validId(req.params.questionId)) {
        return res.status(400).json({ message: "Invalid attempt or question ID" });
    }
    const marksAwarded = Number(req.body.marksAwarded);
    if (req.body.marksAwarded == null || req.body.marksAwarded === "" ||
        !Number.isFinite(marksAwarded) || marksAwarded < 0 ||
        (req.body.feedback != null && typeof req.body.feedback !== "string")) {
        return res.status(400).json({ message: "Enter valid marks and feedback" });
    }
    const attempt = await QuizAttempt.findByPk(req.params.attemptId);
    if (!attempt || attempt.submittedAt == null) return res.status(404).json({ message: "Submitted attempt not found" });
    const assessment = await QuizAssessment.findByPk(attempt.assessmentId);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    const access = await getCourseAccess(assessment.courseId, req.user);
    if (access.status) return res.status(access.status).json({ message: access.message });
    if (!access.isManager) return res.status(403).json({ message: "Only course managers can grade theory answers" });

    const question = await Quiz.findOne({
        where: { id: req.params.questionId, assessmentId: assessment.id, questionType: "THEORY" }
    });
    if (!question) return res.status(404).json({ message: "Theory question not found" });
    if (marksAwarded > numberValue(question.marks)) {
        return res.status(400).json({ message: "Marks awarded cannot exceed the available marks" });
    }

    const result = await sequelize.transaction(async (transaction) => {
        const lockedAttempt = await QuizAttempt.findByPk(attempt.id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!lockedAttempt || !lockedAttempt.submittedAt) return { status: 404 };
        let response = await QuizAttemptAnswer.findOne({
            where: { attemptId: lockedAttempt.id, questionId: question.id },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!response) {
            response = await QuizAttemptAnswer.create({
                attemptId: lockedAttempt.id,
                questionId: question.id,
                answer: ""
            }, { transaction });
        }
        response.marksAwarded = marksAwarded;
        response.feedback = req.body.feedback?.trim() || null;
        await response.save({ transaction });
        const finalized = await finalizeAttempt(lockedAttempt, transaction);
        return { response, attempt: finalized.attempt };
    });
    if (result.status) return res.status(result.status).json({ message: "Submitted attempt not found" });
    res.json({ message: "Theory answer graded", response: result.response, attempt: result.attempt });
};

exports.startAttempt = async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required" });
    const assessmentId = Number(req.params.id);
    if (!validId(assessmentId)) return res.status(400).json({ message: "Invalid assessment ID" });
    const assessment = await QuizAssessment.findByPk(assessmentId);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });

    const outcome = await sequelize.transaction(async (transaction) => {
        const enrolled = await Enrollment.findOne({
            where: { studentId: req.user.id, courseId: assessment.courseId },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!enrolled) return { status: 403, message: "Enroll in the course first" };

        let active = await QuizAttempt.findOne({
            where: { studentId: req.user.id, assessmentId: assessment.id, submittedAt: null },
            order: [["startedAt", "DESC"]],
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        const now = new Date();
        if (active && new Date(active.deadlineAt) <= now) {
            await finalizeAttempt(active, transaction, active.deadlineAt);
            active = null;
        }
        if (active) return { attempt: active, resumed: true };
        const attemptCount = await QuizAttempt.count({
            where: { studentId: req.user.id, assessmentId: assessment.id },
            transaction
        });
        if (attemptCount >= assessment.maxAttempts) {
            return { status: 409, message: "You have used all attempts for this assessment" };
        }
        const attempt = await QuizAttempt.create({
            studentId: req.user.id,
            assessmentId: assessment.id,
            startedAt: now,
            deadlineAt: new Date(now.getTime() + assessment.timeLimitMinutes * 60 * 1000),
            answers: {}
        }, { transaction });
        return { attempt, resumed: false };
    });
    if (outcome.status) return res.status(outcome.status).json({ message: outcome.message });
    res.status(outcome.resumed ? 200 : 201).json({
        attempt: outcome.attempt,
        questions: await loadAttemptQuestions(assessment.id),
        answers: await loadAttemptAnswers(outcome.attempt.id)
    });
};

exports.saveAnswers = async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required" });
    if (!validId(req.params.attemptId)) return res.status(400).json({ message: "Invalid attempt ID" });
    if (!req.body.answers || typeof req.body.answers !== "object" || Array.isArray(req.body.answers)) {
        return res.status(400).json({ message: "Answers must be an object keyed by question ID" });
    }
    const attemptId = Number(req.params.attemptId);
    const result = await sequelize.transaction(async (transaction) => {
        const attempt = await QuizAttempt.findByPk(attemptId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!attempt) return { status: 404, message: "Attempt not found" };
        if (attempt.studentId !== req.user.id) return { status: 403, message: "Attempt access denied" };
        if (attempt.submittedAt) return { status: 409, message: "Attempt has already been submitted" };
        if (Date.now() >= new Date(attempt.deadlineAt).getTime()) {
            await finalizeAttempt(attempt, transaction, attempt.deadlineAt);
            return { status: 409, message: "The assessment deadline has passed" };
        }

        const answerError = await persistAttemptAnswers(attempt, req.body.answers, transaction);
        if (answerError) return answerError;
        return { attempt };
    });
    if (result.status) {
        return res.status(result.status).json({ message: result.message });
    }
    res.json({ message: "Answers saved", attempt: result.attempt });
};

exports.submitAttempt = async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required" });
    if (!validId(req.params.attemptId)) return res.status(400).json({ message: "Invalid attempt ID" });
    if (req.body.answers != null &&
        (typeof req.body.answers !== "object" || Array.isArray(req.body.answers))) {
        return res.status(400).json({ message: "Answers must be an object keyed by question ID" });
    }
    const attemptId = Number(req.params.attemptId);
    const result = await sequelize.transaction(async (transaction) => {
        const attempt = await QuizAttempt.findByPk(attemptId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!attempt) return { status: 404, message: "Attempt not found" };
        if (attempt.studentId !== req.user.id) return { status: 403, message: "Attempt access denied" };
        if (attempt.submittedAt) return { status: 409, message: "Attempt has already been submitted" };
        if (Date.now() >= new Date(attempt.deadlineAt).getTime()) {
            await finalizeAttempt(attempt, transaction, attempt.deadlineAt);
            return { status: 409, message: "The assessment deadline has passed", attempt };
        }
        if (req.body.answers) {
            const answerError = await persistAttemptAnswers(attempt, req.body.answers, transaction);
            if (answerError) return answerError;
        }
        const finalized = await finalizeAttempt(attempt, transaction);
        return { attempt: finalized.attempt };
    });
    if (result.status) {
        return res.status(result.status).json({
            message: result.message,
            ...(result.attempt ? { attempt: studentAttemptSummary(result.attempt) } : {})
        });
    }
    res.json({ message: "Assessment submitted" });
};

exports.getMyAttempt = async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student access required" });
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid assessment ID" });
    const assessment = await QuizAssessment.findByPk(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    const enrolled = await Enrollment.findOne({
        where: { studentId: req.user.id, courseId: assessment.courseId }
    });
    if (!enrolled) return res.status(403).json({ message: "Enroll in the course first" });
    let attempt = await QuizAttempt.findOne({
        where: { studentId: req.user.id, assessmentId: assessment.id, submittedAt: null },
        order: [["startedAt", "DESC"]]
    });
    if (!attempt) {
        attempt = await QuizAttempt.findOne({
            where: { studentId: req.user.id, assessmentId: assessment.id },
            order: [["startedAt", "DESC"]]
        });
        if (!attempt) return res.status(404).json({ message: "No assessment attempt found" });
        return res.json({ attempt: studentAttemptSummary(attempt), questions: [] });
    }
    if (Date.now() >= new Date(attempt.deadlineAt).getTime()) {
        const completed = await sequelize.transaction(async (transaction) => {
            const locked = await QuizAttempt.findByPk(attempt.id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (locked.submittedAt) return locked;
            return (await finalizeAttempt(locked, transaction, locked.deadlineAt)).attempt;
        });
        return res.status(409).json({
            message: "The assessment deadline has passed",
            attempt: studentAttemptSummary(completed)
        });
    }
    res.json({
        attempt,
        questions: await loadAttemptQuestions(assessment.id),
        answers: await loadAttemptAnswers(attempt.id)
    });
};
