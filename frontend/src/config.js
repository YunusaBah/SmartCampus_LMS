const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || "";
const configuredApiHost = (() => {
    if (!configuredApiUrl) return "";

    try {
        return new URL(configuredApiUrl).hostname;
    } catch {
        return "";
    }
})();
const isLocalhostApi = configuredApiHost === "localhost"
    || configuredApiHost.endsWith(".localhost")
    || configuredApiHost === "[::1]"
    || /^127(?:\.\d{1,3}){3}$/.test(configuredApiHost);

if (import.meta.env.PROD && isLocalhostApi) {
    console.warn("Ignoring VITE_API_URL pointing to localhost in production; using same-origin /api routes.");
}

const defaultApiUrl = import.meta.env.DEV ? "http://localhost:5000" : "";
const API_BASE = (
    import.meta.env.PROD && isLocalhostApi
        ? ""
        : configuredApiUrl || defaultApiUrl
).replace(/\/$/, "");

export default API_BASE;
