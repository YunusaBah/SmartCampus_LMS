const API_BASE = import.meta.env.DEV
    ? (import.meta.env.VITE_API_URL?.trim() || "http://localhost:5000").replace(/\/+$/, "")
    : "";

export default API_BASE;
