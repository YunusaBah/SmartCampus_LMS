import { lazy, Suspense, useEffect, useState } from "react";
import { FaCommentDots } from "react-icons/fa";
import { getUser } from "../hooks/useAuth";

const FloatingChat = lazy(() => import("./FloatingChat"));

const FloatingChatHost = () => {
    const [user, setUser] = useState(getUser);
    const [activated, setActivated] = useState(false);
    const [shareAnnouncement, setShareAnnouncement] = useState(null);

    useEffect(() => {
        const openShare = (event) => {
            setShareAnnouncement({
                ...event.detail,
                requestId: `${Date.now()}-${Math.random()}`
            });
            setActivated(true);
        };
        const syncAccount = () => {
            setUser(getUser());
            setActivated(false);
            setShareAnnouncement(null);
        };
        window.addEventListener("smartcampus:share-announcement", openShare);
        window.addEventListener("smartcampus:account-changed", syncAccount);
        window.addEventListener("storage", syncAccount);
        return () => {
            window.removeEventListener("smartcampus:share-announcement", openShare);
            window.removeEventListener("smartcampus:account-changed", syncAccount);
            window.removeEventListener("storage", syncAccount);
        };
    }, []);

    if (user?.role !== "student") return null;

    if (activated) {
        return (
            <Suspense fallback={null}>
                <FloatingChat
                    key={shareAnnouncement?.requestId || "chat"}
                    initialOpen
                    initialShare={shareAnnouncement}
                />
            </Suspense>
        );
    }

    return (
        <button
            type="button"
            className="floating-chat-launcher"
            aria-label="Open chats"
            aria-expanded="false"
            onClick={() => setActivated(true)}
        >
            <FaCommentDots aria-hidden="true" />
        </button>
    );
};

export default FloatingChatHost;
