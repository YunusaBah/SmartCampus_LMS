const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Keep deployment configuration tolerant of common naming differences. Vercel
// environment variable names are case-sensitive, so normalize these once at
// startup instead of duplicating fallbacks throughout the application.
if (!process.env.GOOGLE_CLIENT_ID && process.env.VITE_GOOGLE_CLIENT_ID) {
    process.env.GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
}
if (!process.env.CLIENT_URL) {
    const clientUrl = process.env.cLIENT_URL || process.env.VITE_CLIENT_URL;
    if (clientUrl) process.env.CLIENT_URL = clientUrl;
}
