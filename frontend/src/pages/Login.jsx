import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../services/api";
import Register from "./Register";
import GoogleSignInButton from "../components/GoogleSignInButton";
import SmartCampusWalkthrough from "../components/SmartCampusWalkthrough";
import ShareAppButton from "../components/ShareAppButton";
import { readDefaultPage } from "../utils/settingsPreferences";
import { FaArrowRight, FaCode, FaEnvelope, FaFacebookF, FaGraduationCap, FaHandshake, FaInstagram, FaLightbulb, FaLinkedinIn, FaPhone, FaTimes, FaWhatsapp } from "react-icons/fa";

const readResetTokenFromHash = () =>
    new URLSearchParams(window.location.hash.slice(1)).get("resetToken") || "";

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const successMsg = location.state?.message || "";

    const [formData, setFormData] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resetToken, setResetToken] = useState(readResetTokenFromHash);
    const [loginOpen, setLoginOpen] = useState(false);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [showStickyActions, setShowStickyActions] = useState(false);
    const [registrationMessage, setRegistrationMessage] = useState("");
    const [recoveryMode, setRecoveryMode] = useState(() => resetToken ? "reset" : "");
    const [recoveryEmail, setRecoveryEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [recoveryStatus, setRecoveryStatus] = useState("");
    const [collaborationForm, setCollaborationForm] = useState({ name: "", email: "", message: "" });
    const [collaborationSubmitting, setCollaborationSubmitting] = useState(false);
    const [collaborationStatus, setCollaborationStatus] = useState(null);
    const [collaborationOpen, setCollaborationOpen] = useState(false);
    const loginActionsRef = useRef(null);
    const portfolioRef = useRef(null);

    useEffect(() => {
        const actions = loginActionsRef.current;
        if (!actions) return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            setShowStickyActions(!entry.isIntersecting);
        }, { rootMargin: "-80px 0px 0px 0px" });
        observer.observe(actions);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const portfolio = portfolioRef.current;
        if (!portfolio) return undefined;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle("is-visible", entry.isIntersecting);
            });
        }, { threshold: 0.12, rootMargin: "-88px 0px -6% 0px" });

        portfolio.querySelectorAll(".portfolio-reveal").forEach((element) => observer.observe(element));
        return () => observer.disconnect();
    }, []);

    const finishLogin = (result) => {
        localStorage.setItem("token", result.data.token);
        localStorage.setItem("user", JSON.stringify(result.data.user));
        window.dispatchEvent(new Event("smartcampus:account-changed"));
        const classCode = new URLSearchParams(location.search).get("join");
        navigate(classCode
            ? `/invite?code=${encodeURIComponent(classCode)}`
            : readDefaultPage(result.data.user.id));
    };

    useEffect(() => {
        if (!loginOpen && !registerOpen && !collaborationOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setLoginOpen(false);
                setRegisterOpen(false);
                setCollaborationOpen(false);
            }
        };

        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [collaborationOpen, loginOpen, registerOpen]);

    useEffect(() => {
        if (!new URLSearchParams(location.hash.slice(1)).has("resetToken")) return;
        navigate({
            pathname: location.pathname,
            search: location.search,
            hash: ""
        }, { replace: true });
    }, [location.hash, location.pathname, location.search, navigate]);

    const openLogin = () => {
        setError("");
        setRecoveryMode("");
        setRecoveryStatus("");
        setLoginOpen(true);
    };

    const openRegister = () => {
        setRegistrationMessage("");
        setRegisterOpen(true);
    };

    const closeModals = () => {
        setLoginOpen(false);
        setRegisterOpen(false);
        setRecoveryMode("");
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await API.post("/auth/login", formData);
            finishLogin(res);
        } catch (error) {
            setError(error.response?.data?.message || (
                error.code === "ECONNABORTED" || error.code === "ERR_NETWORK"
                    ? "Unable to connect to SmartCampus. Check your connection and try again."
                    : "Login failed. Please try again."
            ));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleCredential = async (credential) => {
        if (loading) return;
        setLoading(true);
        setError("");
        try {
            const response = await API.post("/auth/google/login", { credential });
            finishLogin(response);
        } catch (googleError) {
            setError(googleError.response?.data?.message || (
                googleError.code === "ECONNABORTED" || googleError.code === "ERR_NETWORK"
                    ? "Unable to connect to SmartCampus. Check your connection and try again."
                    : "Google login failed. Please try again."
            ));
        } finally {
            setLoading(false);
        }
    };

    const handleCollaborationSubmit = async (event) => {
        event.preventDefault();
        setCollaborationSubmitting(true);
        setCollaborationStatus(null);
        try {
            const response = await API.post("/feedback/collaboration", collaborationForm);
            setCollaborationStatus({ type: "success", text: response.data.message });
            setCollaborationForm({ name: "", email: "", message: "" });
        } catch (submitError) {
            setCollaborationStatus({
                type: "error",
                text: submitError.response?.data?.message || "Unable to send your message. Please try again."
            });
        } finally {
            setCollaborationSubmitting(false);
        }
    };

    const handleRecoverySubmit = async (event) => {
        event.preventDefault();
        setRecoveryStatus("");
        setError("");
        setLoading(true);
        try {
            if (recoveryMode === "request") {
                const response = await API.post("/auth/password/forgot", { email: recoveryEmail });
                if (response.data.resetToken) {
                    setResetToken(response.data.resetToken);
                    setRecoveryMode("reset");
                    setRecoveryStatus("Development reset token generated. Choose a new password below.");
                } else {
                    setRecoveryStatus(response.data.message);
                }
                return;
            }

            const response = await API.post("/auth/password/reset", {
                token: resetToken,
                newPassword,
                confirmPassword
            });
            setLoginOpen(false);
            setRecoveryMode("");
            setNewPassword("");
            setConfirmPassword("");
            navigate("/login", {
                replace: true,
                state: { message: response.data.message }
            });
        } catch (recoveryError) {
            setError(recoveryError.response?.data?.message || "Unable to process password recovery.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login-portal" id="top">
            <header className={`portfolio-sticky-bar${showStickyActions ? " has-sticky-actions" : ""}`}>
                <a className="portfolio-brand" href="#top" aria-label="SmartCampus LMS home">
                    <span className="portfolio-brand-mark">
                        <img src="/smartcampus-mark.png" alt="" />
                    </span>
                    <span className="portfolio-brand-copy">
                        <strong>SmartCampus LMS</strong>
                    </span>
                </a>
                <nav className="portfolio-nav" aria-label="Portfolio navigation">
                    <a href="#why-smartcampus">Why SmartCampus LMS</a>
                    <a href="#platform">Platform</a>
                    <a href="#collaborate">Collaborate</a>
                    <a href="#developer">Developer</a>
                    <a href="#contact">Contact</a>
                </nav>
                {showStickyActions && (
                    <div className="portfolio-sticky-actions">
                        <button className="login-action-secondary portfolio-login-button" type="button" onClick={openLogin}>Login</button>
                        <button className="login-action-primary portfolio-register-button" type="button" onClick={openRegister}>Create account</button>
                    </div>
                )}
            </header>

            <div className="login-landing">
                <section className="login-welcome">
                    <div className="utg-header">
                        <p className="login-eyebrow">THE UNIVERSITY OF THE GAMBIA</p>
                    </div>
                    <h1>SmartCampus LMS</h1>
                    <p className="login-welcome-copy">
                        Courses, learning materials, assignments, and campus communication — all in one place.
                    </p>
                    {successMsg && <p className="login-success" role="status">{successMsg}</p>}
                    {registrationMessage && <p className="login-success" role="status">{registrationMessage}</p>}
                    <div className="login-actions" ref={loginActionsRef}>
                        <button className="login-action-primary" type="button" onClick={openLogin}>
                            Login
                        </button>
                        <button className="login-action-secondary" type="button" onClick={openRegister}>
                            Create account
                        </button>
                    </div>
                </section>

                <SmartCampusWalkthrough />
            </div>

            <section className="developer-portfolio" aria-label="Developer portfolio" ref={portfolioRef}>
                <section className="portfolio-story portfolio-reveal" id="why-smartcampus">
                    <div className="portfolio-section-heading">
                        <p className="portfolio-eyebrow"><FaLightbulb aria-hidden="true" /> THE IDEA</p>
                        <h2>Why SmartCampus LMS was created</h2>
                    </div>
                    <p className="portfolio-story-copy">
                        Learning information can be scattered across course pages, files, messages, and notices.
                        SmartCampus brings the core student and lecturer workflows together so course resources,
                        assignments, communication, and progress are easier to find and manage.
                    </p>
                    <div className="portfolio-value-grid">
                        <article className="portfolio-reveal"><span>01</span><h3>One learning space</h3><p>Keep courses, resources, activities, and updates connected.</p></article>
                        <article className="portfolio-reveal"><span>02</span><h3>Clearer workflows</h3><p>Help students follow their work and lecturers manage course activity.</p></article>
                        <article className="portfolio-reveal"><span>03</span><h3>Built to grow</h3><p>Create a foundation for more accessible and connected campus learning.</p></article>
                    </div>
                </section>

                <section className="portfolio-platform portfolio-reveal" id="platform">
                    <div className="portfolio-section-heading">
                        <p className="portfolio-eyebrow"><FaGraduationCap aria-hidden="true" /> THE PLATFORM</p>
                        <h2>Designed around campus learning</h2>
                        <p>Student and lecturer tools come together in one connected platform.</p>
                    </div>
                    <div className="portfolio-platform-grid">
                        <article className="portfolio-reveal"><strong>Learn</strong><span>Courses, materials, quizzes, assignments, grades, and certificates.</span></article>
                        <article className="portfolio-reveal"><strong>Teach</strong><span>Course management, student lists, assignments, submissions, and grading.</span></article>
                        <article className="portfolio-reveal"><strong>Stay connected</strong><span>Messages, announcements, calendars, and course updates.</span></article>
                        <article className="portfolio-reveal"><strong>Stay organized</strong><span>To-do lists, deadlines, progress, and account preferences.</span></article>
                    </div>
                </section>

                <section className="portfolio-collaboration portfolio-reveal" id="collaborate">
                    <div>
                        <p className="portfolio-eyebrow"><FaHandshake aria-hidden="true" /> BUILD WITH US</p>
                        <h2>Good ideas grow through collaboration.</h2>
                        <p>
                            SmartCampus welcomes conversations with sponsors, educators, institutions, and
                            collaborators who want to support practical, accessible learning technology.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="portfolio-collaboration-link portfolio-collaboration-trigger"
                        aria-label="Open collaboration message form"
                        title="Send a collaboration message"
                        onClick={() => setCollaborationOpen(true)}
                    >
                        <FaArrowRight aria-hidden="true" />
                    </button>
                </section>

                <section className="portfolio-intro portfolio-reveal" id="developer">
                    <div className="portfolio-intro-copy">
                        <p className="portfolio-eyebrow"><FaCode aria-hidden="true" /> DEVELOPER PORTFOLIO</p>
                        <h2>Building useful technology for learning.</h2>
                        <p>
                            I&apos;m Yunusa Bah, a Computer Science student at the University of The Gambia and the
                            developer behind SmartCampus LMS. I&apos;m interested in building practical software that
                            makes everyday learning and teaching easier.
                        </p>
                        <a className="portfolio-text-link" href="#why-smartcampus">Explore the story <FaArrowRight /></a>
                    </div>
                    <div className="portfolio-photo-grid">
                        <figure className="portfolio-photo-primary">
                            <img
                                src="/developer-profile.jpeg"
                                alt="Portrait of Yunusa Bah wearing a black suit and tie"
                            />
                            <figcaption>
                                <strong>Yunusa Bah</strong>
                                <span>Developer of SmartCampus LMS</span>
                            </figcaption>
                        </figure>
                    </div>
                </section>

                <section className="portfolio-contact portfolio-reveal" id="contact">
                    <div className="portfolio-section-heading">
                        <p className="portfolio-eyebrow">GET IN TOUCH</p>
                        <h2>Let&apos;s connect</h2>
                        <p>For questions, sponsorship, or collaboration, reach out using the contacts below.</p>
                    </div>
                    <div className="portfolio-contact-grid">
                        <a href="tel:+220833359853"><FaPhone aria-hidden="true" /><span><strong>Phone</strong><small>+220 833359853</small></span></a>
                        <a href="mailto:yb22423255@utg.edu.gm"><FaEnvelope aria-hidden="true" /><span><strong>School email</strong><small>yb22423255@utg.edu.gm</small></span></a>
                        <a href="mailto:bahy1878@gmail.com"><FaEnvelope aria-hidden="true" /><span><strong>Personal email</strong><small>bahy1878@gmail.com</small></span></a>
                    </div>
                    <div className="portfolio-social-links" aria-label="Developer social profiles">
                        <a href="https://www.instagram.com/yunusabah17/" target="_blank" rel="noopener noreferrer">
                            <FaInstagram aria-hidden="true" /><span>Instagram <strong>@yunusabah17</strong></span>
                        </a>
                        <a href="https://www.facebook.com/profile.php?id=100083044838130" target="_blank" rel="noopener noreferrer">
                            <FaFacebookF aria-hidden="true" /><span>Facebook <strong>@Bah Yunusa</strong></span>
                        </a>
                        <a href="https://www.linkedin.com/in/yunusa-bah-854aab448" target="_blank" rel="noopener noreferrer">
                            <FaLinkedinIn aria-hidden="true" /><span>LinkedIn <strong>Yunusa Bah</strong></span>
                        </a>
                    </div>
                </section>
            </section>

            <a
                className="whatsapp-live-toggle"
                href="https://whatsapp.com/channel/0029VbE9CqvA89MjElFNQd2E"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join the SmartCampus LMS WhatsApp channel for updates"
            >
                <FaWhatsapp aria-hidden="true" />
                <span><strong>WhatsApp updates</strong><small>Join our channel</small></span>
                <span className="whatsapp-live-indicator" aria-hidden="true" />
            </a>
            <ShareAppButton floating />

            <footer className="portfolio-footer">
                <span>© {new Date().getFullYear()} SmartCampus LMS. All rights reserved. Built by Yunusa Bah.</span>
                <a href="#top">Back to top ↑</a>
            </footer>

            {collaborationOpen && (
                <div
                    className="auth-modal-backdrop portfolio-collaboration-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !collaborationSubmitting) setCollaborationOpen(false);
                    }}
                >
                    <section
                        className="portfolio-collaboration-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="collaboration-modal-title"
                    >
                        <button
                            className="auth-modal-close"
                            type="button"
                            onClick={() => setCollaborationOpen(false)}
                            aria-label="Close collaboration form"
                            disabled={collaborationSubmitting}
                        >
                            <FaTimes aria-hidden="true" />
                        </button>
                        <p className="portfolio-eyebrow"><FaHandshake aria-hidden="true" /> BUILD WITH US</p>
                        <h2 id="collaboration-modal-title">Discuss a collaboration</h2>
                        <p>Your message will be sent to the SmartCampus LMS school contact.</p>
                        {collaborationStatus && (
                            <p className={`portfolio-form-status ${collaborationStatus.type}`} role={collaborationStatus.type === "error" ? "alert" : "status"}>
                                {collaborationStatus.text}
                            </p>
                        )}
                        <form className="portfolio-collaboration-form" onSubmit={handleCollaborationSubmit}>
                            <label>
                                Name (optional)
                                <input
                                    type="text"
                                    maxLength={120}
                                    value={collaborationForm.name}
                                    onChange={(event) => setCollaborationForm((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="Your name"
                                    disabled={collaborationSubmitting}
                                />
                            </label>
                            <label>
                                Email for a reply (optional)
                                <input
                                    type="email"
                                    maxLength={254}
                                    value={collaborationForm.email}
                                    onChange={(event) => setCollaborationForm((current) => ({ ...current, email: event.target.value }))}
                                    placeholder="you@example.com"
                                    disabled={collaborationSubmitting}
                                />
                            </label>
                            <label>
                                Message
                                <textarea
                                    required
                                    maxLength={5000}
                                    rows={4}
                                    value={collaborationForm.message}
                                    onChange={(event) => setCollaborationForm((current) => ({ ...current, message: event.target.value }))}
                                    placeholder="Write your collaboration message here..."
                                    disabled={collaborationSubmitting}
                                />
                            </label>
                            <button className="portfolio-collaboration-link" type="submit" disabled={collaborationSubmitting}>
                                {collaborationSubmitting ? "Sending..." : "Send message"} <FaArrowRight aria-hidden="true" />
                            </button>
                        </form>
                    </section>
                </div>
            )}

            {loginOpen && (
                <div
                    className="auth-modal-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeModals();
                    }}
                >
                    <section
                        className="form-box login-card login-modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="login-title"
                    >
                        <button
                            className="auth-modal-close"
                            type="button"
                            onClick={() => setLoginOpen(false)}
                            aria-label="Close login form"
                        >
                            ×
                        </button>
                        <header className="login-card-heading">
                            <p className="login-eyebrow">THE UNIVERSITY OF THE GAMBIA</p>
                            <h2 id="login-title">
                                {recoveryMode === "request" ? "Recover your account" :
                                    recoveryMode === "reset" ? "Choose a new password" : "Welcome back"}
                            </h2>
                            {recoveryMode && <p>{recoveryMode === "request"
                                ? "Enter your account email."
                                : "Enter a new password."}</p>}
                        </header>

                        {recoveryMode ? (
                            <>
                                {recoveryStatus && <p className="login-success" role="status">{recoveryStatus}</p>}
                                {error && <p className="login-error" role="alert">{error}</p>}
                                <form className="login-form" onSubmit={handleRecoverySubmit}>
                                    {recoveryMode === "request" ? (
                                        <label>
                                            Email address
                                            <input
                                                type="email"
                                                autoComplete="email"
                                                maxLength={254}
                                                required
                                                value={recoveryEmail}
                                                onChange={(event) => setRecoveryEmail(event.target.value)}
                                            />
                                        </label>
                                    ) : (
                                        <>
                                            <label>
                                                New password
                                                <input
                                                    type="password"
                                                    autoComplete="new-password"
                                                    minLength={6}
                                                    required
                                                    value={newPassword}
                                                    onChange={(event) => setNewPassword(event.target.value)}
                                                />
                                            </label>
                                            <label>
                                                Confirm new password
                                                <input
                                                    type="password"
                                                    autoComplete="new-password"
                                                    minLength={6}
                                                    required
                                                    value={confirmPassword}
                                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                                />
                                            </label>
                                        </>
                                    )}
                                    <button className="btn" type="submit" disabled={loading}>
                                        {loading ? "Please wait..." : recoveryMode === "request" ? "Send recovery instructions" : "Reset password"}
                                    </button>
                                </form>
                                <p className="login-register-link">
                                    <button
                                        className="login-register-trigger"
                                        type="button"
                                        onClick={() => {
                                            setRecoveryMode("");
                                            setRecoveryStatus("");
                                            setError("");
                                        }}
                                    >
                                        Back to login
                                    </button>
                                </p>
                            </>
                        ) : (
                            <>
                                {error && <p className="login-error" role="alert">{error}</p>}
                                <div className="google-signin-section">
                                    <p className="google-signin-copy">
                                        Continue with the Google account linked to your SmartCampus LMS account. Choose an account when prompted.
                                    </p>
                                    <GoogleSignInButton
                                        onCredential={handleGoogleCredential}
                                        onError={setError}
                                    />
                                    {loading && <p className="google-signin-loading" role="status">Signing in…</p>}
                                </div>
                                <div className="auth-divider"><span>or use your password</span></div>
                                <form className="login-form" onSubmit={handleSubmit}>
                                    <label>
                                        Email address
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Password
                                        <input
                                            type="password"
                                            name="password"
                                            placeholder="Enter your password"
                                            autoComplete="current-password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                        />
                                    </label>
                                    <button className="btn" type="submit" disabled={loading}>
                                        {loading ? "Signing in..." : "Login"}
                                    </button>
                                </form>
                                <p className="login-register-link">
                                    <button
                                        className="login-register-trigger"
                                        type="button"
                                        onClick={() => {
                                            setRecoveryEmail(formData.email);
                                            setRecoveryStatus("");
                                            setError("");
                                            setRecoveryMode("request");
                                        }}
                                    >
                                        Forgot password?
                                    </button>
                                </p>
                            </>
                        )}
                        {!recoveryMode && <p className="login-register-link">
                            Don&apos;t have an account?{" "}
                            <button
                                className="login-register-trigger"
                                type="button"
                                onClick={() => {
                                    setLoginOpen(false);
                                    openRegister();
                                }}
                            >
                                Create
                            </button>
                        </p>}
                    </section>
                </div>
            )}

            {registerOpen && (
                <Register
                    embedded
                    onClose={() => setRegisterOpen(false)}
                    onSuccess={() => {
                        setRegisterOpen(false);
                        setRegistrationMessage("Account created successfully. You can now log in.");
                    }}
                    onLogin={() => {
                        setRegisterOpen(false);
                        openLogin();
                    }}
                />
            )}
        </main>
    );
};

export default Login;
