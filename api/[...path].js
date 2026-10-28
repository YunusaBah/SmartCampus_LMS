require("../backend/src/config/env");

const app = require("../backend/src/app");
const initializeDatabase = require("../backend/src/utils/initializeDatabase");

module.exports = async (req, res) => {
    try {
        await initializeDatabase();
    } catch (error) {
        console.error("Vercel API database initialization failed:", error.message);
        return res.status(503).json({ message: "The API database is temporarily unavailable" });
    }

    return app(req, res);
};
