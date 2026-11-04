require("./config/env");

const express = require("express");
const initializeDatabase = require("./utils/initializeDatabase");
const api = require("./app");

const app = express();

app.get(["/health/live", "/api/health/live"], (req, res) => {
    res.json({ status: "ok" });
});

app.use(async (req, res, next) => {
    try {
        await initializeDatabase();
        next();
    } catch (error) {
        console.error("Vercel API database initialization failed:", error.message);
        res.status(503).json({ message: "The API database is temporarily unavailable" });
    }
});
app.use(api);

module.exports = app;
