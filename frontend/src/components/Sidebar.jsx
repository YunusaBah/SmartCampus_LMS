import { Link, NavLink, useLocation } from "react-router-dom";
import { FaUsers } from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";

const ModuleLogo = ({ name }) => (
    <img src={`/project-icons/${name}.png`} alt="" aria-hidden="true" />
);

const Sidebar = ({ open, onClose }) => {
    const location = useLocation();
    const { isStaff } = useAuth();
    const courseId = location.pathname.match(/^\/courses\/([^/]+)$/)?.[1];
    const searchParams = new URLSearchParams(location.search);
    const courseContextId = searchParams.get("courseId") || courseId;
    const courseSection = searchParams.get("section") || "materials";
    const showStudentCourseNavigation = Boolean(courseContextId && !isStaff);
    const courseSections = [
        ["course", "Course", <ModuleLogo name="courses" />, `/courses/${courseContextId}?section=materials`, `/courses/${courseContextId}`],
        ["materials", "Materials", <ModuleLogo name="materials" />, `/materials?courseId=${courseContextId}`, "/materials"],
        ["assignments", "Assignments", <ModuleLogo name="assignments" />, `/assignments?courseId=${courseContextId}`, "/assignments"],
        ["quizzes", "Quizzes", <ModuleLogo name="quizzes" />, `/quizzes?courseId=${courseContextId}`, "/quizzes"],
        ["calendar", "Calendar", <ModuleLogo name="calendar" />, `/calendar?courseId=${courseContextId}`, "/calendar"],
        ["announcements", "Announcements", <ModuleLogo name="announcements" />, `/announcements?courseId=${courseContextId}`, "/announcements"]
    ];
    const contextualModuleHref = (path) => courseContextId
        ? `${path}?courseId=${encodeURIComponent(courseContextId)}`
        : path;

    const handleNavClick = () => {
        if (window.innerWidth <= 768) onClose?.();
    };

    const link = (to, label, icon) => (
        <li key={to}>
            <NavLink
                to={to}
                end={to === "/courses" ? showStudentCourseNavigation : true}
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                title={label}
                aria-label={label}
                onClick={handleNavClick}
            >
                <span className="nav-link-icon">{icon}</span>
                <span>{label}</span>
            </NavLink>
        </li>
    );

    return (
        <aside className={open ? "sidebar" : "sidebar closed"}>
            <nav aria-label="Main navigation">
                <ul>
                    {link("/dashboard", "Home", <ModuleLogo name="home" />)}
                    {link("/courses", "Courses", <ModuleLogo name="courses" />)}
                    {isStaff && link("/students", "Students", <FaUsers />)}
                    {isStaff && link("/grades", "Grades", <ModuleLogo name="grades" />)}
                    {isStaff && link(contextualModuleHref("/assignments"), "Assignments", <ModuleLogo name="assignments" />)}
                    {isStaff && link(contextualModuleHref("/quizzes"), "Quizzes", <ModuleLogo name="quizzes" />)}
                    {showStudentCourseNavigation && (
                        <>
                            {courseSections.map(([section, label, icon, to, sectionPath]) => {
                                const isActive = location.pathname === sectionPath &&
                                    (section !== "course" || courseSection === "materials");
                                return (
                                <li key={section}>
                                    <Link
                                        to={to}
                                        className={isActive ? "nav-link active" : "nav-link"}
                                        title={label}
                                        aria-label={label}
                                        aria-current={isActive ? "page" : undefined}
                                        onClick={handleNavClick}
                                    >
                                        <span className="nav-link-icon">{icon}</span>
                                        <span>{label}</span>
                                    </Link>
                                </li>
                            );})}
                        </>
                    )}
                    {!showStudentCourseNavigation && (
                        <>
                            <li>
                                <Link to={contextualModuleHref("/materials")} className={location.pathname === "/materials" ? "nav-link active" : "nav-link"} title="Materials" aria-label="Materials" onClick={handleNavClick}>
                                <span className="nav-link-icon"><ModuleLogo name="materials" /></span>
                                    <span>Materials</span>
                                </Link>
                            </li>
                            {!isStaff && link("/grades", "Grades", <ModuleLogo name="grades" />)}
                            {!isStaff && (
                                <li>
                                    <Link to={contextualModuleHref("/quizzes")} className={location.pathname === "/quizzes" ? "nav-link active" : "nav-link"} title="Quizzes" aria-label="Quizzes" onClick={handleNavClick}>
                                        <span className="nav-link-icon"><ModuleLogo name="quizzes" /></span>
                                        <span>Quizzes</span>
                                    </Link>
                                </li>
                            )}
                            {!isStaff && link(contextualModuleHref("/assignments"), "Assignments", <ModuleLogo name="assignments" />)}
                            {link(contextualModuleHref("/calendar"), "Calendar", <ModuleLogo name="calendar" />)}
                            {link(contextualModuleHref("/announcements"), "Announcements", <ModuleLogo name="announcements" />)}
                        </>
                    )}
                    {link("/settings", "Settings", <ModuleLogo name="settings" />)}
                </ul>
            </nav>
        </aside>
    );
};

export default Sidebar;