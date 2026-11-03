import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useOfflineRefresh from "../hooks/useOfflineRefresh";
import {
    FaArrowRight,
    FaBookOpen,
    FaBullhorn,
    FaClipboardList,
    FaClock,
    FaGraduationCap,
    FaPlus,
    FaUsers
} from "react-icons/fa";
import API from "../services/api";

const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date to be confirmed";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
};

const delegatedPermissionLabels = {
    uploadMaterials: "Upload course materials",
    createAssignments: "Create assignments",
    gradeAssignments: "Grade assignments",
    postAnnouncements: "Post announcements"
};

const delegatedPermissionLinks = {
    uploadMaterials: "/materials",
    createAssignments: "/assignments",
    gradeAssignments: "/assignments",
    postAnnouncements: "/announcements"
};

const Dashboard = () => {
    const offlineRefresh = useOfflineRefresh();
    const [dashboard, setDashboard] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [reload, setReload] = useState(0);
    const hasDashboardRef = useRef(false);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        const refreshDashboard = () => setReload((value) => value + 1);
        window.addEventListener("smartcampus:dashboard-refresh", refreshDashboard);
        window.addEventListener("focus", refreshDashboard);
        const loadDashboard = async () => {
            try {
                const response = await API.get("/dashboard", {
                    signal: controller.signal,
                });
                if (active) {
                    setDashboard(response.data);
                    hasDashboardRef.current = true;
                    setError("");
                }
            } catch (err) {
                if (active && err.code !== "ERR_CANCELED") {
                    const message = err.response?.data?.message || "Unable to load your dashboard.";
                    if (!hasDashboardRef.current) setError(message);
                    else console.warn("Dashboard refresh failed; keeping the last loaded dashboard:", message);
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        loadDashboard();
        return () => {
            active = false;
            controller.abort();
            window.removeEventListener("smartcampus:dashboard-refresh", refreshDashboard);
            window.removeEventListener("focus", refreshDashboard);
        };
    }, [offlineRefresh, reload]);

    if (loading) {
        return <div className="page-content dashboard-loading" role="status">Loading your learning space...</div>;
    }

    if (error || !dashboard) {
        return (
            <div className="page-content">
                <div className="dashboard-alert" role="alert">
                    <strong>We couldn't load your dashboard.</strong>
                    <span>{error || "Dashboard data is unavailable."}</span>
                    <button className="btn btn-inline" type="button" onClick={() => {
                        setError("");
                        setLoading(true);
                        setReload((value) => value + 1);
                    }}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const isLecturer = dashboard.role === "lecturer";
    const { summary, courses } = dashboard;
    const delegatedPermissions = dashboard.delegatedPermissions || [];
    const firstName = dashboard.profile?.displayName?.trim().split(/\s+/)[0];

    return (
        <div className="page-content dashboard-page">
            <header className="dashboard-welcome">
                <div>
                    <p className="eyebrow">{isLecturer ? "TEACHING OVERVIEW" : "YOUR LEARNING SPACE"}</p>
                    <h1>{firstName ? `Welcome back, ${firstName}` : "Welcome back!"}</h1>
                </div>
                <div className="welcome-mark" aria-hidden="true"><FaGraduationCap /></div>
            </header>

            {isLecturer ? (
                <>
                    <section className="dashboard-stats" aria-label="Teaching overview">
                        <Link to="/courses" className="dashboard-stat">
                            <span className="stat-icon"><FaBookOpen /></span>
                            <div><span>My courses</span><strong>{summary.myCourses}</strong></div>
                        </Link>
                        <Link to="/students" className="dashboard-stat">
                            <span className="stat-icon"><FaUsers /></span>
                            <div><span>Students enrolled</span><strong>{summary.studentsEnrolled}</strong></div>
                        </Link>
                        <Link to="/assignments" className="dashboard-stat">
                            <span className="stat-icon"><FaClipboardList /></span>
                            <div><span>Active assignments</span><strong>{summary.activeAssignments}</strong></div>
                        </Link>
                        <Link to="/assignments" className="dashboard-stat">
                            <span className="stat-icon stat-icon-warm"><FaClock /></span>
                            <div><span>Submissions to grade</span><strong>{summary.submissionsToGrade}</strong></div>
                        </Link>
                    </section>

                    <section className="dashboard-section">
                        <div className="section-heading">
                            <div><p className="eyebrow">YOUR TEACHING</p><h2>My courses</h2></div>
                            <Link to="/courses" className="text-link">View all courses <FaArrowRight /></Link>
                        </div>
                        {courses.length ? (
                            <div className="course-list">
                                {courses.map((course) => (
                                    <Link to={`/courses/${course.id}?section=materials`} className="course-list-item" key={course.id}>
                                        <span className="course-list-icon"><FaBookOpen /></span>
                                        <span className="course-list-copy">
                                            <strong>{course.title}</strong>
                                            <span>
                                                {course.studentCount} students · {course.materialCount} materials · {course.assignmentCount} assignments
                                            </span>
                                        </span>
                                        <FaArrowRight className="course-list-arrow" />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="dashboard-empty">
                                <FaBookOpen />
                                <div><strong>You haven't created any courses yet.</strong></div>
                                <Link to="/courses" className="btn btn-inline"><FaPlus /> Create course</Link>
                            </div>
                        )}
                    </section>

                    <section className="dashboard-section">
                        <div className="section-heading">
                            <div><p className="eyebrow">QUICK ACTIONS</p><h2>Get things done</h2></div>
                        </div>
                        <div className="dashboard-quick-actions">
                            <Link to="/courses?create=1"><span className="dashboard-quick-action-icons"><FaPlus /><FaBookOpen /></span><span>Create course</span></Link>
                            <Link to="/materials?create=1"><span className="dashboard-quick-action-icons"><FaPlus /><FaBookOpen /></span><span>Upload materials</span></Link>
                            <Link to="/assignments?create=1"><span className="dashboard-quick-action-icons"><FaPlus /><FaClipboardList /></span><span>Create assignment</span></Link>
                            <Link to="/quizzes?create=1"><span className="dashboard-quick-action-icons"><FaPlus /><FaGraduationCap /></span><span>Create quiz</span></Link>
                            <Link to="/assignments?view=submissions"><span className="dashboard-quick-action-icons"><FaPlus /><FaClock /></span><span>Review submissions</span></Link>
                        </div>
                    </section>

                    <ActivitySection
                        items={dashboard.upcomingActivities}
                        lecturer
                    />

                    {dashboard.recentActivity?.length > 0 && (
                        <section className="dashboard-section">
                            <div className="section-heading">
                                <div><p className="eyebrow">LATEST CHANGES</p><h2>Recent course activity</h2></div>
                            </div>
                            <div className="upcoming-list">
                                {dashboard.recentActivity.map((activity) => (
                                    <Link className="upcoming-item" to="/materials" key={activity.id}>
                                        <span className="upcoming-date">{formatDate(activity.startsAt)}</span>
                                        <span className="upcoming-copy"><strong>{activity.title}</strong><span>{activity.courseTitle}</span></span>
                                        <FaArrowRight className="course-list-arrow" />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            ) : (
                <>
                    <section className="dashboard-stats" aria-label="Learning overview">
                        <Link to="/courses" className="dashboard-stat">
                            <span className="stat-icon"><FaBookOpen /></span>
                            <div><span>My courses</span><strong>{summary.myCourses}</strong></div>
                        </Link>
                        <Link to="/assignments" className="dashboard-stat">
                            <span className="stat-icon"><FaClipboardList /></span>
                            <div><span>Pending assignments</span><strong>{summary.pendingAssignments}</strong></div>
                        </Link>
                        <Link to="/quizzes" className="dashboard-stat">
                            <span className="stat-icon"><FaClock /></span>
                            <div><span>Available quizzes</span><strong>{summary.upcomingQuizzes}</strong></div>
                        </Link>
                        <Link to="/grades" className="dashboard-stat">
                            <span className="stat-icon stat-icon-warm"><FaGraduationCap /></span>
                            <div><span>Graded assessments</span><strong>{summary.gradedAssessments}</strong></div>
                        </Link>
                    </section>

                    {delegatedPermissions.length > 0 && (
                        <section className="dashboard-section delegated-permissions-section">
                            <div className="section-heading">
                                <div><p className="eyebrow">YOUR COURSE ROLES</p><h2>Permissions granted to you</h2></div>
                            </div>
                            <div className="delegated-permissions-list">
                                {delegatedPermissions.map((grant) => (
                                    <article className="delegated-permission-card" key={grant.courseId}>
                                        <div>
                                            <strong>{grant.courseTitle}</strong>
                                            <span>{grant.role === "student_assistant"
                                                ? "Student Assistant"
                                                : grant.role === "class_representative"
                                                    ? "Class Representative"
                                                    : "Course access"}</span>
                                        </div>
                                        <div className="delegated-permission-links">
                                            {grant.permissions.map((permission) => (
                                                <Link
                                                    to={delegatedPermissionLinks[permission]}
                                                    key={permission}
                                                >
                                                    {delegatedPermissionLabels[permission] || permission}
                                                </Link>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    <div className="dashboard-columns">
                        <section className="dashboard-section">
                            <div className="section-heading">
                                <div><p className="eyebrow">PICK UP A CLASS</p><h2>My courses</h2></div>
                                <Link to="/courses" className="text-link">View all <FaArrowRight /></Link>
                            </div>
                            {courses.length ? (
                                <div className="course-list">
                                    {courses.map((course, index) => (
                                        <div className="course-list-item student-course-list-item" key={course.id}>
                                            <span className={`course-list-icon course-accent-${index % 3}`}><FaBookOpen /></span>
                                            <Link to={`/courses/${course.id}?section=materials`} className="student-course-main-link">
                                                <span className="course-list-copy">
                                                    <strong>{course.title}</strong>
                                                    <span>Code: {course.courseCode || "Not set"} · {course.lecturerName} · {course.pendingAssignments} pending assignment{course.pendingAssignments === 1 ? "" : "s"}</span>
                                                </span>
                                                <FaArrowRight className="course-list-arrow" />
                                            </Link>
                                            {course.lecturerEmail && (
                                                <a className="student-lecturer-email" href={`mailto:${course.lecturerEmail}`}>
                                                    Contact lecturer · {course.lecturerEmail}
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="dashboard-empty">
                                    <FaBookOpen />
                                    <div><strong>You haven't joined any courses yet.</strong></div>
                                    <Link to="/join" className="btn btn-inline">Join a course <FaArrowRight /></Link>
                                </div>
                            )}
                        </section>

                        <ActivitySection items={dashboard.upcomingActivities} />
                    </div>

                    {dashboard.recentActivity?.some((activity) => activity.type === "material") && (
                        <section className="dashboard-section">
                            <div className="section-heading">
                                <div><p className="eyebrow">NEW LEARNING RESOURCES</p><h2>Recently added materials</h2></div>
                            </div>
                            <div className="upcoming-list">
                                {dashboard.recentActivity.filter((activity) => activity.type === "material").map((activity) => (
                                    <Link className="upcoming-item" to={activity.href} key={activity.id}>
                                        <span className="upcoming-date">{formatDate(activity.createdAt)}</span>
                                        <span className="upcoming-copy"><strong>{activity.title}</strong><span>{activity.courseTitle}</span></span>
                                        <FaArrowRight className="course-list-arrow" />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="dashboard-section">
                        <div className="section-heading">
                            <div><p className="eyebrow">FROM YOUR COURSES</p><h2>Recent announcements</h2></div>
                            <Link to="/announcements" className="text-link">View all announcements <FaArrowRight /></Link>
                        </div>
                        {dashboard.recentAnnouncements.length ? (
                            <div className="upcoming-list">
                                {dashboard.recentAnnouncements.map((announcement) => (
                                    <Link to="/announcements" className="upcoming-item" key={announcement.id}>
                                        <span className="upcoming-date">{formatDate(announcement.createdAt)}</span>
                                        <span className="upcoming-copy">
                                            <strong>{announcement.title}</strong>
                                            <span>{announcement.courseTitle} · {announcement.preview}</span>
                                        </span>
                                        <FaArrowRight className="course-list-arrow" />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="upcoming-empty">
                                <FaBullhorn />
                                <strong>No recent announcements</strong>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

const ActivitySection = ({ items = [], lecturer = false }) => (
    <section className="dashboard-section upcoming-section">
        <div className="section-heading">
            <div>
                <p className="eyebrow">{lecturer ? "STAY ON TOP OF TEACHING" : "STAY ON TRACK"}</p>
                <h2>{lecturer ? "Next up" : "Upcoming activities"}</h2>
            </div>
            <Link to="/assignments" className="text-link">
                {lecturer ? "Manage work" : "All work"} <FaArrowRight />
            </Link>
        </div>
        {items.length ? (
            <div className="upcoming-list">
                {items.map((activity) => (
                    <Link
                        to={activity.type === "quiz" ? "/quizzes" : "/assignments"}
                        className="upcoming-item"
                        key={activity.id}
                    >
                        <span className="upcoming-date">{formatDate(activity.startsAt)}</span>
                        <span className="upcoming-copy">
                            <strong>{activity.title}</strong>
                            <span>{activity.courseTitle}{activity.type === "grading"
                                ? ` · ${activity.submissionCount} submission${activity.submissionCount === 1 ? "" : "s"} to grade`
                                : lecturer ? " · Assignment deadline" : ` · ${activity.status}`}</span>
                        </span>
                        <FaArrowRight className="course-list-arrow" />
                    </Link>
                ))}
            </div>
        ) : (
            <div className="upcoming-empty">
                <FaClock />
                <strong>{lecturer ? "You're all caught up!" : "You're up to date!"}</strong>
            </div>
        )}
    </section>
);

export default Dashboard;
