const { sequelize } = require("../config/db");
const connectDB = sequelize.connectDB;
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
