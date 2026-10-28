import { useEffect, useRef, useState } from "react";

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

const GoogleSignInButton = ({ text = "signin_with", onCredential, onError }) => {
    const containerRef = useRef(null);
    const credentialHandler = useRef(onCredential);
    const errorHandler = useRef(onError);
    const [ready, setReady] = useState(false);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    useEffect(() => {
        credentialHandler.current = onCredential;
        errorHandler.current = onError;
    }, [onCredential, onError]);

    useEffect(() => {
        if (!clientId || !containerRef.current) return undefined;
        let active = true;
        loadGoogleIdentity()
            .then((googleIdentity) => {
                if (!active || !containerRef.current) return;
                googleIdentity.initialize({
                    client_id: clientId,
                    callback: (response) => {
                        if (response.credential) credentialHandler.current(response.credential);
                        else errorHandler.current?.("Google did not return a sign-in credential.");
                    }
                });
                containerRef.current.replaceChildren();
                googleIdentity.renderButton(containerRef.current, {
                    theme: "outline",
                    size: "large",
                    shape: "rectangular",
                    text,
                    width: Math.min(360, containerRef.current.clientWidth || 360)
                });
                setReady(true);
            })
            .catch((error) => errorHandler.current?.(error.message));

        return () => { active = false; };
    }, [clientId, text]);

    if (!clientId) {
        return <p className="google-signin-notice" role="status">
            Google sign-in isn&apos;t configured for this site yet. You can use your email and password, or ask
            the site administrator to add the Google OAuth client ID and redeploy.
        </p>;
    }

    return (
        <div className="google-signin-wrap">
            {!ready && <span className="google-signin-loading" role="status">Loading Google sign-in…</span>}
            <div className="google-signin-button" ref={containerRef} />
        </div>
    );
};

export default GoogleSignInButton;
