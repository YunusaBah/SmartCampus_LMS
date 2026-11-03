import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";
import RouteBackButton from "../components/RouteBackButton";

const readUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
};

const JoinClass = ({ invitationMode = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const invitationCode = (params.get("code") || "").trim().toUpperCase();
    const token = localStorage.getItem("token");
    const user = readUser();
    const [code, setCode] = useState(invitationCode);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const attemptedCode = useRef("");

    const joinClass = useCallback(async (classCode) => {
        setError("");
        setSuccess("");
        setLoading(true);
        try {
            const response = await API.post("/enrollments/join", {
                classCode: classCode.toUpperCase().trim()
            });
            setSuccess(response.data.message || `Successfully joined "${response.data.course.title}"!`);
            window.dispatchEvent(new Event("smartcampus:dashboard-refresh"));
            window.dispatchEvent(new Event("smartcampus:courses-refresh"));
            window.setTimeout(() => {
                navigate(`/courses/${response.data.course.id}?section=materials`, { replace: true });
            }, 900);
        } catch (joinError) {
            setError(joinError.response?.data?.message || "Failed to join class.");
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (!invitationCode || !token || user?.role !== "student" || attemptedCode.current === invitationCode) return;
        attemptedCode.current = invitationCode;
        joinClass(invitationCode);
    }, [invitationCode, joinClass, token, user?.role]);

    const handleJoin = (event) => {
        event.preventDefault();
        joinClass(code);
    };

    if (invitationMode && !token) {
        const loginPath = `/login?join=${encodeURIComponent(invitationCode)}`;
        const registerPath = `/register?join=${encodeURIComponent(invitationCode)}`;

        return (
            <div className="join-invitation-page">
                <section className="join-invitation-card">
                    <span className="join-invitation-mark" aria-hidden="true">SC</span>
                    <p className="eyebrow">SMARTCAMPUS COURSE INVITATION</p>
                    <h1>{invitationCode ? "Join your class" : "Join a SmartCampus class"}</h1>
                    <p>
                        {invitationCode
                            ? "Sign in or create a student account and we’ll add you to this class automatically."
                            : "Sign in or create a student account to join a class with your lecturer’s code."}
                    </p>
                    {invitationCode && (
                        <div className="join-invitation-code">
                            <span>CLASS CODE</span>
                            <strong>{invitationCode}</strong>
                        </div>
                    )}
                    <div className="join-invitation-actions">
                        <Link className="btn btn-inline" to={loginPath}>Login to join</Link>
                        <Link className="btn btn-secondary btn-inline" to={registerPath}>Create student account</Link>
                    </div>
                    {!invitationCode && (
                        <p className="join-invitation-manual-link">
                            After signing in, open Join a class from your dashboard to enter your code.
                        </p>
                    )}
                    <Link className="join-invitation-home" to="/login">Back to SmartCampus</Link>
                </section>
            </div>
        );
    }

    if (token && user?.role !== "student") {
        return (
            <div className="page-content">
                <div className="dashboard-alert" role="alert">
                    <strong>Student account required</strong>
                    <span>Class invitations can only be used with a student account.</span>
                    <Link to="/dashboard" className="btn btn-inline">Go to dashboard</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page-content">
            <RouteBackButton className="course-manage-back" label="Back to courses" />
            <div className="form-box join-class-card">
                <h2>{invitationCode ? "Joining your class" : "Join a Class"}</h2>
                <p style={{ color: "var(--theme-muted)", marginBottom: 20, fontSize: "0.9rem" }}>
                    {invitationCode
                        ? "We’re adding this class to your dashboard."
                        : "Enter the 6-8 character code your lecturer gave you."}
                </p>
                {error && <p className="register-error" role="alert">{error}</p>}
                {success && <p className="login-success" role="status">{success}</p>}
                {!invitationCode && (
                    <form onSubmit={handleJoin}>
                        <input
                            type="text"
                            placeholder="e.g. ABC123"
                            value={code}
                            onChange={(event) => setCode(event.target.value.toUpperCase())}
                            maxLength={8}
                            required
                            style={{
                                letterSpacing: "0.3em",
                                fontSize: "1.4rem",
                                textAlign: "center",
                                fontWeight: 700
                            }}
                        />
                        <button className="btn" type="submit" disabled={loading || code.length < 6} style={{ marginTop: 12 }}>
                            {loading ? "Joining..." : "Join Class"}
                        </button>
                    </form>
                )}
                {invitationCode && error && (
                    <form onSubmit={handleJoin}>
                        <label htmlFor="retry-class-code">You can edit the code and try again</label>
                        <input
                            id="retry-class-code"
                            type="text"
                            value={code}
                            onChange={(event) => setCode(event.target.value.toUpperCase())}
                            maxLength={8}
                            required
                        />
                        <button className="btn" type="submit" disabled={loading || code.length < 6} style={{ marginTop: 12 }}>
                            {loading ? "Joining..." : "Try code again"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default JoinClass;
