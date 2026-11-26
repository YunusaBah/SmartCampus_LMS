import { useEffect, useState } from "react";

let activeSubscribers = 0;
let refreshTimer;

const requestRefresh = () => {
    if (navigator.onLine && document.visibilityState === "visible") {
        window.dispatchEvent(new Event("smartcampus:offline-cache-updated"));
    }
};

const useOfflineRefresh = () => {
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const handleCacheUpdate = () => setRevision((current) => current + 1);
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") requestRefresh();
        };

        window.addEventListener("smartcampus:offline-cache-updated", handleCacheUpdate);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        activeSubscribers += 1;

        if (!refreshTimer) {
            // This is a stale-cache fallback, not a real-time transport.
            // Realtime features handle immediate updates; keep fallback refreshes
            // less frequent and avoid network work for background tabs.
            refreshTimer = window.setInterval(requestRefresh, 60_000);
            window.addEventListener("online", requestRefresh);
        }

        return () => {
            window.removeEventListener("smartcampus:offline-cache-updated", handleCacheUpdate);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            activeSubscribers -= 1;

            if (activeSubscribers === 0) {
                window.clearInterval(refreshTimer);
                refreshTimer = undefined;
                window.removeEventListener("online", requestRefresh);
            }
        };
    }, []);

    return revision;
};

export default useOfflineRefresh;
