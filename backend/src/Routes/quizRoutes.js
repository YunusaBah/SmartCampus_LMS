const express = require("express");
const router = express.Router();

const quizController = require("../controllers/quizController");
const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/roleMiddleware");
const assessmentController = require("../controllers/assessmentController");
const questionImportController = require("../controllers/questionImportController");
const multer = require("multer");
const path = require("path");
const questionImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    fileFilter(req, file, callback) {
        const extension = path.extname(file.originalname || "").toLowerCase();
        if (![".pdf", ".docx", ".pptx", ".txt", ".xlsx", ".csv"].includes(extension)) {
            return callback(new Error("Invalid file type"));
        }
        return callback(null, true);
    }
});

router.post(
    "/questions/extract",
    authMiddleware,
    requireRole("lecturer"),
    questionImportUpload.single("file"),
    questionImportController.extractQuestions
);

router.post(
    "/assessments",
    authMiddleware,
    requireRole("lecturer"),
    assessmentController.createAssessment
);

router.get(
    "/assessments/course/:courseId",
    authMiddleware,
    assessmentController.listAssessments
);

router.get(
    "/assessments/:id/attempt",
    authMiddleware,
    requireRole("student"),
    assessmentController.getMyAttempt
);

router.get(
    "/assessments/:id/attempts",
    authMiddleware,
    requireRole("lecturer"),
    assessmentController.listAssessmentAttempts
);

router.post(
    "/assessments/:id/attempts",
    authMiddleware,
    requireRole("student"),
    assessmentController.startAttempt
);

router.get(
    "/assessments/:id",
    authMiddleware,
    assessmentController.getAssessment
);

router.put(
    "/attempts/:attemptId/answers",
    authMiddleware,
    requireRole("student"),
    assessmentController.saveAnswers
);

router.post(
    "/attempts/:attemptId/submit",
    authMiddleware,
    requireRole("student"),
    assessmentController.submitAttempt
);

router.put(
    "/attempts/:attemptId/questions/:questionId/grade",
    authMiddleware,
    requireRole("lecturer"),
    assessmentController.gradeTheoryAnswer
);

router.post(
    "/",
    authMiddleware,
    requireRole("lecturer"),
    quizController.createQuiz
);

router.get(
    "/course/:courseId",
    authMiddleware,
    quizController.getCourseQuizzes
);

router.post(
    "/submit",
    authMiddleware,
    requireRole("student"),
    quizController.submitQuiz
);

module.exports = router;
