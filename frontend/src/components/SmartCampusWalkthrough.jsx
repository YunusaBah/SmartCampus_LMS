import { useEffect, useState } from "react";
import { FaBars, FaBell, FaMoon, FaSun, FaUserCircle, FaUsers } from "react-icons/fa";

const walkthroughScenes = {
    student: [
        { label: "Home", icon: "home", eyebrow: "YOUR LEARNING SPACE", title: "Dashboard", description: "See your courses, upcoming work, and recent learning activity at a glance.", features: ["Course overview", "Upcoming activities"] },
        { label: "Courses", icon: "courses", eyebrow: "YOUR CLASSES", title: "Courses", description: "Open your classes and go directly to course materials.", features: ["Course materials", "Course information"] },
        { label: "Materials", icon: "materials", eyebrow: "LEARNING RESOURCES", title: "Materials", description: "Find course notes, shared files, and links from your lecturers.", features: ["Course resources", "New materials"] },
        { label: "Grades", icon: "grades", eyebrow: "YOUR RESULTS", title: "Grades", description: "Review marks and feedback for your completed assessments.", features: ["Assessment results", "Lecturer feedback"] },
        { label: "Quizzes", icon: "quizzes", eyebrow: "CHECK YOUR KNOWLEDGE", title: "Quizzes", description: "Take course quizzes and review available learning checks.", features: ["Available quizzes", "Quiz results"] },
        { label: "Assignments", icon: "assignments", eyebrow: "COURSEWORK", title: "Assignments", description: "Check deadlines, submit your work, and follow submission status.", features: ["Due dates", "Submission status"] },
        { label: "Calendar", icon: "calendar", eyebrow: "YOUR SCHEDULE", title: "Calendar", description: "Keep track of classes, assessment dates, and campus events.", features: ["Upcoming events", "Important dates"] },
        { label: "Announcements", icon: "announcements", eyebrow: "CAMPUS UPDATES", title: "Announcements", description: "Catch important notices and updates shared with your courses.", features: ["Course notices", "Latest updates"] },
        { label: "Settings", icon: "settings", eyebrow: "MAKE IT YOURS", title: "Settings", description: "Manage your profile, preferences, accessibility, and appearance.", features: ["Profile and preferences", "Display settings"] }
    ],
    lecturer: [
        { label: "Home", icon: "home", eyebrow: "YOUR LEARNING SPACE", title: "Dashboard", description: "See your courses, upcoming work, and recent learning activity at a glance.", features: ["Course overview", "Upcoming activities"] },
        { label: "Courses", icon: "courses", eyebrow: "YOUR CLASSES", title: "Courses", description: "Open your classes and go directly to course materials or management.", features: ["Course materials", "Course management"] },
        { label: "Students", icon: "students", eyebrow: "TEACHING TOOLS", title: "Students", description: "View your class rosters and follow student participation.", features: ["Class roster", "Student activity"] },
        { label: "Grades", icon: "grades", eyebrow: "YOUR RESULTS", title: "Grades", description: "Review marks and feedback for course assessments.", features: ["Assessment results", "Course performance"] },
        { label: "Assignments", icon: "assignments", eyebrow: "COURSEWORK", title: "Assignments", description: "Manage coursework and review student submissions.", features: ["Assignment uploads", "Student submissions"] },
        { label: "Quizzes", icon: "quizzes", eyebrow: "CHECK YOUR KNOWLEDGE", title: "Quizzes", description: "Manage classwork and timed tests, and review submissions.", features: ["Classwork", "Timed tests"] },
        { label: "Materials", icon: "materials", eyebrow: "LEARNING RESOURCES", title: "Materials", description: "Manage course notes, shared files, and learning links.", features: ["Course resources", "New materials"] },
        { label: "Calendar", icon: "calendar", eyebrow: "YOUR SCHEDULE", title: "Calendar", description: "Keep track of classes, assessment dates, and campus events.", features: ["Upcoming events", "Important dates"] },
        { label: "Announcements", icon: "announcements", eyebrow: "CAMPUS UPDATES", title: "Announcements", description: "Share important notices and updates with your courses.", features: ["Course notices", "Latest updates"] },
        { label: "Settings", icon: "settings", eyebrow: "MAKE IT YOURS", title: "Settings", description: "Manage your profile, preferences, accessibility, and appearance.", features: ["Profile and preferences", "Display settings"] }
    ]
};

const SmartCampusWalkthrough = () => {
    const [activeScene, setActiveScene] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [role, setRole] = useState("student");
    const [previewTheme, setPreviewTheme] = useState(
        () => localStorage.getItem("smartcampus:theme:guest") === "dark" ||
            document.documentElement.dataset.theme === "dark" ? "dark" : "light"
    );
    const [isPlaying, setIsPlaying] = useState(
        () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    const scenes = walkthroughScenes[role];
    const scene = scenes[activeScene];

    const selectScene = (index) => {
        setActiveScene(index);
    };

    const selectRole = (nextRole) => {
        setRole(nextRole);
        setActiveScene(0);
        setSidebarOpen(true);
    };

    useEffect(() => {
        if (!isPlaying) return undefined;

        const timer = window.setInterval(() => {
            setActiveScene((current) => (current + 1) % scenes.length);
        }, 3800);

        return () => window.clearInterval(timer);
    }, [isPlaying, role, scenes.length]);

    return (
        <aside className="login-walkthrough" aria-label="SmartCampus platform walkthrough">
            <div className="walkthrough-heading">
                <p className="login-eyebrow">A QUICK CAMPUS TOUR</p>
                <h2>See how SmartCampus LMS works</h2>
            </div>
            <div className="walkthrough-role-switch" aria-label="Choose a role to preview">
                {["student", "lecturer"].map((item) => (
                    <button
                        key={item}
                        type="button"
                        className={role === item ? "active" : ""}
                        aria-pressed={role === item}
                        onClick={() => selectRole(item)}
                    >
                        {item === "student" ? "Student" : "Lecturer"}
                    </button>
                ))}
            </div>
            <div className="walkthrough-phone">
                <div className="walkthrough-phone-frame">
                    <div className="walkthrough-phone-camera" aria-hidden="true" />
                    <div className="walkthrough-phone-screen" data-theme-preview={previewTheme}>
                        <div className="walkthrough-status-bar" aria-hidden="true">
                            <span>9:41</span>
                            <span>● ● ●</span>
                        </div>
                        <div className="walkthrough-app">
                            <header className="walkthrough-app-header">
                                <button
                                    type="button"
                                    className="walkthrough-menu-toggle"
                                    aria-label={sidebarOpen ? "Close tour navigation" : "Open tour navigation"}
                                    aria-expanded={sidebarOpen}
                                    aria-controls="walkthrough-sidebar"
                                    onClick={() => setSidebarOpen((open) => !open)}
                                >
                                    <FaBars aria-hidden="true" />
                                </button>
                                <span className="walkthrough-app-mark">
                                    <img src="/smartcampus-mark.png" alt="" />
                                </span>
                                <span className="walkthrough-app-name">SmartCampus LMS</span>
                                <button type="button" className="walkthrough-header-action" aria-label="Notifications">
                                    <FaBell aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    className="walkthrough-header-action"
                                    aria-label={`Preview ${previewTheme === "dark" ? "light" : "dark"} theme`}
                                    aria-pressed={previewTheme === "dark"}
                                    onClick={() => setPreviewTheme((current) => current === "dark" ? "light" : "dark")}
                                >
                                    {previewTheme === "dark" ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
                                </button>
                                <FaUserCircle className="walkthrough-profile-icon" aria-hidden="true" />
                            </header>
                            <div className={sidebarOpen ? "walkthrough-workspace" : "walkthrough-workspace sidebar-collapsed"}>
                                <nav className="walkthrough-sidebar" id="walkthrough-sidebar" aria-label={`${role} navigation preview`}>
                                    {scenes.map((item, index) => (
                                        <button
                                            type="button"
                                            className={index === activeScene ? "walkthrough-nav-item active" : "walkthrough-nav-item"}
                                            key={item.label}
                                            title={item.label}
                                            aria-label={item.label}
                                            aria-current={index === activeScene ? "page" : undefined}
                                            onClick={() => selectScene(index)}
                                        >
                                            <span className="walkthrough-nav-icon">
                                                {item.icon === "students"
                                                    ? <FaUsers aria-hidden="true" />
                                                    : <img src={`/project-icons/${item.icon}.png`} alt="" />}
                                            </span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </nav>
                                <main className="walkthrough-page-preview" key={`${role}-${activeScene}`} aria-live="polite">
                                    <p className="walkthrough-page-eyebrow">{scene.eyebrow}</p>
                                    <h3>{scene.title}</h3>
                                    <p className="walkthrough-page-description">{scene.description}</p>
                                    <div className="walkthrough-feature-card">
                                        <span className="walkthrough-feature-heading">IN THIS MODULE</span>
                                        {scene.features.map((feature, index) => (
                                            <div className="walkthrough-feature-row" key={feature}>
                                                <span className={index === 0 ? "walkthrough-feature-icon accent" : "walkthrough-feature-icon"}>
                                                    {index === 0 ? "✓" : "›"}
                                                </span>
                                                <span>{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <span className="walkthrough-page-action">Open {scene.label} <b>→</b></span>
                                </main>
                            </div>
                        </div>
                    </div>
                    <div className="walkthrough-phone-button" aria-hidden="true" />
                </div>
                <div className="walkthrough-caption" aria-live="polite">
                    <strong>{scene.label}</strong>
                    <span>{scene.description}</span>
                </div>
                <div className="walkthrough-controls">
                    <button
                        type="button"
                        className="walkthrough-play-button"
                        onClick={() => setIsPlaying((playing) => !playing)}
                        aria-label={isPlaying ? "Pause SmartCampus walkthrough" : "Play SmartCampus walkthrough"}
                    >
                        {isPlaying ? "Pause tour" : "Play tour"}
                    </button>
                    <div className="walkthrough-dots" aria-label="Choose a walkthrough module">
                        {scenes.map((item, index) => (
                            <button
                                key={item.label}
                                type="button"
                                className={index === activeScene ? "active" : ""}
                                onClick={() => selectScene(index)}
                                aria-label={`Show ${item.label.toLowerCase()}`}
                                aria-current={index === activeScene ? "step" : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default SmartCampusWalkthrough;
