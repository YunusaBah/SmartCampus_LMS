import { useEffect, useMemo, useState } from "react";
import { FaClipboardCheck, FaArrowLeft, FaArrowRight, FaFileExcel, FaSearch } from "react-icons/fa";
import API from "../services/api";
import useOfflineRefresh from "../hooks/useOfflineRefresh";
import { useAuth } from "../hooks/useAuth";
import ReportExportDialog from "../components/ReportExportDialog";

const Grades = () => {
    const offlineRefresh = useOfflineRefresh();
    const { isStaff } = useAuth();
    const [data, setData] = useState({
        quizResults: [],
        assessmentResults: [],
        submissions: [],
        summary: { quizAverage: null, quizCount: 0, assessmentCount: 0, gradedSubmissions: 0, pendingSubmissions: 0, submissionCount: 0 },
        pagination: { pageSize: 20, quizPage: 1, quizPages: 0, assessmentPage: 1, assessmentPages: 0, submissionPage: 1, submissionPages: 0 }
    });
    const [pages, setPages] = useState({ quizPage: 1, assessmentPage: 1, submissionPage: 1 });
    const [activeTab, setActiveTab] = useState("quizzes");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lecturerRows, setLecturerRows] = useState([]);
    const [lecturerCourses, setLecturerCourses] = useState([]);
    const [search, setSearch] = useState("");
    const [courseFilter, setCourseFilter] = useState("all");
    const [sortBy, setSortBy] = useState("name");
    const [reportOpen, setReportOpen] = useState(false);

    useEffect(() => {
        if (!isStaff) return undefined;
        let active = true;
        const loadLecturerGrades = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await API.get("/courses/my");
                const courses = response.data;
                const gradebooks = await Promise.all(courses.map((course) =>
                    API.get(`/courses/${course.id}/gradebook`)
                ));
                if (!active) return;
                setLecturerCourses(courses);
                setLecturerRows(gradebooks.flatMap((gradebookResponse) => {
                    const gradebook = gradebookResponse.data;
                    return gradebook.students.map((student) => ({
                        id: `${gradebook.course.id}:${student.id}`,
                        studentId: student.id,
                        fullName: student.fullName,
                        matNumber: student.matNumber || "",
                        courseId: String(gradebook.course.id),
                        courseTitle: gradebook.course.title,
                        timed: student.assessmentAttempts.map((attempt) =>
                            `${attempt.assessment?.title || "Timed assignment"}: ${attempt.score ?? "Pending"}${attempt.totalMarks != null ? `/${attempt.totalMarks}` : ""}${attempt.theoryPending ? " (awaiting review)" : ""}`
                        ).join("; ") || "—",
                        classwork: student.assignments.filter((item) => item.workType === "classwork").map(({ title, submission }) =>
                            `${title}: ${submission && submission.grade !== "Pending" ? submission.grade : submission ? "Awaiting grade" : "Not submitted"}`
                        ).join("; ") || "—",
                        assignment: student.assignments.filter((item) => item.workType !== "classwork").map(({ title, submission }) =>
                            `${title}: ${submission && submission.grade !== "Pending" ? submission.grade : submission ? "Awaiting grade" : "Not submitted"}`
                        ).join("; ") || "—"
                    }));
                }));
            } catch (requestError) {
                if (active) setError(requestError.response?.data?.message || "Unable to load course grades.");
            } finally {
                if (active) setLoading(false);
            }
        };
        loadLecturerGrades();
        return () => { active = false; };
    }, [isStaff, offlineRefresh]);

    useEffect(() => {
        if (isStaff) return undefined;
        let active = true;

        API.get("/dashboard/grades", { params: pages })
            .then((response) => {
                if (!active) return;
                const result = response.data;
                const quizResults = result.quizResults || [];
                const assessmentResults = result.assessmentResults || [];
                const submissions = result.submissions || [];
                const gradedCount = submissions.filter((submission) => submission.grade !== "Pending").length;
                setData({
                    quizResults,
                    assessmentResults,
                    submissions,
                    summary: result.summary || {
                        quizAverage: quizResults.length
                            ? Math.round(quizResults.reduce((total, item) => total + item.score * 100, 0) / quizResults.length)
                            : null,
                        quizCount: quizResults.length,
                        assessmentCount: assessmentResults.length,
                        gradedSubmissions: gradedCount,
                        pendingSubmissions: submissions.length - gradedCount,
                        submissionCount: submissions.length
                    },
                    pagination: result.pagination || {
                        pageSize: 20,
                        quizPage: 1,
                        quizPages: 1,
                        assessmentPage: 1,
                        assessmentPages: 1,
                        submissionPage: 1,
                        submissionPages: 1
                    }
                });
            })
            .catch((requestError) => {
                if (active) {
                    setError(requestError.response?.data?.message || "Unable to load your grades.");
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [isStaff, offlineRefresh, pages]);

    const filteredLecturerRows = useMemo(() => lecturerRows
        .filter((row) =>
            (courseFilter === "all" || row.courseId === courseFilter) &&
            `${row.fullName} ${row.matNumber} ${row.courseTitle} ${row.timed} ${row.classwork} ${row.assignment}`
                .toLowerCase().includes(search.trim().toLowerCase())
        )
        .sort((left, right) => {
            const leftValue = sortBy === "matNumber" ? left.matNumber : left.fullName;
            const rightValue = sortBy === "matNumber" ? right.matNumber : right.fullName;
            return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
        }), [courseFilter, lecturerRows, search, sortBy]);

    if (isStaff) {
        if (loading) return <div className="page-content dashboard-loading" role="status">Loading course grades...</div>;
        if (error) return <div className="page-content"><div className="dashboard-alert" role="alert"><strong>Grades couldn't be loaded.</strong><span>{error}</span></div></div>;
        const reportColumns = [
            { key: "no", label: "No.", value: (_row, index) => index + 1 },
            { key: "fullName", label: "Full name" },
            { key: "matNumber", label: "Mat. number" },
            { key: "courseTitle", label: "Course" },
            { key: "timed", label: "Timed assignment" },
            { key: "classwork", label: "Classwork" },
            { key: "assignment", label: "Assignment" }
        ];
        return (
            <div className="page-content grades-page lecturer-grades-page">
                <header className="grades-header">
                    <div><p className="eyebrow">TEACHING</p><h1>Grades</h1></div>
                    <button type="button" className="btn btn-inline" onClick={() => setReportOpen(true)} disabled={!filteredLecturerRows.length}>
                        <FaFileExcel aria-hidden="true" /> Report
                    </button>
                </header>
                <div className="student-list-controls gradebook-controls">
                    <label className="catalog-search">
                        <FaSearch aria-hidden="true" />
                        <span className="sr-only">Search grades by student, course, or work</span>
                        <input type="search" placeholder="Search: name, mat. number, course, grades" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </label>
                    <label className="materials-course-filter"><span>Course</span>
                        <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                            <option value="all">All courses</option>
                            {lecturerCourses.map((course) => <option key={course.id} value={String(course.id)}>{course.title}</option>)}
                        </select>
                    </label>
                    <label className="materials-course-filter"><span>Sort by</span>
                        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                            <option value="name">Name (A-Z)</option>
                            <option value="matNumber">Matric number</option>
                        </select>
                    </label>
                </div>
                {filteredLecturerRows.length ? (
                    <div className="records-table-scroll gradebook-table-scroll">
                        <table className="records-table gradebook-table">
                            <thead><tr>{reportColumns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
                            <tbody>{filteredLecturerRows.map((row, index) => (
                                <tr key={row.id}>
                                    <td>{index + 1}</td><td>{row.fullName}</td><td>{row.matNumber || "—"}</td><td>{row.courseTitle}</td>
                                    <td>{row.timed}</td><td>{row.classwork}</td><td>{row.assignment}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                ) : <div className="grade-empty"><FaClipboardCheck aria-hidden="true" /><strong>{lecturerRows.length ? "No grades match your filters" : "No student grades available yet"}</strong></div>}
                {reportOpen && <ReportExportDialog title="Export grade report" reportType="grades" columns={reportColumns} rows={filteredLecturerRows} onClose={() => setReportOpen(false)} />}
            </div>
        );
    }

    if (loading) {
        return <div className="page-content dashboard-loading" role="status">Loading your grades...</div>;
    }

    if (error) {
        return (
            <div className="page-content">
                <div className="dashboard-alert" role="alert">
                    <strong>Your grades couldn't be loaded.</strong>
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    const showPagination = (key, currentPage, pageCount) => pageCount > 1 && (
        <nav className="grades-pagination" aria-label={`${key === "quizPage" ? "Quick quiz results" : key === "assessmentPage" ? "Timed assessment results" : "Assignment submissions"} pages`}>
            <button
                type="button"
                className="btn btn-inline btn-secondary"
                disabled={currentPage <= 1}
                onClick={() => setPages((current) => ({ ...current, [key]: current[key] - 1 }))}
            >
                <FaArrowLeft aria-hidden="true" /> Previous
            </button>
            <span>Page {currentPage} of {pageCount}</span>
            <button
                type="button"
                className="btn btn-inline btn-secondary"
                disabled={currentPage >= pageCount}
                onClick={() => setPages((current) => ({ ...current, [key]: current[key] + 1 }))}
            >
                Next <FaArrowRight aria-hidden="true" />
            </button>
        </nav>
    );

    return (
        <div className="page-content grades-page">
            <header className="grades-header">
                <div>
                    <p className="eyebrow">YOUR PERFORMANCE</p>
                    <h1>Grades</h1>
                </div>
            </header>

            <section className="grade-summary" aria-label="Grade summary">
                <div className="grade-summary-item">
                    <span>Quiz average</span>
                    <strong>{data.summary.quizAverage === null ? "—" : `${data.summary.quizAverage}%`}</strong>
                </div>
                <div className="grade-summary-item">
                    <span>Graded assignments</span>
                    <strong>{data.summary.gradedSubmissions}</strong>
                </div>
                <div className="grade-summary-item">
                    <span>Awaiting review</span>
                    <strong>{data.summary.pendingSubmissions}</strong>
                </div>
            </section>

            <nav className="grades-tabs" aria-label="Grade categories" role="tablist">
                {[
                    ["quizzes", "Assessments"],
                    ["timed", "Timed assessments"],
                    ["coursework", "Coursework"]
                ].map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        id={`grades-tab-${id}`}
                        aria-controls={`grades-panel-${id}`}
                        aria-selected={activeTab === id}
                        tabIndex={activeTab === id ? 0 : -1}
                        onClick={() => setActiveTab(id)}
                        onKeyDown={(event) => {
                            const tabIds = ["quizzes", "timed", "coursework"];
                            const currentIndex = tabIds.indexOf(activeTab);
                            const nextIndex = event.key === "ArrowRight"
                                ? (currentIndex + 1) % tabIds.length
                                : event.key === "ArrowLeft"
                                    ? (currentIndex - 1 + tabIds.length) % tabIds.length
                                    : event.key === "Home"
                                        ? 0
                                        : event.key === "End"
                                            ? tabIds.length - 1
                                            : -1;
                            if (nextIndex < 0) return;
                            event.preventDefault();
                            setActiveTab(tabIds[nextIndex]);
                            event.currentTarget.parentElement
                                ?.querySelectorAll('[role="tab"]')[nextIndex]
                                ?.focus();
                        }}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            {activeTab === "quizzes" && <section className="grades-section" role="tabpanel" id="grades-panel-quizzes" aria-labelledby="grades-tab-quizzes">
                <div className="section-heading">
                    <div><p className="eyebrow">ASSESSMENTS</p><h2>Quiz results</h2></div>
                    <span className="grades-section-count">{data.summary.quizCount}</span>
                </div>
                {data.quizResults.length ? (
                    <div className="records-table-scroll">
                        <table className="records-table">
                            <thead>
                                <tr>
                                    <th scope="col" className="table-number-column">No.</th>
                                    <th scope="col">Quiz question</th>
                                                    <th scope="col">Course</th>
                                                    <th scope="col">Your answer</th>
                                                    <th scope="col">Auto grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.quizResults.map((result, index) => (
                                    <tr key={result.id}>
                                        <td className="table-number-column">{(data.pagination.quizPage - 1) * data.pagination.pageSize + index + 1}</td>
                                        <td>{result.quiz?.question || "Quiz question"}</td>
                                        <td>{result.quiz?.course?.title || "Course"}</td>
                                        <td>{result.selectedAnswer}</td>
                                        <td>{result.score === 1 ? "Correct (100%)" : "Incorrect (0%)"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grade-empty">
                        <FaClipboardCheck aria-hidden="true" />
                        <strong>No quiz attempts yet</strong>
                    </div>
                )}
                {showPagination("quizPage", data.pagination.quizPage, data.pagination.quizPages)}
            </section>}

            {activeTab === "timed" && <section className="grades-section" role="tabpanel" id="grades-panel-timed" aria-labelledby="grades-tab-timed">
                <div className="section-heading">
                    <div><p className="eyebrow">TIMED ASSESSMENTS</p><h2>Assessment results</h2></div>
                    <span className="grades-section-count">{data.summary.assessmentCount}</span>
                </div>
                {data.assessmentResults.length ? (
                    <div className="records-table-scroll">
                        <table className="records-table">
                            <thead>
                                <tr>
                                    <th scope="col" className="table-number-column">No.</th>
                                    <th scope="col">Assessment</th>
                                    <th scope="col">Course</th>
                                    <th scope="col">Submitted</th>
                                    <th scope="col">Auto score</th>
                                    <th scope="col">Result</th>
                                    <th scope="col">Marking status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.assessmentResults.map((attempt, index) => (
                                    <tr key={attempt.id}>
                                        <td className="table-number-column">{(data.pagination.assessmentPage - 1) * data.pagination.pageSize + index + 1}</td>
                                        <td>{attempt.assessment?.title || "Timed assessment"}</td>
                                        <td>{attempt.assessment?.course?.title || "Course"}</td>
                                        <td>{new Date(attempt.submittedAt).toLocaleDateString()}</td>
                                        <td>{attempt.score ?? "Pending"}/{attempt.totalMarks ?? "—"} marks</td>
                                        <td>{attempt.totalMarks
                                            ? `${Math.round(attempt.score * 100 / attempt.totalMarks)}%`
                                            : "—"}</td>
                                        <td>{attempt.theoryPending ? "Theory awaiting review" : "Auto-marked"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grade-empty">
                        <FaClipboardCheck aria-hidden="true" />
                        <strong>No timed assessments submitted</strong>
                    </div>
                )}
                {showPagination("assessmentPage", data.pagination.assessmentPage, data.pagination.assessmentPages)}
            </section>}

            {activeTab === "coursework" && <section className="grades-section" role="tabpanel" id="grades-panel-coursework" aria-labelledby="grades-tab-coursework">
                <div className="section-heading">
                    <div><p className="eyebrow">COURSE WORK</p><h2>Assignments and classwork</h2></div>
                    <span className="grades-section-count">{data.summary.submissionCount}</span>
                </div>
                {data.submissions.length ? (
                    <div className="records-table-scroll">
                        <table className="records-table">
                            <thead>
                                <tr>
                                    <th scope="col" className="table-number-column">No.</th>
                                    <th scope="col">Assignment</th>
                                    <th scope="col">Course</th>
                                    <th scope="col">Submitted</th>
                                    <th scope="col">Grade</th>
                                    <th scope="col">Feedback</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.submissions.map((submission, index) => (
                                    <tr key={submission.id}>
                                        <td className="table-number-column">{(data.pagination.submissionPage - 1) * data.pagination.pageSize + index + 1}</td>
                                        <td>{submission.assignment?.title || "Assignment"}</td>
                                        <td>{submission.assignment?.course?.title || "Course"}</td>
                                        <td>{new Date(submission.createdAt).toLocaleDateString()}</td>
                                        <td>{submission.grade && submission.grade !== "Pending" ? submission.grade : "Not graded"}</td>
                                        <td>{submission.feedback || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grade-empty">
                        <FaClipboardCheck aria-hidden="true" />
                        <strong>No assignments submitted</strong>
                    </div>
                )}
                {showPagination("submissionPage", data.pagination.submissionPage, data.pagination.submissionPages)}
            </section>}
        </div>
    );
};

export default Grades;
