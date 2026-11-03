import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import MaterialPreviewDialog from "../components/MaterialPreviewDialog";
import RouteBackButton from "../components/RouteBackButton";
import { FaEye, FaPlus, FaSearch } from "react-icons/fa";
import useOfflineRefresh from "../hooks/useOfflineRefresh";

const Assignments = () => {
    const offlineRefresh = useOfflineRefresh();
    const { isStaff } = useAuth();
    const [searchParams] = useSearchParams();
    const initialCourseId = searchParams.get("courseId");
    const [data, setData] = useState([]);
    const [permittedCourses, setPermittedCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [gradeInputs, setGradeInputs] = useState({});
    const [feedbackInputs, setFeedbackInputs] = useState({});
    const [gradingSubmissionId, setGradingSubmissionId] = useState(null);
    const [msg, setMsg] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedCourse, setSelectedCourse] = useState(initialCourseId || "all");
    const [activeAssignmentTab, setActiveAssignmentTab] = useState("assigned");
    const [submitModalOpen, setSubmitModalOpen] = useState(false);
    const [submissionCourseId, setSubmissionCourseId] = useState("");
    const [submissionAssignmentId, setSubmissionAssignmentId] = useState("");
    const [submissionModalFile, setSubmissionModalFile] = useState(null);
    const [submissionModalReply, setSubmissionModalReply] = useState("");
    const [submissionModalError, setSubmissionModalError] = useState("");
    const [previewAssignment, setPreviewAssignment] = useState(null);
    const [previewSubmission, setPreviewSubmission] = useState(null);
    const [submittingIds, setSubmittingIds] = useState([]);
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const [assignmentSearch, setAssignmentSearch] = useState("");
    const [assignmentStatusFilter, setAssignmentStatusFilter] = useState("all");
    const [showCourseAssignments, setShowCourseAssignments] = useState(() => searchParams.get("view") === "uploaded");
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewPageSize, setReviewPageSize] = useState(10);
    const [createAssignmentOpen, setCreateAssignmentOpen] = useState(() => isStaff && searchParams.get("create") === "1");
    const [creatingAssignment, setCreatingAssignment] = useState(false);
    const [createAssignmentError, setCreateAssignmentError] = useState("");
    const assignmentFileInput = useRef(null);
    const [assignmentForm, setAssignmentForm] = useState({
        courseId: isStaff && searchParams.get("create") === "1" ? initialCourseId || "" : "",
        title: "",
        description: "",
        dueDate: "",
        file: null
    });

    useEffect(() => {
        const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const refreshAssignments = () => setRefreshKey((key) => key + 1);
        window.addEventListener("focus", refreshAssignments);
        return () => window.removeEventListener("focus", refreshAssignments);
    }, []);

    const showMsg = (text, type = "success") => {
        setMsg({ text, type });
        setTimeout(() => setMsg(null), 3500);
    };

    useEffect(() => {
        let active = true;

        const loadData = async () => {
            setLoadError("");
            try {
                if (isStaff) {
                    const coursesRes = await API.get("/courses/my");
                    const courses = coursesRes.data;
                    const withSubs = await Promise.all(
                        courses.map(async (course) => {
                            const [submissionResponse, gradebookResponse] = await Promise.all([
                                API.get(`/assignments/course/${course.id}/submissions`),
                                API.get(`/courses/${course.id}/gradebook`)
                            ]);
                            return {
                                ...course,
                                assignments: submissionResponse.data,
                                gradebook: gradebookResponse.data
                            };
                        })
                    );
                    if (active) setData(withSubs);
                } else {
                    const [assignmentResponse, enrollmentResponse] = await Promise.all([
                        API.get("/assignments/my"),
                        API.get("/enrollments/my-courses")
                    ]);
                    if (active) {
                        setData(assignmentResponse.data);
                        setPermittedCourses(enrollmentResponse.data
                            .filter((enrollment) => enrollment.course)
                            .map((enrollment) => ({
                                ...enrollment.course,
                                permissions: enrollment.permissions || []
                            })));
                    }
                }
            } catch (err) {
                if (active) setLoadError(err.response?.data?.message || "Unable to load grading data.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadData();
        return () => { active = false; };
    }, [isStaff, offlineRefresh, refreshKey]);

    const handleGrade = async (submissionId) => {
        const grade = (gradeInputs[submissionId] ?? "").trim();
        if (!grade) {
            const message = "Enter a grade first.";
            showMsg(message, "error");
            return message;
        }
        setGradingSubmissionId(submissionId);
        try {
            const feedback = feedbackInputs[submissionId] ?? "";
            const response = await API.patch(`/assignments/submissions/${submissionId}/grade`, { grade, feedback });
            const savedSubmission = response.data.submission;
            setData((current) => current.map((course) => ({
                ...course,
                assignments: course.assignments.map((assignment) => ({
                    ...assignment,
                    submissions: assignment.submissions?.map((submission) =>
                        submission.id === submissionId ? { ...submission, ...savedSubmission } : submission
                    )
                }))
            })));
            setGradeInputs((previous) => ({ ...previous, [submissionId]: savedSubmission.grade }));
            setFeedbackInputs((previous) => ({ ...previous, [submissionId]: savedSubmission.feedback || "" }));
            showMsg("Grade saved!");
            return null;
        } catch (err) {
            const message = err.response?.data?.message || "Grading failed.";
            showMsg(message, "error");
            return message;
        } finally {
            setGradingSubmissionId(null);
        }
    };

    const handleCreateAssignment = async (event) => {
        event.preventDefault();
        if (!assignmentForm.courseId) {
            setCreateAssignmentError("Choose a course for this assignment.");
            return;
        }
        setCreatingAssignment(true);
        setCreateAssignmentError("");
        const payload = new FormData();
        payload.append("courseId", assignmentForm.courseId);
        payload.append("title", assignmentForm.title.trim());
        payload.append("description", assignmentForm.description.trim());
        payload.append("dueDate", assignmentForm.dueDate);
        if (assignmentForm.file) payload.append("file", assignmentForm.file);
        try {
            await API.post("/assignments", payload, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setAssignmentForm({ courseId: "", title: "", description: "", dueDate: "", file: null });
            if (assignmentFileInput.current) assignmentFileInput.current.value = "";
            setCreateAssignmentOpen(false);
            showMsg("Assignment published to the course.");
            setRefreshKey((key) => key + 1);
            window.dispatchEvent(new Event("smartcampus:dashboard-refresh"));
        } catch (requestError) {
            setCreateAssignmentError(requestError.response?.data?.message || "Unable to publish this assignment.");
        } finally {
            setCreatingAssignment(false);
        }
    };

    const viewSubmission = async (submission) => {
        setPreviewSubmission(submission);
        try {
            const response = await API.patch(`/assignments/submissions/${submission.id}/view`);
            setData((current) => current.map((course) => ({
                ...course,
                assignments: course.assignments.map((assignment) => ({
                    ...assignment,
                    submissions: assignment.submissions?.map((item) => item.id === submission.id
                        ? { ...item, lecturerViews: [{ viewedAt: response.data.viewedAt }] }
                        : item)
                }))
            })));
        } catch (requestError) {
            showMsg(requestError.response?.data?.message || "Unable to record that this submission was viewed.", "error");
        }
    };

    const submitAssignment = async (assignment, file, answerText, setFeedback = () => {}) => {
        const reply = answerText.trim();
        if (new Date(assignment.dueDate).getTime() < Date.now()) {
            const message = "You cannot submit after the due date. Contact your lecturer to reschedule or extend the deadline.";
            showMsg(message, "error");
            setFeedback(message);
            return false;
        }
        if (!file && !reply) {
            const message = "Write a reply or attach a file to submit.";
            showMsg(message, "error");
            setFeedback(message);
            return false;
        }
        const payload = new FormData();
        payload.append("assignmentId", assignment.id);
        if (reply) payload.append("answerText", reply);
        if (file) payload.append("file", file);
        setSubmittingIds((current) => [...new Set([...current, assignment.id])]);
        try {
            await API.post("/assignments/submit", payload, { headers: { "Content-Type": "multipart/form-data" } });
            showMsg("Assignment submitted successfully.");
            setSubmissionModalReply("");
            setRefreshKey((key) => key + 1);
            setFeedback("");
            return true;
        } catch (requestError) {
            const message = requestError.response?.data?.message || "Unable to submit assignment.";
            showMsg(message, "error");
            setFeedback(message);
            if (requestError.response?.status === 409) setRefreshKey((key) => key + 1);
            return false;
        } finally {
            setSubmittingIds((current) => current.filter((id) => id !== assignment.id));
        }
    };

    const studentCourses = useMemo(() => [...new Map([
        ...permittedCourses,
        ...data.filter((assignment) => assignment.course).map((assignment) => assignment.course)
    ].map((course) => [course.id, course])).values()], [data, permittedCourses]);
    const modalAssignments = useMemo(() => data.filter((assignment) =>
        String(assignment.courseId) === submissionCourseId &&
        !assignment.submissions?.length &&
        new Date(assignment.dueDate).getTime() >= currentTime
    ).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [currentTime, data, submissionCourseId]);
    const courseAssignments = useMemo(() => data
        .filter((assignment) => selectedCourse === "all" || String(assignment.courseId) === selectedCourse)
        .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()),
    [data, selectedCourse]);
    const assignmentCategories = useMemo(() => {
        return {
            assigned: courseAssignments.filter((assignment) =>
                !assignment.submissions?.length && new Date(assignment.dueDate).getTime() >= currentTime
            ),
            missing: courseAssignments.filter((assignment) =>
                !assignment.submissions?.length && new Date(assignment.dueDate).getTime() < currentTime
            ),
            done: courseAssignments.filter((assignment) => Boolean(assignment.submissions?.length))
        };
    }, [courseAssignments, currentTime]);
    const visibleAssignments = assignmentCategories[activeAssignmentTab];

    const openAssignmentSubmit = (assignment) => {
        setSubmissionCourseId(String(assignment.courseId));
        setSubmissionAssignmentId(String(assignment.id));
        setSubmissionModalFile(null);
        setSubmissionModalReply("");
        setSubmissionModalError("");
        setSubmitModalOpen(true);
    };

    const handleSubmitFromModal = async (event) => {
        event.preventDefault();
        const assignment = modalAssignments.find((item) => String(item.id) === submissionAssignmentId);
        if (!assignment) {
            setSubmissionModalError("Choose an assignment subject.");
            return;
        }
        if (!submissionModalFile && !submissionModalReply.trim()) {
            setSubmissionModalError("Write a reply or choose an assignment file.");
            return;
        }
        const submitted = await submitAssignment(assignment, submissionModalFile, submissionModalReply, setSubmissionModalError);
        if (submitted) {
            setSubmissionModalFile(null);
            setSubmissionModalReply("");
            setSubmissionCourseId("");
            setSubmissionAssignmentId("");
            setSubmitModalOpen(false);
        }
    };

    if (loading) return <div className="page-content"><p>Loading...</p></div>;

    /* ── LECTURER VIEW ── */
    if (isStaff) {
        const totalPending = data.reduce((acc, course) =>
            acc + course.assignments.reduce((a2, asgn) =>
                a2 + (asgn.submissions?.filter(s => s.grade === "Pending").length || 0), 0), 0);
        const assignmentRows = data.flatMap((course) => course.assignments.flatMap((assignment) => {
            const submissions = assignment.submissions || [];
            return submissions.map((submission) => ({
                id: submission.id,
                courseTitle: course.title,
                assignment,
                submission
            })).sort((left, right) => {
                const leftSubmittedAt = left.submission?.createdAt
                    ? new Date(left.submission.createdAt).getTime()
                    : Number.POSITIVE_INFINITY;
                const rightSubmittedAt = right.submission?.createdAt
                    ? new Date(right.submission.createdAt).getTime()
                    : Number.POSITIVE_INFINITY;
                return leftSubmittedAt - rightSubmittedAt;
            });
        }));
        const filteredAssignmentRows = assignmentRows.filter(({ courseTitle, assignment, submission }) => {
            const query = assignmentSearch.trim().toLowerCase();
            const matchesSearch = !query || `${assignment.title} ${assignment.description || ""} ${courseTitle} ${submission?.student?.fullName || ""} ${submission?.student?.matNumber || ""} ${submission?.student?.email || ""}`
                .toLowerCase()
                .includes(query);
            const matchesCourse = selectedCourse === "all" ||
                String(assignment.courseId) === selectedCourse;
            const isPending = submission?.grade === "Pending";
            const matchesStatus = assignmentStatusFilter === "all" ||
                (assignmentStatusFilter === "pending" && (!submission || isPending)) ||
                (assignmentStatusFilter === "graded" && submission && !isPending);
            return matchesSearch && matchesCourse && matchesStatus;
        });
        const allCourseAssignments = data.flatMap((course) => course.assignments.map((assignment) => ({
            ...assignment,
            courseTitle: course.title
        })));
        const filteredCourseAssignments = allCourseAssignments.filter((assignment) => {
            const query = assignmentSearch.trim().toLowerCase();
            const matchesSearch = !query || `${assignment.title} ${assignment.description || ""} ${assignment.courseTitle}`
                .toLowerCase()
                .includes(query);
            const matchesCourse = selectedCourse === "all" || String(assignment.courseId) === selectedCourse;
            const dueTime = new Date(assignment.dueDate).getTime();
            const matchesStatus = assignmentStatusFilter === "all" ||
                (assignmentStatusFilter === "open" && dueTime >= currentTime) ||
                (assignmentStatusFilter === "closed" && dueTime < currentTime);
            return matchesSearch && matchesCourse && matchesStatus;
        });
        const displayedRows = showCourseAssignments ? filteredCourseAssignments : filteredAssignmentRows;
        const reviewPageCount = Math.max(1, Math.ceil(displayedRows.length / reviewPageSize));
        const currentReviewPage = Math.min(reviewPage, reviewPageCount);
        const visibleRows = displayedRows.slice(
            (currentReviewPage - 1) * reviewPageSize,
            currentReviewPage * reviewPageSize
        );

        return (
            <div className="page-content grading-page">
                {selectedCourse !== "all" && data.some((course) => String(course.id) === selectedCourse) && (
                    <RouteBackButton
                        className="course-context-back"
                        label={`Back to ${data.find((course) => String(course.id) === selectedCourse)?.title}`}
                    />
                )}
                <header>
                    <p className="eyebrow">COURSEWORK</p>
                    <div className="assignments-page-header">
                        <h1>Assignments</h1>
                        <button
                            type="button"
                            className="btn btn-inline"
                            disabled={!data.length}
                            onClick={() => {
                                setAssignmentForm((current) => ({ ...current, courseId: current.courseId || String(data[0]?.id || "") }));
                                setCreateAssignmentError("");
                                setCreateAssignmentOpen(true);
                            }}
                        ><FaPlus aria-hidden="true" /> Create assignment</button>
                    </div>
                </header>
                {loadError && <p className="materials-error" role="alert">{loadError}</p>}

                {msg && (
                    <p style={{ color: msg.type === "error" ? "#ff6b6b" : "#00d464", marginBottom: 16 }}>
                        {msg.text}
                    </p>
                )}

                <section className="course-stat-grid" aria-label="Assignment summary">
                    <article><span>Courses</span><strong>{data.length}</strong></article>
                    <article><span>Assignments</span><strong>{new Set(assignmentRows.map((row) => row.assignment.id)).size}</strong></article>
                    <article><span>Needs grading</span><strong>{totalPending}</strong></article>
                    <article><span>Submissions</span><strong>{assignmentRows.filter((row) => row.submission).length}</strong></article>
                </section>

                <nav className="course-workspace-nav assignment-lecturer-nav" aria-label="Assignment workspace">
                    <div className="course-workspace-nav-tabs">
                        <button
                            type="button"
                            className={showCourseAssignments ? "is-active" : ""}
                            aria-current={showCourseAssignments ? "page" : undefined}
                            onClick={() => {
                                setShowCourseAssignments(true);
                                setReviewPage(1);
                                setAssignmentStatusFilter("all");
                            }}
                        >Uploads</button>
                        <button
                            type="button"
                            className={!showCourseAssignments ? "is-active" : ""}
                            aria-current={!showCourseAssignments ? "page" : undefined}
                            onClick={() => {
                                setShowCourseAssignments(false);
                                setReviewPage(1);
                                setAssignmentStatusFilter("all");
                            }}
                        >Reviews</button>
                    </div>
                </nav>

                <section className="grading-course-section">
                    <div className="materials-controls">
                        <label className="catalog-search">
                            <FaSearch aria-hidden="true" />
                            <span className="sr-only">Search assignment reviews</span>
                            <input
                                type="search"
                                placeholder={showCourseAssignments
                                    ? "Search: assignment, description, course"
                                    : "Search: assignment, course, student"}
                                value={assignmentSearch}
                                onChange={(event) => {
                                    setReviewPage(1);
                                    setAssignmentSearch(event.target.value);
                                }}
                            />
                        </label>
                        <label className="materials-course-filter">
                            <span>Course</span>
                            <select value={selectedCourse} onChange={(event) => {
                                setReviewPage(1);
                                setSelectedCourse(event.target.value);
                            }}>
                                <option value="all">All courses</option>
                                {data.map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
                            </select>
                        </label>
                        {!showCourseAssignments && <label className="materials-course-filter">
                            <span>Status</span>
                            <select value={assignmentStatusFilter} onChange={(event) => {
                                setReviewPage(1);
                                setAssignmentStatusFilter(event.target.value);
                            }}>
                                <option value="all">All submissions</option>
                                <option value="pending">Needs grading</option>
                                <option value="graded">Graded</option>
                            </select>
                        </label>}
                        {showCourseAssignments && <label className="materials-course-filter">
                            <span>Status</span>
                            <select value={assignmentStatusFilter} onChange={(event) => {
                                setReviewPage(1);
                                setAssignmentStatusFilter(event.target.value);
                            }}>
                                <option value="all">All assignments</option>
                                <option value="open">Open for submissions</option>
                                <option value="closed">Past due</option>
                            </select>
                        </label>}
                    </div>
                    {displayedRows.length ? (
                        <div className="grading-table-scroll">
                            {showCourseAssignments ? (
                                <table className="grading-table assignment-list-table">
                                    <colgroup>
                                        <col style={{ width: "6%" }} />
                                        <col style={{ width: "20%" }} />
                                        <col style={{ width: "29%" }} />
                                        <col style={{ width: "16%" }} />
                                        <col style={{ width: "14%" }} />
                                        <col style={{ width: "15%" }} />
                                    </colgroup>
                                    <thead><tr>
                                        <th scope="col" className="table-number-column">No.</th>
                                        <th scope="col">Assignment</th>
                                        <th scope="col">Description</th>
                                        <th scope="col">Course</th>
                                        <th scope="col">Due date</th>
                                        <th scope="col">Assignment file</th>
                                    </tr></thead>
                                    <tbody>
                                        {visibleRows.map((assignment, index) => (
                                            <tr key={assignment.id}>
                                                <td className="table-number-column">{(currentReviewPage - 1) * reviewPageSize + index + 1}</td>
                                                <td><strong>{assignment.title}</strong></td>
                                                <td>{assignment.description || "—"}</td>
                                                <td>{assignment.courseTitle}</td>
                                                <td>{assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "—"}</td>
                                                <td>{assignment.fileUrl
                                                    ? <button type="button" className="assignment-review-view-button file-view-button" onClick={() => setPreviewAssignment(assignment)}><FaEye aria-hidden="true" /> View file</button>
                                                    : "No file"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="grading-table assignment-review-table">
                                    <colgroup>
                                        <col className="assignment-review-number-column" />
                                        <col className="assignment-review-assignment-column" />
                                        <col className="assignment-review-course-column" />
                                        <col className="assignment-review-student-column" />
                                        <col className="assignment-review-submission-column" />
                                        <col className="assignment-review-grade-column" />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th scope="col" className="table-number-column">No.</th>
                                            <th scope="col">Assignment</th>
                                            <th scope="col">Course</th>
                                            <th scope="col">Student</th>
                                            <th scope="col">View</th>
                                            <th scope="col">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    {visibleRows.map(({ id, courseTitle, assignment, submission }, index) => (
                                        <tr key={id}>
                                            <td className="table-number-column">{(currentReviewPage - 1) * reviewPageSize + index + 1}</td>
                                            <td>
                                                <strong>{assignment.title}</strong>
                                            </td>
                                            <td>{courseTitle}</td>
                                            {submission ? (
                                                <>
                                                    <td>
                                                        <strong>{submission.student?.fullName || "Unknown student"}</strong>
                                                        <span className="records-table-secondary">Mat. no. {submission.student?.matNumber || "Not provided"}</span>
                                                    </td>
                                                    <td>
                                                        {submission.fileUrl || submission.answerText
                                                            ? <button type="button" className="assignment-review-view-button file-view-button" onClick={() => viewSubmission(submission)}><FaEye aria-hidden="true" /> View</button>
                                                            : "No file or reply"}
                                                    </td>
                                                    <td><span className={submission.grade === "Pending" ? "grading-status pending" : "grading-status graded"}>{submission.grade || "Pending"}</span></td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>—</td>
                                                    <td>No</td>
                                                    <td>—</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ) : (
                        <p className="empty-state">{showCourseAssignments
                            ? (allCourseAssignments.length ? "No assignments match these filters." : "No assignments uploaded yet.")
                            : (assignmentRows.length ? "No assignments match these filters." : "No submissions to review.")}</p>
                    )}
                    <footer className="assignment-review-pagination">
                        <span>
                            {displayedRows.length
                                ? `Showing ${(currentReviewPage - 1) * reviewPageSize + 1}–${Math.min(currentReviewPage * reviewPageSize, displayedRows.length)} of ${displayedRows.length}`
                                : "Showing 0 of 0"}
                        </span>
                        <label>
                            Show
                            <select
                                value={reviewPageSize}
                                onChange={(event) => {
                                    setReviewPage(1);
                                    setReviewPageSize(Number(event.target.value));
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            per page
                        </label>
                        <nav aria-label="Review submissions pages">
                            <button type="button" disabled={currentReviewPage <= 1} onClick={() => setReviewPage((page) => Math.max(1, page - 1))}>Previous</button>
                            <span>Page {currentReviewPage} of {reviewPageCount}</span>
                            <button type="button" disabled={currentReviewPage >= reviewPageCount} onClick={() => setReviewPage((page) => Math.min(reviewPageCount, page + 1))}>Next</button>
                        </nav>
                    </footer>
                </section>
                {previewSubmission && <MaterialPreviewDialog
                    key={`submission-${previewSubmission.id}`}
                    resourcePath={previewSubmission.fileUrl ? `/downloads/submission/${previewSubmission.id}` : null}
                    fileName={previewSubmission.fileName || `Submission ${previewSubmission.id}`}
                    textContent={previewSubmission.answerText}
                    gradeValue={gradeInputs[previewSubmission.id] ?? (previewSubmission.grade === "Pending" ? "" : previewSubmission.grade)}
                    feedbackValue={feedbackInputs[previewSubmission.id] ?? previewSubmission.feedback ?? ""}
                    grading={gradingSubmissionId === previewSubmission.id}
                    onGradeChange={(value) => setGradeInputs((previous) => ({ ...previous, [previewSubmission.id]: value }))}
                    onFeedbackChange={(value) => setFeedbackInputs((previous) => ({ ...previous, [previewSubmission.id]: value }))}
                    onSaveGrade={() => handleGrade(previewSubmission.id)}
                    onClose={() => setPreviewSubmission(null)}
                />}
                {createAssignmentOpen && (
                    <div className="course-modal-backdrop" onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !creatingAssignment) setCreateAssignmentOpen(false);
                    }}>
                        <section className="course-modal" role="dialog" aria-modal="true" aria-labelledby="create-assignment-heading">
                            <button type="button" className="course-modal-close" aria-label="Close assignment form" disabled={creatingAssignment} onClick={() => setCreateAssignmentOpen(false)}>×</button>
                            <h2 id="create-assignment-heading">Upload assignment</h2>
                            {createAssignmentError && <p className="course-modal-feedback" role="alert">{createAssignmentError}</p>}
                            <form className="course-create-form" onSubmit={handleCreateAssignment}>
                                <label>
                                    Course
                                    <select required value={assignmentForm.courseId} onChange={(event) => setAssignmentForm((current) => ({ ...current, courseId: event.target.value }))} disabled={creatingAssignment}>
                                        <option value="" disabled>Select a course</option>
                                        {data.map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
                                    </select>
                                </label>
                                <label>Assignment title<input required maxLength={255} value={assignmentForm.title} onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))} disabled={creatingAssignment} /></label>
                                <div className="assignment-upload-file-field">
                                    <span>Assignment file</span>
                                    <input
                                        ref={assignmentFileInput}
                                        className="course-file-input-hidden"
                                        type="file"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip"
                                        onChange={(event) => setAssignmentForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                                        disabled={creatingAssignment}
                                    />
                                    <div className="course-file-picker">
                                        <button
                                            type="button"
                                            className="assignment-file-plus"
                                            aria-label="Choose assignment file"
                                            title="Choose assignment file"
                                            disabled={creatingAssignment}
                                            onClick={() => assignmentFileInput.current?.click()}
                                        >
                                            <FaPlus aria-hidden="true" />
                                        </button>
                                        <input
                                            className="assignment-file-name"
                                            type="text"
                                            aria-label="Selected assignment file name"
                                            placeholder="No file chosen"
                                            value={assignmentForm.file?.name || "No file chosen"}
                                            readOnly
                                        />
                                    </div>
                                </div>
                                <label>Description<textarea required rows={4} maxLength={10000} value={assignmentForm.description} onChange={(event) => setAssignmentForm((current) => ({ ...current, description: event.target.value }))} disabled={creatingAssignment} /></label>
                                <label>Due date<input type="date" required value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, dueDate: event.target.value }))} disabled={creatingAssignment} /></label>
                                <div className="course-modal-actions">
                                    <button type="button" className="course-cancel-button" onClick={() => setCreateAssignmentOpen(false)} disabled={creatingAssignment}>Cancel</button>
                                    <button type="submit" className="upload-icon-button" aria-label={creatingAssignment ? "Publishing assignment" : "Publish assignment"} title={creatingAssignment ? "Publishing assignment" : "Publish assignment"} disabled={creatingAssignment}>
                                        <FaPlus aria-hidden="true" />
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </div>
        );
    }

    /* ── STUDENT VIEW ── */
    return (
        <div className="page-content assignments-page">
            {selectedCourse !== "all" && studentCourses.some((course) => String(course.id) === selectedCourse) && (
                <RouteBackButton
                    className="course-context-back"
                    label={`Back to ${studentCourses.find((course) => String(course.id) === selectedCourse)?.title}`}
                />
            )}
            <header className="assignments-page-header">
                <div>
                    <p className="eyebrow">YOUR COURSEWORK</p>
                    <h1>Assignments</h1>
                    <p className="assignments-page-description">Track due dates, review feedback, and submit your course work.</p>
                </div>
                <button type="button" className="btn btn-inline assignments-submit-top-button" aria-label="Submit assignment" onClick={() => {
                    setSubmissionModalError("");
                    const nextCourseId = selectedCourse !== "all"
                        ? selectedCourse
                        : initialCourseId || "";
                    const firstAssignment = data.find((assignment) =>
                        (!nextCourseId || String(assignment.courseId) === nextCourseId) &&
                        !assignment.submissions?.length &&
                        new Date(assignment.dueDate).getTime() >= currentTime
                    );
                    setSubmissionCourseId(nextCourseId || String(firstAssignment?.courseId || ""));
                    setSubmissionAssignmentId(String(firstAssignment?.id || ""));
                    setSubmitModalOpen(true);
                }}>
                    <FaPlus aria-hidden="true" /> Submit assignment
                </button>
            </header>
            {!isStaff && permittedCourses.some((course) =>
                course.permissions.includes("createAssignments") || course.permissions.includes("gradeAssignments")
            ) && (
                <section className="course-feature-section" aria-label="Course staff permissions">
                    <h2>Course permissions</h2>
                    <div className="course-workspace-links">
                        {permittedCourses.filter((course) => course.permissions.includes("createAssignments")).map((course) => (
                            <Link key={`create-${course.id}`} className="upload-icon-button" to={`/courses/${course.id}?section=assignments`} aria-label={`Create assignment for ${course.title}`} title={`Create assignment · ${course.title}`}>
                                <FaPlus aria-hidden="true" />
                            </Link>
                        ))}
                        {permittedCourses.filter((course) => course.permissions.includes("gradeAssignments")).map((course) => (
                            <Link key={`grade-${course.id}`} to={`/courses/${course.id}?section=grading`}>
                                Grade assignments · {course.title}
                            </Link>
                        ))}
                    </div>
                </section>
            )}
            {loadError && <p className="materials-error" role="alert">{loadError}</p>}
            {msg && <p className={msg.type === "error" ? "materials-error" : "feature-status"} role={msg.type === "error" ? "alert" : "status"}>{msg.text}</p>}

            {data.length === 0 ? (
                <p style={{ color: "var(--theme-muted)" }}>
                    No assignments yet. <Link to="/courses">Enroll in a course</Link> first.
                </p>
            ) : (
                <>
                    <label className="materials-course-filter assignments-course-picker">
                        <span>Filter by course</span>
                        <select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}>
                            <option value="all">All courses</option>
                            {studentCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                        </select>
                    </label>
                    <nav className="assignment-status-tabs" role="tablist" aria-label="Assignment status">
                        {[
                            ["assigned", "Assigned"],
                            ["missing", "Missing"],
                            ["done", "Done"]
                        ].map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                id={`assignments-tab-${id}`}
                                aria-controls={`assignments-panel-${id}`}
                                aria-selected={activeAssignmentTab === id}
                                tabIndex={activeAssignmentTab === id ? 0 : -1}
                                onClick={() => setActiveAssignmentTab(id)}
                                onKeyDown={(event) => {
                                    const tabIds = ["assigned", "missing", "done"];
                                    const currentIndex = tabIds.indexOf(activeAssignmentTab);
                                    const nextIndex = event.key === "ArrowRight"
                                        ? (currentIndex + 1) % tabIds.length
                                        : event.key === "ArrowLeft"
                                            ? (currentIndex - 1 + tabIds.length) % tabIds.length
                                            : -1;
                                    if (nextIndex < 0) return;
                                    event.preventDefault();
                                    setActiveAssignmentTab(tabIds[nextIndex]);
                                    event.currentTarget.parentElement
                                        ?.querySelectorAll('[role="tab"]')[nextIndex]
                                        ?.focus();
                                }}
                            >
                                {label}<span>{assignmentCategories[id].length}</span>
                            </button>
                        ))}
                    </nav>
                    {visibleAssignments.length ? (
                        <div role="tabpanel" id={`assignments-panel-${activeAssignmentTab}`} aria-labelledby={`assignments-tab-${activeAssignmentTab}`}>
                            <div className="student-assignment-cards">
                                {visibleAssignments.map((assignment) => {
                                    const submission = assignment.submissions?.[0];
                                    const overdue = currentTime > new Date(assignment.dueDate).getTime();
                                    const lecturerViewed = Boolean(submission?.lecturerViews?.length);
                                    return (
                                        <article className="student-assignment-module-card" key={`card-${assignment.id}`}>
                                            <header>
                                                <div>
                                                    <h2>{assignment.title}</h2>
                                                    <span>{assignment.course?.title || "Course"}</span>
                                                </div>
                                                <span className={`assignment-status-badge${submission ? " is-done" : overdue ? " is-missing" : ""}`}>
                                                    {submission ? "Submitted" : overdue ? "Missing" : "Assigned"}
                                                </span>
                                            </header>
                                            {assignment.description && <p>{assignment.description}</p>}
                                            <dl>
                                                <div><dt>Due date</dt><dd>{new Date(assignment.dueDate).toLocaleString()}</dd></div>
                                                <div>
                                                    <dt>Lecturer viewed</dt>
                                                    <dd>{submission ? lecturerViewed ? "Yes" : "Not yet" : "—"}</dd>
                                                </div>
                                                <div>
                                                    <dt>Submission</dt>
                                                    <dd>{submission
                                                        ? `Submitted ${new Date(submission.createdAt).toLocaleString()}`
                                                        : overdue ? "Deadline passed" : "Not submitted"}</dd>
                                                </div>
                                            </dl>
                                            <div className="student-assignment-module-actions">
                                                {assignment.fileUrl && (
                                                    <button type="button" className="file-view-button" onClick={() => setPreviewAssignment(assignment)}>
                                                        <FaEye aria-hidden="true" /> View assignment
                                                    </button>
                                                )}
                                                {submission?.fileUrl && (
                                                    <button type="button" className="file-view-button" onClick={() => viewSubmission(submission)}>
                                                        <FaEye aria-hidden="true" /> View submission
                                                    </button>
                                                )}
                                                {!submission && !overdue && (
                                                    <button type="button" className="btn btn-inline" onClick={() => openAssignmentSubmit(assignment)}>
                                                        Submit assignment
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                            <div className="grading-table-scroll student-assignment-desktop-table">
                            <table className="grading-table student-assignment-table">
                                <colgroup>
                                    <col className="table-number-column" />
                                    <col className="student-assignment-title-column" />
                                    <col className="student-assignment-course-column" />
                                    <col className="student-assignment-due-column" />
                                    <col className="student-assignment-file-column" />
                                    <col className="student-assignment-view-column" />
                                    <col className="student-assignment-submission-column" />
                                    <col className="student-assignment-submit-column" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th scope="col" className="table-number-column">No.</th>
                                        <th scope="col">Assignment</th>
                                        <th scope="col">Course</th>
                                        <th scope="col">Due date</th>
                                        <th scope="col">Assignment file</th>
                                        <th scope="col">Lecturer viewed</th>
                                        <th scope="col">Submission</th>
                                        <th scope="col">Submit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleAssignments.map((assignment, index) => {
                                        const submission = assignment.submissions?.[0];
                                        const overdue = currentTime > new Date(assignment.dueDate).getTime();
                                        const lecturerViewed = Boolean(submission?.lecturerViews?.length);
                                        return (
                                            <tr key={assignment.id}>
                                                <td className="table-number-column">{index + 1}</td>
                                                <td>
                                                    <strong>{assignment.title}</strong>
                                                    {assignment.description && <span className="records-table-secondary">{assignment.description}</span>}
                                                </td>
                                                <td>{assignment.course?.title || "Course"}</td>
                                                <td>{new Date(assignment.dueDate).toLocaleString()}</td>
                                                <td>
                                                    {assignment.fileUrl ? <div className="student-assignment-table-actions">
                                                        <button type="button" className="file-view-button" onClick={() => setPreviewAssignment(assignment)}><FaEye aria-hidden="true" /> View</button>
                                                    </div> : "—"}
                                                </td>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        aria-label={lecturerViewed ? "Lecturer viewed your submission" : "Lecturer has not viewed your submission"}
                                                        checked={lecturerViewed}
                                                        readOnly
                                                        disabled
                                                    />
                                                </td>
                                                <td>
                                                    {submission ? <div className="student-assignment-table-actions">
                                                        <span>{new Date(submission.createdAt).toLocaleString()}</span>
                                                        {submission.answerText && <span className="records-table-secondary">Reply submitted</span>}
                                                        {submission.fileUrl && <>
                                                            <button type="button" className="file-view-button" onClick={() => viewSubmission(submission)}><FaEye aria-hidden="true" /> View</button>
                                                        </>}
                                                    </div> : overdue ? "Deadline passed" : "Not submitted"}
                                                </td>
                                                <td>{!submission && !overdue
                                                    ? <button type="button" className="upload-icon-button" aria-label={`Submit ${assignment.title}`} title={`Submit ${assignment.title}`} onClick={() => openAssignmentSubmit(assignment)}>
                                                        <FaPlus aria-hidden="true" />
                                                    </button>
                                                    : "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    ) : <div className="materials-empty">
                        <h2>{activeAssignmentTab === "done"
                            ? "No completed assignments"
                            : activeAssignmentTab === "missing"
                                ? "No missing assignments"
                                : "No assigned work"}</h2>
                    </div>}
                </>
            )}
            {submitModalOpen && (
                <div className="course-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setSubmitModalOpen(false);
                }}>
                    <section className="course-modal" role="dialog" aria-modal="true" aria-labelledby="student-submit-assignment-heading">
                        <button type="button" className="course-modal-close" aria-label="Close submission form" onClick={() => setSubmitModalOpen(false)}>×</button>
                        <h2 id="student-submit-assignment-heading">Submit assignment</h2>
                        <form className="course-create-form" onSubmit={handleSubmitFromModal}>
                            <label>Course
                                <select
                                    required
                                    value={submissionCourseId}
                                    onChange={(event) => {
                                        const nextCourseId = event.target.value;
                                        setSubmissionCourseId(nextCourseId);
                                        const firstAssignment = data.find((assignment) =>
                                            String(assignment.courseId) === nextCourseId && !assignment.submissions?.length
                                        );
                                        setSubmissionAssignmentId(firstAssignment ? String(firstAssignment.id) : "");
                                        setSubmissionModalFile(null);
                                        setSubmissionModalError("");
                                    }}
                                >
                                    <option value="">Choose a course</option>
                                    {studentCourses.map((course) => (
                                        <option key={course.id} value={course.id}>{course.title}</option>
                                    ))}
                                </select>
                            </label>
                            <label>Assignment subject
                                <select
                                    required
                                    value={submissionAssignmentId}
                                    disabled={!submissionCourseId || modalAssignments.length === 0}
                                    onChange={(event) => {
                                        setSubmissionAssignmentId(event.target.value);
                                        setSubmissionModalFile(null);
                                        setSubmissionModalError("");
                                    }}
                                >
                                    <option value="">Choose an assignment</option>
                                    {modalAssignments.map((assignment) => (
                                        <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
                                    ))}
                                </select>
                                {submissionCourseId && modalAssignments.length === 0 && (
                                    <small className="settings-field-hint">There are no unsubmitted assignments for this course.</small>
                                )}
                            </label>
                            <label>Assignment file
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] || null;
                                        const extension = file?.name.split(".").pop()?.toLowerCase();
                                        if (file && !["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv", "png", "jpg", "jpeg", "gif", "webp", "zip"].includes(extension)) {
                                            setSubmissionModalFile(null);
                                            setSubmissionModalError("Choose a supported document, image, or ZIP archive.");
                                            return;
                                        }
                                        if (file && file.size > 10 * 1024 * 1024) {
                                            setSubmissionModalFile(null);
                                            setSubmissionModalError("The submission file must be 10 MB or smaller.");
                                            return;
                                        }
                                        setSubmissionModalFile(file);
                                        setSubmissionModalError("");
                                    }}
                                />
                                <small className="settings-field-hint">
                                    {submissionModalFile?.name || "PDF, Office document, text, CSV, or image · up to 10 MB"}
                                </small>
                            </label>
                            <label>Reply
                                <textarea
                                    value={submissionModalReply}
                                    onChange={(event) => {
                                        setSubmissionModalReply(event.target.value);
                                        setSubmissionModalError("");
                                    }}
                                    rows={3}
                                    placeholder="Add a reply (optional when submitting a file)"
                                />
                            </label>
                            {submissionModalError && <p className="course-modal-feedback" role="alert">{submissionModalError}</p>}
                            <button
                                type="submit"
                                className="upload-icon-button"
                                aria-label={submittingIds.includes(Number(submissionAssignmentId)) ? "Submitting assignment" : "Submit assignment"}
                                title={submittingIds.includes(Number(submissionAssignmentId)) ? "Submitting assignment" : "Submit assignment"}
                                disabled={!submissionAssignmentId || (!submissionModalFile && !submissionModalReply.trim()) || submittingIds.includes(Number(submissionAssignmentId))}
                            >
                                <FaPlus aria-hidden="true" />
                            </button>
                        </form>
                    </section>
                </div>
            )}
            {previewAssignment && <MaterialPreviewDialog
                key={`assignment-${previewAssignment.id}`}
                resourcePath={`/downloads/assignment/${previewAssignment.id}`}
                fileName={previewAssignment.fileName}
                onClose={() => setPreviewAssignment(null)}
            />}
            {previewSubmission && <MaterialPreviewDialog
                key={`submission-${previewSubmission.id}`}
                resourcePath={previewSubmission.fileUrl ? `/downloads/submission/${previewSubmission.id}` : null}
                fileName={previewSubmission.fileName || `Submission ${previewSubmission.id}`}
                textContent={previewSubmission.answerText}
                onClose={() => setPreviewSubmission(null)}
            />}
        </div>
    );
};

export default Assignments;