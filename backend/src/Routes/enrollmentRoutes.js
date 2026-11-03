const express = require("express");
const router = express.Router();
const enrollmentController = require("../controllers/enrollmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/roleMiddleware");

// Students join a class using a code
router.post("/join", authMiddleware, requireRole("student"), enrollmentController.joinByCode);
router.delete("/:courseId", authMiddleware, requireRole("student"), enrollmentController.leaveCourse);

// Get student's enrolled courses
router.get("/my-courses", authMiddleware, requireRole("student"), enrollmentController.getStudentCourses);

module.exports = router;