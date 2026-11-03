import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowRight, FaBookOpen, FaPlus, FaSearch, FaTimes } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import useOfflineRefresh from "../hooks/useOfflineRefresh";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Courses = ({ catalog = false }) => {
    const offlineRefresh = useOfflineRefresh();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isStaff } = useAuth();
    const requestedCourseSection = ["materials", "students", "assignments", "quizzes", "grading", "calendar", "announcements"].includes(searchParams.get("section"))
        ? searchParams.get("section")
        : null;
    const courseSection = requestedCourseSection;
    const sectionDetails = {
        materials: { title: "Materials", action: "Open materials" },
        students: { title: "Students", action: "View students" },
        quizzes: { title: "Quizzes", action: "Open quizzes" },
        assignments: { title: "Assignments", action: "Open assignments" },
        grading: { title: "Grading", action: "Open grading" },
        calendar: { title: "Calendar", action: "Open calendar" },
        announcements: { title: "Announcements", action: "Open announcements" }
    }[courseSection];
    const [myCourses, setMyCourses] = useState([]);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState([]);
    const [form, setForm] = useState({
        title: "", description: "", classDays: [], classStartTime: "", classEndTime: ""
    });
    const [search, setSearch] = useState("");
    const [courseStatusFilter, setCourseStatusFilter] = useState("all");
    const [courseStats, setCourseStats] = useState(null);
    const [studentStats, setStudentStats] = useState({
        enrolledCourses: 0, pendingAssignments: 0, upcomingDeadlines: 0, completedActivities: 0
    });
    const [catalogFilter, setCatalogFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [msg, setMsg] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(() => isStaff && searchParams.get("create") === "1");
    const [creating, setCreating] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const createAbortController = useRef(null);
    const creatingRef = useRef(false);

    useEffect(() => {
        let active = true;

        const loadData = async () => {
            try {
                if (isStaff) {
                    const [res, statsRes] = await Promise.all([
                        API.get("/courses/my"),
                        API.get("/courses/my/stats")
                    ]);
                    if (active) {
                        setMyCourses(res.data);
                        setCourseStats(statsRes.data);
                    }
                } else if (catalog) {
                    const [catalogRes, enrolledRes] = await Promise.all([
                        API.get("/courses"),
                        API.get("/enrollments/my-courses")
                    ]);
                    const enrolledCourses = enrolledRes.data.map((enrollment) => enrollment.course).filter(Boolean);
                    if (active) {
                        setMyCourses(catalogRes.data);
                        setEnrolledCourseIds(enrolledCourses.map((course) => course.id));
                    }
                } else {
                    const res = await API.get("/enrollments/my-courses");
                    if (active) {
                        const studentCourses = res.data.map((enrollment) => enrollment.course).filter(Boolean);
                        setMyCourses(studentCourses);
                        setStudentStats({
                            enrolledCourses: studentCourses.length,
                            pendingAssignments: studentCourses.reduce((total, course) => total + (course.pendingAssignments || 0), 0),
                            upcomingDeadlines: studentCourses.reduce((total, course) => total + (course.upcomingDeadlines || 0), 0),
                            completedActivities: studentCourses.reduce((total, course) => total + (course.completedActivities || 0), 0)
                        });
                    }
                }
            } catch (err) {
                if (active) setLoadError(err.response?.data?.message || "Unable to load courses.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadData();
        return () => { active = false; };
    }, [catalog, isStaff, offlineRefresh, refreshKey]);

    useEffect(() => {
        const refreshCourses = () => setRefreshKey((key) => key + 1);
        window.addEventListener("focus", refreshCourses);
        window.addEventListener("smartcampus:courses-refresh", refreshCourses);
        return () => {
            window.removeEventListener("focus", refreshCourses);
            window.removeEventListener("smartcampus:courses-refresh", refreshCourses);
        };
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.classDays.length) {
            setMsg("Choose at least one class day.");
            return;
        }
        if (!navigator.onLine) {
            setMsg("No internet connection. Connect to the internet and try again.");
            return;
        }
        if (creatingRef.current) return;

        const payload = new FormData();
        payload.append("title", form.title);
        payload.append("description", form.description);
        payload.append("classDays", JSON.stringify(form.classDays));
        payload.append("classStartTime", form.classStartTime);
        payload.append("classEndTime", form.classEndTime);
        payload.append("classTimeZone", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

        const controller = new AbortController();
        createAbortController.current = controller;
        creatingRef.current = true;
        setCreating(true);
        setMsg("");
        try {
            const response = await API.post("/courses", payload, {
                signal: controller.signal,
                headers: { "Content-Type": "multipart/form-data" }
            });
            setForm({ title: "", description: "", classDays: [], classStartTime: "", classEndTime: "" });
            setIsCreateOpen(false);
            setMsg("Course created successfully!");
            window.dispatchEvent(new Event("smartcampus:dashboard-refresh"));
            window.dispatchEvent(new Event("smartcampus:courses-refresh"));
            navigate(`/courses/${response.data.id}?section=manage`, {
                state: { successMessage: "Course created successfully." }
            });
        } catch (err) {
            if (controller.signal.aborted) {
                setMsg("Course creation cancelled.");
            } else if (!err.response) {
                setMsg("No internet connection. Check your connection and try again.");
            } else {
                setMsg(err.response.data?.message || "Failed to create course.");
            }
        } finally {
            if (createAbortController.current === controller) createAbortController.current = null;
            creatingRef.current = false;
            setCreating(false);
        }
    };

    const closeCreateDialog = () => {
        if (creating) {
            createAbortController.current?.abort();
            setIsCreateOpen(false);
            setForm({ title: "", description: "", classDays: [], classStartTime: "", classEndTime: "" });
            return;
        }
        setIsCreateOpen(false);
        setForm({ title: "", description: "", classDays: [], classStartTime: "", classEndTime: "" });
    };

    const filteredLecturerCourses = myCourses.filter((course) =>
        (courseStatusFilter === "all" || (course.status || "active") === courseStatusFilter) &&
        `${course.title} ${course.academicCode || ""} ${course.description || ""}`.toLowerCase().includes(search.trim().toLowerCase())
    );
    const filteredStudentCourses = myCourses.filter((course) =>
        (catalogFilter === "all" || (catalogFilter === "active" ? course.status !== "archived" : course.status === "archived")) &&
        `${course.title} ${course.academicCode || ""} ${course.description || ""} ${course.lecturerName || ""}`
            .toLowerCase().includes(search.trim().toLowerCase())
    );

    if (!catalog && courseSection === "materials") return <Navigate to="/materials" replace />;
    if (!catalog && courseSection === "quizzes") return <Navigate to="/quizzes" replace />;
    if (!catalog && courseSection === "grading" && isStaff) return <Navigate to="/assignments" replace />;
    if (loading) return <div className="page-content dashboard-loading" role="status">Loading courses...</div>;
    if (loadError) return <div className="page-content"><p className="dashboard-alert" role="alert">{loadError}</p></div>;

    if (catalog && !isStaff) {
        const normalizedSearch = search.trim().toLowerCase();
        const visibleCourses = myCourses.filter((course) => {
            const matchesSearch = `${course.title} ${course.description} ${course.lecturer?.fullName || ""}`
                .toLowerCase()
                .includes(normalizedSearch);
            const matchesFilter = catalogFilter === "all" || enrolledCourseIds.includes(course.id);
            return matchesSearch && matchesFilter;
        });

        return (
            <div className="page-content catalog-page">
                <header className="catalog-header">
                    <div>
                        <p className="eyebrow">LEARN SOMETHING NEW</p>
                        <h1>Course catalog</h1>
                    </div>
                    <span className="catalog-count">{myCourses.length} {myCourses.length === 1 ? "course" : "courses"}</span>
                </header>

                <div className="catalog-controls">
                    <label className="catalog-search">
                        <FaSearch aria-hidden="true" />
                        <span className="sr-only">Search courses</span>
                        <input
                            type="search"
                            placeholder="Search: course, topic, lecturer"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </label>
                    <div className="catalog-filters" role="group" aria-label="Filter courses">
                        <button
                            type="button"
                            className={catalogFilter === "all" ? "catalog-filter active" : "catalog-filter"}
                            aria-pressed={catalogFilter === "all"}
                            onClick={() => setCatalogFilter("all")}
                        >
                            All courses
                        </button>
                        <button
                            type="button"
                            className={catalogFilter === "enrolled" ? "catalog-filter active" : "catalog-filter"}
                            aria-pressed={catalogFilter === "enrolled"}
                            onClick={() => setCatalogFilter("enrolled")}
                        >
                            My courses
                        </button>
                    </div>
                </div>
                {msg && <p className="dashboard-alert" role="alert">{msg}</p>}

                {visibleCourses.length ? (
                    <div className="catalog-grid">
                        {visibleCourses.map((course, index) => {
                            const isEnrolled = enrolledCourseIds.includes(course.id);
                            return (
                                <article className={`catalog-card student-course-simple course-accent-${index % 3}`} key={course.id}>
                                    <div className="catalog-card-content">
                                        <h2>{course.title}</h2>
                                        <p className="catalog-lecturer">
                                            Lecturer: <strong>{course.lecturer?.fullName || "SmartCampus faculty"}</strong>
                                        </p>
                                        <Link
                                            to={isEnrolled
                                                ? `/courses/${course.id}?section=${courseSection || (isStaff ? "manage" : "materials")}`
                                                : "/join"}
                                            className="catalog-link"
                                        >
                                            {isEnrolled ? "Open course" : "Join a class"}
                                            <FaArrowRight aria-hidden="true" />
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="catalog-empty">
                        <FaSearch aria-hidden="true" />
                        <h2>{myCourses.length ? "No courses match your search" : "No courses are available yet"}</h2>
                        <p>{myCourses.length ? "No matching courses." : "No courses available."}</p>
                    </div>
                )}
            </div>
        );
    }

    /* ── LECTURER VIEW ── */
    if (isStaff) {
        return (
            <div className="page-content">
                <header className="lecturer-courses-header">
                    <div>
                        <h1>{sectionDetails?.title || "My Courses"}</h1>
                    </div>
                    {!sectionDetails && <button
                        type="button"
                        className="create-course-button"
                        aria-label="Create course"
                        title="Create course"
                        onClick={() => { setMsg(""); setIsCreateOpen(true); }}
                    >
                        <FaPlus aria-hidden="true" />
                    </button>}
                </header>

                {msg && <p className={`course-feedback${msg.includes("successfully") ? " success" : ""}`} role="status">{msg}</p>}

                {isCreateOpen && (
                    <div className="course-modal-backdrop" onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeCreateDialog();
                    }}>
                        <section className="course-modal" role="dialog" aria-modal="true" aria-labelledby="create-course-heading">
                            <button type="button" className="course-modal-close" aria-label="Close create course dialog" onClick={closeCreateDialog}>
                                <FaTimes aria-hidden="true" />
                            </button>
                            <h2 id="create-course-heading">Create a course</h2>
                            {msg && !msg.includes("cancelled") && (
                                <p className="course-modal-feedback" role="alert">{msg}</p>
                            )}
                            {creating && <p className="course-pending-message" role="status">Course creation pending...</p>}
                            <form className="course-create-form" onSubmit={handleCreate}>
                                <label>
                                    Course name
                                    <input
                                        autoFocus
                                        value={form.title}
                                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                                        required
                                        maxLength={255}
                                        disabled={creating}
                                    />
                                </label>
                                <label>
                                    Course description <span className="course-field-optional">(optional)</span>
                                    <textarea
                                        value={form.description}
                                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                                        disabled={creating}
                                        rows={3}
                                        maxLength={10000}
                                        placeholder="Describe what students will learn in this course"
                                    />
                                </label>
                                <fieldset className="course-schedule-days">
                                    <legend>Class days</legend>
                                    {weekdays.map((day, index) => (
                                        <label key={day}>
                                            <input
                                                type="checkbox"
                                                checked={form.classDays.includes(index)}
                                                onChange={(event) => setForm((current) => ({
                                                    ...current,
                                                    classDays: event.target.checked
                                                        ? [...current.classDays, index]
                                                        : current.classDays.filter((selectedDay) => selectedDay !== index)
                                                }))}
                                                disabled={creating}
                                            />
                                            {day}
                                        </label>
                                    ))}
                                </fieldset>
                                <div className="course-schedule-time">
                                    <label>
                                        Class starts
                                        <input
                                            type="time"
                                            required
                                            value={form.classStartTime}
                                            onChange={(event) => setForm({ ...form, classStartTime: event.target.value })}
                                            disabled={creating}
                                        />
                                    </label>
                                    <label>
                                        Class ends
                                        <input
                                            type="time"
                                            required
                                            value={form.classEndTime}
                                            onChange={(event) => setForm({ ...form, classEndTime: event.target.value })}
                                            disabled={creating}
                                        />
                                    </label>
                                </div>
                                <div className="course-modal-actions">
                                    <button type="button" className="course-cancel-button" onClick={closeCreateDialog}>
                                        {creating ? "Cancel creation" : "Cancel"}
                                    </button>
                                    {!creating && <button type="submit" className="btn">Create course</button>}
                                    {creating && <button type="button" className="btn" disabled>Creating course...</button>}
                                </div>
                            </form>
                        </section>
                    </div>
                )}

                <section className="course-stat-grid" aria-label="Course statistics">
                    <article><span>Total courses</span><strong>{courseStats?.totalCourses ?? "—"}</strong></article>
                    <article><span>Unique students</span><strong>{courseStats?.uniqueStudents ?? "—"}</strong></article>
                    <article><span>Active courses</span><strong>{courseStats?.activeCourses ?? "—"}</strong></article>
                    <article><span>Pending submissions</span><strong>{courseStats?.pendingSubmissions ?? "—"}</strong></article>
                </section>
                <div className="course-list-controls">
                    <label className="catalog-search">
                        <FaSearch aria-hidden="true" />
                        <span className="sr-only">Search your courses</span>
                        <input type="search" placeholder="Search: your courses" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </label>
                    <label className="course-status-filter">
                        <span>Status</span>
                        <select value={courseStatusFilter} onChange={(event) => setCourseStatusFilter(event.target.value)}>
                            <option value="all">All courses</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </select>
                    </label>
                </div>
                <section className="dashboard-course-grid" aria-label="Your courses">
                    {myCourses.length === 0 && <p style={{ color: "var(--theme-muted)" }}>No courses yet.</p>}
                    {filteredLecturerCourses.map((course, index) => (
                        <article className={`course-card student-course-simple course-accent-${index % 3}`} key={course.id}>
                            <h3>{course.title}</h3>
                            {course.description && <p className="course-summary">{course.description}</p>}
                            <p className="course-summary">
                                {course.enrollmentCount ?? 0} {(course.enrollmentCount ?? 0) === 1 ? "student" : "students"} enrolled
                            </p>
                            {course.createdAt && (
                                <p className="course-created-date">
                                    Created {new Date(course.createdAt).toLocaleDateString(undefined, {
                                        year: "numeric", month: "short", day: "numeric"
                                    })}
                                </p>
                            )}
                            <Link className="course-card-link" to={`/courses/${course.id}?section=materials`}>
                                Open course <FaArrowRight aria-hidden="true" />
                            </Link>
                        </article>
                    ))}
                    {myCourses.length > 0 && filteredLecturerCourses.length === 0 && (
                        <p className="course-empty-filter">No courses match those filters.</p>
                    )}
                </section>
            </div>
        );
    }

    /* ── STUDENT VIEW ── */
    return (
        <div className="page-content student-courses-page">
            <header className="lecturer-courses-header">
                <div>
                    <p className="eyebrow">YOUR LEARNING SPACE</p>
                    <h1>{sectionDetails?.title || "My Courses"}</h1>
                </div>
                <Link to="/join" className="btn btn-inline"><FaPlus /> Join course</Link>
            </header>

            <section className="course-stat-grid" aria-label="Your learning statistics">
                <article><span>Enrolled courses</span><strong>{studentStats.enrolledCourses}</strong></article>
                <article><span>Pending assignments</span><strong>{studentStats.pendingAssignments}</strong></article>
                <article><span>Deadlines in 7 days</span><strong>{studentStats.upcomingDeadlines}</strong></article>
                <article><span>Completed lessons</span><strong>{studentStats.completedActivities}</strong></article>
            </section>
            <div className="course-list-controls">
                <label className="catalog-search">
                    <FaSearch aria-hidden="true" />
                    <span className="sr-only">Search my courses</span>
                    <input type="search" placeholder="Search: course, lecturer" value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <label className="course-status-filter">
                    <span>Status</span>
                    <select value={catalogFilter} onChange={(event) => setCatalogFilter(event.target.value)}>
                        <option value="all">All courses</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                    </select>
                </label>
            </div>
            {!myCourses.length ? (
                <div className="catalog-empty">
                    <FaBookOpen aria-hidden="true" />
                    <h2>You haven't joined any courses yet.</h2>
                    <p>Enter your lecturer's class code.</p>
                    <Link to="/join" className="btn btn-inline"><FaPlus /> Join course</Link>
                </div>
            ) : filteredStudentCourses.length ? (
                <div className="dashboard-course-grid">
                    {filteredStudentCourses.map((course, index) => (
                        <article className={`course-card student-course-simple course-accent-${index % 3}`} key={course.id}>
                            <h3>{course.title}</h3>
                            <p className="course-summary">Lecturer: {course.lecturerName || "Lecturer"}</p>
                            <Link className="course-card-link" to={`/courses/${course.id}?section=materials`}>Open course <FaArrowRight /></Link>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="catalog-empty"><FaSearch /><h2>No courses match those filters</h2><p>Try a different search or course status.</p></div>
            )}
        </div>
    );
};

export default Courses;