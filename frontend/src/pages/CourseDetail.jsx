import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import API from "../services/api";
import { appendUploadedFile } from "../services/fileUploads";
import { useAuth } from "../hooks/useAuth";
import AIAssistant from "../components/AIAssistant";
import MaterialPreviewDialog from "../components/MaterialPreviewDialog";
import RouteBackButton from "../components/RouteBackButton";
import QuizGradingTables from "../components/QuizGradingTables";
import QuestionImportDialog from "../components/QuestionImportDialog";
import AnnouncementCard from "../components/AnnouncementCard";
import useOfflineRefresh from "../hooks/useOfflineRefresh";
import {
    FaArrowRight,
    FaBullhorn,
    FaBookOpen,
    FaCalendarAlt,
    FaCheckCircle,
    FaClipboardList,
    FaClock,
    FaCog,
    FaCopy,
    FaEdit,
    FaEye,
    FaGraduationCap,
    FaPlus,
    FaSearch,
    FaShareAlt,
    FaSignOutAlt,
    FaTrash,
    FaUsers
} from "react-icons/fa";

const buildCourseInviteUrl = (classCode) => {
    const inviteUrl = new URL("/invite", window.location.origin);
    inviteUrl.searchParams.set("code", classCode);
    return inviteUrl;
};

const CourseDetail = () => {
    const offlineRefresh = useOfflineRefresh();
    const { courseId } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isStaff } = useAuth();
    const [data, setData] = useState(null);
    const requestedTab = searchParams.get("section");
    const tab = requestedTab || "materials";
    const [submissions, setSubmissions] = useState([]);
    const [mySubmissions, setMySubmissions] = useState([]);
    const [modules, setModules] = useState([]);
    const [progress, setProgress] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [gradebook, setGradebook] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [extendedError, setExtendedError] = useState("");
    const [moduleTitle, setModuleTitle] = useState("");
    const [editingLessonId, setEditingLessonId] = useState(null);
    const [studentSearch, setStudentSearch] = useState("");
    const [studentSort, setStudentSort] = useState("name");
    const [permissionStudentSearch, setPermissionStudentSearch] = useState("");
    const [permissionStudentPickerOpen, setPermissionStudentPickerOpen] = useState(false);
    const [selectedPermissionStudentId, setSelectedPermissionStudentId] = useState("");
    const [savingPermissionStudentId, setSavingPermissionStudentId] = useState("");
    const [permissionDrafts, setPermissionDrafts] = useState({});
    const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
    const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "" });
    const [eventForm, setEventForm] = useState({ eventType: "class", title: "", description: "", startsAt: "", endsAt: "" });
    const [assessmentForm, setAssessmentForm] = useState({
        title: "", instructions: "", timeLimitMinutes: 20, maxAttempts: 1,
        questions: [{ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", questionType: "MCQ", marks: 1 }]
    });
    const [questionImportOpen, setQuestionImportOpen] = useState(false);
    const [assessmentAttempts, setAssessmentAttempts] = useState([]);
    const [gradingAssessment, setGradingAssessment] = useState(null);
    const [gradingSaving, setGradingSaving] = useState("");
    const [activeAttempt, setActiveAttempt] = useState(null);
    const [attemptQuestions, setAttemptQuestions] = useState([]);
    const [attemptAnswers, setAttemptAnswers] = useState({});
    const [attemptResult, setAttemptResult] = useState(null);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [error, setError] = useState("");
    const [alertMsg, setAlertMsg] = useState(null);
    const [routeSuccess] = useState(location.state?.successMessage || "");
    const [gradeInputs, setGradeInputs] = useState({});
    const [feedbackInputs, setFeedbackInputs] = useState({});
    const [gradingSubmissionId, setGradingSubmissionId] = useState(null);
    const [previewLesson, setPreviewLesson] = useState(null);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [leavingCourse, setLeavingCourse] = useState(false);
    const [deletingCourse, setDeletingCourse] = useState(false);
    const [regeneratingClassCode, setRegeneratingClassCode] = useState(false);
    const lessonArticleRefs = useRef(new Map());
    const progressRef = useRef(progress);
    const readingTimer = useRef(null);
    const readingSaveQueue = useRef(Promise.resolve());

    const [lessonForm, setLessonForm] = useState({ title: "", content: "", resourceUrl: "", file: null });
    const lessonFileInput = useRef(null);
    const coursePermissionOptions = [
        ["uploadMaterials", "Upload course materials"],
        ["createAssignments", "Create assignments"],
        ["gradeAssignments", "Grade assignments"],
        ["postAnnouncements", "Post announcements"]
    ];
    const [quizForm, setQuizForm] = useState({ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" });
    const [assignmentForm, setAssignmentForm] = useState({ title: "", description: "", dueDate: "", file: null });
    const [quizAnswers, setQuizAnswers] = useState({});
    const [submittingQuizIds, setSubmittingQuizIds] = useState([]);
    const [submitFiles, setSubmitFiles] = useState({});
    const [assignmentReplies, setAssignmentReplies] = useState({});

    const showAlert = (text, type = "success") => {
        setAlertMsg({ text, type });
        setTimeout(() => setAlertMsg(null), 3500);
    };

    const copyCourseInvite = async () => {
        if (!data?.course?.classCode) return;
        try {
            const inviteUrl = buildCourseInviteUrl(data.course.classCode);
            await navigator.clipboard.writeText(
                inviteUrl.href
            );
            setInviteCopied(true);
            window.setTimeout(() => setInviteCopied(false), 2200);
        } catch {
            showAlert("Unable to copy the course link. Please allow clipboard access and try again.", "error");
        }
    };

    const copyCourseCode = async () => {
        if (!data?.course?.classCode) return;
        try {
            await navigator.clipboard.writeText(data.course.classCode);
            setInviteCopied(true);
            window.setTimeout(() => setInviteCopied(false), 2200);
        } catch {
            showAlert("Unable to copy the class code. Please allow clipboard access and try again.", "error");
        }
    };

    const shareCourse = async () => {
        if (!data?.course?.classCode) return;
        const url = buildCourseInviteUrl(data.course.classCode).href;
        if (!navigator.share) {
            await copyCourseInvite();
            return;
        }
        try {
            await navigator.share({
                title: `Join ${data.course.title} on SmartCampus`,
                text: `Join my SmartCampus course${data.course.academicCode ? ` (${data.course.academicCode})` : ""}.`,
                url
            });
        } catch (shareError) {
            if (shareError.name !== "AbortError") {
                showAlert("Unable to share this course. Copy the course link instead.", "error");
            }
        }
    };

    const leaveCourse = async () => {
        if (leavingCourse || !window.confirm(
            `Leave "${data.course.title}"? Your submissions, grades, and reading progress will be kept.`
        )) return;
        setLeavingCourse(true);
        try {
            await API.delete(`/enrollments/${courseId}`);
            window.dispatchEvent(new Event("smartcampus:dashboard-refresh"));
            window.dispatchEvent(new Event("smartcampus:courses-refresh"));
            navigate("/courses", { replace: true });
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to leave this course.", "error");
            setLeavingCourse(false);
        }
    };

    const deleteCourse = async () => {
        if (!showLecturer || deletingCourse) return;
        if (!window.confirm(`Delete "${data.course.title}" and all of its course data? This cannot be undone.`)) return;
        if (!navigator.onLine) {
            showAlert("Connect to the internet before deleting this course.", "error");
            return;
        }
        setDeletingCourse(true);
        try {
            await API.delete(`/courses/${courseId}`);
            window.dispatchEvent(new Event("smartcampus:dashboard-refresh"));
            window.dispatchEvent(new Event("smartcampus:courses-refresh"));
            navigate("/courses", { replace: true });
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to delete this course.", "error");
        } finally {
            setDeletingCourse(false);
        }
    };

    const regenerateCourseCode = async () => {
        if (regeneratingClassCode || !window.confirm(
            "Generate a new class code? The current code will stop working for new students."
        )) return;
        setRegeneratingClassCode(true);
        try {
            const response = await API.post(`/courses/${courseId}/class-code/regenerate`);
            setData((current) => current
                ? { ...current, course: { ...current.course, classCode: response.data.classCode } }
                : current);
            showAlert("Class code updated. Share the new code with your students.");
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to update the class code.", "error");
        } finally {
            setRegeneratingClassCode(false);
        }
    };

    const handleView = (resourceId, fileName) => {
        setPreviewLesson({ id: resourceId, fileName, resourceType: "lesson" });
    };

    const loadCourse = useCallback(() => {
        API.get(`/courses/${courseId}`)
            .then(res => {
                setData(res.data);
                setError("");
            })
            .catch(err => {
                setError(err.response?.data?.message || "Cannot load course");
            });
    }, [courseId]);

    const loadSubmissions = useCallback(() => {
        API.get(`/assignments/course/${courseId}/submissions`)
            .then(res => setSubmissions(res.data))
            .catch(err => console.error(err));
    }, [courseId]);

    useEffect(() => {
        loadCourse();
    }, [loadCourse, offlineRefresh]);

    useEffect(() => {
        if (tab === "manage") return undefined;
        let active = true;
        const loadLmsData = async () => {
            setExtendedError("");
            try {
                const requests = [
                    API.get(`/courses/${courseId}/modules`),
                    API.get(`/courses/${courseId}/progress`),
                    API.get(`/courses/${courseId}/announcements`),
                    API.get(`/courses/${courseId}/calendar`),
                    API.get(`/quizzes/assessments/course/${courseId}`)
                ];
                if (isStaff) {
                    requests.push(API.get(`/courses/${courseId}/gradebook`));
                    requests.push(API.get(`/courses/${courseId}/analytics`));
                }
                const results = await Promise.all(requests);
                if (!active) return;
                setModules(results[0].data);
                setProgress(results[1].data);
                setAnnouncements(results[2].data);
                setCalendarEvents(results[3].data);
                setAssessments(results[4].data);
                if (isStaff) {
                    setGradebook(results[5].data);
                    setAnalytics(results[6].data);
                }
            } catch (requestError) {
                if (active) setExtendedError(requestError.response?.data?.message || "Some course tools could not be loaded.");
            }
        };
        loadLmsData();
        return () => { active = false; };
    }, [courseId, isStaff, offlineRefresh, tab]);

    useEffect(() => {
        if ((data?.isLecturer || data?.permissions?.includes("gradeAssignments")) && tab === "grading") {
            loadSubmissions();
        }
    }, [data?.isLecturer, data?.permissions, offlineRefresh, tab, loadSubmissions]);

    useEffect(() => {
        if (!data || isStaff) return;
        let active = true;
        API.get("/assignments/my/submissions")
            .then((response) => {
                if (active) setMySubmissions(response.data.filter((submission) => submission.assignment?.courseId === Number(courseId)));
            })
            .catch((requestError) => {
                if (active) setExtendedError(requestError.response?.data?.message || "Unable to load your submissions.");
            });
        return () => { active = false; };
    }, [courseId, data, isStaff, offlineRefresh]);

    useEffect(() => {
        if (!activeAttempt) return undefined;
        const updateRemaining = () => setSecondsRemaining(Math.max(
            0,
            Math.ceil((new Date(activeAttempt.deadlineAt).getTime() - Date.now()) / 1000)
        ));
        updateRemaining();
        const timer = window.setInterval(updateRemaining, 1000);
        return () => window.clearInterval(timer);
    }, [activeAttempt]);

    const handleCreateLesson = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append("title", lessonForm.title);
        formData.append("content", lessonForm.content);
        formData.append("videoUrl", lessonForm.resourceUrl);
        formData.append("courseId", courseId);
        if (lessonForm.moduleId) formData.append("moduleId", lessonForm.moduleId);
        try {
            await appendUploadedFile(formData, lessonForm.file, {
                purpose: "lesson",
                ...(editingLessonId ? { lessonId: editingLessonId } : { courseId })
            });
            if (editingLessonId) {
                await API.patch(`/lessons/${editingLessonId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
            } else {
                await API.post("/lessons", formData, { headers: { "Content-Type": "multipart/form-data" } });
            }
            setLessonForm({ title: "", content: "", resourceUrl: "", file: null });
            if (lessonFileInput.current) lessonFileInput.current.value = "";
            setEditingLessonId(null);
            showAlert(editingLessonId ? "Course material updated!" : "Lesson uploaded!");
            loadCourse();
        } catch (err) {
            showAlert(err.response?.data?.message || err.message || "Failed to upload lesson", "error");
        }
    };

    const editLesson = (lesson) => {
        setEditingLessonId(lesson.id);
        setLessonForm({
            title: lesson.title,
            content: lesson.content || "",
            resourceUrl: lesson.videoUrl || "",
            moduleId: lesson.moduleId || "",
            file: null
        });
    };

    const deleteLesson = async (lesson) => {
        if (!window.confirm(`Delete "${lesson.title}"? Student progress for this material will also be removed.`)) return;
        try {
            await API.delete(`/lessons/${lesson.id}`);
            showAlert("Course material deleted.");
            loadCourse();
        } catch (deleteError) {
            showAlert(deleteError.response?.data?.message || "Unable to delete course material.", "error");
        }
    };

    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        try {
            await API.post("/quizzes", { ...quizForm, courseId: Number(courseId) });
            setQuizForm({ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" });
            showAlert("Quiz question created!");
            loadCourse();
        } catch (err) {
            showAlert(err.response?.data?.message || "Failed to create quiz", "error");
        }
    };

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        const payload = new FormData();
        payload.append("title", assignmentForm.title);
        payload.append("description", assignmentForm.description);
        payload.append("dueDate", assignmentForm.dueDate);
        payload.append("courseId", courseId);
        try {
            await appendUploadedFile(payload, assignmentForm.file, {
                purpose: "assignment",
                courseId
            });
            await API.post("/assignments", payload, { headers: { "Content-Type": "multipart/form-data" } });
            setAssignmentForm({ title: "", description: "", dueDate: "", file: null });
            showAlert("Assignment created!");
            loadCourse();
        } catch (err) {
            showAlert(err.response?.data?.message || err.message || "Failed to create assignment", "error");
        }
    };

    const handleQuizSubmit = async (quizId) => {
        const selectedAnswer = quizAnswers[quizId];
        if (quizzes.find((quiz) => quiz.id === quizId)?.submitted) {
            showAlert("You have already submitted this quiz question. Submissions are final.", "error");
            return;
        }
        if (!selectedAnswer) { showAlert("Select an answer first", "error"); return; }
        setSubmittingQuizIds((current) => [...new Set([...current, quizId])]);
        try {
            await API.post("/quizzes/submit", { quizId, selectedAnswer });
            setData((current) => ({
                ...current,
                quizzes: current.quizzes.map((quiz) => quiz.id === quizId
                    ? { ...quiz, submitted: true }
                    : quiz)
            }));
            setQuizAnswers((current) => {
                const next = { ...current };
                delete next[quizId];
                return next;
            });
            showAlert("Submitted. Your submission is final.");
            loadCourse();
        } catch (err) {
            if (err.response?.status === 409) loadCourse();
            showAlert(err.response?.data?.message || "Quiz submit failed", "error");
        } finally {
            setSubmittingQuizIds((current) => current.filter((id) => id !== quizId));
        }
    };

    const handleAssignmentSubmit = async (assignment) => {
        const assignmentId = assignment.id;
        const file = submitFiles[assignmentId];
        const answerText = (assignmentReplies[assignmentId] || "").trim();
        if (new Date().getTime() > new Date(assignment.dueDate).getTime()) {
            showAlert("Deadline passed. Contact your lecturer to request an extension.", "error");
            return;
        }
        if (!file && !answerText) {
            showAlert("Write a reply or attach a file to submit.", "error");
            return;
        }
        const formData = new FormData();
        formData.append("assignmentId", assignmentId);
        if (answerText) formData.append("answerText", answerText);
        try {
            await appendUploadedFile(formData, file, {
                purpose: "submission",
                assignmentId
            });
            await API.post("/assignments/submit", formData, { headers: { "Content-Type": "multipart/form-data" } });
            setSubmitFiles((current) => {
                const next = { ...current };
                delete next[assignmentId];
                return next;
            });
            setAssignmentReplies((current) => {
                const next = { ...current };
                delete next[assignmentId];
                return next;
            });
            showAlert("Assignment submitted!");
            loadCourse();
        } catch (err) {
            showAlert(err.response?.data?.message || err.message || "Submit failed", "error");
            return;
        }
        try {
            const response = await API.get("/assignments/my/submissions");
            setMySubmissions(response.data.filter((submission) => submission.assignment?.courseId === Number(courseId)));
        } catch (requestError) {
            setExtendedError(requestError.response?.data?.message || "Submission saved, but the submission list could not be refreshed.");
        }
    };

    const handleGrade = async (submissionId) => {
        const submission = submissions.flatMap((assignment) => assignment.submissions || [])
            .find((item) => item.id === submissionId);
        const grade = (gradeInputs[submissionId] ?? (submission?.grade === "Pending" ? "" : submission?.grade || "")).trim();
        if (!grade) { showAlert("Enter a grade first", "error"); return; }
        setGradingSubmissionId(submissionId);
        try {
            const response = await API.patch(`/assignments/submissions/${submissionId}/grade`, {
                grade,
                feedback: feedbackInputs[submissionId] ?? submission?.feedback ?? ""
            });
            const savedSubmission = response.data.submission;
            setSubmissions((current) => current.map((assignment) => ({
                ...assignment,
                submissions: assignment.submissions?.map((item) =>
                    item.id === submissionId ? { ...item, ...savedSubmission } : item
                )
            })));
            setGradeInputs((previous) => ({ ...previous, [submissionId]: savedSubmission.grade }));
            setFeedbackInputs((previous) => ({ ...previous, [submissionId]: savedSubmission.feedback || "" }));
            showAlert("Grade saved!");
        } catch (err) {
            showAlert(err.response?.data?.message || "Grading failed", "error");
        } finally {
            setGradingSubmissionId(null);
        }
    };

    const markSubmissionViewed = async (submission) => {
        try {
            const response = await API.patch(`/assignments/submissions/${submission.id}/view`);
            setSubmissions((current) => current.map((assignment) => ({
                ...assignment,
                submissions: assignment.submissions?.map((item) => item.id === submission.id
                    ? { ...item, lecturerViews: [{ viewedAt: response.data.viewedAt }] }
                    : item)
            })));
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to record that this submission was viewed.", "error");
        }
    };

    const refreshLmsData = async () => {
        const requests = [
            API.get(`/courses/${courseId}/modules`),
            API.get(`/courses/${courseId}/progress`),
            API.get(`/courses/${courseId}/announcements`),
            API.get(`/courses/${courseId}/calendar`),
            API.get(`/quizzes/assessments/course/${courseId}`)
        ];
        if (isStaff) {
            requests.push(API.get(`/courses/${courseId}/gradebook`));
            requests.push(API.get(`/courses/${courseId}/analytics`));
        }
        const results = await Promise.all(requests);
        setModules(results[0].data);
        setProgress(results[1].data);
        setAnnouncements(results[2].data);
        setCalendarEvents(results[3].data);
        setAssessments(results[4].data);
        if (isStaff) {
            setGradebook(results[5].data);
            setAnalytics(results[6].data);
        }
    };

    const createModule = async (event) => {
        event.preventDefault();
        try {
            await API.post(`/courses/${courseId}/modules`, { title: moduleTitle, orderIndex: modules.length });
            setModuleTitle("");
            await refreshLmsData();
            showAlert("Course module created.");
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to create module.", "error");
        }
    };

    const completeLesson = async (lessonId) => {
        try {
            await API.post(`/lessons/${lessonId}/progress`);
            await refreshLmsData();
            showAlert("Lesson marked complete.");
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to save lesson progress.", "error");
        }
    };

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    useEffect(() => {
        if (data?.isLecturer || !data?.isEnrolled) return undefined;
        const saveReadingPosition = (lessonId, readingPosition, readingProgress) => {
            readingSaveQueue.current = readingSaveQueue.current
                .catch(() => undefined)
                .then(() => API.patch(`/lessons/${lessonId}/progress`, {
                    readingPosition,
                    readingProgress
                }))
                .then((response) => {
                    setProgress((current) => current ? {
                        ...current,
                        lessons: current.lessons.map((lesson) => lesson.id === lessonId
                            ? { ...lesson, ...response.data }
                            : lesson)
                    } : current);
                })
                .catch((requestError) => {
                    showAlert(requestError.response?.data?.message || "Unable to save reading progress.", "error");
                });
        };

        const saveCurrentReadingPosition = () => {
            const visibleLine = window.scrollY + window.innerHeight * 0.35;
            const visibleLessons = [...lessonArticleRefs.current.entries()]
                .map(([lessonId, element]) => ({
                    lessonId,
                    element,
                    top: element.getBoundingClientRect().top + window.scrollY,
                    bottom: element.getBoundingClientRect().bottom + window.scrollY
                }))
                .filter((item) => item.top <= visibleLine && item.bottom > visibleLine)
                .sort((left, right) => right.top - left.top);
            const current = visibleLessons[0];
            if (!current) return;
            const readingPosition = Math.max(0, Math.round(visibleLine - current.top));
            const readingProgress = Math.min(
                100,
                Math.round(readingPosition * 100 / Math.max(current.element.offsetHeight, 1))
            );
            if (!readingPosition) return;

            const previousLesson = progressRef.current?.lessons?.find((lesson) => lesson.id === current.lessonId);
            if (previousLesson?.readingPosition === readingPosition) return;
            setProgress((value) => value ? {
                ...value,
                lessons: value.lessons.map((lesson) => lesson.id === current.lessonId
                    ? { ...lesson, readingPosition, readingProgress }
                    : lesson)
            } : value);
            saveReadingPosition(current.lessonId, readingPosition, readingProgress);
        };

        const scheduleReadingSave = () => {
            if (readingTimer.current) window.clearTimeout(readingTimer.current);
            readingTimer.current = window.setTimeout(saveCurrentReadingPosition, 900);
        };
        window.addEventListener("scroll", scheduleReadingSave, { passive: true });
        window.addEventListener("resize", scheduleReadingSave);
        return () => {
            window.removeEventListener("scroll", scheduleReadingSave);
            window.removeEventListener("resize", scheduleReadingSave);
            if (readingTimer.current) {
                window.clearTimeout(readingTimer.current);
                saveCurrentReadingPosition();
            }
        };
    }, [data?.isEnrolled, data?.isLecturer, courseId]);

    const continueReading = () => {
        const nextLesson = progress?.lessons
            ?.filter((lesson) => lesson.readingPosition > 0)
            .sort((left, right) => new Date(right.lastReadAt || 0) - new Date(left.lastReadAt || 0))[0];
        const element = nextLesson && lessonArticleRefs.current.get(nextLesson.id);
        if (!nextLesson || !element) return;
        const top = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
            top: Math.max(0, top + nextLesson.readingPosition - window.innerHeight * 0.35),
            behavior: "smooth"
        });
    };

    const createAnnouncement = async (event) => {
        event.preventDefault();
        try {
            if (editingAnnouncementId) {
                const response = await API.patch(`/announcements/${editingAnnouncementId}`, announcementForm);
                setAnnouncements((current) => current.map((item) =>
                    item.id === editingAnnouncementId ? { ...item, ...response.data } : item
                ));
                showAlert("Announcement updated.");
            } else {
                const response = await API.post(`/courses/${courseId}/announcements`, announcementForm);
                setAnnouncements((current) => [{
                    ...response.data,
                    author: { fullName: "You" }
                }, ...current]);
                showAlert("Announcement published.");
            }
            setAnnouncementForm({ title: "", body: "" });
            setEditingAnnouncementId(null);
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to save announcement.", "error");
        }
    };

    const saveStudentPermissions = async (student, revoke = false) => {
        const draft = permissionDrafts[student.id] || {
            role: student.permissionRole || "",
            permissions: student.permissions || []
        };
        const role = revoke ? null : draft.role || null;
        const permissions = revoke || !role
            ? []
            : draft.permissions.filter((permission) =>
                coursePermissionOptions.some(([supportedPermission]) => supportedPermission === permission)
            );
        setSavingPermissionStudentId(String(student.id));
        try {
            const response = await API.patch(`/courses/${courseId}/students/${student.id}/permissions`, {
                role,
                permissions
            });
            setData((current) => ({
                ...current,
                students: current.students.map((item) => item.id === student.id
                    ? {
                        ...item,
                        canPostAnnouncements: response.data.canPostAnnouncements,
                        announcementRoleName: response.data.announcementRoleName,
                        permissionRole: response.data.permissionRole,
                        permissions: response.data.permissions
                    }
                    : item)
            }));
            setPermissionDrafts((current) => {
                const next = { ...current };
                delete next[student.id];
                return next;
            });
            showAlert(revoke
                ? `${student.fullName}'s course role and permissions were revoked.`
                : `${student.fullName}'s course role and permissions were saved.`);
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to update course permissions.", "error");
        } finally {
            setSavingPermissionStudentId("");
        }
    };

    const removeAnnouncement = async (announcement) => {
        if (!window.confirm(`Delete announcement "${announcement.title}"?`)) return;
        try {
            await API.delete(`/announcements/${announcement.id}`);
            setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
            showAlert("Announcement deleted.");
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to delete announcement.", "error");
        }
    };

    const createCalendarEvent = async (event) => {
        event.preventDefault();
        try {
            const response = await API.post(`/courses/${courseId}/calendar`, {
                ...eventForm,
                startsAt: new Date(eventForm.startsAt).toISOString(),
                endsAt: new Date(eventForm.endsAt).toISOString()
            });
            setCalendarEvents((current) => [...current, response.data].sort((a, b) =>
                new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
            ));
            setEventForm({ eventType: "class", title: "", description: "", startsAt: "", endsAt: "" });
            showAlert("Course event created.");
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to create course event.", "error");
        }
    };

    const createAssessment = async (event) => {
        event.preventDefault();
        try {
            await API.post("/quizzes/assessments", {
                ...assessmentForm,
                courseId: Number(courseId),
                timeLimitMinutes: Number(assessmentForm.timeLimitMinutes),
                maxAttempts: Number(assessmentForm.maxAttempts)
            });
            setAssessmentForm({
                title: "", instructions: "", timeLimitMinutes: 20, maxAttempts: 1,
                questions: [{ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", questionType: "MCQ", marks: 1 }]
            });
            await refreshLmsData();
            showAlert("Timed assessment created.");
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to create assessment.", "error");
        }
    };

    const startAssessment = async (assessmentId) => {
        setAttemptResult(null);
        try {
            const response = await API.post(`/quizzes/assessments/${assessmentId}/attempts`);
            setActiveAttempt({ ...response.data.attempt, assessmentId });
            setAttemptQuestions(response.data.questions);
            setAttemptAnswers({ ...(response.data.attempt.answers || {}), ...(response.data.answers || {}) });
        } catch (requestError) {
            if (requestError.response?.status === 409) {
                try {
                    const previous = await API.get(`/quizzes/assessments/${assessmentId}/attempt`);
                    setAttemptResult({ attempt: previous.data.attempt, results: previous.data.questions });
                } catch (attemptError) {
                    showAlert(attemptError.response?.data?.message || requestError.response.data.message, "error");
                }
                return;
            }
            showAlert(requestError.response?.data?.message || "Unable to start assessment.", "error");
        }
    };

    const saveAttemptAnswer = async (questionId, answer) => {
        const key = String(questionId);
        setAttemptAnswers((current) => ({ ...current, [key]: answer }));
        try {
            await API.put(`/quizzes/attempts/${activeAttempt.id}/answers`, { answers: { [key]: answer } });
        } catch (requestError) {
            if (requestError.response?.status !== 409) {
                showAlert(requestError.response?.data?.message || "Unable to save your answer.", "error");
            }
        }
    };

    const submitAssessment = async () => {
        if (!activeAttempt || !window.confirm("Submit this assessment now? You cannot change answers after submission.")) return;
        try {
            const response = await API.post(`/quizzes/attempts/${activeAttempt.id}/submit`, { answers: attemptAnswers });
            setAttemptResult(response.data);
            setActiveAttempt(null);
            await refreshLmsData();
        } catch (requestError) {
            if (requestError.response?.status === 409 && requestError.response.data.attempt) {
                setAttemptResult({ attempt: requestError.response.data.attempt, results: [] });
                setActiveAttempt(null);
                return;
            }
            showAlert(requestError.response?.data?.message || "Unable to submit assessment.", "error");
        }
    };

    const importAssessmentQuestions = (importedQuestions) => {
        const filledCount = assessmentForm.questions.filter((question) => question.question.trim()).length;
        if (filledCount + importedQuestions.length > 100) {
            return "An assessment can contain at most 100 questions. Remove some questions before importing.";
        }
        setAssessmentForm((current) => ({
            ...current,
            questions: [...current.questions.filter((question) => question.question.trim()), ...importedQuestions]
        }));
        return true;
    };

    const loadAssessmentAttempts = async (assessment) => {
        try {
            const response = await API.get(`/quizzes/assessments/${assessment.id}/attempts`);
            setAssessmentAttempts(response.data);
            setGradingAssessment(assessment);
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to load assessment attempts.", "error");
        }
    };

    const saveTheoryGrade = async (attempt, question) => {
        const key = `${attempt.id}:${question.id}`;
        const response = attempt.responses.find((item) => item.question.id === question.id)?.response;
        if (gradeInputs[key] === undefined || gradeInputs[key] === "") {
            showAlert("Enter a mark for this theory question.", "error");
            return;
        }
        setGradingSaving(key);
        try {
            const result = await API.put(`/quizzes/attempts/${attempt.id}/questions/${question.id}/grade`, {
                marksAwarded: Number(gradeInputs[key]),
                feedback: feedbackInputs[key] ?? response?.feedback ?? ""
            });
            setAssessmentAttempts((current) => current.map((item) => item.id === attempt.id ? {
                ...item,
                ...result.data.attempt,
                responses: item.responses.map((entry) => entry.question.id === question.id
                    ? { ...entry, response: result.data.response }
                    : entry)
            } : item));
            showAlert("Theory response graded.");
        } catch (requestError) {
            showAlert(requestError.response?.data?.message || "Unable to save theory grade.", "error");
        } finally {
            setGradingSaving("");
        }
    };

    const filteredPermissionStudents = useMemo(() => (data?.students || [])
        .filter((student) =>
            `${student.fullName} ${student.email} ${student.matNumber || ""}`
                .toLowerCase()
                .includes(permissionStudentSearch.trim().toLowerCase())
        )
        .sort((left, right) => (left.fullName || "").localeCompare(right.fullName || "", undefined, {
            numeric: true,
            sensitivity: "base"
        })), [data?.students, permissionStudentSearch]);

    const selectedPermissionStudent = (data?.students || [])
        .find((student) => String(student.id) === selectedPermissionStudentId);
    const selectedPermissionDraft = selectedPermissionStudent
        ? permissionDrafts[selectedPermissionStudent.id] || {
            role: selectedPermissionStudent.permissionRole || "",
            permissions: (selectedPermissionStudent.permissions || []).filter((permission) =>
                coursePermissionOptions.some(([supportedPermission]) => supportedPermission === permission)
            )
        }
        : { role: "", permissions: [] };

    const filteredCourseStudents = useMemo(() => (data?.students || [])
        .filter((student) =>
            `${student.fullName} ${student.email} ${student.matNumber || ""}`
                .toLowerCase()
                .includes(studentSearch.trim().toLowerCase())
        )
        .sort((left, right) => {
            const leftValue = studentSort === "matNumber" ? left.matNumber || "" : left.fullName || "";
            const rightValue = studentSort === "matNumber" ? right.matNumber || "" : right.fullName || "";
            return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
        }), [data?.students, studentSearch, studentSort]);

    if (error) return (
        <div className="page-content">
            <p style={{ color: "#ff6b6b", marginBottom: 12 }}>{error}</p>
            <RouteBackButton className="course-manage-back" label="Back to courses" />
        </div>
    );

    if (!data) return <div className="page-content"><p>Loading classroom...</p></div>;

    const { course, lessons, quizzes, assignments, students, isLecturer } = data;
    const showLecturer = isLecturer || isStaff;
    const canUploadMaterials = showLecturer || data.permissions?.includes("uploadMaterials");
    const canCreateAssignments = showLecturer || data.permissions?.includes("createAssignments");
    const canGradeAssignments = showLecturer || data.permissions?.includes("gradeAssignments");
    const canPostAnnouncements = showLecturer || data.permissions?.includes("postAnnouncements");
    const lessonContent = lessons.map(l => l.content).join(" ");

    if (tab === "manage" && !showLecturer) {
        return <Navigate to={`/courses/${courseId}?section=materials`} replace />;
    }

    if (requestedTab === "overview") {
        return <Navigate to={`/courses/${courseId}?section=${showLecturer ? "manage" : "materials"}`} replace />;
    }

    if (tab === "home") {
        return <Navigate to={`/courses/${courseId}?section=${showLecturer ? "manage" : "materials"}`} replace />;
    }

    if (tab === "settings" && showLecturer) {
        return <Navigate to={`/settings/courses?courseId=${encodeURIComponent(courseId)}&returnTo=${encodeURIComponent(`/courses/${courseId}?section=manage`)}`} replace />;
    }

    if (tab === "manage" && showLecturer) {
        const openCourseSettings = () => {
            const returnTo = `/courses/${courseId}?section=manage`;
            navigate(`/settings/courses?courseId=${encodeURIComponent(courseId)}&returnTo=${encodeURIComponent(returnTo)}`);
        };

        return (
            <div className="page-content course-manage-page">
                <RouteBackButton className="course-manage-back" label="Back to courses" />
                <header className="course-manage-page-heading">
                    <div>
                        <p className="eyebrow">COURSE MANAGEMENT</p>
                        <h1>{course.title}</h1>
                        <p>{course.academicCode || "Manage course details, enrollment, and student access."}</p>
                        {course.createdAt && (
                            <p className="course-created-date">
                                Created {new Date(course.createdAt).toLocaleDateString(undefined, {
                                    year: "numeric", month: "long", day: "numeric"
                                })}
                            </p>
                        )}
                    </div>
                    <span className={`course-status-pill ${course.status === "archived" ? "is-archived" : ""}`}>
                        {course.status === "archived" ? "Archived" : "Active"}
                    </span>
                </header>

                {alertMsg && (
                    <p className={`feature-status ${alertMsg.type}`} role="status">{alertMsg.text}</p>
                )}

                <section className="course-manage-panel" aria-label="Course actions">
                    <div className="course-manage-heading">
                        <div>
                            <h2>Course actions</h2>
                            <p>Manage your class code, course settings, enrollment, and student access.</p>
                        </div>
                    </div>
                    <div className="course-manage-code">
                        <span>Current class code</span>
                        <strong>{course.classCode || "No class code available"}</strong>
                    </div>
                    <div className="course-manage-page-actions">
                        <button type="button" className="course-action-card" onClick={regenerateCourseCode} disabled={regeneratingClassCode || !course.classCode}>
                            <FaEdit aria-hidden="true" />
                            <span><strong>{regeneratingClassCode ? "Updating code..." : "Edit code"}</strong><small>Replace the current class code</small></span>
                        </button>
                        <button type="button" className="course-action-card" onClick={copyCourseCode} disabled={!course.classCode}>
                            <FaCopy aria-hidden="true" />
                            <span><strong>{inviteCopied ? "Code copied" : "Copy code"}</strong><small>Copy the code for students</small></span>
                        </button>
                        <button type="button" className="course-action-card" onClick={shareCourse} disabled={!course.classCode}>
                            <FaShareAlt aria-hidden="true" />
                            <span><strong>Share code</strong><small>Share the course invitation</small></span>
                        </button>
                        <button type="button" className="course-action-card" onClick={openCourseSettings}>
                            <FaCog aria-hidden="true" />
                            <span><strong>Course settings</strong><small>Update course details and access</small></span>
                        </button>
                        <button type="button" className="course-action-card" onClick={() => document.getElementById("course-manage-students")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                            <FaUsers aria-hidden="true" />
                            <span><strong>Student permissions</strong><small>Manage roles and student access</small></span>
                        </button>
                        <button type="button" className="course-action-card is-danger" disabled={deletingCourse} onClick={deleteCourse}>
                            <FaTrash aria-hidden="true" />
                            <span><strong>{deletingCourse ? "Deleting course..." : "Delete course"}</strong><small>Delete this course and its data</small></span>
                        </button>
                    </div>
                </section>

                <section id="course-manage-students" className="course-manage-students" aria-labelledby="course-manage-students-title">
                    <div className="course-permission-card">
                        <div className="course-permission-card-heading">
                            <h2 id="course-manage-students-title">Student Permission</h2>
                            <span className="catalog-count">{students?.length || 0} students</span>
                        </div>
                        {!students?.length ? (
                            <p className="empty-state">No students are enrolled in this course yet.</p>
                        ) : (
                            <>
                                <div
                                    className="course-student-picker"
                                    onBlur={(event) => {
                                        if (!event.currentTarget.contains(event.relatedTarget)) {
                                            setPermissionStudentPickerOpen(false);
                                        }
                                    }}
                                >
                                    <span className="course-permission-field-label">Student</span>
                                    <button
                                        type="button"
                                        className="course-student-picker-trigger"
                                        aria-haspopup="listbox"
                                        aria-expanded={permissionStudentPickerOpen}
                                        aria-controls="course-permission-students"
                                        onClick={() => {
                                            setPermissionStudentPickerOpen((open) => !open);
                                            setPermissionStudentSearch("");
                                        }}
                                    >
                                        {selectedPermissionStudent
                                            ? `${selectedPermissionStudent.fullName} · ${selectedPermissionStudent.email}`
                                            : "Select a student"}
                                        <span aria-hidden="true">▾</span>
                                    </button>
                                    {permissionStudentPickerOpen && (
                                        <div className="course-student-picker-menu">
                                            <label className="catalog-search">
                                                <FaSearch aria-hidden="true" />
                                                <span className="sr-only">Search students</span>
                                                <input
                                                    type="search"
                                                    autoFocus
                                                    placeholder="Search students by name, email, or ID"
                                                    value={permissionStudentSearch}
                                                    onChange={(event) => setPermissionStudentSearch(event.target.value)}
                                                />
                                            </label>
                                            <div id="course-permission-students" className="course-student-picker-options" role="listbox" aria-label="Course students">
                                                {filteredPermissionStudents.length ? filteredPermissionStudents.map((student) => (
                                                    <button
                                                        type="button"
                                                        role="option"
                                                        aria-selected={String(student.id) === selectedPermissionStudentId}
                                                        key={student.id}
                                                        onClick={() => {
                                                            setSelectedPermissionStudentId(String(student.id));
                                                            setPermissionStudentPickerOpen(false);
                                                            setPermissionStudentSearch("");
                                                        }}
                                                    >
                                                        <strong>{student.fullName}</strong>
                                                        <span>{student.matNumber || "No student ID"} · {student.email}</span>
                                                    </button>
                                                )) : <p className="empty-state">No students match your search.</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {selectedPermissionStudent && (
                                    <div className="course-permission-editor">
                                        <label className="course-permission-role">
                                            <span className="course-permission-field-label">Course role</span>
                                            <select
                                                aria-label={`Course role for ${selectedPermissionStudent.fullName}`}
                                                value={selectedPermissionDraft.role}
                                                onChange={(event) => setPermissionDrafts((current) => ({
                                                    ...current,
                                                    [selectedPermissionStudent.id]: {
                                                        role: event.target.value,
                                                        permissions: event.target.value ? selectedPermissionDraft.permissions : []
                                                    }
                                                }))}
                                            >
                                                <option value="">Select a role</option>
                                                <option value="student_assistant">Student Assistant</option>
                                                <option value="class_representative">Class Representative</option>
                                            </select>
                                        </label>
                                        <fieldset className="course-permission-options" disabled={!selectedPermissionDraft.role}>
                                            <legend>Permissions</legend>
                                            <label className="course-permission-select-all">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPermissionDraft.permissions.length === coursePermissionOptions.length}
                                                    onChange={(event) => setPermissionDrafts((current) => ({
                                                        ...current,
                                                        [selectedPermissionStudent.id]: {
                                                            role: selectedPermissionDraft.role,
                                                            permissions: event.target.checked
                                                                ? coursePermissionOptions.map(([permission]) => permission)
                                                                : []
                                                        }
                                                    }))}
                                                />
                                                Select all
                                            </label>
                                            {coursePermissionOptions.map(([permission, label]) => (
                                                <label key={permission}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPermissionDraft.permissions.includes(permission)}
                                                        onChange={(event) => setPermissionDrafts((current) => ({
                                                            ...current,
                                                            [selectedPermissionStudent.id]: {
                                                                role: selectedPermissionDraft.role,
                                                                permissions: event.target.checked
                                                                    ? [...new Set([...selectedPermissionDraft.permissions, permission])]
                                                                    : selectedPermissionDraft.permissions.filter((item) => item !== permission)
                                                            }
                                                        }))}
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                        </fieldset>
                                        <button
                                            type="button"
                                            className="btn btn-inline course-permission-save"
                                            disabled={savingPermissionStudentId === String(selectedPermissionStudent.id)}
                                            onClick={() => saveStudentPermissions(selectedPermissionStudent)}
                                        >
                                            {savingPermissionStudentId === String(selectedPermissionStudent.id) ? "Saving..." : "Save permissions"}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="page-content">
            <RouteBackButton className="course-manage-back" label="Back to courses" />
            <h1>{course.title}</h1>
            {course.description && <p style={{ color: "var(--theme-muted)", marginBottom: 20 }}>{course.description}</p>}
            {showLecturer && tab === "materials" && (
                <div className="course-page-header-actions">
                    <Link className="btn btn-inline btn-secondary" to={`/courses/${courseId}?section=manage`}>
                        <FaCog aria-hidden="true" /> Manage course
                    </Link>
                </div>
            )}
            {course.hasContentFile && (
                <p style={{ marginBottom: 20 }}>
                    <button
                        type="button"
                        className="file-view-button"
                        onClick={() => setPreviewLesson({
                            id: course.id,
                            fileName: course.contentFileName || `course-content-${course.id}`,
                            resourceType: "course-content"
                        })}
                    >
                        <FaEye aria-hidden="true" /> View {course.contentFileName || "course contents"}
                    </button>
                </p>
            )}
            <div className="course-detail-meta">
                {course.academicCode && <span>{course.academicCode}</span>}
                {course.department?.name && <span>{course.department.name}</span>}
                {course.category && <span>{course.category}</span>}
            </div>
            {!showLecturer && data.isEnrolled && course.classCode && (
                <section className="student-course-actions" aria-label="Course enrollment and sharing">
                    <div className="student-course-invite">
                        <span>Class code</span>
                        <strong>{course.classCode}</strong>
                    </div>
                    <button type="button" className="btn btn-inline btn-secondary" onClick={copyCourseCode}>
                        <FaCopy aria-hidden="true" /> {inviteCopied ? "Copied" : "Copy code"}
                    </button>
                    <button type="button" className="btn btn-inline btn-secondary" onClick={copyCourseInvite}>
                        <FaCopy aria-hidden="true" /> {inviteCopied ? "Copied link" : "Copy invite link"}
                    </button>
                    <button type="button" className="btn btn-inline" onClick={shareCourse}>
                        <FaShareAlt aria-hidden="true" /> Share course
                    </button>
                    <button type="button" className="student-course-leave" onClick={leaveCourse} disabled={leavingCourse}>
                        <FaSignOutAlt aria-hidden="true" /> {leavingCourse ? "Leaving..." : "Leave course"}
                    </button>
                </section>
            )}

            {routeSuccess && !alertMsg && <p className="feature-status success" role="status">{routeSuccess}</p>}
            {alertMsg && (
                <p style={{
                    color: alertMsg.type === "error" ? "#ff6b6b" : "#00d464",
                    marginBottom: 16, padding: "10px 14px",
                    background: alertMsg.type === "error" ? "rgba(255,107,107,0.1)" : "rgba(0,212,100,0.1)",
                    borderRadius: 8
                }}>
                    {alertMsg.text}
                </p>
            )}
            {extendedError && <p className="feature-status error" role="alert">{extendedError}</p>}

            {tab === "home" && !showLecturer && (
                <section className="student-course-home" aria-label="Course home">
                    <div className="student-course-home-heading">
                        <div>
                            <p className="eyebrow">YOUR CLASSROOM</p>
                            <h2>Welcome to {course.title}</h2>
                            <p>{course.description || "Your course workspace. Choose a section to get started."}</p>
                        </div>
                        <span className={`course-status-pill ${course.status === "archived" ? "is-archived" : ""}`}>
                            {course.status === "archived" ? "Archived" : "Active"}
                        </span>
                    </div>
                    {progress && (
                        <div className="course-progress-summary">
                            <div>
                                <strong>Learning progress</strong>
                                <span>
                                    {progress.completedLessons} of {progress.totalLessons} lessons completed · {progress.completionPercent}%
                                </span>
                            </div>
                            <div
                                className="course-progress-track"
                                role="progressbar"
                                aria-label="Course learning progress"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={progress.completionPercent}
                            >
                                <span style={{ width: `${progress.completionPercent}%` }} />
                            </div>
                            {progress.lessons?.some((lesson) => lesson.readingPosition > 0) && (
                                <div className="course-reading-progress">
                                    <span>
                                        Reading progress · {Math.round(progress.lessons.reduce(
                                            (total, lesson) => total + (lesson.readingProgress || 0), 0
                                        ) / Math.max(progress.totalLessons, 1))}% · {progress.lessons.filter(
                                            (lesson) => lesson.readingPosition > 0
                                        ).length} of {progress.totalLessons} materials opened
                                    </span>
                                    <button type="button" className="btn btn-inline btn-secondary" onClick={continueReading}>
                                        Continue reading
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="student-course-home-grid" aria-label="Course sections">
                        {[
                            { path: "/materials", title: "Course materials", description: `${lessons.length} learning ${lessons.length === 1 ? "resource" : "resources"}`, icon: <FaBookOpen /> },
                            { path: "/assignments", title: "Assignments", description: "View coursework and due dates", icon: <FaClipboardList /> },
                            { path: "/quizzes", title: "Quizzes", description: "Open your course assessments", icon: <FaGraduationCap /> },
                            { path: "/calendar", title: "Calendar", description: "See classes and upcoming dates", icon: <FaCalendarAlt /> },
                            { path: "/announcements", title: "Announcements", description: "Read updates from your lecturer", icon: <FaBullhorn /> }
                        ].map((item) => (
                            <Link
                                className="student-course-home-card"
                                to={`${item.path}?courseId=${encodeURIComponent(courseId)}`}
                                key={item.path}
                            >
                                <span className="student-course-home-icon" aria-hidden="true">{item.icon}</span>
                                <span className="student-course-home-copy">
                                    <strong>{item.title}</strong>
                                    <small>{item.description}</small>
                                </span>
                                <FaArrowRight className="student-course-home-arrow" aria-hidden="true" />
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* MATERIALS */}
            {tab === "materials" && (
                <section>
                    {showLecturer && (
                        <>
                            <details className="feature-create-panel" open={Boolean(editingLessonId)}>
                                <summary>Create a course module</summary>
                                <form className="feature-form-grid" onSubmit={createModule}>
                                    <label>Module title<input required value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} /></label>
                                    <button className="btn btn-inline" type="submit">Add module</button>
                                </form>
                            </details>
                        </>
                    )}
                    {canUploadMaterials && (
                        <details className="feature-create-panel upload-icon-panel">
                                <summary className="upload-icon-summary" aria-label={editingLessonId ? "Edit course material" : "Upload course material"} title={editingLessonId ? "Edit course material" : "Upload course material"}><FaPlus aria-hidden="true" /></summary>
                                <form className="feature-form-grid" onSubmit={handleCreateLesson}>
                                    <label>Lesson title<input value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} required /></label>
                                    <label>Module
                                        <select value={lessonForm.moduleId || ""} onChange={(event) => setLessonForm({ ...lessonForm, moduleId: event.target.value })}>
                                            <option value="">Uncategorized lesson</option>
                                            {modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
                                        </select>
                                    </label>
                                    <label>Resource link (optional)<input type="url" maxLength={2048} placeholder="Paste a book, video, or learning platform URL" value={lessonForm.resourceUrl} onChange={e => setLessonForm({ ...lessonForm, resourceUrl: e.target.value })} /></label>
                                    <label>Upload a file from your device<input type="file" ref={lessonFileInput} onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) setLessonForm(prev => ({ ...prev, file }));
                                    }} /></label>
                                    <details className="feature-form-wide">
                                        <summary>Add written notes (optional)</summary>
                                        <textarea value={lessonForm.content} onChange={e => setLessonForm({ ...lessonForm, content: e.target.value })} />
                                    </details>
                                    <button type="submit" className="upload-icon-button" aria-label={editingLessonId ? "Save material" : "Upload material"} title={editingLessonId ? "Save material" : "Upload material"}><FaPlus aria-hidden="true" /></button>
                                    {editingLessonId && <button type="button" className="btn btn-secondary" onClick={() => {
                                        setEditingLessonId(null);
                                        setLessonForm({ title: "", content: "", resourceUrl: "", file: null });
                                        if (lessonFileInput.current) lessonFileInput.current.value = "";
                                    }}>Cancel edit</button>}
                                </form>
                        </details>
                    )}
                    {!showLecturer && progress && (
                        <div className="course-progress-summary">
                            <div><strong>Learning progress</strong><span>{progress.completedLessons} of {progress.totalLessons} lessons completed · {progress.completionPercent}%</span></div>
                            <div className="course-progress-track"><span style={{ width: `${progress.completionPercent}%` }} /></div>
                            {progress.lessons?.some((lesson) => lesson.readingPosition > 0) && (
                                <div className="course-reading-progress">
                                    <span>
                                        Reading progress · {Math.round(progress.lessons.reduce((total, lesson) => total + (lesson.readingProgress || 0), 0) / Math.max(progress.totalLessons, 1))}% · {progress.lessons.filter((lesson) => lesson.readingPosition > 0).length} of {progress.totalLessons} materials opened
                                    </span>
                                    <button type="button" className="btn btn-inline btn-secondary" onClick={continueReading}>
                                        Continue reading
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {!lessons.length ? <div className="feature-empty"><FaBookOpen /><strong>No course materials yet</strong></div> : (
                        <div className="course-curriculum">
                            {modules.map((module) => {
                                const moduleLessons = lessons.filter((lesson) => lesson.moduleId === module.id);
                                return (
                                    <section className="curriculum-module" key={module.id}>
                                        <header><span>MODULE {module.orderIndex + 1}</span><h2>{module.title}</h2></header>
                                        {moduleLessons.map((lesson) => {
                                            const completed = progress?.lessons?.some((item) => item.id === lesson.id && item.completed);
                                            return (
                                                <article className="curriculum-lesson" key={lesson.id} ref={(element) => {
                                                    if (element) lessonArticleRefs.current.set(lesson.id, element);
                                                    else lessonArticleRefs.current.delete(lesson.id);
                                                }}>
                                                    <span className={completed ? "lesson-status complete" : "lesson-status"}><FaCheckCircle /></span>
                                                    <div><strong>{lesson.title}</strong>
                                                        {lesson.createdAt && <time className="course-material-date">Added {new Date(lesson.createdAt).toLocaleDateString()}</time>}
                                                        {lesson.content && <p>{lesson.content}</p>}
                                                        {lesson.videoUrl && <div className="lesson-resources"><a href={lesson.videoUrl} target="_blank" rel="noreferrer">Open learning resource</a></div>}
                                                    </div>
                                                    {lesson.hasFile && <div className="lesson-file-actions">
                                                        <button type="button" className="file-view-button" onClick={() => handleView(lesson.id, lesson.fileName || lesson.title)}><FaEye aria-hidden="true" /> View</button>
                                                    </div>}
                                                    {showLecturer && <div className="course-material-actions">
                                                        <button type="button" onClick={() => editLesson(lesson)}>Edit</button>
                                                        <button type="button" onClick={() => deleteLesson(lesson)}>Remove</button>
                                                    </div>}
                                                    {!showLecturer && (
                                                        <button type="button" className="lesson-complete-button" disabled={completed} onClick={() => completeLesson(lesson.id)}>
                                                            {completed ? "Completed" : "Mark complete"}
                                                        </button>
                                                    )}
                                                </article>
                                            );
                                        })}
                                        {!moduleLessons.length && <p className="module-empty">No lessons in this module yet.</p>}
                                    </section>
                                );
                            })}
                            {lessons.filter((lesson) => !lesson.moduleId).length > 0 && (
                                <section className="curriculum-module">
                                    <header><span>COURSE MATERIALS</span><h2>Other lessons</h2></header>
                                    {lessons.filter((lesson) => !lesson.moduleId).map((lesson) => (
                                        <article className="curriculum-lesson" key={lesson.id} ref={(element) => {
                                            if (element) lessonArticleRefs.current.set(lesson.id, element);
                                            else lessonArticleRefs.current.delete(lesson.id);
                                        }}>
                                            <span className={progress?.lessons?.some((item) => item.id === lesson.id && item.completed) ? "lesson-status complete" : "lesson-status"}><FaBookOpen /></span>
                                            <div><strong>{lesson.title}</strong>
                                                {lesson.createdAt && <time className="course-material-date">Added {new Date(lesson.createdAt).toLocaleDateString()}</time>}
                                                {lesson.content && <p>{lesson.content}</p>}
                                            </div>
                                            {lesson.videoUrl && <div className="lesson-resources"><a href={lesson.videoUrl} target="_blank" rel="noreferrer">Open learning resource</a></div>}
                                            {lesson.hasFile && <div className="lesson-file-actions">
                                                <button type="button" className="file-view-button" onClick={() => handleView(lesson.id, lesson.fileName || lesson.title)}><FaEye aria-hidden="true" /> View</button>
                                            </div>}
                                            {showLecturer && <div className="course-material-actions">
                                                <button type="button" onClick={() => editLesson(lesson)}>Edit</button>
                                                <button type="button" onClick={() => deleteLesson(lesson)}>Remove</button>
                                            </div>}
                                            {!showLecturer && <button type="button" className="lesson-complete-button" disabled={progress?.lessons?.some((item) => item.id === lesson.id && item.completed)} onClick={() => completeLesson(lesson.id)}>
                                                {progress?.lessons?.some((item) => item.id === lesson.id && item.completed) ? "Completed" : "Mark complete"}
                                            </button>}
                                        </article>
                                    ))}
                                </section>
                            )}
                        </div>
                    )}
                    {showLecturer && analytics && (
                        <div className="course-analytics-strip">
                            <span>{analytics.enrolledStudents} students</span>
                            <span>{analytics.lessonCount} lessons</span>
                            <span>{analytics.assignmentCount} assignments</span>
                            <span>{analytics.gradedSubmissionCount}/{analytics.submissionCount} submissions graded</span>
                        </div>
                    )}
                </section>
            )}

            {/* QUIZZES */}
            {tab === "quizzes" && (
                <section>
                    {showLecturer && (
                        <>
                            <details className="feature-create-panel">
                                <summary>Create a timed assessment</summary>
                                <form className="feature-form-grid" onSubmit={createAssessment}>
                                    <label>Assessment title<input required value={assessmentForm.title} onChange={(event) => setAssessmentForm({ ...assessmentForm, title: event.target.value })} /></label>
                                    <label>Time limit (minutes)<input type="number" min="1" max="600" required value={assessmentForm.timeLimitMinutes} onChange={(event) => setAssessmentForm({ ...assessmentForm, timeLimitMinutes: event.target.value })} /></label>
                                    <label>Maximum attempts<input type="number" min="1" max="10" required value={assessmentForm.maxAttempts} onChange={(event) => setAssessmentForm({ ...assessmentForm, maxAttempts: event.target.value })} /></label>
                                    <label className="feature-form-wide">Instructions<textarea rows={2} value={assessmentForm.instructions} onChange={(event) => setAssessmentForm({ ...assessmentForm, instructions: event.target.value })} /></label>
                                    {assessmentForm.questions.map((question, index) => (
                                        <fieldset className="assessment-question-form feature-form-wide" key={index}>
                                            <legend>Question {index + 1}</legend>
                                            <label>Prompt<textarea rows={3} required value={question.question} onChange={(event) => setAssessmentForm((current) => ({
                                                ...current,
                                                questions: current.questions.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item)
                                            }))} /></label>
                                            <div className="quiz-question-controls">
                                                <label>Type<select value={question.questionType} onChange={(event) => setAssessmentForm((current) => ({
                                                    ...current,
                                                    questions: current.questions.map((item, itemIndex) => itemIndex === index ? {
                                                        ...item,
                                                        questionType: event.target.value,
                                                        correctAnswer: event.target.value === "THEORY" ? null : ""
                                                    } : item)
                                                }))}>
                                                    <option value="MCQ">Multiple choice</option>
                                                    <option value="THEORY">Theory</option>
                                                </select></label>
                                                <label>Marks<input type="number" min="0.01" step="0.01" required value={question.marks} onChange={(event) => setAssessmentForm((current) => ({
                                                    ...current,
                                                    questions: current.questions.map((item, itemIndex) => itemIndex === index ? { ...item, marks: event.target.value } : item)
                                                }))} /></label>
                                            </div>
                                            {question.questionType === "MCQ" && <>
                                                {["A", "B", "C", "D"].map((option) => (
                                                    <label key={option}>Option {option}<input value={question[`option${option}`]} onChange={(event) => setAssessmentForm((current) => ({
                                                        ...current,
                                                        questions: current.questions.map((item, itemIndex) => itemIndex === index ? { ...item, [`option${option}`]: event.target.value } : item)
                                                    }))} /></label>
                                                ))}
                                                <label>Correct answer<select required value={question.correctAnswer || ""} onChange={(event) => setAssessmentForm((current) => ({
                                                    ...current,
                                                    questions: current.questions.map((item, itemIndex) => itemIndex === index ? { ...item, correctAnswer: event.target.value } : item)
                                                }))}>
                                                    <option value="">Select answer</option>
                                                    {["A", "B", "C", "D"].filter((option) => question[`option${option}`].trim()).map((option) => <option key={option} value={option}>{option}</option>)}
                                                </select></label>
                                            </>}
                                            {assessmentForm.questions.length > 1 && (
                                                <button type="button" className="text-button" onClick={() => setAssessmentForm((current) => ({
                                                    ...current,
                                                    questions: current.questions.filter((_, itemIndex) => itemIndex !== index)
                                                }))}>Remove question</button>
                                            )}
                                        </fieldset>
                                    ))}
                                    <div className="assessment-form-actions">
                                        <button type="button" className="btn btn-secondary btn-inline" disabled={assessmentForm.questions.length >= 100} onClick={() => setAssessmentForm((current) => ({
                                            ...current,
                                            questions: [...current.questions, { question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", questionType: "MCQ", marks: 1 }]
                                        }))}>Add question</button>
                                        <button type="button" className="btn btn-secondary btn-inline" disabled={assessmentForm.questions.length >= 100} onClick={() => setQuestionImportOpen(true)}>Import Questions</button>
                                        <button type="submit" className="btn btn-inline">Publish assessment</button>
                                    </div>
                                </form>
                            </details>
                            <details className="feature-create-panel">
                                <summary>Add a quick quiz question</summary>
                                <form className="feature-form-grid" onSubmit={handleCreateQuiz}>
                                    <label className="feature-form-wide">Question<input value={quizForm.question} onChange={e => setQuizForm({ ...quizForm, question: e.target.value })} required /></label>
                                    {["A", "B", "C", "D"].map(opt => (
                                        <label key={opt}>Option {opt}<input value={quizForm[`option${opt}`]} onChange={e => setQuizForm({ ...quizForm, [`option${opt}`]: e.target.value })} required /></label>
                                    ))}
                                    <label>Correct answer<select value={quizForm.correctAnswer} onChange={e => setQuizForm({ ...quizForm, correctAnswer: e.target.value })}>
                                        {["A", "B", "C", "D"].map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select></label>
                                    <button type="submit" className="btn btn-inline">Add question</button>
                                </form>
                            </details>
                        </>
                    )}
                    {assessments.length > 0 && (
                        <div className="feature-assessment-list">
                            <div className="section-heading"><div><p className="eyebrow">TIMED QUIZZES</p><h2>Assessments</h2></div></div>
                            {assessments.map((assessment) => (
                                <article className="feature-assessment-card" key={assessment.id}>
                                    <div><h3>{assessment.title}</h3><p>{assessment.instructions || "Answer each question before the timer expires."}</p><span><FaClock /> {assessment.timeLimitMinutes} min · {assessment.questions?.length || 0} questions · {assessment.maxAttempts} attempt(s)</span></div>
                                    {!showLecturer && <button type="button" className="btn btn-inline" onClick={() => startAssessment(assessment.id)}>Start / resume</button>}
                                    {showLecturer && <button type="button" className="btn btn-secondary btn-inline" onClick={() => loadAssessmentAttempts(assessment)}>View attempts / grade</button>}
                                </article>
                            ))}
                        </div>
                    )}
                    {activeAttempt && (
                        <section className="active-assessment">
                            <header><div><p className="eyebrow">ASSESSMENT IN PROGRESS</p><h2>{assessments.find((assessment) => assessment.id === activeAttempt.assessmentId)?.title || "Timed assessment"}</h2></div><span className={secondsRemaining < 60 ? "assessment-timer urgent" : "assessment-timer"}><FaClock /> {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, "0")}</span></header>
                            {attemptQuestions.map((question, index) => (
                                <article className="assessment-question" key={question.id}>
                                    <h3>{index + 1}. {question.question} <small>({question.marks} marks)</small></h3>
                                    {question.questionType === "THEORY" ? (
                                        <textarea
                                            className="assessment-theory-answer"
                                            aria-label={`Written answer for question ${index + 1}`}
                                            placeholder="Write your answer here..."
                                            maxLength={20000}
                                            rows={7}
                                            value={attemptAnswers[String(question.id)] || ""}
                                            onChange={(event) => setAttemptAnswers((current) => ({
                                                ...current,
                                                [String(question.id)]: event.target.value
                                            }))}
                                            onBlur={() => saveAttemptAnswer(question.id, attemptAnswers[String(question.id)] || "")}
                                        />
                                    ) : (
                                        <div className="assessment-answer-list">
                                            {["A", "B", "C", "D"].filter((option) => question[`option${option}`]).map((option) => (
                                                <label key={option} className="assessment-answer">
                                                    <input type="radio" name={`attempt-${question.id}`} checked={attemptAnswers[String(question.id)] === option} onChange={() => saveAttemptAnswer(question.id, option)} />
                                                    <span><strong>{option}.</strong> {question[`option${option}`]}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </article>
                            ))}
                            <button type="button" className="btn btn-inline" onClick={submitAssessment}>Submit assessment</button>
                        </section>
                    )}
                    {attemptResult && (
                        <div className="attempt-result" role="status">
                            <strong>Assessment submitted. You can view the result in Grades.</strong>
                        </div>
                    )}
                    {gradingAssessment && (
                        <div className="course-modal-backdrop" onMouseDown={(event) => {
                            if (event.target === event.currentTarget && !gradingSaving) setGradingAssessment(null);
                        }}>
                            <section className="course-modal theory-grading-modal" role="dialog" aria-modal="true" aria-labelledby="theory-grading-heading">
                                <button type="button" className="course-modal-close" aria-label="Close attempts" disabled={Boolean(gradingSaving)} onClick={() => setGradingAssessment(null)}>Close</button>
                                <h2 id="theory-grading-heading">{gradingAssessment.title} attempts</h2>
                                {!assessmentAttempts.length && <p>No student attempts recorded yet.</p>}
                                {assessmentAttempts.map((attempt) => (
                                    <article className="theory-attempt-card" key={attempt.id}>
                                        <h3>{attempt.student?.fullName || "Student"} · {attempt.submittedAt ? "Submitted" : "In progress"}</h3>
                                        {attempt.submittedAt && <p>
                                            Score: {attempt.score ?? 0} / {attempt.totalMarks ?? 0} marks
                                            {attempt.theoryPending && " · Theory marking pending"}
                                        </p>}
                                        {!attempt.submittedAt && <p>Unsubmitted attempt answers are not available for grading.</p>}
                                        {attempt.submittedAt && attempt.responses.map(({ question, response }) => (
                                            <section className="theory-response" key={`${attempt.id}-${question.id}`}>
                                            <h4>{question.question} ({question.marks} marks)</h4>
                                            <p className="theory-student-answer">{response?.answer || "No answer submitted."}</p>
                                            <div className="theory-grade-fields">
                                                <label>Marks awarded
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={question.marks}
                                                        step="0.01"
                                                        value={gradeInputs[`${attempt.id}:${question.id}`] ?? response?.marksAwarded ?? ""}
                                                        onChange={(event) => setGradeInputs((current) => ({ ...current, [`${attempt.id}:${question.id}`]: event.target.value }))}
                                                    />
                                                </label>
                                                <label>Feedback
                                                    <textarea
                                                        rows={2}
                                                        value={feedbackInputs[`${attempt.id}:${question.id}`] ?? response?.feedback ?? ""}
                                                        onChange={(event) => setFeedbackInputs((current) => ({ ...current, [`${attempt.id}:${question.id}`]: event.target.value }))}
                                                    />
                                                </label>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-inline"
                                                disabled={Boolean(gradingSaving)}
                                                onClick={() => saveTheoryGrade(attempt, question)}
                                            >
                                                {gradingSaving === `${attempt.id}:${question.id}` ? "Saving..." : "Save grade"}
                                            </button>
                                            </section>
                                        ))}
                                    </article>
                                ))}
                            </section>
                        </div>
                    )}
                    <div className="quick-quiz-list">
                        {quizzes.length === 0 && <p style={{ color: "var(--theme-muted)" }}>No quiz questions yet.</p>}
                        {quizzes.map(quiz => (
                            <article className="quick-quiz-row" key={quiz.id}>
                                <h3>{quiz.question}</h3>
                                {!showLecturer ? (
                                    <>
                                        {quiz.submitted ? (
                                            <p className="quick-quiz-submitted" role="status">Submitted · final</p>
                                        ) : (
                                            <>
                                                <div className="quick-quiz-options">
                                                    {["A", "B", "C", "D"].map((opt) => quiz[`option${opt}`] && (
                                                        <label key={opt} className={`quick-quiz-option${quizAnswers[quiz.id] === opt ? " selected" : ""}`}>
                                                            <input type="radio" name={`quiz-${quiz.id}`} value={opt}
                                                                checked={quizAnswers[quiz.id] === opt}
                                                                onChange={() => setQuizAnswers((current) => ({ ...current, [quiz.id]: opt }))} />
                                                            <strong>{opt}:</strong>
                                                            <span>{quiz[`option${opt}`]}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <button type="button" className="btn btn-inline quick-quiz-submit"
                                                    disabled={!quizAnswers[quiz.id] || submittingQuizIds.includes(quiz.id)}
                                                    onClick={() => handleQuizSubmit(quiz.id)}>
                                                    {submittingQuizIds.includes(quiz.id) ? "Submitting..." : "Submit answer"}
                                                </button>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <ul className="quick-quiz-lecturer-options">
                                        {["A", "B", "C", "D"].map(opt => (
                                            <li key={opt} style={{
                                                padding: "6px 0",
                                                color: quiz.correctAnswer === opt ? "var(--theme-accent)" : "var(--theme-muted)",
                                                fontWeight: quiz.correctAnswer === opt ? 700 : 400
                                            }}>
                                                {quiz.correctAnswer === opt ? "✓ " : ""}{opt}: {quiz[`option${opt}`]}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {/* ASSIGNMENTS */}
            {tab === "assignments" && (
                <section>
                    {canCreateAssignments && (
                        <details className="feature-create-panel upload-icon-panel assignment-create-toggle">
                            <summary className="upload-icon-summary" aria-label="Create assignment" title="Create assignment"><FaPlus aria-hidden="true" /></summary>
                            <form className="panel-form" onSubmit={handleCreateAssignment}>
                            <h3>Create Assignment</h3>
                            <input placeholder="Title" value={assignmentForm.title}
                                   onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })} required />
                            <textarea placeholder="Description" value={assignmentForm.description}
                                      onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })} required />
                            <label style={{ color: "var(--theme-muted)", fontSize: "0.85rem" }}>Due Date</label>
                            <input type="date" value={assignmentForm.dueDate}
                                   onChange={e => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })} required />
                            <label>Assignment file (optional)<input type="file" onChange={(event) => setAssignmentForm((current) => ({
                                ...current,
                                file: event.target.files?.[0] || null
                            }))} /></label>
                            <button type="submit" className="upload-icon-button" style={{ marginTop: 10 }} aria-label="Create assignment" title="Create assignment"><FaPlus aria-hidden="true" /></button>
                            </form>
                        </details>
                    )}
                    <div className="card-grid">
                        {assignments.length === 0 && <p style={{ color: "var(--theme-muted)" }}>No assignments yet.</p>}
                        {assignments.map(a => (
                            <div className="card" key={a.id}>
                                {(() => {
                                    const submission = mySubmissions.find((item) => item.assignmentId === a.id);
                                    const late = new Date(a.dueDate).getTime() < Date.now();
                                    const status = submission
                                        ? new Date(submission.createdAt).getTime() > new Date(a.dueDate).getTime() ? "Late" : "Submitted"
                                        : submitFiles[a.id] || assignmentReplies[a.id]?.trim() ? "In Progress" : late ? "Late" : "Not Started";
                                    return (
                                        <>
                                <h3>{a.title}</h3>
                                <p style={{ color: "var(--theme-muted)", fontSize: "0.9rem" }}>{a.description}</p>
                                <p style={{ color: "var(--theme-muted)", fontSize: "0.85rem", marginTop: 6 }}>
                                    Due: {new Date(a.dueDate).toLocaleDateString()}
                                </p>
                                {a.fileUrl && <div className="student-assignment-file-actions">
                                    <button type="button" className="file-view-button" onClick={() => setPreviewLesson({
                                        id: a.id,
                                        fileName: a.fileName || a.title,
                                        resourceType: "assignment"
                                    })}><FaEye aria-hidden="true" /> View assignment file</button>
                                </div>}
                                {!showLecturer && <p className="assignment-status"><strong>Status:</strong> {status}</p>}
                                {!showLecturer && submission?.fileUrl && (
                                    <div className="student-assignment-file-actions">
                                        <button type="button" className="file-view-button" onClick={() => setPreviewLesson({
                                            id: submission.id,
                                            fileName: submission.fileName || `Submission ${submission.id}`,
                                            resourceType: "submission"
                                        })}><FaEye aria-hidden="true" /> View your submission</button>
                                    </div>
                                )}
                                {!showLecturer && submission?.answerText && (
                                    <div className="assignment-submission-reply"><strong>Your reply</strong><p>{submission.answerText}</p></div>
                                )}
                                {!showLecturer && !submission && late && (
                                    <p className="assignment-deadline-error" role="status">Deadline passed. Contact your lecturer to request an extension.</p>
                                )}
                                {!showLecturer && (
                                    <>
                                        {!submission && <div className="student-assignment-submit">
                                            <label>Your reply
                                                <textarea
                                                    rows={4}
                                                    maxLength={20000}
                                                    value={assignmentReplies[a.id] || ""}
                                                    onChange={(event) => setAssignmentReplies((current) => ({
                                                        ...current,
                                                        [a.id]: event.target.value
                                                    }))}
                                                    placeholder="Write your assignment response..."
                                                />
                                            </label>
                                            <label>Attach a file (optional)
                                                <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip"
                                               onChange={e => {
                                                   const file = e.target.files?.[0];
                                                   if (file) setSubmitFiles(prev => ({ ...prev, [a.id]: file }));
                                               }} />
                                            </label>
                                            <button type="button" className="upload-icon-button" style={{ marginTop: 8 }}
                                                aria-label="Submit assignment" title="Submit assignment"
                                                disabled={(!submitFiles[a.id] && !assignmentReplies[a.id]?.trim()) || late}
                                                onClick={() => handleAssignmentSubmit(a)}><FaPlus aria-hidden="true" /></button>
                                        </div>}
                                    </>
                                )}
                                        </>
                                    );
                                })()}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* STUDENTS */}
            {tab === "students" && showLecturer && (
                <section>
                    <h2 style={{ marginBottom: 16, color: "var(--theme-accent)" }}>
                        Enrolled Students ({students?.length || 0})
                    </h2>
                    <div className="student-list-controls">
                        <label className="catalog-search course-student-search">
                            <FaSearch aria-hidden="true" />
                            <span className="sr-only">Search enrolled students</span>
                            <input
                                type="search"
                                placeholder="Search: name, email, ID"
                                value={studentSearch}
                                onChange={(event) => setStudentSearch(event.target.value)}
                            />
                        </label>
                        <label className="materials-course-filter">
                            <span>Sort by</span>
                            <select value={studentSort} onChange={(event) => setStudentSort(event.target.value)}>
                                <option value="name">Name (A-Z)</option>
                                <option value="matNumber">Matric number</option>
                            </select>
                        </label>
                    </div>
                    {(!students || students.length === 0) ? (
                        <p className="empty-state">No students are enrolled in this course yet.</p>
                    ) : filteredCourseStudents.length ? (
                        <div className="student-table-scroll">
                            <table className="student-table">
                                <thead>
                                    <tr>
                                        <th scope="col" className="table-number-column">No.</th>
                                        <th scope="col">Full name</th>
                                        <th scope="col">Mat. number</th>
                                        <th scope="col">Email</th>
                                        <th scope="col">Enrolled</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCourseStudents.map((student, index) => (
                                        <tr key={student.id}>
                                            <td className="table-number-column">{index + 1}</td>
                                            <td>{student.fullName}</td>
                                            <td>{student.matNumber || "Not provided"}</td>
                                            <td><a href={`mailto:${student.email}`}>{student.email}</a></td>
                                            <td>{student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="empty-state">No students match your search.</p>
                    )}
                </section>
            )}

            {/* GRADING */}
            {tab === "grading" && canGradeAssignments && (
                <section>
                    {showLecturer && <Link className="course-content-file" to="?section=gradebook">Open gradebook</Link>}
                    <h2 style={{ marginBottom: 16, color: "var(--theme-accent)" }}>Grade Submissions</h2>
                    {submissions.length === 0 && (
                        <p style={{ color: "var(--theme-muted)" }}>No submissions yet.</p>
                    )}
                    {submissions.length > 0 && (
                        <div className="grading-table-scroll">
                            <table className="grading-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Assignment</th>
                                        <th scope="col">Student</th>
                                        <th scope="col">Submitted</th>
                                        <th scope="col">Status</th>
                                        <th scope="col" className="grading-mark-column">Grade</th>
                                        <th scope="col">Feedback</th>
                                        <th scope="col">File</th>
                                        <th scope="col" className="grading-action-column">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.flatMap((assignment) => {
                                        const assignmentSubmissions = assignment.submissions || [];
                                        return assignmentSubmissions.length
                                            ? assignmentSubmissions.map((submission) => ({ assignment, submission }))
                                            : [{ assignment, submission: null }];
                                    }).sort((left, right) => {
                                        const leftTime = left.submission?.createdAt
                                            ? new Date(left.submission.createdAt).getTime()
                                            : Number.POSITIVE_INFINITY;
                                        const rightTime = right.submission?.createdAt
                                            ? new Date(right.submission.createdAt).getTime()
                                            : Number.POSITIVE_INFINITY;
                                        return leftTime - rightTime;
                                    }).map(({ assignment, submission }) => submission ? (
                                        <tr key={submission.id}>
                                            <td>
                                                <strong>{assignment.title}</strong>
                                                <span className="records-table-secondary">Due {new Date(assignment.dueDate).toLocaleDateString()}</span>
                                            </td>
                                            <td>
                                                <strong>{submission.student?.fullName || "Unknown student"}</strong>
                                                <span className="records-table-secondary">Mat. no. {submission.student?.matNumber || "Not provided"}</span>
                                                <span className="records-table-secondary">{submission.student?.email}</span>
                                            </td>
                                            <td>{submission.createdAt ? new Date(submission.createdAt).toLocaleDateString() : "—"}</td>
                                            <td><span className={submission.grade === "Pending" ? "grading-status pending" : "grading-status graded"}>
                                                {submission.grade === "Pending" ? "Needs grading" : "Graded"}
                                            </span></td>
                                            <td className="grading-mark-column">
                                                <input
                                                    className="grading-grade-input"
                                                    aria-label={`Grade for ${submission.student?.fullName || "student"} on ${assignment.title}`}
                                                    placeholder="Mark"
                                                    value={gradeInputs[submission.id] ?? (submission.grade === "Pending" ? "" : submission.grade)}
                                                    disabled={gradingSubmissionId === submission.id}
                                                    onChange={(event) => setGradeInputs((previous) => ({
                                                        ...previous,
                                                        [submission.id]: event.target.value
                                                    }))}
                                                />
                                            </td>
                                            <td>
                                                <textarea
                                                    className="grading-feedback-input"
                                                    aria-label={`Feedback for ${submission.student?.fullName || "student"}`}
                                                    placeholder="Optional feedback"
                                                    value={feedbackInputs[submission.id] ?? submission.feedback ?? ""}
                                                    disabled={gradingSubmissionId === submission.id}
                                                    onChange={(event) => setFeedbackInputs((previous) => ({
                                                        ...previous,
                                                        [submission.id]: event.target.value
                                                    }))}
                                                    rows={2}
                                                />
                                            </td>
                                            <td>
                                                {submission.answerText && <p className="assignment-submission-reply">{submission.answerText}</p>}
                                                {submission.fileUrl
                                                ? <div className="grading-file-actions">
                                                    <button type="button" className="file-view-button" onClick={() => {
                                                        if (showLecturer) markSubmissionViewed(submission);
                                                        setPreviewLesson({
                                                        id: submission.id,
                                                        fileName: submission.fileName || `Submission ${submission.id}`,
                                                        resourceType: "submission"
                                                        });
                                                    }}><FaEye aria-hidden="true" /> View</button>
                                                </div>
                                                : !submission.answerText && "No file or reply"}
                                            </td>
                                            <td className="grading-action-column">
                                                <button type="button" className="grading-save-button" disabled={gradingSubmissionId === submission.id} onClick={() => handleGrade(submission.id)}>
                                                    {gradingSubmissionId === submission.id ? "Saving..." : "Save"}
                                                </button>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr key={`${assignment.id}-empty`}>
                                            <td><strong>{assignment.title}</strong></td>
                                            <td colSpan="7" className="grading-no-submissions">No submissions yet.</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {showLecturer && <QuizGradingTables gradebook={gradebook} />}
                </section>
            )}

            {tab === "announcements" && (
                <section className="course-feature-section">
                    {(showLecturer || canPostAnnouncements) && (
                        <form className="feature-create-panel feature-form-grid" onSubmit={createAnnouncement}>
                            <h2 className="feature-form-wide">{editingAnnouncementId ? "Edit announcement" : "Publish a course announcement"}</h2>
                            <label>Title<input required value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} /></label>
                            <label className="feature-form-wide">Message<textarea required rows={4} value={announcementForm.body} onChange={(event) => setAnnouncementForm({ ...announcementForm, body: event.target.value })} /></label>
                            <button className="btn btn-inline" type="submit">{editingAnnouncementId ? "Save announcement" : "Publish announcement"}</button>
                            {editingAnnouncementId && <button type="button" className="btn btn-secondary" onClick={() => {
                                setEditingAnnouncementId(null);
                                setAnnouncementForm({ title: "", body: "" });
                            }}>Cancel edit</button>}
                        </form>
                    )}
                    {announcements.length === 0
                        ? <div className="feature-empty"><strong>No announcements yet</strong></div>
                        : <div className="course-feature-list announcement-list">{announcements.map((announcement) => (
                            <AnnouncementCard key={announcement.id} announcement={announcement} isStaff={showLecturer} actions={showLecturer && <div className="course-material-actions">
                                    <button type="button" onClick={() => {
                                        setEditingAnnouncementId(announcement.id);
                                        setAnnouncementForm({ title: announcement.title, body: announcement.body });
                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}>Edit</button>
                                    <button type="button" onClick={() => removeAnnouncement(announcement)}>Delete</button>
                                </div>} />
                        ))}</div>}
                </section>
            )}

            {tab === "calendar" && (
                <section className="course-feature-section">
                    {showLecturer && (
                        <form className="feature-create-panel feature-form-grid" onSubmit={createCalendarEvent}>
                            <h2 className="feature-form-wide">Add a course event</h2>
                            <label>Event type<select value={eventForm.eventType} onChange={(event) => setEventForm({ ...eventForm, eventType: event.target.value })}>
                                {["event", "class", "exam", "deadline", "other"].map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
                            </select></label>
                            <label>Title<input required value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} /></label>
                            <label>Starts<input type="datetime-local" required value={eventForm.startsAt} onChange={(event) => setEventForm({ ...eventForm, startsAt: event.target.value })} /></label>
                            <label>Ends<input type="datetime-local" required value={eventForm.endsAt} onChange={(event) => setEventForm({ ...eventForm, endsAt: event.target.value })} /></label>
                            <label className="feature-form-wide">Details<textarea rows={2} value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} /></label>
                            <button className="btn btn-inline" type="submit">Add event</button>
                        </form>
                    )}
                    {calendarEvents.length === 0
                        ? <div className="feature-empty"><FaClock /><strong>No course events scheduled</strong></div>
                        : <div className="course-feature-list">{calendarEvents.map((event) => (
                            <article className="course-feature-card calendar-course-event" key={event.id}>
                                <span className="course-event-type">{event.status === "cancelled" ? "cancelled" : event.eventType}</span>
                                <div><h2>{event.title}</h2><time>{new Date(event.startsAt).toLocaleString()}</time>{event.status === "rescheduled" && <span>Rescheduled</span>}{event.description && <p>{event.description}</p>}</div>
                            </article>
                        ))}</div>}
                </section>
            )}

            {tab === "gradebook" && showLecturer && (
                <section className="course-feature-section">
                    <Link className="course-content-file" to="?section=grading">Back to grading</Link>
                    {analytics && (
                        <div className="course-analytics-strip">
                            <span>{analytics.enrolledStudents} students</span>
                            <span>{analytics.assignmentCount} assignments</span>
                            <span>{analytics.submissionCount} submissions</span>
                            <span>{analytics.gradedSubmissionCount} graded</span>
                            <span>{analytics.assessmentCount + analytics.quizQuestionCount} quiz items</span>
                        </div>
                    )}
                    {!gradebook?.students?.length
                        ? <div className="feature-empty"><strong>No enrolled students</strong></div>
                        : <div className="course-gradebook-scroll"><table className="course-gradebook">
                            <thead><tr>
                                <th>Student</th>
                                {gradebook.assignmentColumns.map((assignment) => <th key={`assignment-${assignment.id}`}>{assignment.title}</th>)}
                                {gradebook.legacyQuizQuestions.map((quiz) => <th key={`quiz-${quiz.id}`}>{quiz.question}</th>)}
                                {gradebook.assessmentColumns.map((assessment) => <th key={`assessment-${assessment.id}`}>{assessment.title}</th>)}
                            </tr></thead>
                            <tbody>{gradebook.students.map((student) => (
                                <tr key={student.id}>
                                    <th scope="row">
                                        <strong>{student.fullName}</strong>
                                        <span>Mat. no. {student.matNumber || "Not provided"}</span>
                                        <span>{student.email}</span>
                                    </th>
                                    {gradebook.assignmentColumns.map((assignment) => {
                                        const grade = student.assignments.find((item) => item.assignmentId === assignment.id)?.submission?.grade;
                                        return <td key={`assignment-${assignment.id}`}>{grade && grade !== "Pending" ? grade : "—"}</td>;
                                    })}
                                    {gradebook.legacyQuizQuestions.map((quiz) => {
                                        const result = student.quizResults.find((item) => item.quizId === quiz.id);
                                        return <td key={`quiz-${quiz.id}`}>{result ? (result.score > 0 ? "Correct" : "Incorrect") : "—"}</td>;
                                    })}
                                    {gradebook.assessmentColumns.map((assessment) => {
                                        const attempt = student.assessmentAttempts.find((item) => item.assessmentId === assessment.id && item.submittedAt);
                                        return <td key={`assessment-${assessment.id}`}>{attempt
                                            ? attempt.theoryPending
                                                ? "Pending theory marking"
                                                : `${attempt.score}/${attempt.totalMarks ?? attempt.totalQuestions}`
                                            : "—"}</td>;
                                    })}
                                </tr>
                            ))}</tbody>
                        </table></div>}
                </section>
            )}

            {import.meta.env.VITE_ENABLE_AI_ASSISTANT === "true" && (
                <AIAssistant key={course.id} courseName={course.title} lessonContent={lessonContent} />
            )}
            {previewLesson && <MaterialPreviewDialog
                key={`${previewLesson.resourceType}-${previewLesson.id}`}
                resourcePath={`/downloads/${previewLesson.resourceType}/${previewLesson.id}`}
                fileName={previewLesson.fileName}
                lessonId={previewLesson.resourceType === "lesson" ? previewLesson.id : undefined}
                onClose={() => setPreviewLesson(null)}
            />}
            {questionImportOpen && <QuestionImportDialog
                onClose={() => setQuestionImportOpen(false)}
                onImport={importAssessmentQuestions}
            />}
        </div>
    );
};

export default CourseDetail;