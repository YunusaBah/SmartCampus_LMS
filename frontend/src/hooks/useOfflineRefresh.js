import { useEffect, useState } from "react";

let activeSubscribers = 0;
let refreshTimer;

const requestRefresh = () => {
    if (navigator.onLine) window.dispatchEvent(new Event("smartcampus:offline-cache-updated"));
};

const useOfflineRefresh = () => {
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const handleCacheUpdate = () => setRevision((current) => current + 1);
        window.addEventListener("smartcampus:offline-cache-updated", handleCacheUpdate);
        activeSubscribers += 1;
        if (!refreshTimer) {
            refreshTimer = window.setInterval(requestRefresh, 30_000);
            window.addEventListener("online", requestRefresh);
        }
        return () => {
            window.removeEventListener("smartcampus:offline-cache-updated", handleCacheUpdate);
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
