const { connectDB } = require("../config/db");
require("../models/associations");

// A serverless instance should only establish its database connection.
// Schema migrations, Sequelize sync, indexes, and database security policies
// are deployment tasks and must not run on user requests/cold starts.
let databaseConnection;

module.exports = () => {
    if (!databaseConnection) {
        databaseConnection = connectDB().catch((error) => {
            databaseConnection = undefined;
            throw error;
        });
    }

    return databaseConnection;
};
