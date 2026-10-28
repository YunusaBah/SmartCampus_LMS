import { Link, NavLink, useLocation } from "react-router-dom";
import {
    FaBookOpen,
    FaChartBar,
    FaClipboardList,
    FaCog,
    FaHome,
    FaCalendarAlt,
    FaBell,
    FaUsers,
    FaQuestionCircle,
    FaLifeRing
} from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";

const Sidebar = ({ open, onClose }) => {
    const location = useLocation();
    const { isStaff } = useAuth();
    const courseId = location.pathname.match(/^\/courses\/([^/]+)$/)?.[1];
    const activeCourseSection = new URLSearchParams(location.search).get("section") || "materials";
    const courseSections = [
        ["overview", "Overview", <FaChartBar />],
        ["materials", "Materials", <FaBookOpen />],
        ...(isStaff ? [["students", "Students", <FaUsers />]] : []),
        ["assignments", "Assignment", <FaClipboardList />],
        ["quizzes", "Quizes", <FaQuestionCircle />],
        ...(isStaff ? [["grading", "Grading", <FaChartBar />]] : []),
        ...(!isStaff ? [["grades", "Grades", <FaChartBar />]] : []),
        ["calendar", "Calendar", <FaCalendarAlt />],
        ["announcements", "Announcements", <FaBell />]
    ];

    const handleNavClick = () => {
        if (window.innerWidth <= 768) onClose?.();
    };

    const link = (to, label, icon) => (
        <li key={to}>
            <NavLink
                to={to}
                end={to === "/courses"}
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                onClick={handleNavClick}
            >
                <span className="nav-link-icon">{icon}</span>
                <span>{label}</span>
            </NavLink>
        </li>
    );

    return (
        <aside className={open ? "sidebar" : "sidebar closed"}>
            <div className="sidebar-brand">
                <div className="sidebar-brand-lockup">
                    <span className="brand-mark"><img src="/smartcampus-mark.png" alt="" /></span>
                    <span className="sidebar-brand-copy">
                        <strong>SmartCampus</strong>
                        <span>LEARNING PLATFORM</span>
                    </span>
                </div>
            </div>

            <nav>
                <ul>
                    {link("/dashboard", "Home", <FaHome />)}
                    {link("/courses", "Courses", <FaBookOpen />)}
                    {courseId && (
                        <>
                            {courseSections.map(([section, label, icon]) => (
                                <li key={section}>
                                    <Link
                                        to={section === "grades" ? "/grades" : `${location.pathname}?section=${section}`}
                                        className={section === "grades"
                                            ? location.pathname === "/grades" ? "nav-link active" : "nav-link"
                                            : activeCourseSection === section || (section === "grading" && activeCourseSection === "gradebook") ? "nav-link active" : "nav-link"}
                                        aria-current={section === "grades"
                                            ? location.pathname === "/grades" ? "page" : undefined
                                            : activeCourseSection === section || (section === "grading" && activeCourseSection === "gradebook") ? "page" : undefined}
                                        onClick={handleNavClick}
                                    >
                                        <span className="nav-link-icon">{icon}</span>
                                        <span>{label}</span>
                                    </Link>
                                </li>
                            ))}
                        </>
                    )}
                    {!courseId && (
                        <>
                            <li>
                                <Link to="/materials" className={location.pathname === "/materials" ? "nav-link active" : "nav-link"} onClick={handleNavClick}>
                                    <span className="nav-link-icon"><FaBookOpen /></span>
                                    <span>Materials</span>
                                </Link>
                            </li>
                            <li>
                                <Link to="/quizzes" className={location.pathname === "/quizzes" ? "nav-link active" : "nav-link"} onClick={handleNavClick}>
                                    <span className="nav-link-icon"><FaQuestionCircle /></span>
                                    <span>Quizes</span>
                                </Link>
                            </li>
                            {isStaff && link("/students", "Students", <FaUsers />)}
                            {!isStaff && link("/grades", "Grades", <FaChartBar />)}
                            {isStaff && (
                                <li>
                                    <Link to="/assignments" className={location.pathname === "/assignments" ? "nav-link active" : "nav-link"} onClick={handleNavClick}>
                                        <span className="nav-link-icon"><FaChartBar /></span>
                                        <span>Grading</span>
                                    </Link>
                                </li>
                            )}
                            {!isStaff && link("/assignments", "Assignment", <FaClipboardList />)}
                            {link("/calendar", "Calendar", <FaCalendarAlt />)}
                            {link("/announcements", "Announcements", <FaBell />)}
                        </>
                    )}
                    {link("/settings", "Settings", <FaCog />)}
                    {link("/help-feedback", "Help & Feedback", <FaLifeRing />)}
                </ul>
            </nav>
        </aside>
    );
};

export default Sidebar;