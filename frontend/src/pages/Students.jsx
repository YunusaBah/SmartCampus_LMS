import { useEffect, useMemo, useState } from "react";
import { FaFileExcel, FaSearch } from "react-icons/fa";
import API from "../services/api";
import useOfflineRefresh from "../hooks/useOfflineRefresh";
import ReportExportDialog from "../components/ReportExportDialog";

const Students = () => {
    const offlineRefresh = useOfflineRefresh();
    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [courseFilter, setCourseFilter] = useState("all");
    const [sortBy, setSortBy] = useState("name");
    const [reportOpen, setReportOpen] = useState(false);

    useEffect(() => {
        let active = true;

        Promise.all([API.get("/courses/students"), API.get("/courses/my")])
            .then(([studentsResponse, coursesResponse]) => {
                if (!active) return;
                setStudents(studentsResponse.data);
                setCourses(coursesResponse.data);
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Failed to load your courses and students.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [offlineRefresh]);

    const courseCounts = useMemo(() => {
        const counts = new Map();
        students.forEach((student) => {
            const id = String(student.courseId);
            counts.set(id, (counts.get(id) || 0) + 1);
        });
        return counts;
    }, [students]);

    const filteredStudents = students
        .filter((student) =>
            (courseFilter === "all" || String(student.courseId) === courseFilter) &&
            `${student.fullName} ${student.matNumber || ""} ${student.phone || ""} ${student.email || ""} ${student.courseTitle}`
                .toLowerCase()
                .includes(search.trim().toLowerCase())
        )
        .sort((left, right) => {
            const leftValue = sortBy === "matNumber" ? left.matNumber || "" : left.fullName || "";
            const rightValue = sortBy === "matNumber" ? right.matNumber || "" : right.fullName || "";
            return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
        });

    return (
        <div className="page-content students-page">
            <header className="students-header">
                <div>
                    <p className="eyebrow">TEACHING</p>
                    <h1>My students</h1>
                </div>
                <div className="students-header-actions">
                    {!loading && !error && <span className="catalog-count">{students.length} enrollments</span>}
                    {!loading && !error && <button type="button" className="btn btn-inline" disabled={!filteredStudents.length} onClick={() => setReportOpen(true)}>
                        <FaFileExcel aria-hidden="true" /> Report
                    </button>}
                </div>
            </header>

            {loading && <p role="status">Loading students...</p>}
            {error && <p className="error-text" role="alert">{error}</p>}
            {!loading && !error && courses.length === 0 && (
                <p className="empty-state">You do not have any courses yet.</p>
            )}

            {!loading && !error && courses.length > 0 && (
                <>
                    <div className="student-list-controls">
                        <label className="catalog-search">
                            <FaSearch aria-hidden="true" />
                            <span className="sr-only">Search your students</span>
                            <input
                                type="search"
                                placeholder="Search: name, ID, phone, email"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </label>
                        <label className="materials-course-filter">
                            <span>Course</span>
                            <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                                <option value="all">All courses</option>
                                {courses.map((course) => (
                                    <option key={course.id} value={String(course.id)}>
                                        {course.title} ({course.enrollmentCount ?? courseCounts.get(String(course.id)) ?? 0})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="materials-course-filter">
                            <span>Sort by</span>
                            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                                <option value="name">Name (A-Z)</option>
                                <option value="matNumber">Matric number</option>
                            </select>
                        </label>
                    </div>

                    {filteredStudents.length ? (
                        <div className="student-table-scroll">
                            <table className="student-table">
                                <thead>
                                    <tr>
                                        <th scope="col" className="table-number-column">No.</th>
                                        <th scope="col">Full name</th>
                                        <th scope="col">Mat. number</th>
                                        <th scope="col">Course</th>
                                        <th scope="col">Phone number</th>
                                        <th scope="col">Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((student, index) => (
                                        <tr key={`${student.courseId}:${student.id}`}>
                                            <td className="table-number-column">{index + 1}</td>
                                            <td>{student.fullName}</td>
                                            <td>{student.matNumber || "Not provided"}</td>
                                            <td>{student.courseTitle}</td>
                                            <td>{student.phone || "Not provided"}</td>
                                            <td><a href={`mailto:${student.email}`}>{student.email}</a></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="catalog-empty">
                            <FaSearch aria-hidden="true" />
                            <h2>{students.length ? "No students match your search" : "No students enrolled yet"}</h2>
                            <p>{students.length ? "Try another name, phone number, email, or course." : "Enrolled students will appear here."}</p>
                        </div>
                    )}
                    {reportOpen && <ReportExportDialog
                        title="Export student report"
                        reportType="students"
                        columns={[
                            { key: "no", label: "No.", value: (_student, index) => index + 1 },
                            { key: "fullName", label: "Full name" },
                            { key: "matNumber", label: "Mat. number" },
                            { key: "courseTitle", label: "Course" },
                            { key: "phone", label: "Phone number" },
                            { key: "email", label: "Email" }
                        ]}
                        rows={filteredStudents.map((student) => ({
                            ...student,
                            matNumber: student.matNumber || "Not provided",
                            phone: student.phone || "Not provided"
                        }))}
                        onClose={() => setReportOpen(false)}
                    />}
                </>
            )}
        </div>
    );
};

export default Students;
