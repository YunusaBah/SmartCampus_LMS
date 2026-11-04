const database = require("../config/db");
const sequelize = database.sequelize;
const connectDB = database.connectDB;
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
            if (runMigrations.ensureIdentityIndexes) {
                await runMigrations.ensureIdentityIndexes();
            }
            await runChatSecurity();
            console.log("Database synced");
        })().catch((error) => {
            databaseInitialization = undefined;
            throw error;
        });
    }

    return databaseInitialization;
};
