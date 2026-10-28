const defaultApiUrl = import.meta.env.DEV
    ? "http://localhost:5000"
    : "";
const API_BASE = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, "");

export default API_BASE;
