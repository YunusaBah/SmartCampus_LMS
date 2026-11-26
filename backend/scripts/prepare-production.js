require("../src/config/env");

const { sequelize, connectDB } = require("../src/config/db");
require("../src/models/associations");
const runMigrations = require("../src/utils/runMigrations");
const runChatSecurity = require("../src/utils/chatSecurity");

const prepareProductionDatabase = async () => {
    await connectDB();
    console.log("Applying SmartCampus database migrations...");
    await runMigrations();
    console.log("Synchronizing newly introduced Sequelize models...");
    await sequelize.sync();
    console.log("Applying chat database security policies...");
    await runChatSecurity();
    console.log("Production database preparation completed.");
};

prepareProductionDatabase()
    .catch((error) => {
        console.error("Production database preparation failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await sequelize.close();
    });
