import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaArrowRight, FaEye, FaPlus, FaQuestionCircle, FaSearch, FaTimes } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import QuestionImportDialog from "../components/QuestionImportDialog";
import useOfflineRefresh from "../hooks/useOfflineRefresh";
import MaterialPreviewDialog from "../components/MaterialPreviewDialog";
import RouteBackButton from "../components/RouteBackButton";

const newQuestion = () => ({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "",
    questionType: "MCQ",
    marks: 1
});

const Quizzes = () => {
    const offlineRefresh = useOfflineRefresh();
    const { isStaff } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialCourseId = searchParams.get("courseId");
    const [courses, setCourses] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [assessmentGradebooks, setAssessmentGradebooks] = useState([]);
    const [classworkAssignments, setClassworkAssignments] = useState([]);
    const [previewSubmission, setPreviewSubmission] = useState(null);
    const [previewAssignment, setPreviewAssignment] = useState(null);
    const [activeTimedAttempt, setActiveTimedAttempt] = useState(null);
    const [timedAttemptDetails, setTimedAttemptDetails] = useState(null);
    const [timedAttemptLoading, setTimedAttemptLoading] = useState(false);
    const [timedAttemptError, setTimedAttemptError] = useState("");
    const [gradeInputs, setGradeInputs] = useState({});
    const [feedbackInputs, setFeedbackInputs] = useState({});
    const [gradingSaving, setGradingSaving] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [search, setSearch] = useState("");
    const [courseFilter, setCourseFilter] = useState(initialCourseId || "all");
    const activeWorkspaceTab = ["classwork", "timed", "uploaded"].includes(searchParams.get("type"))
        ? searchParams.get("type")
        : "classwork";
    const [classworkStatusFilter, setClassworkStatusFilter] = useState("pending");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(() => isStaff && searchParams.get("create") === "1");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");
    const [formType, setFormType] = useState("classwork");
    const [questionImportOpen, setQuestionImportOpen] = useState(false);
    const [courseId, setCourseId] = useState(initialCourseId || "");
    const [assignmentForm, setAssignmentForm] = useState({
        title: "",
        description: "",
        dueDate: "",
        file: null
    });
    const assignmentFileInput = useRef(null);
    const [assessmentForm, setAssessmentForm] = useState({
        title: "",
        instructions: "",
        timeLimitMinutes: 20,
        maxAttempts: 1,
        questions: [newQuestion()]
    });

    useEffect(() => {
        let active = true;
        const loadQuizzes = async () => {
            setError("");
            try {
                const response = await API.get(isStaff ? "/courses/my" : "/enrollments/my-courses");
                const availableCourses = isStaff
                    ? response.data
                    : response.data.map((enrollment) => enrollment.course).filter(Boolean);
                const rows = await Promise.all(availableCourses.map(async (course) => {
                    const [assessmentResponse, quickQuizResponse, ...staffResponses] = await Promise.all([
                        API.get(`/quizzes/assessments/course/${course.id}`),
                        API.get(`/quizzes/course/${course.id}`),
                        ...(isStaff ? [
                            API.get(`/courses/${course.id}/gradebook`),
                            API.get(`/assignments/course/${course.id}/submissions`)
                        ] : [])
                    ]);
                    return [
                        ...(isStaff ? [{
                            courseId: course.id,
                            title: course.title,
                            gradebook: staffResponses[0].data,
                            assignments: staffResponses[1].data
                        }] : []),
                        ...assessmentResponse.data.map((quiz) => ({
                            id: `assessment-${quiz.id}`,
                            type: "assessment",
                            sourceId: quiz.id,
                            title: quiz.title,
                            description: quiz.instructions,
                            questionCount: quiz.questions?.length || 0,
                            timeLimitMinutes: quiz.timeLimitMinutes,
                            maxAttempts: quiz.maxAttempts,
                            createdAt: quiz.createdAt,
                            courseId: course.id,
                            courseTitle: course.title
                        })),
                        ...quickQuizResponse.data.map((quiz) => ({
                            id: `quick-${quiz.id}`,
                            type: "quick",
                            sourceId: quiz.id,
                            title: quiz.question,
                            courseId: course.id,
                            courseTitle: course.title
                        }))
                    ];
                }));
                if (active) {
                    setCourses(availableCourses);
                    const loadedRows = rows.flat();
                    const staffRows = loadedRows.filter((item) => item.gradebook);
                    setAssessmentGradebooks(staffRows);
                    setClassworkAssignments(staffRows.flatMap((course) => course.assignments.map((assignment) => ({
                        ...assignment,
                        courseTitle: course.title
                    }))));
                    setQuizzes(loadedRows.filter((item) => !item.gradebook));
                    setCourseId((current) => current || String(availableCourses[0]?.id || ""));
                }
            } catch (requestError) {
                if (active) setError(requestError.response?.data?.message || "Unable to load course quizzes.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadQuizzes();
        return () => { active = false; };
    }, [isStaff, offlineRefresh, refreshKey]);

    const visibleQuizzes = useMemo(() => {
        const query = search.trim().toLowerCase();
        return quizzes.filter((quiz) => {
            const matchesCourse = courseFilter === "all" || String(quiz.courseId) === courseFilter;
            const matchesSearch = !query || `${quiz.title} ${quiz.courseTitle} ${quiz.description || ""}`
                .toLowerCase()
                .includes(query);
            return matchesCourse && matchesSearch;
        });
    }, [courseFilter, quizzes, search]);

    const timedTests = quizzes.filter((quiz) =>
        quiz.type === "assessment" &&
        (courseFilter === "all" || String(quiz.courseId) === courseFilter) &&
        (courseFilter !== "all" || !search.trim() ||
            `${quiz.title} ${quiz.courseTitle} ${quiz.description || ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    );
    const uploadedItems = [
        ...classworkAssignments
            .filter((assignment) => {
                const query = search.trim().toLowerCase();
                return assignment.workType === "classwork" &&
                    (courseFilter === "all" || String(assignment.courseId) === courseFilter) &&
                    (!query || `${assignment.title} ${assignment.description || ""} ${assignment.courseTitle}`.toLowerCase().includes(query));
            })
            .map((assignment) => ({ ...assignment, kind: "classwork" })),
        ...visibleQuizzes.filter((quiz) => quiz.type === "assessment").map((quiz) => ({ ...quiz, kind: quiz.type }))
    ].sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
    const classworkSubmissions = classworkAssignments.filter((assignment) => assignment.workType === "classwork").flatMap((assignment) =>
        (assignment.submissions || []).map((submission) => ({
            ...submission,
            assignmentTitle: assignment.title,
            courseId: assignment.courseId,
            courseTitle: assignment.courseTitle
        }))
    ).filter((submission) => {
        const query = search.trim().toLowerCase();
        const matchesCourse = courseFilter === "all" || String(submission.courseId) === courseFilter;
        const isGraded = Boolean(submission.grade && submission.grade !== "Pending");
        const matchesStatus = classworkStatusFilter === "all" ||
            (classworkStatusFilter === "pending" && !isGraded) ||
            (classworkStatusFilter === "graded" && isGraded);
        const matchesSearch = !query || `${submission.assignmentTitle} ${submission.courseTitle} ${submission.student?.fullName || ""} ${submission.student?.matNumber || ""}`
            .toLowerCase().includes(query);
        return matchesCourse && matchesStatus && matchesSearch;
    }).sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());
    const timedSubmissionRows = assessmentGradebooks.flatMap((course) =>
        (course.gradebook?.students || []).flatMap((student) =>
            (student.assessmentAttempts || [])
                .filter((attempt) => attempt.submittedAt)
                .map((attempt) => ({
                    id: `${course.courseId}-${attempt.id}`,
                    courseId: String(course.courseId),
                    courseTitle: course.title,
                    student,
                    attempt,
                    assessment: quizzes.find((quiz) =>
                        quiz.type === "assessment" &&
                        String(quiz.sourceId) === String(attempt.assessmentId) &&
                        String(quiz.courseId) === String(course.courseId)
                    )
                }))
        )
    ).filter(({ courseId, student, assessment }) => {
        const query = search.trim().toLowerCase();
        return (courseFilter === "all" || courseId === courseFilter) &&
            (!query || `${student.fullName || ""} ${student.matNumber || ""} ${student.email || ""} ${assessment?.title || ""} ${assessment?.courseTitle || ""}`
                .toLowerCase().includes(query));
    }).sort((left, right) => new Date(right.attempt.submittedAt).getTime() - new Date(left.attempt.submittedAt).getTime());

    const updateQuestion = (index, key, value) => {
        setAssessmentForm((current) => ({
            ...current,
            questions: current.questions.map((question, itemIndex) =>
                itemIndex === index ? {
                    ...question,
                    [key]: value,
                    ...(key === "questionType" ? { correctAnswer: value === "THEORY" ? null : "" } : {})
                } : question
            )
        }));
    };

    const importQuestions = (importedQuestions) => {
        if (assessmentForm.questions.filter((question) => question.question.trim()).length + importedQuestions.length > 100) {
            return "An assessment can contain at most 100 questions. Remove some questions before importing.";
        }
        if (importedQuestions.some((question) => question.questionType === "THEORY")) {
            return "Timed tests support multiple-choice questions only.";
        }
        setAssessmentForm((current) => ({
            ...current,
            questions: [...current.questions.filter((question) => question.question.trim()), ...importedQuestions]
        }));
        setCreateError("");
        return true;
    };

    const createQuiz = async (event) => {
        event.preventDefault();
        if (!courseId) {
            setCreateError("Choose a course for this quiz.");
            return;
        }
        if (formType === "assessment" && assessmentForm.questions.some((question) => question.questionType !== "MCQ")) {
            setCreateError("Timed tests support multiple-choice questions only.");
            return;
        }
        if (formType === "assessment" && assessmentForm.questions.some((question) =>
            !question.question.trim() || !Number.isFinite(Number(question.marks)) || Number(question.marks) <= 0 ||
            (question.questionType !== "THEORY" &&
                (["A", "B", "C", "D"].filter((letter) => question[`option${letter}`].trim()).length < 2 ||
                    !question.correctAnswer || !question[`option${question.correctAnswer}`]?.trim()))
        )) {
            setCreateError("Complete each question. Multiple-choice questions need at least two options and a correct answer.");
            return;
        }
        setCreating(true);
        setCreateError("");
        try {
            if (formType === "classwork") {
                const payload = new FormData();
                payload.append("courseId", courseId);
                payload.append("title", assignmentForm.title.trim());
                payload.append("description", assignmentForm.description.trim());
                payload.append("dueDate", assignmentForm.dueDate);
                payload.append("workType", "classwork");
                if (assignmentForm.file) payload.append("file", assignmentForm.file);
                await API.post("/assignments", payload, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                setAssignmentForm({ title: "", description: "", dueDate: "", file: null });
                if (assignmentFileInput.current) assignmentFileInput.current.value = "";
            } else {
                const response = await API.post("/quizzes/assessments", {
                    ...assessmentForm,
                    courseId: Number(courseId),
                    timeLimitMinutes: Number(assessmentForm.timeLimitMinutes),
                    maxAttempts: Number(assessmentForm.maxAttempts)
                });
                const course = courses.find((item) => String(item.id) === courseId);
                const assessment = response.data.assessment || response.data;
                setQuizzes((current) => [{
                    id: `assessment-${assessment.id}`,
                    type: "assessment",
                    sourceId: assessment.id,
                    title: assessment.title,
                    description: assessment.instructions,
                    questionCount: assessment.questions?.length || assessmentForm.questions.length,
                    timeLimitMinutes: assessment.timeLimitMinutes,
                    courseId: course.id,
                    courseTitle: course.title
                }, ...current]);
                setAssessmentForm({
                    title: "",
                    instructions: "",
                    timeLimitMinutes: 20,
                    maxAttempts: 1,
                    questions: [newQuestion()]
                });
            }
            setIsCreateOpen(false);
            setRefreshKey((key) => key + 1);
            window.dispatchEvent(new Event("smartcampus:dashboard-refresh"));
        } catch (requestError) {
            setCreateError(requestError.response?.data?.message || "Unable to create this quiz.");
        } finally {
            setCreating(false);
        }
    };

    const saveClassworkGrade = async (submission) => {
        const grade = (gradeInputs[submission.id] ?? "").trim();
        if (!grade) return "Enter a grade before saving.";
        setGradingSaving(String(submission.id));
        setError("");
        try {
            const response = await API.patch(`/assignments/submissions/${submission.id}/grade`, {
                grade,
                feedback: feedbackInputs[submission.id] ?? ""
            });
            const savedSubmission = response.data.submission;
            setClassworkAssignments((current) => current.map((assignment) => ({
                ...assignment,
                submissions: assignment.submissions?.map((item) =>
                    item.id === submission.id ? { ...item, ...savedSubmission } : item
                )
            })));
            setPreviewSubmission((current) => current?.id === submission.id
                ? { ...current, ...savedSubmission }
                : current);
            return null;
        } catch (requestError) {
            const message = requestError.response?.data?.message || "Unable to save the classwork grade.";
            setError(message);
            return message;
        } finally {
            setGradingSaving("");
        }
    };

    const openClassworkSubmission = async (submission) => {
        setPreviewSubmission(submission);
        try {
            const response = await API.patch(`/assignments/submissions/${submission.id}/view`);
            setClassworkAssignments((current) => current.map((assignment) => ({
                ...assignment,
                submissions: assignment.submissions?.map((item) => item.id === submission.id
                    ? { ...item, lecturerViews: [{ viewedAt: response.data.viewedAt }] }
                    : item)
            })));
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to record that this submission was viewed.");
        }
    };

    const openTimedAttempt = async (row) => {
        setActiveTimedAttempt(row);
        setTimedAttemptDetails(null);
        setTimedAttemptError("");
        setTimedAttemptLoading(true);
        try {
            const assessmentId = row.attempt.assessmentId;
            const [assessmentResponse, attemptsResponse] = await Promise.all([
                API.get(`/quizzes/assessments/${assessmentId}`),
                API.get(`/quizzes/assessments/${assessmentId}/attempts`)
            ]);
            const attempt = attemptsResponse.data.find((item) => String(item.id) === String(row.attempt.id));
            if (!attempt) throw new Error("The submitted attempt could not be found.");
            setTimedAttemptDetails({ assessment: assessmentResponse.data, attempt });
        } catch (requestError) {
            setTimedAttemptError(requestError.response?.data?.message || requestError.message || "Unable to load this timed test submission.");
        } finally {
            setTimedAttemptLoading(false);
        }
    };

    const closeCreate = () => {
        if (creating) return;
        setIsCreateOpen(false);
        setCreateError("");
    };

    return (
        <div className="page-content materials-page">
            {courseFilter !== "all" && courses.some((course) => String(course.id) === courseFilter) && (
                <RouteBackButton
                    className="course-context-back"
                    label={`Back to ${courses.find((course) => String(course.id) === courseFilter)?.title}`}
                />
            )}
            <header className="materials-header">
                <div>
                    <p className="eyebrow">COURSE ASSESSMENTS</p>
                    <h1>Quizzes</h1>
                </div>
                {isStaff && <div className="course-page-header-actions">
                    <button type="button" className="btn btn-inline" aria-label={`Create ${activeWorkspaceTab === "timed" ? "timed test" : "classwork"}`} disabled={!courses.length} onClick={() => {
                        setFormType(activeWorkspaceTab === "timed" ? "assessment" : "classwork");
                        setCreateError("");
                        setIsCreateOpen(true);
                    }}><FaPlus aria-hidden="true" /> Create {activeWorkspaceTab === "timed" ? "timed test" : "classwork"}</button>
                </div>}
                {questionImportOpen && <QuestionImportDialog
                    onClose={() => setQuestionImportOpen(false)}
                    onImport={importQuestions}
                />}
            </header>

            {isStaff && (
                <nav className="course-workspace-nav" aria-label="Coursework sections">
                    <div className="course-workspace-nav-tabs">
                        <button
                            type="button"
                            className={activeWorkspaceTab === "classwork" ? "is-active" : ""}
                            aria-current={activeWorkspaceTab === "classwork" ? "page" : undefined}
                            onClick={() => setSearchParams((current) => {
                                const next = new URLSearchParams(current);
                                next.set("type", "classwork");
                                return next;
                            })}
                        >Classwork</button>
                        <button
                            type="button"
                            className={activeWorkspaceTab === "timed" ? "is-active" : ""}
                            aria-current={activeWorkspaceTab === "timed" ? "page" : undefined}
                            onClick={() => setSearchParams((current) => {
                                const next = new URLSearchParams(current);
                                next.set("type", "timed");
                                return next;
                            })}
                        >Timed test</button>
                        <button
                            type="button"
                            className={activeWorkspaceTab === "uploaded" ? "is-active" : ""}
                            aria-current={activeWorkspaceTab === "uploaded" ? "page" : undefined}
                            onClick={() => setSearchParams((current) => {
                                const next = new URLSearchParams(current);
                                next.set("type", "uploaded");
                                return next;
                            })}
                        >Uploads</button>
                    </div>
                </nav>
            )}

            <div className="materials-controls">
                <label className="catalog-search">
                    <FaSearch aria-hidden="true" />
                    <span className="sr-only">{isStaff ? "Search assessments and submissions" : "Search quizzes"}</span>
                    <input
                        type="search"
                        placeholder={isStaff ? "Search: title, course, student" : "Search: quizzes, courses"}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                <label className="materials-course-filter">
                    <span>Course</span>
                    <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                        <option value="all">All courses</option>
                        {courses.map((course) => (
                            <option key={course.id} value={String(course.id)}>{course.title}</option>
                        ))}
                    </select>
                </label>
                {isStaff && activeWorkspaceTab === "classwork" && (
                    <label className="materials-course-filter">
                        <span>Status</span>
                        <select value={classworkStatusFilter} onChange={(event) => setClassworkStatusFilter(event.target.value)}>
                            <option value="pending">Needs grading</option>
                            <option value="all">All submissions</option>
                            <option value="graded">Graded</option>
                        </select>
                    </label>
                )}
            </div>

            {error && <p className="materials-error" role="alert">{error}</p>}
            {loading ? (
                <p role="status">Loading quizzes...</p>
            ) : isStaff && activeWorkspaceTab === "classwork" ? (
                classworkSubmissions.length ? (
                    <div className="grading-table-scroll">
                        <table className="grading-table quiz-workspace-table">
                            <thead><tr>
                                <th scope="col" className="table-number-column">No.</th>
                                <th scope="col">Classwork</th>
                                <th scope="col">Course</th>
                                <th scope="col">Student</th>
                                <th scope="col">Submitted</th>
                                <th scope="col">Submission</th>
                                <th scope="col">Grade</th>
                            </tr></thead>
                            <tbody>
                                {classworkSubmissions.map((submission, index) => (
                                    <tr key={submission.id}>
                                        <td className="table-number-column">{index + 1}</td>
                                        <td><strong>{submission.assignmentTitle}</strong></td>
                                        <td>{submission.courseTitle}</td>
                                        <td>
                                            <strong>{submission.student?.fullName || "Student"}</strong>
                                            {submission.student?.matNumber && <span className="records-table-secondary">{submission.student.matNumber}</span>}
                                        </td>
                                        <td>{submission.createdAt ? new Date(submission.createdAt).toLocaleDateString() : "—"}</td>
                                        <td>
                                            <button type="button" className="assignment-review-view-button" onClick={() => openClassworkSubmission(submission)}>
                                                <FaEye aria-hidden="true" /> View & grade
                                            </button>
                                        </td>
                                        <td><span className={submission.grade && submission.grade !== "Pending" ? "grading-status graded" : "grading-status pending"}>{submission.grade || "Pending"}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="materials-empty">
                        <FaQuestionCircle aria-hidden="true" />
                        <h2>{classworkStatusFilter === "pending" ? "No classwork needs grading" : "No classwork submissions yet"}</h2>
                    </div>
                )
            ) : isStaff && activeWorkspaceTab === "uploaded" ? (
                uploadedItems.length ? (
                    <div className="grading-table-scroll">
                        <table className="grading-table quiz-workspace-table quiz-uploaded-table">
                            <thead><tr>
                                <th scope="col" className="table-number-column">No.</th>
                                <th scope="col">Upload</th>
                                <th scope="col">Type</th>
                                <th scope="col">Course</th>
                                <th scope="col">Details</th>
                                <th scope="col">Open</th>
                            </tr></thead>
                            <tbody>
                                {uploadedItems.map((item, index) => (
                                    <tr key={`${item.kind}-${item.id}`}>
                                        <td className="table-number-column">{index + 1}</td>
                                        <td><strong>{item.title}</strong></td>
                                        <td>{item.kind === "assessment" ? "Timed test" : "Classwork"}</td>
                                        <td>{item.courseTitle}</td>
                                        <td>{item.kind === "assessment"
                                            ? `${item.timeLimitMinutes} min · ${item.questionCount} questions · ${item.maxAttempts ?? "—"} attempts`
                                            : `Due ${item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}`}</td>
                                        <td><Link className="grading-table-link" to={`/courses/${item.courseId}?section=${item.kind === "classwork" ? "assignments" : "quizzes"}`}>Open course</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="materials-empty">
                        <FaQuestionCircle aria-hidden="true" />
                        <h2>{quizzes.length || classworkAssignments.length ? "No uploads match your filters" : "No quizzes or classwork uploaded yet"}</h2>
                    </div>
                )
            ) : isStaff ? (
                timedSubmissionRows.length ? (
                    <div className="grading-table-scroll">
                        <table className="grading-table quiz-workspace-table quiz-timed-results-table">
                            <thead><tr>
                                <th scope="col" className="table-number-column">No.</th>
                                <th scope="col">Student</th>
                                <th scope="col">Timed test</th>
                                <th scope="col">Course</th>
                                <th scope="col">Submitted</th>
                                <th scope="col">Score</th>
                                <th scope="col">Result</th>
                                <th scope="col">View</th>
                            </tr></thead>
                            <tbody>
                                {timedSubmissionRows.map((row, index) => (
                                    <tr key={row.id}>
                                        <td className="table-number-column">{index + 1}</td>
                                        <td>
                                            <strong>{row.student.fullName}</strong>
                                            <span className="records-table-secondary">Mat. no. {row.student.matNumber || "Not provided"}</span>
                                            {row.student.email && <span className="records-table-secondary">{row.student.email}</span>}
                                        </td>
                                        <td><strong>{row.assessment?.title || "Timed test"}</strong></td>
                                        <td>{row.courseTitle}</td>
                                        <td>{new Date(row.attempt.submittedAt).toLocaleString()}</td>
                                        <td>{row.attempt.score ?? 0} / {row.attempt.totalMarks ?? row.attempt.totalQuestions ?? 0}</td>
                                        <td><span className={row.attempt.theoryPending ? "grading-status pending" : "grading-status graded"}>{row.attempt.theoryPending ? "Pending review" : "Auto-graded"}</span></td>
                                        <td>
                                            <button type="button" className="assignment-review-view-button" onClick={() => openTimedAttempt(row)}>
                                                <FaEye aria-hidden="true" /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="materials-empty">
                        <FaQuestionCircle aria-hidden="true" />
                        <h2>{timedTests.length ? "No submitted timed tests match your filters" : "No timed tests available yet"}</h2>
                    </div>
                )
            ) : visibleQuizzes.length ? (
                <div className="materials-list">
                    {visibleQuizzes.map((quiz) => (
                        <article className="material-item" key={quiz.id}>
                            <span className="material-item-icon"><FaQuestionCircle /></span>
                            <div className="material-item-content">
                                <h2>{quiz.title}</h2>
                                <Link to={`/courses/${quiz.courseId}?section=quizzes`} className="material-course-link">
                                    {quiz.courseTitle}
                                </Link>
                                {quiz.description && <p>{quiz.description}</p>}
                                <span className="quiz-item-meta">
                                    {quiz.type === "assessment"
                                        ? `Timed test · ${quiz.timeLimitMinutes} minutes · ${quiz.questionCount} questions`
                                        : "Classwork · Quick quiz"}
                                </span>
                            </div>
                            <Link
                                to={`/courses/${quiz.courseId}?section=quizzes`}
                                className="material-download quiz-open-link"
                            >
                                {isStaff ? "Open course" : "Open quiz"} <FaArrowRight />
                            </Link>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="materials-empty">
                    <FaQuestionCircle aria-hidden="true" />
                    <h2>{quizzes.length ? "No quizzes match your filters" : "No quizzes available yet"}</h2>
                    <p>{quizzes.length ? "No matching quizzes." : "No quizzes available."}</p>
                </div>
            )}
            {previewAssignment && <MaterialPreviewDialog
                key={`uploaded-classwork-${previewAssignment.id}`}
                resourcePath={`/downloads/assignment/${previewAssignment.id}`}
                fileName={previewAssignment.fileName || previewAssignment.title}
                onClose={() => setPreviewAssignment(null)}
            />}
            {previewSubmission && <MaterialPreviewDialog
                key={`classwork-${previewSubmission.id}`}
                resourcePath={previewSubmission.fileUrl ? `/downloads/submission/${previewSubmission.id}` : null}
                fileName={previewSubmission.fileName || `Submission ${previewSubmission.id}`}
                textContent={previewSubmission.answerText}
                gradeValue={gradeInputs[previewSubmission.id] ?? (previewSubmission.grade === "Pending" ? "" : previewSubmission.grade)}
                feedbackValue={feedbackInputs[previewSubmission.id] ?? previewSubmission.feedback ?? ""}
                grading={gradingSaving === String(previewSubmission.id)}
                onGradeChange={(value) => setGradeInputs((current) => ({ ...current, [previewSubmission.id]: value }))}
                onFeedbackChange={(value) => setFeedbackInputs((current) => ({ ...current, [previewSubmission.id]: value }))}
                onSaveGrade={() => saveClassworkGrade(previewSubmission)}
                onClose={() => setPreviewSubmission(null)}
            />}
            {activeTimedAttempt && (
                <div className="course-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setActiveTimedAttempt(null);
                }}>
                    <section className="course-modal quiz-attempt-modal" role="dialog" aria-modal="true" aria-labelledby="timed-attempt-heading">
                        <button type="button" className="course-modal-close" aria-label="Close submission details" onClick={() => setActiveTimedAttempt(null)}>
                            <FaTimes aria-hidden="true" />
                        </button>
                        <h2 id="timed-attempt-heading">Timed test submission</h2>
                        <p><strong>{activeTimedAttempt.student.fullName}</strong> · {activeTimedAttempt.assessment?.title || "Timed test"}</p>
                        <p>{activeTimedAttempt.courseTitle} · Submitted {new Date(activeTimedAttempt.attempt.submittedAt).toLocaleString()}</p>
                        {timedAttemptLoading ? <p role="status">Loading submission details…</p> : null}
                        {timedAttemptError && <p className="course-modal-feedback" role="alert">{timedAttemptError}</p>}
                        {timedAttemptDetails && (
                            <>
                                <p className="quiz-attempt-score">
                                    Score: {timedAttemptDetails.attempt.score ?? 0} / {timedAttemptDetails.attempt.totalMarks ?? 0}
                                    {" · "}
                                    {timedAttemptDetails.attempt.theoryPending ? "Theory answers need review" : "Auto-graded"}
                                </p>
                                <div className="quiz-attempt-questions">
                                    {timedAttemptDetails.assessment.questions.map((question, index) => {
                                        const answer = timedAttemptDetails.attempt.answers?.[String(question.id)];
                                        const theoryResponse = timedAttemptDetails.attempt.responses?.find(
                                            (item) => String(item.question.id) === String(question.id)
                                        )?.response;
                                        const selectedOption = answer && ["A", "B", "C", "D"].includes(answer)
                                            ? question[`option${answer}`]
                                            : null;
                                        return (
                                            <article className="quiz-attempt-question" key={question.id}>
                                                <h3>{index + 1}. {question.question}</h3>
                                                <p><strong>Student response:</strong> {question.questionType === "THEORY"
                                                    ? theoryResponse?.answer || "No response"
                                                    : selectedOption ? `Option ${answer}: ${selectedOption}` : "No response"}</p>
                                                {question.questionType === "THEORY"
                                                    ? <p><strong>Review:</strong> {theoryResponse?.marksAwarded == null ? "Pending" : `${theoryResponse.marksAwarded} / ${question.marks}`}</p>
                                                    : <p><strong>Correct answer:</strong> {question.correctAnswer ? `Option ${question.correctAnswer}: ${question[`option${question.correctAnswer}`]}` : "Unavailable"}</p>}
                                            </article>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}
            {isCreateOpen && (
                <div className="course-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeCreate();
                }}>
                    <section className="course-modal quiz-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-quiz-heading">
                        <button type="button" className="course-modal-close" aria-label="Close quiz dialog" onClick={closeCreate}>
                            <FaTimes aria-hidden="true" />
                        </button>
                        <h2 id="create-quiz-heading">{formType === "assessment" ? "Create timed test" : "Create classwork"}</h2>
                        {createError && <p className="course-modal-feedback" role="alert">{createError}</p>}
                        <form className="course-create-form" onSubmit={createQuiz}>
                            <label>
                                Available courses
                                <select required value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={creating}>
                                    <option value="" disabled>Select a course</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={String(course.id)}>{course.title}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Assessment type
                                <select value={formType} onChange={(event) => setFormType(event.target.value)} disabled={creating}>
                                    <option value="assessment">Timed test</option>
                                    <option value="classwork">Classwork (file submission)</option>
                                </select>
                            </label>
                            {formType === "assessment" ? (
                                <>
                                    <label>Assessment title<input required maxLength={255} value={assessmentForm.title} onChange={(event) => setAssessmentForm({ ...assessmentForm, title: event.target.value })} disabled={creating} /></label>
                                    <label>Time limit (minutes)<input type="number" min="1" max="600" required value={assessmentForm.timeLimitMinutes} onChange={(event) => setAssessmentForm({ ...assessmentForm, timeLimitMinutes: event.target.value })} disabled={creating} /></label>
                                    <label>Maximum attempts<input type="number" min="1" max="10" required value={assessmentForm.maxAttempts} onChange={(event) => setAssessmentForm({ ...assessmentForm, maxAttempts: event.target.value })} disabled={creating} /></label>
                                    <label>Instructions<textarea rows={2} value={assessmentForm.instructions} onChange={(event) => setAssessmentForm({ ...assessmentForm, instructions: event.target.value })} disabled={creating} /></label>
                                    {assessmentForm.questions.map((question, index) => (
                                        <fieldset className="quiz-question-fieldset" key={index}>
                                            <legend>Question {index + 1}</legend>
                                            <label>Question<input required value={question.question} onChange={(event) => updateQuestion(index, "question", event.target.value)} disabled={creating} /></label>
                                            <div className="quiz-question-controls">
                                                <label>Marks<input type="number" min="0.01" step="0.01" required value={question.marks} onChange={(event) => updateQuestion(index, "marks", event.target.value)} disabled={creating} /></label>
                                            </div>
                                            {["A", "B", "C", "D"].map((option) => (
                                                <label key={option}>Option {option}<input value={question[`option${option}`]} onChange={(event) => updateQuestion(index, `option${option}`, event.target.value)} disabled={creating} /></label>
                                            ))}
                                            <label>Correct answer<select required value={question.correctAnswer || ""} onChange={(event) => updateQuestion(index, "correctAnswer", event.target.value)} disabled={creating}>
                                                <option value="">Select answer</option>
                                                {["A", "B", "C", "D"].filter((option) => question[`option${option}`].trim()).map((option) => <option key={option} value={option}>{option}</option>)}
                                            </select></label>
                                            {assessmentForm.questions.length > 1 && (
                                                <button type="button" className="text-button" onClick={() => setAssessmentForm((current) => ({
                                                    ...current,
                                                    questions: current.questions.filter((_, itemIndex) => itemIndex !== index)
                                                }))} disabled={creating}>Remove question</button>
                                            )}
                                        </fieldset>
                                    ))}
                                    <div className="assessment-form-actions">
                                        <button type="button" className="btn btn-secondary btn-inline" disabled={creating || assessmentForm.questions.length >= 100} onClick={() => setAssessmentForm((current) => ({ ...current, questions: [...current.questions, newQuestion()] }))}>Add question</button>
                                        <button type="button" className="btn btn-secondary btn-inline" disabled={creating || assessmentForm.questions.length >= 100} onClick={() => setQuestionImportOpen(true)}>Import Questions</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <label>Classwork title<input required maxLength={255} value={assignmentForm.title} onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))} disabled={creating} /></label>
                                    <label>Instructions<textarea required rows={3} value={assignmentForm.description} onChange={(event) => setAssignmentForm((current) => ({ ...current, description: event.target.value }))} disabled={creating} /></label>
                                    <label>Due date<input type="date" required value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, dueDate: event.target.value }))} disabled={creating} /></label>
                                    <label>Reference file (optional)
                                        <input ref={assignmentFileInput} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip" onChange={(event) => setAssignmentForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} disabled={creating} />
                                    </label>
                                </>
                            )}
                            <div className="course-modal-actions">
                                <button type="button" className="course-cancel-button" onClick={closeCreate} disabled={creating}>Cancel</button>
                                <button type="submit" className="upload-icon-button" aria-label={creating ? "Publishing assessment" : formType === "assessment" ? "Create timed test" : "Publish classwork"} title={creating ? "Publishing assessment" : formType === "assessment" ? "Create timed test" : "Publish classwork"} disabled={creating}>
                                    <FaPlus aria-hidden="true" />
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
};

export default Quizzes;
