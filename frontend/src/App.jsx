import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import Layout from "./components/Layout";
import FloatingChatHost from "./components/FloatingChatHost";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import RoleRoute from "./components/RoleRoute";

import { readDefaultPage, readReducedMotion } from "./utils/settingsPreferences";

import "./styles/global.css";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const MyCourses = lazy(() => import("./pages/MyCourses"));
const Assignments = lazy(() => import("./pages/Assignments"));
const Grades = lazy(() => import("./pages/Grades"));
const JoinClass = lazy(() => import("./pages/JoinClass"));
const Students = lazy(() => import("./pages/Students"));
const Settings = lazy(() => import("./pages/Settings"));
const HelpFeedback = lazy(() => import("./pages/HelpFeedback"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Messages = lazy(() => import("./pages/Messages"));
const Certificates = lazy(() => import("./pages/Certificates"));
const Materials = lazy(() => import("./pages/Materials"));
const Quizzes = lazy(() => import("./pages/Quizzes"));

const readAccountId = () => {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        return user?.id == null ? "guest" : String(user.id);
    } catch {
        return "guest";
    }
};

const themeKey = (accountId) => `smartcampus:theme:${accountId}`;
const textSizeKey = (accountId) => `smartcampus:text-size:${accountId}`;

const readTheme = (accountId) => localStorage.getItem(themeKey(accountId)) === "dark" ? "dark" : "light";
const readTextSize = (accountId) => {
    const value = Number(localStorage.getItem(textSizeKey(accountId)) || 0);
    return Number.isInteger(value) && value >= 0 && value <= 20 ? value : 0;
};

function App() {
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
    const [accountId, setAccountId] = useState(readAccountId);
    const [theme, setTheme] = useState(() => readTheme(readAccountId()));
    const [textSize, setTextSize] = useState(() => readTextSize(readAccountId()));
    const closeSidebar = () => setSidebarOpen(false);
    const toggleSidebar = () => setSidebarOpen(prev => !prev);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(themeKey(accountId), theme);
    }, [accountId, theme]);

    useEffect(() => {
        document.documentElement.style.fontSize = `${100 + textSize * 2}%`;
        localStorage.setItem(textSizeKey(accountId), String(textSize));
    }, [accountId, textSize]);

    useEffect(() => {
        document.documentElement.dataset.reducedMotion = String(readReducedMotion(accountId));
    }, [accountId]);

    useEffect(() => {
        const syncAccountTheme = () => {
            const nextAccountId = readAccountId();
            setAccountId(nextAccountId);
            setTheme(readTheme(nextAccountId));
            setTextSize(readTextSize(nextAccountId));
        };
        const syncOtherTab = (event) => {
            if (event.key === "user" || event.key === "token") syncAccountTheme();
        };

        window.addEventListener("smartcampus:account-changed", syncAccountTheme);
        window.addEventListener("smartcampus:text-size-changed", syncAccountTheme);
        window.addEventListener("storage", syncOtherTab);
        return () => {
            window.removeEventListener("smartcampus:account-changed", syncAccountTheme);
            window.removeEventListener("smartcampus:text-size-changed", syncAccountTheme);
            window.removeEventListener("storage", syncOtherTab);
        };
    }, []);

    return (
        <BrowserRouter>
            <SpeedInsights />
            <Suspense fallback={<div className="page-content"><p>Loading...</p></div>}>
                <Routes>
                    <Route path="/invite" element={<JoinClass invitationMode />} />
                    <Route element={<PublicRoute />}>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                    </Route>

                    <Route element={<ProtectedRoute />}>
                        <Route
                            path="/"
                            element={
                                <Layout
                                    open={sidebarOpen}
                                    toggle={toggleSidebar}
                                    onClose={closeSidebar}
                                    theme={theme}
                                    toggleTheme={() => setTheme(current => current === "dark" ? "light" : "dark")}
                                />
                            }
                        >
                        <Route index element={<Navigate to={readDefaultPage(accountId)} replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="courses" element={<Courses />} />
                        <Route path="materials" element={<Materials />} />
                        <Route path="quizzes" element={<Quizzes />} />
                        <Route path="catalog" element={
                            <RoleRoute roles={["student"]}>
                                <Courses catalog />
                            </RoleRoute>
                        } />
                        <Route path="courses/:courseId" element={<CourseDetail />} />
                        <Route path="join" element={
                            <RoleRoute roles={["student"]}>
                                <JoinClass />
                            </RoleRoute>
                        } />
                        <Route path="my-courses" element={
                            <RoleRoute roles={["student"]}>
                                <MyCourses />
                            </RoleRoute>
                        } />
                        <Route path="assignments" element={<Assignments />} />
                        <Route path="students" element={
                            <RoleRoute roles={["lecturer"]}>
                                <Students />
                            </RoleRoute>
                        } />
                        <Route path="grades" element={
                            <RoleRoute roles={["student", "lecturer"]}>
                                <Grades />
                            </RoleRoute>
                        } />
                        <Route path="calendar" element={<Calendar />} />
                        <Route path="announcements" element={<Announcements />} />
                        <Route path="messages" element={
                            <RoleRoute roles={["student"]}>
                                <Messages />
                            </RoleRoute>
                        } />
                        <Route path="todo" element={<Navigate to="/assignments" replace />} />
                        <Route path="todo/:status" element={<Navigate to="/assignments" replace />} />
                        <Route path="certificates" element={
                            <RoleRoute roles={["student"]}>
                                <Certificates />
                            </RoleRoute>
                        } />
                        <Route path="settings" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="help-feedback" element={
                            <RoleRoute roles={["student", "lecturer"]}>
                                <HelpFeedback />
                            </RoleRoute>
                        } />
                        <Route path="settings/profile" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/profile/name" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/profile/email" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/profile/picture" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/profile/student-id" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/profile/phone" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/security" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/security/password" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/preferences" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/preferences/appearance" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/preferences/text-size" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/preferences/motion" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/preferences/home-page" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/preferences/notifications" element={<Settings theme={theme} setTheme={setTheme} />} />
                        <Route path="settings/courses" element={
                            <RoleRoute roles={["lecturer"]}>
                                <Settings theme={theme} setTheme={setTheme} />
                            </RoleRoute>
                        } />
                        {["name", "code", "category", "description", "status", "enrollment", "start", "end", "class-code"].map((section) => (
                            <Route key={section} path={`settings/courses/${section}`} element={
                                <RoleRoute roles={["lecturer"]}>
                                    <Settings theme={theme} setTheme={setTheme} />
                                </RoleRoute>
                            } />
                        ))}
                        </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Suspense>
            <FloatingChatHost />
        </BrowserRouter>
    );
}

export default App;
