const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const configKeys = [
    "DATABASE_URL",
    "DB_DIALECT",
    "DB_CONNECT_TIMEOUT",
    "DB_HOST",
    "DB_NAME",
    "DB_POOL_MAX",
    "DB_POOL_MIN",
    "DB_PASSWORD",
    "DB_PORT",
    "DB_SSL",
    "DB_SSL_CA_FILE",
    "DB_USER",
    "NODE_ENV",
    "VERCEL"
];
const originalConfig = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));
const sequelizeInstances = [];

const loadDatabaseConfig = (environment) => {
    for (const key of configKeys) delete process.env[key];
    Object.assign(process.env, environment);
    delete require.cache[require.resolve("../src/config/db")];
    const database = require("../src/config/db");
    const { sequelize } = database;
    assert.equal(typeof sequelize.define, "function");
    assert.equal(typeof sequelize.authenticate, "function");
    assert.equal(typeof sequelize.sync, "function");
    assert.equal(typeof database.connectDB, "function");
    sequelizeInstances.push(sequelize);
    return sequelize;
};

after(async () => {
    await Promise.all(sequelizeInstances.map((sequelize) => sequelize.close()));
    for (const key of configKeys) {
        if (originalConfig[key] === undefined) delete process.env[key];
        else process.env[key] = originalConfig[key];
    }
});

test("Supabase PostgreSQL URI enables SSL and infers PostgreSQL dialect", () => {
    const sequelize = loadDatabaseConfig({
        DATABASE_URL: "postgresql://dbuser:secret@db.example.supabase.co:5432/postgres",
        DB_SSL: "true"
    });

    assert.equal(sequelize.getDialect(), "postgres");
    assert.equal(sequelize.config.host, "db.example.supabase.co");
    assert.equal(sequelize.config.port, "5432");
    assert.equal(sequelize.options.dialectOptions.ssl.require, true);
    assert.equal(sequelize.options.dialectOptions.ssl.rejectUnauthorized, true);
    assert.equal(sequelize.options.dialectOptions.connectionTimeoutMillis, 15000);
});

test("local PostgreSQL uses individual connection settings without SSL", () => {
    const sequelize = loadDatabaseConfig({
        DB_DIALECT: "postgres",
        DB_HOST: "localhost",
        DB_NAME: "smartcampus",
        DB_PASSWORD: "local-password",
        DB_PORT: "5432",
        DB_SSL: "false",
        DB_USER: "postgres"
    });

    assert.equal(sequelize.getDialect(), "postgres");
    assert.equal(sequelize.config.host, "localhost");
    assert.equal(sequelize.config.port, 5432);
    assert.equal(sequelize.config.database, "smartcampus");
    assert.equal(sequelize.config.username, "postgres");
    assert.equal(sequelize.options.dialectOptions.ssl, undefined);
});

test("PostgreSQL SSL certificate verification is enabled by default", () => {
    const sequelize = loadDatabaseConfig({
        DATABASE_URL: "postgres://user:password@db.example.com:5432/postgres"
    });

    assert.equal(sequelize.options.dialectOptions.ssl.rejectUnauthorized, true);
});

test("PostgreSQL connection timeout is configurable", () => {
    const sequelize = loadDatabaseConfig({
        DATABASE_URL: "postgres://user:password@db.example.com:5432/postgres",
        DB_CONNECT_TIMEOUT: "8000"
    });

    assert.equal(sequelize.options.dialectOptions.connectionTimeoutMillis, 8000);
});

test("database connection pool defaults stay small for Supabase pooler limits", () => {
        const localSequelize = loadDatabaseConfig({
            DATABASE_URL: "postgresql://test:test@db.example.com:5432/postgres"
        });
        assert.equal(localSequelize.options.pool.max, 2);

        const vercelSequelize = loadDatabaseConfig({
            DATABASE_URL: "postgresql://test:test@db.example.com:6543/postgres",
            VERCEL: "1"
        });
        assert.equal(vercelSequelize.options.pool.max, 1);
    });

    test("database connection pool limits can be explicitly configured", () => {
        const sequelize = loadDatabaseConfig({
            DATABASE_URL: "postgresql://test:test@db.example.com:6543/postgres",
            DB_POOL_MAX: "3",
            DB_POOL_MIN: "1"
        });

        assert.equal(sequelize.options.pool.max, 3);
        assert.equal(sequelize.options.pool.min, 1);
    });

test("PostgreSQL SSL can use a provider CA certificate file", () => {
    const sequelize = loadDatabaseConfig({
        DATABASE_URL: "postgres://user:password@db.example.com:5432/postgres",
        DB_SSL_CA_FILE: path.join(__dirname, "databaseConfig.test.js")
    });

    assert.match(sequelize.options.dialectOptions.ssl.ca, /PostgreSQL SSL can use a provider CA certificate file/);
    assert.equal(sequelize.options.dialectOptions.ssl.rejectUnauthorized, true);
});

test("missing custom CA file fails with a configuration error", () => {
    assert.throws(() => loadDatabaseConfig({
        DATABASE_URL: "postgres://user:password@db.example.com:5432/postgres",
        DB_SSL_CA_FILE: path.join(__dirname, "missing-provider-ca.crt")
    }), /Unable to read DB_SSL_CA_FILE/);
});

test("production database connections cannot disable SSL", () => {
    assert.throws(() => loadDatabaseConfig({
        DATABASE_URL: "postgres://user:password@db.example.com:5432/postgres",
        DB_SSL: "false",
        NODE_ENV: "production"
    }), /DB_SSL cannot be disabled in production/);
});

test("invalid DB_SSL values are rejected instead of disabling SSL", () => {
    assert.throws(() => loadDatabaseConfig({
        DATABASE_URL: "postgres://user:password@db.example.com:5432/postgres",
        DB_SSL: "sometimes"
    }), /DB_SSL must be true or false/);
});

test("MySQL dialect is rejected after the PostgreSQL migration", () => {
    assert.throws(() => loadDatabaseConfig({
        DB_DIALECT: "mysql",
        DB_HOST: "localhost",
        DB_NAME: "smartcampus_test",
        DB_PASSWORD: "test",
        DB_USER: "root"
    }), /DB_DIALECT must be postgres/);
});
