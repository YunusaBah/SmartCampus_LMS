require("../backend/src/config/env");

const app = require("../backend/src/app");
const { sequelize, connectDB } = require("../backend/src/config/db");
require("../backend/src/models/associations");
const runMigrations = require("../backend/src/utils/runMigrations");

let databaseInitialization;

const initializeDatabase = () => {
    if (!databaseInitialization) {
        databaseInitialization = (async () => {
            await connectDB();
            await runMigrations();
            await sequelize.sync();
            console.log("Database synced");
        })().catch((error) => {
            databaseInitialization = undefined;
            throw error;
        });
    }

    return databaseInitialization;
};

module.exports = async (req, res) => {
    try {
        await initializeDatabase();
    } catch (error) {
        console.error("Vercel API database initialization failed:", error.message);
        return res.status(503).json({ message: "The API database is temporarily unavailable" });
    }

    return app(req, res);
};
