const { Sequelize } = require("sequelize");
const fs = require("node:fs");
require("./env");

const databaseUrl = process.env.DATABASE_URL;
const dialect = (process.env.DB_DIALECT || "postgres").toLowerCase();
if (dialect !== "postgres") {
    throw new Error("DB_DIALECT must be postgres");
}

if (!databaseUrl) {
    const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing required database configuration: ${missing.join(", ")} or DATABASE_URL`);
    }
}

const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;
if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new Error("DB_PORT must be a valid port number");
}

const readPoolSetting = (name, defaultValue, minimum) => {
    const value = process.env[name] ? Number(process.env[name]) : defaultValue;
    if (!Number.isSafeInteger(value) || value < minimum) {
        throw new Error(`${name} must be an integer of at least ${minimum}`);
    }
    return value;
};

const poolMax = readPoolSetting("DB_POOL_MAX", process.env.VERCEL ? 2 : 10, 1);
const poolMin = readPoolSetting("DB_POOL_MIN", 0, 0);
if (poolMin > poolMax) {
    throw new Error("DB_POOL_MIN cannot exceed DB_POOL_MAX");
}

const poolAcquire = readPoolSetting("DB_POOL_ACQUIRE", 30000, 1);
const poolIdle = readPoolSetting("DB_POOL_IDLE", 10000, 1);
const connectionTimeout = readPoolSetting("DB_CONNECT_TIMEOUT", 15000, 1000);
if (process.env.DB_SSL !== undefined && !["true", "false"].includes(process.env.DB_SSL)) {
    throw new Error("DB_SSL must be true or false");
}
const sslEnabled = process.env.DB_SSL === undefined || process.env.DB_SSL === "true";
if (!sslEnabled && process.env.NODE_ENV === "production") {
    throw new Error("DB_SSL cannot be disabled in production");
}
if (!sslEnabled && process.env.DB_SSL_CA_FILE) {
    throw new Error("DB_SSL_CA_FILE cannot be used when DB_SSL is false");
}

let sslCa;
if (process.env.DB_SSL_CA_FILE) {
    try {
        sslCa = fs.readFileSync(process.env.DB_SSL_CA_FILE, "utf8");
    } catch (error) {
        throw new Error(`Unable to read DB_SSL_CA_FILE: ${error.message}`);
    }
}

const connectionOptions = {
    dialect,
    logging: false,
    pool: {
        max: poolMax,
        min: poolMin,
        acquire: poolAcquire,
        idle: poolIdle
    },
    dialectOptions: {
        connectionTimeoutMillis: connectionTimeout,
        ...(sslEnabled
            ? {
                ssl: {
                    require: true,
                    rejectUnauthorized: true,
                    ...(sslCa ? { ca: sslCa } : {})
                }
            }
            : {})
    }
};

const sequelize = databaseUrl
    ? new Sequelize(databaseUrl, connectionOptions)
    : new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
            ...connectionOptions,
            host: process.env.DB_HOST,
            port: dbPort
        }
    );

/*
  Function to test database connection
*/
const connectDB = async () => {
    console.log("Connecting to PostgreSQL...");
    await sequelize.authenticate();
    console.log("Database connected successfully");
};

exports.sequelize = sequelize;
exports.connectDB = connectDB;