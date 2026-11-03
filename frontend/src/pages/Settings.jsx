import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBookOpen, FaLifeRing, FaMoon, FaSearch, FaShieldAlt, FaSlidersH, FaSun, FaUserCircle } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import useOfflineRefresh from "../hooks/useOfflineRefresh";
import { profilePictureStorageKey, readProfilePicture } from "../utils/profilePicture";
import ShareAppButton from "../components/ShareAppButton";
import {
    defaultPageOptions,
    defaultPageStorageKey,
    notificationBadgeStorageKey,
    readDefaultPage,
    readNotificationBadge,
    readReducedMotion,
    reducedMotionStorageKey
} from "../utils/settingsPreferences";

const readTextSizePreference = (userId) => {
    const value = Number(localStorage.getItem(`smartcampus:text-size:${userId ?? "guest"}`) || 0);
    return Number.isInteger(value) && value >= 0 && value <= 20 ? value : 0;
};

const courseSettingsFrom = (course) => ({
    title: course.title || "",
    academicCode: course.academicCode || "",
    category: course.category || "",
    description: course.description || "",
    status: course.status || "active",
    enrollmentEnabled: String(course.enrollmentEnabled !== false),
    startDate: course.startDate || "",
    endDate: course.endDate || ""
});

const CourseSettingsForm = ({ course, section, onCourseUpdated }) => {
    const [courseSettings, setCourseSettings] = useState(() => courseSettingsFrom(course));
    const [status, setStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [regeneratingCode, setRegeneratingCode] = useState(false);

    if (section === "class-code") {
        const regenerateCourseCode = async () => {
            setRegeneratingCode(true);
            setStatus(null);
            try {
                const response = await API.post(`/courses/${course.id}/class-code/regenerate`);
                onCourseUpdated({ ...course, classCode: response.data.classCode });
                setStatus({
                    type: "success",
                    text: "Class code regenerated. The previous code no longer works for new enrollments."
                });
            } catch (error) {
                setStatus({
                    type: "error",
                    text: error.response?.data?.message || "Unable to regenerate class code."
                });
            } finally {
                setRegeneratingCode(false);
            }
        };

        return (
            <div className="settings-course-code settings-course-code-page">
                <span>Enrollment class code</span>
                <strong>{course.classCode || "No class code available"}</strong>
                <button
                    type="button"
                    className="btn btn-inline btn-secondary"
                    onClick={regenerateCourseCode}
                    disabled={regeneratingCode}
                >
                    {regeneratingCode ? "Regenerating..." : "Regenerate code"}
                </button>
                {status && <p className={`settings-status ${status.type}`} role="status">{status.text}</p>}
            </div>
        );
    }

    const saveCourseSettings = async (event) => {
        event.preventDefault();
        setSaving(true);
        setStatus(null);
        try {
            const updates = {
                name: { title: courseSettings.title },
                code: { academicCode: courseSettings.academicCode },
                category: { category: courseSettings.category },
                description: { description: courseSettings.description },
                status: { status: courseSettings.status },
                enrollment: { enrollmentEnabled: courseSettings.enrollmentEnabled === "true" },
                start: { startDate: courseSettings.startDate || null },
                end: { endDate: courseSettings.endDate || null }
            }[section];
            const response = await API.patch(`/courses/${course.id}`, updates);
            onCourseUpdated(response.data);
            setStatus({ type: "success", text: "Course settings saved." });
        } catch (error) {
            setStatus({
                type: "error",
                text: error.response?.data?.message || "Unable to save course settings."
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="settings-form" onSubmit={saveCourseSettings}>
            {section === "name" && course.createdAt && (
                <p className="settings-course-created">
                    Created automatically on {new Date(course.createdAt).toLocaleDateString()}
                </p>
            )}
            <div className="settings-form-grid">
                {section === "name" && (
                    <label>Course name<input name="title" required maxLength={255} value={courseSettings.title} onChange={(event) => setCourseSettings({ ...courseSettings, title: event.target.value })} /></label>
                )}
                {section === "code" && (
                    <label>Academic course code<input name="academicCode" maxLength={50} value={courseSettings.academicCode} onChange={(event) => setCourseSettings({ ...courseSettings, academicCode: event.target.value })} /></label>
                )}
                {section === "category" && (
                    <label>Category<input name="category" maxLength={100} value={courseSettings.category} onChange={(event) => setCourseSettings({ ...courseSettings, category: event.target.value })} /></label>
                )}
                {section === "description" && (
                    <label className="settings-form-wide">Description<textarea name="description" rows={5} maxLength={10000} value={courseSettings.description} onChange={(event) => setCourseSettings({ ...courseSettings, description: event.target.value })} /></label>
                )}
                {section === "status" && (
                    <label>Status<select name="status" value={courseSettings.status} onChange={(event) => setCourseSettings({ ...courseSettings, status: event.target.value })}>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                    </select></label>
                )}
                {section === "enrollment" && (
                    <label>Enrollment<select name="enrollmentEnabled" value={courseSettings.enrollmentEnabled} onChange={(event) => setCourseSettings({ ...courseSettings, enrollmentEnabled: event.target.value })}>
                        <option value="true">Open</option>
                        <option value="false">Closed</option>
                    </select></label>
                )}
                {section === "start" && (
                    <label>Start date<input type="date" name="startDate" value={courseSettings.startDate} onChange={(event) => setCourseSettings({ ...courseSettings, startDate: event.target.value })} /></label>
                )}
                {section === "end" && (
                    <label>End date<input type="date" name="endDate" value={courseSettings.endDate} onChange={(event) => setCourseSettings({ ...courseSettings, endDate: event.target.value })} /></label>
                )}
            </div>
            <div className="settings-form-footer">
                {status && <p className={`settings-status ${status.type}`} role="status">{status.text}</p>}
                <button className="btn btn-inline" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                </button>
            </div>
        </form>
    );
};

const Settings = ({ theme, setTheme }) => {
    const offlineRefresh = useOfflineRefresh();
    const navigate = useNavigate();
    const location = useLocation();
    const courseReturnTo = new URLSearchParams(location.search).get("returnTo");
    const { user, isStaff } = useAuth();
    const [profile, setProfile] = useState({
        fullName: user?.fullName || "",
        email: user?.email || "",
        matNumber: user?.matNumber || "",
        phone: user?.phone || ""
    });
    const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [reducedMotion, setReducedMotion] = useState(() => readReducedMotion(user?.id));
    const [defaultPage, setDefaultPage] = useState(() => readDefaultPage(user?.id));
    const [notificationBadge, setNotificationBadge] = useState(() => readNotificationBadge(user?.id));
    const [textSize, setTextSize] = useState(() => readTextSizePreference(user?.id));
    const [settingsSearch, setSettingsSearch] = useState("");
    const [profileStatus, setProfileStatus] = useState(null);
    const [profilePicture, setProfilePicture] = useState(() => readProfilePicture(user?.id));
    const [profilePictureError, setProfilePictureError] = useState("");
    const [passwordStatus, setPasswordStatus] = useState(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [courses, setCourses] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState(
        location.state?.courseId ? String(location.state.courseId) : ""
    );
    const [coursesError, setCoursesError] = useState("");
    const [coursesLoaded, setCoursesLoaded] = useState(false);
    const selectedCourse = courses.find((course) => String(course.id) === selectedCourseId);
    const settingsPath = location.pathname.split("/").slice(2);
    const settingsPage = settingsPath[0] || "";
    const settingsSubpage = settingsPath[1] || "";
    const isSettingsHome = !settingsPage;
    const showCourseSettings = settingsPage === "courses";
    const showProfileSettings = settingsPage === "profile";
    const showSecuritySettings = settingsPage === "security" &&
        settingsSubpage === "password" &&
        user?.passwordLoginEnabled !== false;
    const showPreferences = settingsPage === "preferences";
    const courseSettingsRoute = settingsPage === "courses";
    const loadingCourses = courseSettingsRoute && !coursesLoaded;
    const courseSettingsSection = settingsSubpage;
    const profileDetailsPage = ["name", "email", "student-id", "phone"].includes(settingsSubpage);
    const profilePicturePage = settingsSubpage === "picture";
    const appearancePage = settingsSubpage === "appearance";
    const textSizePage = settingsSubpage === "text-size";
    const motionPage = settingsSubpage === "motion";
    const homePagePage = settingsSubpage === "home-page";
    const notificationsPage = settingsSubpage === "notifications";
    const hasSettingsMenu = isSettingsHome ||
        (showProfileSettings && !settingsSubpage) ||
        (settingsPage === "security" && !settingsSubpage && user?.passwordLoginEnabled !== false) ||
        (showPreferences && !settingsSubpage) ||
        (showCourseSettings && !settingsSubpage && isStaff);
    const settingsMenuOptions = isSettingsHome ? [
        ...(isStaff ? [{
            to: "/settings/courses",
            title: "Course settings",
            description: "Update course details and enrollment separately.",
            keywords: "course name code category description status enrollment dates class code",
            Icon: FaBookOpen
        }] : []),
        {
            to: "/settings/profile",
            title: "Profile",
            description: "Manage personal information and profile picture.",
            keywords: "name email picture student id phone number",
            Icon: FaUserCircle
        },
        ...(user?.passwordLoginEnabled !== false ? [{
            to: "/settings/security",
            title: "Security",
            description: "Manage your password settings.",
            keywords: "password",
            Icon: FaShieldAlt
        }] : []),
        {
            to: "/settings/preferences",
            title: "Preferences",
            description: "Set your theme, text size, and motion preference.",
            keywords: "theme appearance text size motion homepage notifications badge",
            Icon: FaSlidersH
        },
        {
            to: "/help-feedback",
            title: "Help & Feedback",
            description: "Follow step-by-step navigation guides or email private feedback to the developer.",
            keywords: "help support guide feedback",
            Icon: FaLifeRing
        }
    ] : showProfileSettings && !settingsSubpage ? [
        { to: "/settings/profile/name", title: "Full name", description: "Update your account name.", keywords: "name", Icon: FaUserCircle },
        { to: "/settings/profile/email", title: "Email address", description: "Update your account email.", keywords: "email", Icon: FaUserCircle },
        { to: "/settings/profile/picture", title: "Profile picture", description: "Add or remove your account picture.", keywords: "photo avatar image", Icon: FaUserCircle },
        ...(user?.role === "student" ? [
            { to: "/settings/profile/student-id", title: "Student ID", description: "Update your matriculation number.", keywords: "matriculation id", Icon: FaUserCircle },
            { to: "/settings/profile/phone", title: "Phone number", description: "Update your contact number.", keywords: "contact telephone", Icon: FaUserCircle }
        ] : [])
    ] : settingsPage === "security" && !settingsSubpage && user?.passwordLoginEnabled !== false ? [
        { to: "/settings/security/password", title: "Change password", description: "Update your account password.", keywords: "security", Icon: FaShieldAlt }
    ] : showPreferences && !settingsSubpage ? [
        { to: "/settings/preferences/appearance", title: "Color theme", description: "Choose light or dark mode.", keywords: "appearance", Icon: FaSun },
        { to: "/settings/preferences/text-size", title: "Text size", description: "Adjust text size for your account.", keywords: "font accessibility", Icon: FaSlidersH },
        { to: "/settings/preferences/motion", title: "Reduce motion", description: "Limit interface animations.", keywords: "animation accessibility", Icon: FaMoon },
        { to: "/settings/preferences/home-page", title: "Default page", description: "Choose where SmartCampus opens after login.", keywords: "home start", Icon: FaBookOpen },
        { to: "/settings/preferences/notifications", title: "Notification badge", description: "Show or hide the unread count on the bell.", keywords: "alerts unread count", Icon: FaSlidersH }
    ] : showCourseSettings && !settingsSubpage && isStaff && selectedCourseId ? [
        { to: `/settings/courses/name?courseId=${encodeURIComponent(selectedCourseId)}`, title: "Course name", description: "Update the title displayed for this course.", keywords: "title", Icon: FaBookOpen },
        { to: `/settings/courses/code?courseId=${encodeURIComponent(selectedCourseId)}`, title: "Academic course code", description: "Edit the course code.", keywords: "code", Icon: FaBookOpen },
        { to: `/settings/courses/category?courseId=${encodeURIComponent(selectedCourseId)}`, title: "Course category", description: "Set the category for this course.", keywords: "category", Icon: FaBookOpen },
        { to: `/settings/courses/description?courseId=${encodeURIComponent(selectedCourseId)}`, title: "Course description", description: "Edit the course description.", keywords: "description", Icon: FaBookOpen },
        { to: `/settings/courses/status?courseId=${encodeURIComponent(selectedCourseId)}`, title: "Course status", description: "Set this course active or archived.", keywords: "active archived", Icon: FaSlidersH },
        { to: `/settings/courses/enrollment?courseId=${encodeURIComponent(selectedCourseId)}`, title: "Enrollment", description: "Open or close enrollment.", keywords: "join open close", Icon: FaSlidersH },
        { to: `/settings/courses/start?courseId=${encodeURIComponent(selectedCourseId)}`, title: "Start date", description: "Set the course start date.", keywords: "begin", Icon: FaSlidersH },
        { to: `/settings/courses/end?courseId=${encodeURIComponent(selectedCourseId)}`, title: "End date", description: "Set the course end date.", keywords: "finish", Icon: FaSlidersH },
        { to: `/settings/courses/class-code?courseId=${encodeURIComponent(selectedCourseId)}`, title: "Enrollment class code", description: "View or regenerate the class code.", keywords: "invite access", Icon: FaSlidersH }
    ] : [];
    const visibleSettingsOptions = settingsMenuOptions.filter((option) =>
        `${option.title} ${option.description} ${option.keywords}`.toLowerCase().includes(settingsSearch.trim().toLowerCase())
    );
    const settingsPageTitles = {
        courses: "Course settings",
        profile: "Profile information",
        security: "Security",
        preferences: "Appearance & accessibility"
    };
    const settingsSubpageTitles = {
        "courses/name": "Course name",
        "courses/code": "Academic course code",
        "courses/category": "Course category",
        "courses/description": "Course description",
        "courses/status": "Course status",
        "courses/enrollment": "Enrollment settings",
        "courses/start": "Course start date",
        "courses/end": "Course end date",
        "courses/class-code": "Enrollment class code",
        "profile/name": "Full name",
        "profile/email": "Email address",
        "profile/student-id": "Student ID",
        "profile/phone": "Phone number",
        "profile/picture": "Profile picture",
        "security/password": "Change password",
        "preferences/appearance": "Color theme",
        "preferences/text-size": "Text size",
        "preferences/motion": "Reduce motion",
        "preferences/home-page": "Default page",
        "preferences/notifications": "Notification badge"
    };
    const settingsTitle = settingsSubpageTitles[`${settingsPage}/${settingsSubpage}`]
        || settingsPageTitles[settingsPage]
        || "Settings";
    const parentSettingsPath = settingsPage === "courses" && courseSettingsRoute && selectedCourseId
        ? `/settings/courses?courseId=${encodeURIComponent(selectedCourseId)}${courseReturnTo ? `&returnTo=${encodeURIComponent(courseReturnTo)}` : ""}`
        : settingsSubpage ? `/settings/${settingsPage}` : "/settings";

    useEffect(() => {
        const validSubpages = {
            courses: ["", "name", "code", "category", "description", "status", "enrollment", "start", "end", "class-code"],
            profile: [
                "",
                "name",
                "email",
                "picture",
                ...(user?.role === "student" ? ["student-id", "phone"] : [])
            ],
            security: ["", "password"],
            preferences: ["", "appearance", "text-size", "motion", "home-page", "notifications"]
        };
        if (
            (!isSettingsHome && (!validSubpages[settingsPage]?.includes(settingsSubpage) ||
                (settingsPage === "security" && user?.passwordLoginEnabled === false)))
        ) {
            navigate("/settings", { replace: true });
        }
    }, [isSettingsHome, navigate, settingsPage, settingsSubpage, user?.passwordLoginEnabled, user?.role]);

    useEffect(() => {
        if (!isStaff || !courseSettingsRoute) return undefined;
        let active = true;
        API.get("/courses/my")
            .then((response) => {
                if (!active) return;
                const myCourses = response.data;
                setCourses(myCourses);
                const requestedCourseId = new URLSearchParams(location.search).get("courseId") ??
                    (location.state?.courseId == null
                        ? ""
                        : String(location.state.courseId));
                setSelectedCourseId(myCourses.some((course) => String(course.id) === requestedCourseId)
                    ? requestedCourseId
                    : String(myCourses[0]?.id || ""));
            })
            .catch((error) => {
                if (active) {
                    setCoursesError(error.response?.data?.message || "Unable to load your courses.");
                }
            })
            .finally(() => {
                if (active) setCoursesLoaded(true);
            });
        return () => { active = false; };
    }, [courseSettingsRoute, isStaff, location.search, location.state, offlineRefresh]);

    const saveProfile = async (event) => {
        event.preventDefault();
        setProfileStatus(null);
        setSavingProfile(true);

        try {
            const response = await API.patch("/auth/profile", profile);
            localStorage.setItem("user", JSON.stringify(response.data.user));
            window.dispatchEvent(new Event("smartcampus:user-updated"));
            setProfile({
                fullName: response.data.user.fullName,
                email: response.data.user.email,
                matNumber: response.data.user.matNumber || "",
                phone: response.data.user.phone || ""
            });
            setProfileStatus({ type: "success", text: response.data.message });
        } catch (error) {
            setProfileStatus({
                type: "error",
                text: error.response?.data?.message || "Unable to update your profile."
            });
        } finally {
            setSavingProfile(false);
        }
    };

    const persistProfilePicture = (picture) => {
        if (user?.id == null) {
            setProfilePictureError("Unable to save a profile picture for this account.");
            return;
        }
        try {
            if (picture) {
                localStorage.setItem(profilePictureStorageKey(user.id), picture);
            } else {
                localStorage.removeItem(profilePictureStorageKey(user.id));
            }
            setProfilePicture(picture);
            window.dispatchEvent(new Event("smartcampus:profile-picture-updated"));
            setProfilePictureError("");
        } catch {
            setProfilePictureError("Unable to save the profile picture. Try a smaller image.");
        }
    };

    const selectProfilePicture = (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setProfilePictureError("");
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setProfilePictureError("Choose a JPG, PNG, or WebP image.");
            return;
        }
        if (file.size > 1024 * 1024) {
            setProfilePictureError("Choose an image smaller than 1 MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                setProfilePictureError("Unable to read this image.");
                return;
            }
            persistProfilePicture(reader.result);
        };
        reader.onerror = () => setProfilePictureError("Unable to read this image.");
        reader.readAsDataURL(file);
    };

    const savePassword = async (event) => {
        event.preventDefault();
        setPasswordStatus(null);
        if (password.newPassword !== password.confirmPassword) {
            setPasswordStatus({ type: "error", text: "The new passwords do not match." });
            return;
        }
        if (password.newPassword.length < 6) {
            setPasswordStatus({ type: "error", text: "Your new password must be at least 6 characters." });
            return;
        }

        setSavingPassword(true);
        try {
            await API.patch("/auth/password", {
                currentPassword: password.currentPassword,
                newPassword: password.newPassword
            });
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.dispatchEvent(new Event("smartcampus:account-changed"));
            navigate("/login", {
                replace: true,
                state: { message: "Password updated successfully. Please log in again." }
            });
        } catch (error) {
            setPasswordStatus({
                type: "error",
                text: error.response?.data?.message || "Unable to update your password."
            });
        } finally {
            setSavingPassword(false);
        }
    };

    const changeTheme = (nextTheme) => {
        setTheme(nextTheme);
    };

    const changeMotionPreference = (enabled) => {
        setReducedMotion(enabled);
        localStorage.setItem(reducedMotionStorageKey(user?.id), String(enabled));
        document.documentElement.dataset.reducedMotion = String(enabled);
    };

    const changeTextSize = (value) => {
        setTextSize(value);
        localStorage.setItem(`smartcampus:text-size:${user?.id ?? "guest"}`, String(value));
        document.documentElement.style.fontSize = `${100 + value * 2}%`;
        window.dispatchEvent(new Event("smartcampus:text-size-changed"));
    };

    const changeDefaultPage = (page) => {
        setDefaultPage(page);
        localStorage.setItem(defaultPageStorageKey(user?.id), page);
    };

    const changeNotificationBadge = (enabled) => {
        setNotificationBadge(enabled);
        localStorage.setItem(notificationBadgeStorageKey(user?.id), String(enabled));
        window.dispatchEvent(new Event("smartcampus:notification-preference-updated"));
    };

    return (
        <div className="page-content settings-page">
            <header className="settings-header">
                {showCourseSettings && courseReturnTo ? (
                    <Link className="settings-back-link" to={courseReturnTo}>
                        <FaArrowLeft aria-hidden="true" /> Back to manage course
                    </Link>
                ) : !isSettingsHome && (
                    <Link className="settings-back-link" to={parentSettingsPath}>
                        <FaArrowLeft aria-hidden="true" /> {settingsSubpage ? settingsPageTitles[settingsPage] : "Settings"}
                    </Link>
                )}
                <h1>{settingsTitle}</h1>
            </header>

            {isSettingsHome && <ShareAppButton />}

            {hasSettingsMenu && (
                <>
                    <label className="catalog-search settings-search">
                        <FaSearch aria-hidden="true" />
                        <span className="sr-only">Search settings</span>
                        <input
                            type="search"
                            value={settingsSearch}
                            onChange={(event) => setSettingsSearch(event.target.value)}
                            placeholder="Search: profile, theme, courses"
                        />
                    </label>
                    {!(showCourseSettings && !settingsSubpage) && (
                        visibleSettingsOptions.length ? (
                            <nav className="settings-options" aria-label="Settings options">
                                {visibleSettingsOptions.map(({ to, title, description, Icon }) => (
                                    <Link
                                        className="settings-option"
                                        key={to}
                                        to={to}
                                        state={isSettingsHome && to === "/settings/courses" ? location.state : undefined}
                                    >
                                        <span className="settings-section-icon"><Icon /></span>
                                        <span><strong>{title}</strong><small>{description}</small></span>
                                    </Link>
                                ))}
                            </nav>
                        ) : <p className="empty-state">No settings match your search.</p>
                    )}
                </>
            )}

            {showCourseSettings && !settingsSubpage && isStaff && <section className="settings-section">
                {loadingCourses ? (
                    <p role="status">Loading your courses...</p>
                ) : coursesError ? (
                    <p className="settings-status error" role="alert">{coursesError}</p>
                ) : courses.length ? (
                    <>
                        <label className="settings-course-select">
                            Select course to manage
                            <select
                                value={selectedCourseId}
                                onChange={(event) => {
                                    const nextCourseId = event.target.value;
                                    setSelectedCourseId(nextCourseId);
                                    const nextSearch = new URLSearchParams({ courseId: nextCourseId });
                                    if (courseReturnTo) nextSearch.set("returnTo", courseReturnTo);
                                    navigate({ pathname: location.pathname, search: `?${nextSearch}` }, { replace: true });
                                }}
                            >
                                {courses.map((course) => (
                                    <option key={course.id} value={String(course.id)}>{course.title}</option>
                                ))}
                            </select>
                        </label>
                        {selectedCourse && (
                            visibleSettingsOptions.length ? (
                                <nav className="settings-options" aria-label="Course settings">
                                    {visibleSettingsOptions.map(({ to, title, description, Icon }) => (
                                        <Link
                                            className="settings-option"
                                            to={courseReturnTo
                                                ? `${to}&returnTo=${encodeURIComponent(courseReturnTo)}`
                                                : to}
                                            key={to}
                                        >
                                            <span className="settings-section-icon"><Icon /></span>
                                            <span><strong>{title}</strong><small>{description}</small></span>
                                        </Link>
                                    ))}
                                </nav>
                            ) : <p className="empty-state">No course settings match your search.</p>
                        )}
                    </>
                ) : (
                    <p>No courses to configure yet.</p>
                )}
            </section>}

            {showCourseSettings && settingsSubpage && isStaff && <section className="settings-section">
                {loadingCourses ? (
                    <p role="status">Loading your courses...</p>
                ) : coursesError ? (
                    <p className="settings-status error" role="alert">{coursesError}</p>
                ) : courses.length ? (
                    <>
                        <label className="settings-course-select">
                            Select course
                            <select
                                value={selectedCourseId}
                                onChange={(event) => {
                                    const nextCourseId = event.target.value;
                                    setSelectedCourseId(nextCourseId);
                                    const nextSearch = new URLSearchParams({ courseId: nextCourseId });
                                    if (courseReturnTo) nextSearch.set("returnTo", courseReturnTo);
                                    navigate({ pathname: location.pathname, search: `?${nextSearch}` }, { replace: true });
                                }}
                            >
                                {courses.map((course) => (
                                    <option key={course.id} value={String(course.id)}>{course.title}</option>
                                ))}
                            </select>
                        </label>
                        {selectedCourse && (
                            <>
                                <CourseSettingsForm
                                    key={`${selectedCourse.id}-${courseSettingsSection}`}
                                    course={selectedCourse}
                                    section={courseSettingsSection}
                                    onCourseUpdated={(updatedCourse) => {
                                        setCourses((current) => current.map((course) =>
                                            course.id === updatedCourse.id ? { ...course, ...updatedCourse } : course
                                        ));
                                        window.dispatchEvent(new Event("smartcampus:dashboard-refresh"));
                                        window.dispatchEvent(new Event("smartcampus:courses-refresh"));
                                    }}
                                />
                            </>
                        )}
                    </>
                ) : (
                    <p>No courses to configure yet.</p>
                )}
            </section>}

            {showProfileSettings && profilePicturePage && <section className="settings-section" id="profile">
                <div className="settings-profile-picture">
                    {profilePicture ? (
                        <img src={profilePicture} alt="Profile preview" />
                    ) : (
                        <FaUserCircle aria-hidden="true" />
                    )}
                    <div>
                        <label className="settings-picture-picker">
                            Add picture
                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectProfilePicture} />
                        </label>
                        {profilePicture && (
                            <button className="btn btn-inline btn-secondary" type="button" onClick={() => persistProfilePicture("")}>
                                Remove
                            </button>
                        )}
                        {profilePictureError && <p className="settings-status error" role="alert">{profilePictureError}</p>}
                    </div>
                </div>
            </section>}

            {showProfileSettings && profileDetailsPage && <section className="settings-section" id="profile-details">
                <form className="settings-form" onSubmit={saveProfile}>
                    {settingsSubpage === "name" && (
                        <label>
                            Full name
                            <input
                                autoComplete="name"
                                maxLength={255}
                                required
                                value={profile.fullName}
                                onChange={(event) => setProfile({ ...profile, fullName: event.target.value })}
                            />
                        </label>
                    )}
                    {settingsSubpage === "email" && (
                        <label>
                            Email address
                            <input
                                autoComplete="email"
                                type="email"
                                maxLength={254}
                                required
                                readOnly={user?.googleLinked}
                                value={profile.email}
                                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                            />
                            {user?.googleLinked && <small className="settings-field-hint">Email is verified by your Google account and cannot be edited here.</small>}
                        </label>
                    )}
                    {settingsSubpage === "student-id" && user?.role === "student" && (
                        <label>
                            Student ID / Matriculation number
                            <input
                                maxLength={50}
                                required
                                value={profile.matNumber}
                                onChange={(event) => setProfile({ ...profile, matNumber: event.target.value })}
                            />
                        </label>
                    )}
                    {settingsSubpage === "phone" && user?.role === "student" && (
                        <label>
                            Phone number
                            <input
                                autoComplete="tel"
                                type="tel"
                                maxLength={30}
                                value={profile.phone}
                                onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                            />
                        </label>
                    )}
                    <div className="settings-form-footer">
                        {profileStatus && (
                            <p className={`settings-status ${profileStatus.type}`} role="status">{profileStatus.text}</p>
                        )}
                        <button className="btn btn-inline" type="submit" disabled={savingProfile}>
                            {savingProfile ? "Saving..." : "Save profile"}
                        </button>
                    </div>
                </form>
            </section>}

            {showSecuritySettings && user?.passwordLoginEnabled !== false && <section className="settings-section" id="security">
                <form className="settings-form" onSubmit={savePassword}>
                    <label>
                        Current password
                        <input
                            autoComplete="current-password"
                            type="password"
                            required
                            value={password.currentPassword}
                            onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })}
                        />
                    </label>
                    <div className="settings-form-grid">
                        <label>
                            New password
                            <input
                                autoComplete="new-password"
                                type="password"
                                minLength={6}
                                required
                                value={password.newPassword}
                                onChange={(event) => setPassword({ ...password, newPassword: event.target.value })}
                            />
                        </label>
                        <label>
                            Confirm new password
                            <input
                                autoComplete="new-password"
                                type="password"
                                minLength={6}
                                required
                                value={password.confirmPassword}
                                onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })}
                            />
                        </label>
                    </div>
                    <div className="settings-form-footer">
                        {passwordStatus && (
                            <p className={`settings-status ${passwordStatus.type}`} role="status">{passwordStatus.text}</p>
                        )}
                        <button className="btn btn-inline" type="submit" disabled={savingPassword}>
                            {savingPassword ? "Updating..." : "Update password"}
                        </button>
                    </div>
                </form>
            </section>}

            {showPreferences && appearancePage && <section className="settings-section">
                <div className="settings-preference-row">
                    <div>
                        <strong>Color theme</strong>
                    </div>
                    <div className="theme-options" role="group" aria-label="Color theme">
                        <button
                            type="button"
                            className={theme === "light" ? "theme-option selected" : "theme-option"}
                            aria-pressed={theme === "light"}
                            onClick={() => changeTheme("light")}
                        >
                            <FaSun aria-hidden="true" /> Light
                        </button>
                        <button
                            type="button"
                            className={theme === "dark" ? "theme-option selected" : "theme-option"}
                            aria-pressed={theme === "dark"}
                            onClick={() => changeTheme("dark")}
                        >
                            <FaMoon aria-hidden="true" /> Dark
                        </button>
                    </div>
                </div>
            </section>}

            {showPreferences && textSizePage && <section className="settings-section">
                <div className="settings-preference-row">
                    <div><strong>Text size</strong></div>
                    <label className="settings-text-size">
                        <span>{textSize} / 20 · {100 + textSize * 2}%</span>
                        <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={textSize}
                            aria-label="Text size increase from 0 to 20"
                            onChange={(event) => changeTextSize(Number(event.target.value))}
                        />
                    </label>
                </div>
            </section>}

            {showPreferences && motionPage && <section className="settings-section">
                <div className="settings-preference-row">
                    <div>
                        <strong>Reduce motion</strong>
                    </div>
                    <label className="settings-switch">
                        <input
                            type="checkbox"
                            checked={reducedMotion}
                            onChange={(event) => changeMotionPreference(event.target.checked)}
                        />
                        <span className="settings-switch-track" aria-hidden="true" />
                        <span className="sr-only">Reduce motion</span>
                    </label>
                </div>
            </section>}

            {showPreferences && homePagePage && <section className="settings-section">
                <label className="settings-course-select">
                    Open this page after login
                    <select value={defaultPage} onChange={(event) => changeDefaultPage(event.target.value)}>
                        {defaultPageOptions.map((page) => (
                            <option key={page.value} value={page.value}>{page.label}</option>
                        ))}
                    </select>
                </label>
            </section>}

            {showPreferences && notificationsPage && <section className="settings-section">
                <div className="settings-preference-row">
                    <div><strong>Show unread count on notification icon</strong></div>
                    <label className="settings-switch">
                        <input
                            type="checkbox"
                            checked={notificationBadge}
                            onChange={(event) => changeNotificationBadge(event.target.checked)}
                        />
                        <span className="settings-switch-track" aria-hidden="true" />
                        <span className="sr-only">Show unread notification count</span>
                    </label>
                </div>
            </section>}
        </div>
    );
};

export default Settings;
