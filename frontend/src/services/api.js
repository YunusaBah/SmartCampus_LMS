import axios from "axios";
import API_BASE from "../config";
import {
    invalidateOfflineResponsesForAccount,
    isFreshOfflineResponse,
    readOfflineResponse,
    saveOfflineResponse
} from "./offlineCache";

const backgroundRefreshes = new Set();
const API = axios.create({
    baseURL: `${API_BASE}/api`,
    timeout: 90000,
    headers: {
        "Content-Type": "application/json"
    }
});

const requestNetworkGet = API.get.bind(API);

const getAccountId = () => {
    try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        return user?.id == null ? null : String(user.id);
    } catch {
        return null;
    }
};

const toCachedResponse = (entry, config) => ({
    data: entry.data,
    status: 200,
    statusText: "OK (cached)",
    headers: {},
    config,
    request: undefined
});

const cacheKeyFor = (accountId, url, config) => {
    const requestConfig = {
        ...config,
        baseURL: `${API_BASE}/api`,
        url,
        method: "get"
    };
    return `${accountId}:${API.getUri(requestConfig)}`;
};

API.get = (url, config = {}) => {
    const { skipOfflineCache, ...networkConfig } = config;
    if (skipOfflineCache) return requestNetworkGet(url, {
        ...networkConfig,
        timeout: networkConfig.timeout ?? 15000
    });

    const accountId = getAccountId();
    if (!accountId) return requestNetworkGet(url, config);

    const cacheKey = cacheKeyFor(accountId, url, config);
    const cacheNetworkConfig = {
        ...networkConfig,
        timeout: networkConfig.timeout ?? 15000
    };
    const returnCachedResponse = (cachedEntry) => {
        if (navigator.onLine && !isFreshOfflineResponse(cachedEntry) && !backgroundRefreshes.has(cacheKey)) {
            backgroundRefreshes.add(cacheKey);
            const refreshConfig = { ...cacheNetworkConfig };
            delete refreshConfig.signal;
            requestNetworkGet(url, refreshConfig)
                .then(async (response) => {
                    await saveOfflineResponse(cacheKey, response.data);
                    if (!(typeof Blob !== "undefined" && response.data instanceof Blob)) {
                        window.dispatchEvent(new CustomEvent("smartcampus:offline-cache-updated", {
                            detail: { url }
                        }));
                    }
                })
                .catch((error) => {
                    if (!error.response || error.response.status >= 500) {
                        window.dispatchEvent(new Event("smartcampus:api-offline"));
                    }
                })
                .finally(() => backgroundRefreshes.delete(cacheKey));
        }
        return toCachedResponse(cachedEntry, config);
    };

    const cachedEntry = readOfflineResponse(cacheKey).catch((error) => {
        console.warn("Could not read SmartCampus offline cache:", error);
        return null;
    });

    return cachedEntry.then((entry) => {
        if (entry) return returnCachedResponse(entry);
        return requestNetworkGet(url, cacheNetworkConfig).then(async (response) => {
            try {
                await saveOfflineResponse(cacheKey, response.data);
            } catch (error) {
                console.warn("Could not save SmartCampus offline data:", error);
            }
            return response;
        }).catch((error) => {
            if (!error.response || error.response.status >= 500) {
                window.dispatchEvent(new Event("smartcampus:api-offline"));
            }
            throw error;
        });
    });
};

API.interceptors.request.use(
    (config) => {
        if (config.method !== "get" && !navigator.onLine) {
            return Promise.reject(new Error("You are offline. Reconnect to save changes."));
        }

        const token = localStorage.getItem("token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

API.interceptors.response.use(
    (response) => {
        if (response.config.method !== "get") {
            const accountId = getAccountId();
            if (accountId) {
                invalidateOfflineResponsesForAccount(accountId)
                    .catch((error) => console.warn("Could not mark SmartCampus offline data for refresh:", error));
                window.dispatchEvent(new Event("smartcampus:offline-cache-updated"));
            }
        }
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.dispatchEvent(new Event("smartcampus:account-changed"));

            if (window.location.pathname !== "/login") {
                const invitationCode = window.location.pathname === "/invite"
                    ? new URLSearchParams(window.location.search).get("code")
                    : null;
                const loginPath = invitationCode
                    ? `/login?join=${encodeURIComponent(invitationCode)}`
                    : "/login";
                window.location.href = loginPath;
            }
        }

        return Promise.reject(error);
    }
);

export default API;
