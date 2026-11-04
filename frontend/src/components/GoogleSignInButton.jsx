import { useEffect, useRef, useState } from "react";
import API from "../services/api";

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
let scriptPromise;

const loadGoogleIdentity = () => {
    if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const script = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`) || document.createElement("script");
            script.src = GOOGLE_SCRIPT;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (window.google?.accounts?.id) resolve(window.google.accounts.id);
                else reject(new Error("Google sign-in did not initialize."));
            };
            script.onerror = () => {
                scriptPromise = undefined;
                reject(new Error("Google sign-in could not load. Check your internet connection."));
            };
            if (!script.isConnected) document.head.appendChild(script);
        });
    }
    return scriptPromise;
};

const GoogleSignInButton = ({ onCredential, onError }) => {
    const containerRef = useRef(null);
    const credentialHandler = useRef(onCredential);
    const errorHandler = useRef(onError);
    const [ready, setReady] = useState(false);
    const frontendClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    const [clientId, setClientId] = useState(frontendClientId);
    const [configLoaded, setConfigLoaded] = useState(Boolean(frontendClientId));
    const [configError, setConfigError] = useState("");

    useEffect(() => {
        credentialHandler.current = onCredential;
        errorHandler.current = onError;
    }, [onCredential, onError]);

    useEffect(() => {
        if (clientId) return undefined;
        let active = true;

        API.get("/auth/config", { skipOfflineCache: true })
            .then((response) => {
                if (!active) return;
                const configuredClientId = response.data?.googleClientId;
                if (typeof configuredClientId === "string" && configuredClientId.trim()) {
                    setClientId(configuredClientId.trim());
                } else {
                    setConfigError("Google sign-in isn't configured. You can use your email and password.");
                }
                setConfigLoaded(true);
            })
            .catch(() => {
                if (!active) return;
                setConfigError("Google sign-in couldn't be loaded. You can use your email and password.");
                setConfigLoaded(true);
            });

        return () => { active = false; };
    }, [clientId]);

    useEffect(() => {
        if (!clientId || !containerRef.current) return undefined;
        let active = true;
        loadGoogleIdentity()
            .then((googleIdentity) => {
                if (!active || !containerRef.current) return;
                googleIdentity.initialize({
                    client_id: clientId,
                    auto_select: false,
                    callback: (response) => {
                        if (response.credential) credentialHandler.current(response.credential);
                        else errorHandler.current?.("Google did not return a sign-in credential.");
                    }
                });
                containerRef.current.replaceChildren();
                googleIdentity.renderButton(containerRef.current, {
                    type: "icon",
                    theme: "outline",
                    size: "large",
                    shape: "circle"
                });
                setReady(true);
            })
            .catch((error) => errorHandler.current?.(error.message));

        return () => { active = false; };
    }, [clientId]);

    if (!clientId && configLoaded) {
        return <p className="google-signin-notice" role="status">
            {configError || "Google sign-in isn't configured. You can use your email and password."}
        </p>;
    }

    return (
        <div className="google-signin-wrap">
            {!ready && <span className="google-signin-loading" role="status">
                {configLoaded ? "Loading Google sign-in…" : "Checking Google sign-in…"}
            </span>}
            <div className="google-signin-button" ref={containerRef} />
        </div>
    );
};

export default GoogleSignInButton;
