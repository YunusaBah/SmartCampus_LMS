import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBookOpen, FaLifeRing, FaMoon, FaShieldAlt, FaSlidersH, FaSun, FaUserCircle } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { profilePictureStorageKey, readProfilePicture } from "../utils/profilePicture";
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
    const navigate = useNavigate();
    const location = useLocation();
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
        ? `/settings/courses?courseId=${encodeURIComponent(selectedCourseId)}`
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
    }, [courseSettingsRoute, isStaff, location.search, location.state]);

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
                {!isSettingsHome && (
                    <Link className="settings-back-link" to={parentSettingsPath}>
                        <FaArrowLeft aria-hidden="true" /> {settingsSubpage ? settingsPageTitles[settingsPage] : "Settings"}
                    </Link>
                )}
                <h1>{settingsTitle}</h1>
            </header>

            {isSettingsHome && (
                <nav className="settings-options" aria-label="Settings">
                    {isStaff && (
                        <Link className="settings-option" to="/settings/courses" state={location.state}>
                            <span className="settings-section-icon"><FaBookOpen /></span>
                            <span><strong>Course settings</strong><small>Update course details and enrollment separately.</small></span>
                        </Link>
                    )}
                    <Link className="settings-option" to="/settings/profile">
                        <span className="settings-section-icon"><FaUserCircle /></span>
                        <span><strong>Profile</strong><small>Manage personal information and profile picture.</small></span>
                    </Link>
                    {user?.passwordLoginEnabled !== false && (
                        <Link className="settings-option" to="/settings/security">
                            <span className="settings-section-icon"><FaShieldAlt /></span>
                            <span><strong>Security</strong><small>Manage your password settings.</small></span>
                        </Link>
                    )}
                    <Link className="settings-option" to="/settings/preferences">
                        <span className="settings-section-icon"><FaSlidersH /></span>
                        <span><strong>Preferences</strong><small>Set your theme, text size, and motion preference.</small></span>
                    </Link>
                    <Link className="settings-option" to="/help-feedback">
                        <span className="settings-section-icon"><FaLifeRing /></span>
                        <span><strong>Help & Feedback</strong><small>Find role-specific guides or share feedback.</small></span>
                    </Link>
                </nav>
            )}

            {showProfileSettings && !settingsSubpage && (
                <nav className="settings-options" aria-label="Profile settings">
                    <Link className="settings-option" to="/settings/profile/name">
                        <span className="settings-section-icon"><FaUserCircle /></span>
                        <span><strong>Full name</strong><small>Update your account name.</small></span>
                    </Link>
                    <Link className="settings-option" to="/settings/profile/email">
                        <span className="settings-section-icon"><FaUserCircle /></span>
                        <span><strong>Email address</strong><small>Update your account email.</small></span>
                    </Link>
                    <Link className="settings-option" to="/settings/profile/picture">
                        <span className="settings-section-icon"><FaUserCircle /></span>
                        <span><strong>Profile picture</strong><small>Add or remove your account picture.</small></span>
                    </Link>
                    {user?.role === "student" && (
                        <>
                            <Link className="settings-option" to="/settings/profile/student-id">
                                <span className="settings-section-icon"><FaUserCircle /></span>
                                <span><strong>Student ID</strong><small>Update your matriculation number.</small></span>
                            </Link>
                            <Link className="settings-option" to="/settings/profile/phone">
                                <span className="settings-section-icon"><FaUserCircle /></span>
                                <span><strong>Phone number</strong><small>Update your contact number.</small></span>
                            </Link>
                        </>
                    )}
                </nav>
            )}

            {settingsPage === "security" && !settingsSubpage && user?.passwordLoginEnabled !== false && (
                <nav className="settings-options" aria-label="Security settings">
                    <Link className="settings-option" to="/settings/security/password">
                        <span className="settings-section-icon"><FaShieldAlt /></span>
                        <span><strong>Change password</strong><small>Update your account password.</small></span>
                    </Link>
                </nav>
            )}

            {showPreferences && !settingsSubpage && (
                <nav className="settings-options" aria-label="Display preferences">
                    <Link className="settings-option" to="/settings/preferences/appearance">
                        <span className="settings-section-icon"><FaSun /></span>
                        <span><strong>Color theme</strong><small>Choose light or dark mode.</small></span>
                    </Link>
                    <Link className="settings-option" to="/settings/preferences/text-size">
                        <span className="settings-section-icon"><FaSlidersH /></span>
                        <span><strong>Text size</strong><small>Adjust text size for your account.</small></span>
                    </Link>
                    <Link className="settings-option" to="/settings/preferences/motion">
                        <span className="settings-section-icon"><FaMoon /></span>
                        <span><strong>Reduce motion</strong><small>Limit interface animations.</small></span>
                    </Link>
                    <Link className="settings-option" to="/settings/preferences/home-page">
                        <span className="settings-section-icon"><FaBookOpen /></span>
                        <span><strong>Default page</strong><small>Choose where SmartCampus opens after login.</small></span>
                    </Link>
                    <Link className="settings-option" to="/settings/preferences/notifications">
                        <span className="settings-section-icon"><FaSlidersH /></span>
                        <span><strong>Notification badge</strong><small>Show or hide the unread count on the bell.</small></span>
                    </Link>
                </nav>
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
                                    navigate({
                                        pathname: location.pathname,
                                        search: `?courseId=${encodeURIComponent(nextCourseId)}`
                                    }, { replace: true });
                                }}
                            >
                                {courses.map((course) => (
                                    <option key={course.id} value={String(course.id)}>{course.title}</option>
                                ))}
                            </select>
                        </label>
                        {selectedCourse && (
                            <nav className="settings-options" aria-label="Course settings">
                                <Link
                                    className="settings-option"
                                    to={`/settings/courses/name?courseId=${encodeURIComponent(selectedCourseId)}`}
                                >
                                    <span className="settings-section-icon"><FaBookOpen /></span>
                                    <span><strong>Course name</strong><small>Update the title displayed for this course.</small></span>
                                </Link>
                                <Link
                                    className="settings-option" to={`/settings/courses/code?courseId=${encodeURIComponent(selectedCourseId)}`}
                                >
                                    <span className="settings-section-icon"><FaBookOpen /></span>
                                    <span><strong>Academic course code</strong><small>Edit the course code.</small></span>
                                </Link>
                                <Link className="settings-option" to={`/settings/courses/category?courseId=${encodeURIComponent(selectedCourseId)}`}>
                                    <span className="settings-section-icon"><FaBookOpen /></span>
                                    <span><strong>Course category</strong><small>Set the category for this course.</small></span>
                                </Link>
                                <Link className="settings-option" to={`/settings/courses/description?courseId=${encodeURIComponent(selectedCourseId)}`}>
                                    <span className="settings-section-icon"><FaBookOpen /></span>
                                    <span><strong>Course description</strong><small>Edit the course description.</small></span>
                                </Link>
                                <Link className="settings-option" to={`/settings/courses/status?courseId=${encodeURIComponent(selectedCourseId)}`}>
                                    <span className="settings-section-icon"><FaSlidersH /></span>
                                    <span><strong>Course status</strong><small>Set this course active or archived.</small></span>
                                </Link>
                                <Link className="settings-option" to={`/settings/courses/enrollment?courseId=${encodeURIComponent(selectedCourseId)}`}>
                                    <span className="settings-section-icon"><FaSlidersH /></span>
                                    <span><strong>Enrollment</strong><small>Open or close enrollment.</small></span>
                                </Link>
                                <Link className="settings-option" to={`/settings/courses/start?courseId=${encodeURIComponent(selectedCourseId)}`}>
                                    <span className="settings-section-icon"><FaSlidersH /></span>
                                    <span><strong>Start date</strong><small>Set the course start date.</small></span>
                                </Link>
                                <Link className="settings-option" to={`/settings/courses/end?courseId=${encodeURIComponent(selectedCourseId)}`}>
                                    <span className="settings-section-icon"><FaSlidersH /></span>
                                    <span><strong>End date</strong><small>Set the course end date.</small></span>
                                </Link>
                                <Link className="settings-option" to={`/settings/courses/class-code?courseId=${encodeURIComponent(selectedCourseId)}`}>
                                    <span className="settings-section-icon"><FaSlidersH /></span>
                                    <span><strong>Enrollment class code</strong><small>View or regenerate the class code.</small></span>
                                </Link>
                            </nav>
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
                                    navigate({
                                        pathname: location.pathname,
                                        search: `?courseId=${encodeURIComponent(nextCourseId)}`
                                    }, { replace: true });
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
                                required
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
