import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaBell, FaMoon, FaSignOutAlt, FaSun, FaUserCircle } from "react-icons/fa";
import { useAuth } from "../hooks/useAuth";
import API from "../services/api";
import { clearOfflineResponsesForAccount } from "../services/offlineCache";
import { readProfilePicture } from "../utils/profilePicture";
import { readNotificationBadge } from "../utils/settingsPreferences";
import useOfflineRefresh from "../hooks/useOfflineRefresh";

const Navbar = ({ toggle, theme, toggleTheme }) => {
    const offlineRefresh = useOfflineRefresh();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [profilePicture, setProfilePicture] = useState(() => readProfilePicture(user?.id));
    const [showNotificationBadge, setShowNotificationBadge] = useState(() => readNotificationBadge(user?.id));
    const [notifications, setNotifications] = useState([]);
    const [notificationError, setNotificationError] = useState("");
    const [notificationLoading, setNotificationLoading] = useState(true);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);
    const notificationRef = useRef(null);

    useEffect(() => {
        const updateProfilePicture = () => setProfilePicture(readProfilePicture(user?.id));
        updateProfilePicture();
        window.addEventListener("smartcampus:profile-picture-updated", updateProfilePicture);
        return () => window.removeEventListener("smartcampus:profile-picture-updated", updateProfilePicture);
    }, [user?.id]);

    useEffect(() => {
        const updateBadgePreference = () => setShowNotificationBadge(readNotificationBadge(user?.id));
        updateBadgePreference();
        window.addEventListener("smartcampus:notification-preference-updated", updateBadgePreference);
        return () => window.removeEventListener("smartcampus:notification-preference-updated", updateBadgePreference);
    }, [user?.id]);

    useEffect(() => {
        let active = true;
        API.get("/notifications")
            .then((response) => {
                if (active) setNotifications(response.data);
            })
            .catch((error) => {
                if (active) setNotificationError(error.response?.data?.message || "Unable to load notifications.");
            })
            .finally(() => {
                if (active) setNotificationLoading(false);
            });
        return () => { active = false; };
    }, [offlineRefresh]);

    useEffect(() => {
        const closeOnOutsideClick = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
            if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationsOpen(false);
        };
        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setProfileOpen(false);
                setNotificationsOpen(false);
            }
        };
        document.addEventListener("pointerdown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, []);

    const markRead = async (notification) => {
        if (notification.readAt) return true;
        try {
            const response = await API.patch(`/notifications/${notification.id}/read`);
            setNotifications((items) => items.map((item) =>
                item.id === notification.id ? response.data : item
            ));
            return true;
        } catch (error) {
            setNotificationError(error.response?.data?.message || "Unable to mark notification as read.");
            return false;
        }
    };

    const markAllRead = async () => {
        setMarkingAllRead(true);
        setNotificationError("");
        try {
            await API.patch("/notifications/read-all");
            const readAt = new Date().toISOString();
            setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || readAt })));
        } catch (error) {
            setNotificationError(error.response?.data?.message || "Unable to mark notifications as read.");
        } finally {
            setMarkingAllRead(false);
        }
    };

    const openNotification = async (notification) => {
        if (!await markRead(notification)) return;
        setNotificationsOpen(false);
        const resourcePaths = {
            assignment: "/assignments",
            submission: "/grades",
            assessment: "/quizzes",
            announcement: "/announcements",
            message: "/messages",
            calendarEvent: "/calendar"
        };
        navigate(resourcePaths[notification.resourceType] || "/dashboard");
    };

    const unreadCount = notifications.filter((notification) => !notification.readAt).length;
    const fullName = user?.fullName?.trim() || "";
    const displayName = user?.role === "lecturer"
        ? `MR. ${fullName.split(/\s+/).at(-1)?.toUpperCase() || ""}`.trim()
        : fullName;
    const showNavbarWelcome = location.pathname !== "/dashboard" && Boolean(displayName);

    const handleLogout = async () => {
        let logoutMessage = "Logged out successfully.";
        try {
            await API.post("/auth/logout");
        } catch (error) {
            logoutMessage = error.response?.data?.message
                ? "Logged out on this device. Server session revocation failed."
                : "Logged out on this device. Server session revocation could not be confirmed.";
        } finally {
            if (user?.id != null) {
                try {
                    await clearOfflineResponsesForAccount(String(user.id));
                } catch (error) {
                    console.error("Could not clear this account's offline data:", error);
                    logoutMessage = "Logged out, but saved offline data could not be removed from this device.";
                }
            }
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.dispatchEvent(new Event("smartcampus:account-changed"));
            navigate("/login", { replace: true, state: { message: logoutMessage } });
        }
    };

    return (
        <div className="navbar">
            <button
                type="button"
                className="navbar-menu"
                aria-label="Toggle sidebar"
                onClick={toggle}
            >
                <FaBars aria-hidden="true" />
            </button>
            <Link className="navbar-brand-lockup" to="/dashboard" aria-label="SmartCampus LMS home">
                <span className="navbar-brand-mark"><img src="/smartcampus-mark.png" alt="" /></span>
                <span className="navbar-brand-copy">
                    <strong>SmartCampus LMS</strong>
                    <span>LEARNING MANAGEMENT SYSTEM</span>
                </span>
            </Link>
            {showNavbarWelcome && (
                <div className="navbar-welcome" aria-label={`Welcome back, ${displayName}`}>
                    <span>WELCOME BACK</span>
                    <strong>{displayName}</strong>
                </div>
            )}
            <div className="navbar-actions">
                <div className="notification-control" ref={notificationRef}>
                    <button
                        type="button"
                        className="notification-toggle"
                        aria-label={`Notifications${showNotificationBadge && unreadCount ? `, ${unreadCount} unread` : ""}`}
                        aria-expanded={notificationsOpen}
                        onClick={() => {
                            setNotificationsOpen((current) => !current);
                            setProfileOpen(false);
                        }}
                    >
                        <FaBell aria-hidden="true" />
                        {showNotificationBadge && unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                    </button>
                    {notificationsOpen && (
                        <section className="notification-popover" aria-label="Notifications">
                            <header>
                                <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
                                {unreadCount > 0 && (
                                    <button type="button" onClick={markAllRead} disabled={markingAllRead}>
                                        {markingAllRead ? "Marking..." : "Mark all read"}
                                    </button>
                                )}
                            </header>
                            {notificationError && <p className="notification-error" role="alert">{notificationError}</p>}
                            <div className="notification-list">
                                {notifications.length ? notifications.slice(0, 8).map((notification) => (
                                    <button
                                        type="button"
                                        className={notification.readAt ? "notification-item" : "notification-item unread"}
                                        key={notification.id}
                                        onClick={() => openNotification(notification)}
                                    >
                                        <span className="notification-dot" aria-hidden="true" />
                                        <span><strong>{notification.title}</strong><small>{notification.body}</small><time>{new Date(notification.createdAt).toLocaleString()}</time></span>
                                    </button>
                                )) : notificationLoading ? (
                                    <p className="notification-empty" role="status">Loading notifications...</p>
                                ) : !notificationError ? (
                                    <p className="notification-empty">No new notifications.</p>
                                ) : null}
                            </div>
                            <Link to="/announcements" onClick={() => setNotificationsOpen(false)}>Open announcements</Link>
                        </section>
                    )}
                </div>
                <button
                    type="button"
                    className="theme-toggle"
                    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    aria-pressed={theme === "dark"}
                    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    onClick={toggleTheme}
                >
                    {theme === "dark" ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
                </button>
                <div className="navbar-profile-control" ref={profileRef}>
                    <button
                        type="button"
                        className="navbar-profile-toggle"
                        aria-expanded={profileOpen}
                        aria-label={`Profile menu for ${user?.fullName || user?.email || "your account"}`}
                        onClick={() => {
                            setProfileOpen((current) => !current);
                            setNotificationsOpen(false);
                        }}
                    >
                        {profilePicture ? (
                            <img src={profilePicture} alt="" />
                        ) : (
                            <FaUserCircle aria-hidden="true" />
                        )}
                    </button>
                    {profileOpen && (
                        <section className="navbar-profile-menu" aria-label="Account menu">
                            <Link className="navbar-profile-edit" to="/settings/profile" onClick={() => setProfileOpen(false)}>
                                <FaUserCircle aria-hidden="true" /> Edit profile
                            </Link>
                            <button type="button" className="navbar-profile-logout" onClick={handleLogout}>
                                <FaSignOutAlt aria-hidden="true" /> Log out
                            </button>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Navbar;
