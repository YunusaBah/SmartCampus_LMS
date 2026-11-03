process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const runMigrations = require("../src/utils/runMigrations");

const createQueryInterface = ({ migrationApplied }) => {
    const columns = { id: {}, studentId: {}, lessonId: {}, completedAt: {} };
    const addedColumns = [];
    const insertedMigrations = [];
    return {
        addedColumns,
        insertedMigrations,
        async showAllTables() {
            return ["LessonProgresses", "SchemaMigrations"];
        },
        async describeTable() {
            return columns;
        },
        async addColumn(tableName, columnName, definition) {
            assert.equal(tableName, "LessonProgresses");
            columns[columnName] = definition;
            addedColumns.push(columnName);
        },
        async select(_attributes, tableName, options) {
            assert.equal(tableName, "SchemaMigrations");
            assert.equal(options.where.name, "20261102_04_lesson_reading_progress");
            return migrationApplied ? [{ name: options.where.name }] : [];
        },
        async bulkInsert(tableName, rows) {
            assert.equal(tableName, "SchemaMigrations");
            insertedMigrations.push(...rows);
        }
    };
};

test("repairs lesson reading columns even when the migration is marked applied", async () => {
    const queryInterface = createQueryInterface({ migrationApplied: true });

    await runMigrations.ensureLessonReadingProgressSchema(queryInterface);

    assert.deepEqual(queryInterface.addedColumns, ["readingPosition", "readingProgress", "lastReadAt"]);
    assert.deepEqual(queryInterface.insertedMigrations, []);
});

test("adds lesson reading columns before recording the migration", async () => {
    const queryInterface = createQueryInterface({ migrationApplied: false });

    await runMigrations.ensureLessonReadingProgressSchema(queryInterface);

    assert.deepEqual(queryInterface.addedColumns, ["readingPosition", "readingProgress", "lastReadAt"]);
    assert.equal(queryInterface.insertedMigrations.length, 1);
    assert.equal(queryInterface.insertedMigrations[0].name, "20261102_04_lesson_reading_progress");
});

test("creates the private material notes table and unique user index", async () => {
    const tables = ["Lessons", "Users", "SchemaMigrations"];
    const createdTables = [];
    const addedIndexes = [];
    const insertedMigrations = [];
    const queryInterface = {
        async showAllTables() {
            return tables;
        },
        async createTable(tableName, columns) {
            createdTables.push({ tableName, columns });
            tables.push(tableName);
        },
        async showIndex() {
            return [];
        },
        async addIndex(tableName, fields, options) {
            addedIndexes.push({ tableName, fields, options });
        },
        async select(_attributes, tableName, options) {
            assert.equal(tableName, "SchemaMigrations");
            assert.equal(options.where.name, "20261103_02_lesson_private_notes");
            return [];
        },
        async bulkInsert(tableName, rows) {
            assert.equal(tableName, "SchemaMigrations");
            insertedMigrations.push(...rows);
        }
    };

    await runMigrations.ensureLessonPrivateNotesSchema(queryInterface);

    assert.equal(createdTables.length, 1);
    assert.equal(createdTables[0].tableName, "LessonNotes");
    assert.equal(createdTables[0].columns.lessonId.allowNull, false);
    assert.equal(createdTables[0].columns.userId.allowNull, false);
    assert.deepEqual(addedIndexes, [{
        tableName: "LessonNotes",
        fields: ["lessonId", "userId"],
        options: { unique: true, name: "lesson_notes_user_unique" }
    }]);
    assert.equal(insertedMigrations[0].name, "20261103_02_lesson_private_notes");
});

test("adds chat delivery timestamps and the reaction table", async () => {
    const tables = ["ChatMessages", "ChatProfiles", "SchemaMigrations"];
    const columns = { id: {} };
    const addedColumns = [];
    const createdTables = [];
    const addedIndexes = [];
    const queryInterface = {
        async showAllTables() {
            return tables;
        },
        async describeTable(tableName) {
            assert.equal(tableName, "ChatMessages");
            return columns;
        },
        async addColumn(tableName, columnName, definition) {
            assert.equal(tableName, "ChatMessages");
            columns[columnName] = definition;
            addedColumns.push(columnName);
        },
        async createTable(tableName, tableColumns) {
            createdTables.push({ tableName, tableColumns });
            tables.push(tableName);
        },
        async showIndex() {
            return [];
        },
        async addIndex(tableName, fields, options) {
            addedIndexes.push({ tableName, fields, options });
        },
        async select(_attributes, tableName, options) {
            assert.equal(tableName, "SchemaMigrations");
            assert.equal(options.where.name, "20261103_03_chat_message_delivery_reactions");
            return [];
        },
        async bulkInsert() {}
    };

    await runMigrations.ensureChatMessageDeliveryAndReactionsSchema(queryInterface);

    assert.deepEqual(addedColumns, ["deliveredAt"]);
    assert.equal(createdTables[0].tableName, "ChatMessageReactions");
    assert.deepEqual(addedIndexes, [{
        tableName: "ChatMessageReactions",
        fields: ["messageId", "profileId", "emoji"],
        options: { unique: true, name: "chat_message_reaction_unique" }
    }]);
});
