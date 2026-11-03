const { sequelize, connectDB } = require("../config/db");
require("../models/associations");
const runMigrations = require("./runMigrations");
const runChatSecurity = require("./chatSecurity");

let databaseInitialization;

module.exports = () => {
    if (!databaseInitialization) {
        databaseInitialization = (async () => {
            await connectDB();
            await runMigrations();
            await sequelize.sync();
            await runChatSecurity();
            console.log("Database synced");
        })().catch((error) => {
            databaseInitialization = undefined;
            throw error;
        });
    }

    return databaseInitialization;
};
