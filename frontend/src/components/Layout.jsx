import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const Layout = ({ open, toggle, onClose, theme, toggleTheme }) => {
    const [online, setOnline] = useState(() => navigator.onLine);
    const [apiUnavailable, setApiUnavailable] = useState(false);

    useEffect(() => {
        const updateOnline = () => {
            setOnline(navigator.onLine);
            if (navigator.onLine) setApiUnavailable(false);
        };
        const reportApiOffline = () => setApiUnavailable(true);
        window.addEventListener("online", updateOnline);
        window.addEventListener("offline", updateOnline);
        window.addEventListener("smartcampus:api-offline", reportApiOffline);
        return () => {
            window.removeEventListener("online", updateOnline);
            window.removeEventListener("offline", updateOnline);
            window.removeEventListener("smartcampus:api-offline", reportApiOffline);
        };
    }, []);

    return (
        <div className="layout">
            <Navbar toggle={toggle} theme={theme} toggleTheme={toggleTheme} />
            {(!online || apiUnavailable) && (
                <div className="offline-banner" role="status">
                    Offline: saved data only. Reconnect to make changes.
                </div>
            )}

            {open && (
                <button
                    type="button"
                    className="sidebar-overlay"
                    aria-label="Close menu"
                    onClick={onClose}
                />
            )}

            <div className="app-container">
                <Sidebar open={open} onClose={onClose} />

                <main className={open ? "main" : "main sidebar-collapsed"}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
