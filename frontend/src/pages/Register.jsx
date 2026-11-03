import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";
import GoogleSignInButton from "../components/GoogleSignInButton";

const saveSession = (result) => {
    localStorage.setItem("token", result.data.token);
    localStorage.setItem("user", JSON.stringify(result.data.user));
    window.dispatchEvent(new Event("smartcampus:account-changed"));
};

const Register = ({ embedded = false, onClose, onSuccess, onLogin }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        matNumber: "",
        phone: "",
        role: "student"
    });
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [registrationMethod, setRegistrationMethod] = useState("");
    const [googleCredential, setGoogleCredential] = useState("");
    const [verifiedAccount, setVerifiedAccount] = useState(null);

    useEffect(() => {
        if (!embedded) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose?.();
        };

        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [embedded, onClose]);

    const finishSignup = (result) => {
        saveSession(result);
        if (onSuccess) onSuccess();
        const code = new URLSearchParams(location.search).get("join");
        navigate(code ? `/invite?code=${encodeURIComponent(code)}` : "/dashboard", { replace: true });
    };

    const completeRegistration = async (credential, profile = {}) => {
        setLoading(true);
        setError("");
        setMessage("");
        try {
            const response = await API.post("/auth/google/register", {
                credential,
                role: formData.role,
                ...profile
            });
            finishSignup(response);
        } catch (registrationError) {
            if (registrationError.response?.status === 428 &&
                registrationError.response.data?.profileRequired) {
                setGoogleCredential(credential);
                setVerifiedAccount(registrationError.response.data.profile);
                setFormData((current) => ({
                    ...current,
                    fullName: registrationError.response.data.profile.fullName
                }));
                setMessage("Google verified your account. Add the required student details to finish.");
            } else {
                setError(registrationError.response?.data?.message || (
                    registrationError.code === "ECONNABORTED" || registrationError.code === "ERR_NETWORK"
                        ? "Unable to connect to SmartCampus. Check your connection and try again."
                        : "Google registration failed. Please try again."
                ));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCredential = (credential) => {
        if (loading) return;
        completeRegistration(credential);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!googleCredential) return;
        await completeRegistration(googleCredential, {
            fullName: formData.fullName,
            matNumber: formData.matNumber,
            phone: formData.phone
        });
    };

    const handleEmailSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (formData.password !== formData.confirmPassword) {
            setError("The passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const response = await API.post("/auth/register", {
                fullName: formData.fullName,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                matNumber: formData.role === "student" ? formData.matNumber : undefined,
                phone: formData.role === "student" ? formData.phone : undefined
            });
            finishSignup(response);
        } catch (registrationError) {
            setError(registrationError.response?.data?.message || (
                registrationError.code === "ECONNABORTED" || registrationError.code === "ERR_NETWORK"
                    ? "Unable to connect to SmartCampus. Check your connection and try again."
                    : "Account creation failed. Please try again."
            ));
        } finally {
            setLoading(false);
        }
    };

    const changeSignupMethod = (method) => {
        setRegistrationMethod(method);
        setGoogleCredential("");
        setVerifiedAccount(null);
        setError("");
        setMessage("");
    };

    const formCard = (
        <section
            className={`form-box register-card${embedded ? " register-modal-card" : ""}`}
            aria-labelledby="register-title"
            role={embedded ? "dialog" : undefined}
            aria-modal={embedded ? "true" : undefined}
        >
            {embedded && (
                <button
                    className="register-modal-close"
                    type="button"
                    onClick={onClose}
                    aria-label="Close registration form"
                >
                    ×
                </button>
            )}
            <header className="register-heading">
                <p className="register-eyebrow">THE UNIVERSITY OF THE GAMBIA</p>
                <h2 id="register-title">Create your account</h2>
                <p>Choose your account type and how you want to sign up.</p>
            </header>

            {error && <p className="register-error" role="alert">{error}</p>}
            {message && <p className="login-success" role="status">{message}</p>}

            <label className="register-account-notice">
                Account type
                <select
                    name="role"
                    value={formData.role}
                    onChange={(event) => {
                        setFormData((current) => ({
                            ...current,
                            role: event.target.value,
                            matNumber: "",
                            phone: ""
                        }));
                        setError("");
                        setMessage("");
                    }}
                >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                </select>
            </label>

            {formData.role && !registrationMethod && (
                <div className="register-method-picker">
                    <p className="google-signin-copy">
                        Sign up as a {formData.role} using your email and password, or continue with Google.
                    </p>
                    <button className="btn register-submit" type="button" onClick={() => changeSignupMethod("email")}>
                        Sign up with email
                    </button>
                    <div className="auth-divider"><span>or</span></div>
                    <GoogleSignInButton
                        text="signup_with"
                        onCredential={(credential) => {
                            setRegistrationMethod("google");
                            handleCredential(credential);
                        }}
                        onError={setError}
                    />
                    {loading && <p className="google-signin-loading" role="status">Verifying your Google account…</p>}
                </div>
            )}

            {registrationMethod === "email" && (
                <>
                    <form className="register-form" onSubmit={handleEmailSubmit}>
                        <label>
                            Full name
                            <input
                                type="text"
                                name="fullName"
                                autoComplete="name"
                                value={formData.fullName}
                                onChange={(event) => setFormData((current) => ({
                                    ...current,
                                    fullName: event.target.value
                                }))}
                                minLength={2}
                                maxLength={255}
                                required
                            />
                        </label>
                        {formData.role === "student" && (
                            <>
                                <label>
                                    Student ID / matriculation number
                                    <input
                                        type="text"
                                        name="matNumber"
                                        autoComplete="off"
                                        value={formData.matNumber}
                                        onChange={(event) => setFormData((current) => ({
                                            ...current,
                                            matNumber: event.target.value
                                        }))}
                                        maxLength={50}
                                        required
                                    />
                                </label>
                                <label>
                                    Phone number <span className="register-optional">(optional)</span>
                                    <input
                                        type="tel"
                                        name="phone"
                                        autoComplete="tel"
                                        value={formData.phone}
                                        onChange={(event) => setFormData((current) => ({
                                            ...current,
                                            phone: event.target.value
                                        }))}
                                        maxLength={30}
                                    />
                                </label>
                            </>
                        )}
                        <label>
                            Email address
                            <input
                                type="email"
                                name="email"
                                autoComplete="email"
                                maxLength={254}
                                value={formData.email}
                                onChange={(event) => setFormData((current) => ({
                                    ...current,
                                    email: event.target.value
                                }))}
                                required
                            />
                        </label>
                        <label>
                            Password
                            <input
                                type="password"
                                name="password"
                                autoComplete="new-password"
                                minLength={6}
                                value={formData.password}
                                onChange={(event) => setFormData((current) => ({
                                    ...current,
                                    password: event.target.value
                                }))}
                                required
                            />
                            <small className="register-field-hint">Use at least 6 characters.</small>
                        </label>
                        <label>
                            Confirm password
                            <input
                                type="password"
                                name="confirmPassword"
                                autoComplete="new-password"
                                minLength={6}
                                value={formData.confirmPassword}
                                onChange={(event) => setFormData((current) => ({
                                    ...current,
                                    confirmPassword: event.target.value
                                }))}
                                required
                            />
                        </label>
                        <button className="btn register-submit" type="submit" disabled={loading}>
                            {loading ? "Creating account…" : "Create account"}
                        </button>
                    </form>
                    <button className="register-method-back" type="button" onClick={() => changeSignupMethod("")}>
                        Choose another sign-up method
                    </button>
                </>
            )}

            {googleCredential && verifiedAccount && formData.role === "student" && (
                <>
                    <form className="register-form" onSubmit={handleSubmit}>
                        <label className="verified-email">
                            Verified Google email
                            <input type="email" value={verifiedAccount.email} readOnly />
                        </label>
                        <label>
                            Full name
                            <input
                                type="text"
                                name="fullName"
                                autoComplete="name"
                                value={formData.fullName}
                                onChange={(event) => setFormData((current) => ({
                                    ...current,
                                    fullName: event.target.value
                                }))}
                                minLength={2}
                                maxLength={255}
                                required
                            />
                        </label>
                        <label>
                            Student ID / matriculation number
                            <input
                                type="text"
                                name="matNumber"
                                autoComplete="off"
                                value={formData.matNumber}
                                onChange={(event) => setFormData((current) => ({
                                    ...current,
                                    matNumber: event.target.value
                                }))}
                                maxLength={50}
                                required
                            />
                        </label>
                        <label>
                            Phone number <span className="register-optional">(optional)</span>
                            <input
                                type="tel"
                                name="phone"
                                autoComplete="tel"
                                value={formData.phone}
                                onChange={(event) => setFormData((current) => ({
                                    ...current,
                                    phone: event.target.value
                                }))}
                                maxLength={30}
                            />
                        </label>
                        <button className="btn register-submit" type="submit" disabled={loading}>
                            {loading ? "Creating account…" : "Complete student registration"}
                        </button>
                    </form>
                    <button className="register-method-back" type="button" onClick={() => changeSignupMethod("")}>
                        Choose another sign-up method
                    </button>
                </>
            )}

            <p className="register-login-link">
                Already have an account?{" "}
                {onLogin
                    ? <button type="button" onClick={onLogin}>Login</button>
                    : embedded
                        ? <button type="button" onClick={onClose}>Login</button>
                        : <Link to="/login">Login</Link>}
            </p>
        </section>
    );

    if (!embedded) return formCard;

    return (
        <div
            className="register-modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            {formCard}
        </div>
    );
};

export default Register;
