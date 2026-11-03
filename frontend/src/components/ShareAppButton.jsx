import { useState } from "react";
import { FaShare } from "react-icons/fa";

const shareText = "The First Digital Campus Platform for the University of The Gambia. Connect to courses, learning materials, assignments, and campus updates with SmartCampus LMS.";

const ShareAppButton = ({ floating = false, className = "" }) => {
    const [status, setStatus] = useState("");
    const [sharing, setSharing] = useState(false);
    const siteUrl = window.location.origin;

    const shareApp = async () => {
        if (sharing) return;
        setSharing(true);
        setStatus("");

        try {
            if (navigator.share) {
                await navigator.share({
                    title: "UTG-SmartCampusLMS-Community",
                    text: shareText,
                    url: siteUrl
                });
                setStatus("SmartCampus website shared.");
                return;
            }

            if (!navigator.clipboard?.writeText) {
                throw new Error("Sharing is unavailable in this browser.");
            }
            await navigator.clipboard.writeText(`${shareText}\n${siteUrl}`);
            setStatus("The SmartCampus message and website link were copied.");
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
