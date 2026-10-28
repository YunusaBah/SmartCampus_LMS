const { Sequelize } = require("sequelize");
require("./env");

const required = ["DB_HOST", "DB_NAME", "DB_USER"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
    throw new Error(`Missing required database configuration: ${missing.join(", ")}`);
}

const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
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

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: dbPort,
        dialect: "mysql",
        logging: false,
        pool: {
            max: poolMax,
            min: poolMin,
            acquire: poolAcquire,
            idle: poolIdle
        },
        dialectOptions: process.env.DB_SSL === "true"
            ? { ssl: { require: true, rejectUnauthorized: false } }
            : {}
    }
);

/*
  Function to test database connection
*/
const connectDB = async () => {
    await sequelize.authenticate();
    console.log("Database connected successfully");
};

module.exports = { sequelize, connectDB };