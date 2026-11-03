const express = require("express");
const router = express.Router();

const lessonController = require("../controllers/lessonController");
const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/roleMiddleware");
const upload = require("../config/multer");
const lmsController = require("../controllers/lmsController");

router.post(
    "/",
    authMiddleware,
    requireRole("lecturer", "student"),
    upload.single("file"),
    lessonController.createLesson
);

router.get(
    "/:id/notes",
    authMiddleware,
    lessonController.getPrivateNote
);

router.put(
    "/:id/notes",
    authMiddleware,
    lessonController.savePrivateNote
);

router.patch(
    "/:id",
    authMiddleware,
    requireRole("lecturer"),
    upload.single("file"),
    lessonController.updateLesson
);

router.delete(
    "/:id",
    authMiddleware,
    requireRole("lecturer"),
    lessonController.deleteLesson
);

router.get(
    "/course/:courseId",
    authMiddleware,
    lessonController.getLessons
);

router.patch(
    "/:id/order",
    authMiddleware,
    requireRole("lecturer"),
    lmsController.setLessonOrder
);

router.post(
    "/:lessonId/progress",
    authMiddleware,
    requireRole("student"),
    lmsController.completeLesson
);

router.patch(
    "/:lessonId/progress",
    authMiddleware,
    requireRole("student"),
    lmsController.updateLessonReadingProgress
);

module.exports = router;
