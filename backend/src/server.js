require("./config/env");

const fs = require("fs");
const path = require("path");

const app = require("./app");
const { sequelize, connectDB } = require("./config/db");
require("./models/associations");
const connectDatabaseWithRetry = require("./utils/connectDatabaseWithRetry");
const runMigrations = require("./utils/runMigrations");
const runChatSecurity = require("./utils/chatSecurity");
const sendDeadlineReminders = require("./utils/deadlineReminders");
const { isValidJwtSecret } = require("./utils/authConfiguration");

const uploadsDir = require("./utils/uploadsDirectory");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (process.env.NODE_ENV === "production" && !process.env.UPLOADS_DIR) {
    console.warn("UPLOADS_DIR is unset; uploaded course and submission files are on ephemeral local storage.");
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

const validateEnvironment = () => {
    if (!isValidJwtSecret(process.env.JWT_SECRET)) {
        throw new Error("Set JWT_SECRET to a random value of at least 32 characters");
    }
    if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
        throw new Error("PORT must be a valid port number");
    }
};

const startServer = async () => {
    try {
        validateEnvironment();
        await connectDatabaseWithRetry(connectDB);
        console.log("Applying database migrations...");
        await runMigrations();
        console.log("Synchronizing database models...");
        await sequelize.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'enum_ChatMessages_type'
                      AND n.nspname = 'public'
                ) THEN
                    ALTER TYPE public."enum_ChatMessages_type" ADD VALUE IF NOT EXISTS 'voice';
                    ALTER TYPE public."enum_ChatMessages_type" ADD VALUE IF NOT EXISTS 'image';
                    ALTER TYPE public."enum_ChatMessages_type" ADD VALUE IF NOT EXISTS 'file';
                    ALTER TYPE public."enum_ChatMessages_type" ADD VALUE IF NOT EXISTS 'contact';
                END IF;
            END
            $$;
        `);
        await sequelize.sync();
        console.log("Configuring chat database security...");
        await runChatSecurity();
        console.log("Database synced");

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
        const runReminderSweep = () => {
            sendDeadlineReminders().catch((error) => {
                console.error("Deadline reminder sweep failed:", error.message);
            });
        };
        runReminderSweep();
        const reminderTimer = setInterval(runReminderSweep, 15 * 60 * 1000);
        reminderTimer.unref();
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();
