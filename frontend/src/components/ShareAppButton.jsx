import { useState } from "react";
import { FaShare } from "react-icons/fa";

const ideaNote = "Why SmartCampus LMS was created\nLearning information can be scattered across course pages, files, messages, and notices. SmartCampus brings the core student and lecturer workflows together so course resources, assignments, communication, and progress are easier to find and manage.";

const ShareAppButton = ({ floating = false, className = "" }) => {
    const [status, setStatus] = useState("");
    const [sharing, setSharing] = useState(false);
    const siteUrl = window.location.origin;

    const shareApp = async () => {
        if (sharing) return;
        setSharing(true);
        setStatus("");
        const logoUrl = new URL("/smartcampus-mark.png", siteUrl).href;
        const text = `THE IDEA\n\n${ideaNote}\n\n${siteUrl}\n\nSmartCampus LMS logo: ${logoUrl}`;

        try {
            if (navigator.share) {
                const imageResponse = await fetch("/smartcampus-mark.png");
                if (!imageResponse.ok) throw new Error("The SmartCampus logo could not be loaded.");
                const logo = new File([await imageResponse.blob()], "smartcampus-logo.png", {
                    type: "image/png"
                });
                const shareData = { title: "SmartCampus LMS", text, url: siteUrl };
                const fileShareSupported = navigator.canShare?.({ files: [logo] }) === true;
                await navigator.share(fileShareSupported ? { ...shareData, files: [logo] } : shareData);
                setStatus(fileShareSupported
                    ? "SmartCampus link and logo shared."
                    : "SmartCampus link shared. This browser could not attach the logo.");
                return;
            }

            if (!navigator.clipboard?.writeText) {
                throw new Error("Sharing is unavailable in this browser.");
            }
            await navigator.clipboard.writeText(text);
            setStatus("The SmartCampus note and website link were copied.");
        } catch (error) {
            if (error.name !== "AbortError") {
                setStatus(error.message || "Unable to share SmartCampus.");
            }
        } finally {
            setSharing(false);
        }
    };

    return (
        <div className={`share-app-action${floating ? " share-app-floating" : " share-app-settings"} ${className}`.trim()}>
            <button
                type="button"
                className="share-app-button"
                onClick={shareApp}
                disabled={sharing}
                aria-label={floating ? "Share SmartCampus LMS" : undefined}
                title="Share SmartCampus LMS"
            >
                <FaShare aria-hidden="true" />
                <span>{sharing ? "Sharing..." : "Share SmartCampus"}</span>
            </button>
            {status && <span className="share-app-status" role="status">{status}</span>}
        </div>
    );
};

export default ShareAppButton;
