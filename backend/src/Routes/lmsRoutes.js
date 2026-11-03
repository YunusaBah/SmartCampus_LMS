const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const requireRole = require("../middlewares/roleMiddleware");
const lmsController = require("../controllers/lmsController");

router.use(authMiddleware);

router.get("/courses/:courseId/modules", lmsController.listModules);
router.post("/courses/:courseId/modules", requireRole("lecturer"), lmsController.createModule);
router.patch("/modules/:id", requireRole("lecturer"), lmsController.updateModule);
router.delete("/modules/:id", requireRole("lecturer"), lmsController.deleteModule);
router.get("/courses/:courseId/progress", lmsController.getCourseProgress);

router.get("/courses/:courseId/announcements", lmsController.listAnnouncements);
router.post("/courses/:courseId/announcements", lmsController.createAnnouncement);
router.post("/announcements/:id/view", requireRole("student"), lmsController.markAnnouncementViewed);
router.get("/announcements/:id/activity", lmsController.getAnnouncementActivity);
router.put("/announcements/:id/reaction", lmsController.setAnnouncementReaction);
router.post("/announcements/:id/comments", lmsController.createAnnouncementComment);
router.put("/announcements/comments/:id/reaction", lmsController.setAnnouncementCommentReaction);
router.patch("/announcements/:id", requireRole("lecturer"), lmsController.updateAnnouncement);
router.delete("/announcements/:id", requireRole("lecturer"), lmsController.deleteAnnouncement);
router.get("/announcements/my", requireRole("student"), lmsController.listMyAnnouncements);
router.post("/announcements/broadcast", requireRole("lecturer"), lmsController.broadcastAnnouncement);

router.get("/courses/:courseId/conversations", requireRole("student"), lmsController.listConversations);
router.get("/courses/:courseId/conversations/:userId", requireRole("student"), lmsController.listMessages);
router.post("/courses/:courseId/messages", requireRole("student"), lmsController.sendMessage);
router.get("/courses/:courseId/lecturer-messages", requireRole("lecturer", "student"), lmsController.listLecturerMessages);
router.post("/courses/:courseId/lecturer-messages", requireRole("lecturer", "student"), lmsController.sendLecturerMessage);

router.get("/notifications", lmsController.listNotifications);
router.patch("/notifications/read-all", lmsController.markAllNotificationsRead);
router.patch("/notifications/:id/read", lmsController.markNotificationRead);

router.get("/calendar", lmsController.listMyCalendar);
router.get("/courses/:courseId/calendar", lmsController.listCalendarEvents);
router.post("/courses/:courseId/calendar", requireRole("lecturer"), lmsController.createCalendarEvent);
router.patch("/courses/:courseId/calendar/classes/:date", requireRole("lecturer"), lmsController.updateClassOccurrence);
router.patch("/calendar/:id", requireRole("lecturer"), lmsController.updateCalendarEvent);
router.delete("/calendar/:id", requireRole("lecturer"), lmsController.deleteCalendarEvent);

router.get("/departments", lmsController.listDepartments);
router.get("/certificates", requireRole("student"), lmsController.listCertificates);
router.post("/courses/:courseId/certificate", requireRole("student"), lmsController.issueCertificate);

module.exports = router;
