const { DataTypes, QueryTypes } = require("sequelize");
const sequelize = require("../config/db").sequelize;

const migrationName = "20261004_add_lms_features";
const followupMigrationName = "20261004_02_lms_calendar_assessment_options";
const lecturerStudentRolesMigrationName = "20261004_03_lecturer_student_roles";
const roleEnumCleanupMigrationName = "20261004_04_remove_admin_role_value";
const enforceTwoRoleEnumMigrationName = "20261004_05_enforce_two_role_enum";
const reconcileLmsSchemaMigrationName = "20261004_06_reconcile_lms_columns";
const userTokenVersionMigrationName = "20261007_02_ensure_user_token_version";
const reconcileSchemaMigrationName = "20261007_03_reconcile_existing_tables";
const reconcileCalendarAndAssessmentMigrationName = "20261007_04_reconcile_calendar_assessments";
const googleAccountMigrationName = "20261008_01_add_google_account_id";
const courseContentsMigrationName = "20261008_02_add_course_contents_files";
const passwordRecoveryMigrationName = "20261009_01_add_password_recovery_fields";
const auditLogMigrationName = "20261009_02_create_audit_logs";
const performanceIndexesMigrationName = "20261009_03_add_lms_query_indexes";
const courseManagementFieldsMigrationName = "20261009_04_add_course_management_fields";
const courseIntegrityIndexesMigrationName = "20261009_05_enforce_course_integrity_indexes";
const learningMaterialMetadataMigrationName = "20261009_06_add_learning_material_metadata";
const reconcileMaterialAndQuizGradesMigrationName = "20261009_07_reconcile_material_and_quiz_grades";
const quizTheoryAndQuestionTypesMigrationName = "20261010_01_quiz_theory_question_types";
const assignmentFilesAndCalendarAssessmentsMigrationName = "20261010_02_assignment_files_calendar_assessments";
const assignmentReadMigrationName = "20261010_03_assignment_read_tracking";
const studentAnnouncementPermissionMigrationName = "20261010_04_student_announcement_permission";
const submissionFileNameMigrationName = "20261010_05_submission_file_names";
const announcementRolesMigrationName = "20261010_06_announcement_role_names";
const announcementEngagementMigrationName = "20261010_07_announcement_engagement";
const assignmentTextRepliesMigrationName = "20261010_08_assignment_text_replies";
const learningResourceLinksMigrationName = "20261010_09_expand_learning_resource_links";
const courseStudentPermissionsMigrationName = "20261010_10_course_student_permissions";
const chatProfileAndAttachmentsMigrationName = "20261101_01_chat_profiles_and_attachments";
const chatProfilePermissionsMigrationName = "20261101_02_chat_profile_permissions";
const chatProfileContactVisibilityMigrationName = "20261101_03_chat_profile_contact_visibility";
const chatProfileContactApprovalMigrationName = "20261101_04_chat_profile_contact_approval";
const classScheduleAndAutomaticAnnouncementsMigrationName = "20261102_01_class_schedule_automatic_announcements";
const submissionReadMigrationName = "20261102_02_submission_read_tracking";
const announcementCommentsMigrationName = "20261102_03_announcement_comments";
const lessonReadingProgressMigrationName = "20261102_04_lesson_reading_progress";
const assignmentWorkTypeMigrationName = "20261103_01_assignment_work_type";
const lessonPrivateNotesMigrationName = "20261103_02_lesson_private_notes";
const chatMessageDeliveryAndReactionsMigrationName = "20261103_03_chat_message_delivery_reactions";
const migrationNames = [
    migrationName,
    followupMigrationName,
    lecturerStudentRolesMigrationName,
    roleEnumCleanupMigrationName,
    enforceTwoRoleEnumMigrationName,
    reconcileLmsSchemaMigrationName,
    userTokenVersionMigrationName,
    reconcileSchemaMigrationName,
    reconcileCalendarAndAssessmentMigrationName,
    googleAccountMigrationName,
    courseContentsMigrationName,
    passwordRecoveryMigrationName,
    auditLogMigrationName,
    performanceIndexesMigrationName,
    courseManagementFieldsMigrationName,
    courseIntegrityIndexesMigrationName,
    learningMaterialMetadataMigrationName,
    reconcileMaterialAndQuizGradesMigrationName,
    quizTheoryAndQuestionTypesMigrationName,
    assignmentFilesAndCalendarAssessmentsMigrationName,
    assignmentReadMigrationName,
    studentAnnouncementPermissionMigrationName,
    submissionFileNameMigrationName,
    announcementRolesMigrationName,
    announcementEngagementMigrationName,
    assignmentTextRepliesMigrationName,
    learningResourceLinksMigrationName,
    courseStudentPermissionsMigrationName,
    chatProfileAndAttachmentsMigrationName,
    chatProfilePermissionsMigrationName,
    chatProfileContactVisibilityMigrationName,
    chatProfileContactApprovalMigrationName,
    classScheduleAndAutomaticAnnouncementsMigrationName,
    submissionReadMigrationName,
    announcementCommentsMigrationName,
    lessonReadingProgressMigrationName,
    assignmentWorkTypeMigrationName
];
const additions = {
    Users: {
        tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        matNumber: { type: DataTypes.STRING(50), allowNull: true },
        phone: { type: DataTypes.STRING(30), allowNull: true }
    },
    Courses: {
        departmentId: { type: DataTypes.INTEGER, allowNull: true }
    },
    Lessons: {
        moduleId: { type: DataTypes.INTEGER, allowNull: true },
        orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        fileName: { type: DataTypes.STRING, allowNull: true }
    },
    Quizzes: {
        assessmentId: { type: DataTypes.INTEGER, allowNull: true }
    },
    Submissions: {
        feedback: { type: DataTypes.TEXT, allowNull: true }
    },
    CalendarEvents: {
        eventType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "event" }
    },
    QuizAssessments: {
        maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
    }
};

const getTables = async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    return new Set(tables.map((table) => (
        (typeof table === "string" ? table : table.tableName).toLowerCase()
    )));
};

const hasTable = (tables, tableName) => tables.has(tableName.toLowerCase());

const applyAnnouncementCommentsMigration = async (queryInterface) => {
    const applied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: announcementCommentsMigrationName },
        limit: 1
    });
    if (applied.length) return;

    let tables = await getTables(queryInterface);
    if (!hasTable(tables, "AnnouncementComments")) {
        await queryInterface.createTable("AnnouncementComments", {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
            announcementId: { type: DataTypes.INTEGER, allowNull: false },
            authorId: { type: DataTypes.INTEGER, allowNull: false },
            parentCommentId: { type: DataTypes.INTEGER, allowNull: true },
            body: { type: DataTypes.STRING(2000), allowNull: false },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
        });
    }
    let indexes = await queryInterface.showIndex("AnnouncementComments");
    if (!indexes.some((index) => index.name === "announcement_comments_post_created")) {
        await queryInterface.addIndex("AnnouncementComments", ["announcementId", "createdAt"], {
            name: "announcement_comments_post_created"
        });
    }
    if (!indexes.some((index) => index.name === "announcement_comments_parent")) {
        await queryInterface.addIndex("AnnouncementComments", ["parentCommentId"], {
            name: "announcement_comments_parent"
        });
    }

    tables = await getTables(queryInterface);
    if (!hasTable(tables, "AnnouncementCommentReactions")) {
        await queryInterface.createTable("AnnouncementCommentReactions", {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
            commentId: { type: DataTypes.INTEGER, allowNull: false },
            userId: { type: DataTypes.INTEGER, allowNull: false },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
        });
    }
    indexes = await queryInterface.showIndex("AnnouncementCommentReactions");
    if (!indexes.some((index) => index.name === "announcement_comment_reaction_user_unique")) {
        await queryInterface.addIndex("AnnouncementCommentReactions", ["commentId", "userId"], {
            unique: true,
            name: "announcement_comment_reaction_user_unique"
        });
    }
    await queryInterface.bulkInsert("SchemaMigrations", [{
        name: announcementCommentsMigrationName,
        appliedAt: new Date()
    }]);
};

const applyLessonReadingProgressMigration = async (queryInterface) => {
    const tables = await getTables(queryInterface);
    if (hasTable(tables, "LessonProgresses")) {
        const columns = await queryInterface.describeTable("LessonProgresses");
        for (const [columnName, definition] of Object.entries({
            readingPosition: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            readingProgress: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
            lastReadAt: { type: DataTypes.DATE, allowNull: true }
        })) {
            if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
                await queryInterface.addColumn("LessonProgresses", columnName, definition);
            }
        }
    }

    const applied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: lessonReadingProgressMigrationName },
        limit: 1
    });
    if (!applied.length) {
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: lessonReadingProgressMigrationName,
            appliedAt: new Date()
        }]);
    }
};

const applyAssignmentWorkTypeMigration = async (queryInterface) => {
    const tables = await getTables(queryInterface);
    if (hasTable(tables, "Assignments")) {
        const columns = await queryInterface.describeTable("Assignments");
        if (!Object.prototype.hasOwnProperty.call(columns, "workType")) {
            await queryInterface.addColumn("Assignments", "workType", {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "assignment"
            });
        }
    }
    const applied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: assignmentWorkTypeMigrationName },
        limit: 1
    });
    if (!applied.length) {
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: assignmentWorkTypeMigrationName,
            appliedAt: new Date()
        }]);
    }
};

const applyLessonPrivateNotesMigration = async (queryInterface) => {
    let tables = await getTables(queryInterface);
    if (!hasTable(tables, "LessonNotes")) {
        await queryInterface.createTable("LessonNotes", {
            id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
            lessonId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "Lessons", key: "id" },
                onDelete: "CASCADE"
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: "Users", key: "id" },
                onDelete: "CASCADE"
            },
            content: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
        });
    } else {
        const columns = await queryInterface.describeTable("LessonNotes");
        for (const [columnName, definition] of Object.entries({
            lessonId: { type: DataTypes.INTEGER, allowNull: false },
            userId: { type: DataTypes.INTEGER, allowNull: false },
            content: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
        })) {
            if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
                await queryInterface.addColumn("LessonNotes", columnName, definition);
            }
        }
    }

    tables = await getTables(queryInterface);
    if (hasTable(tables, "LessonNotes")) {
        const indexes = await queryInterface.showIndex("LessonNotes");
        if (!indexes.some((index) => index.name === "lesson_notes_user_unique")) {
            await queryInterface.addIndex("LessonNotes", ["lessonId", "userId"], {
                unique: true,
                name: "lesson_notes_user_unique"
            });
        }
    }

    const applied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: lessonPrivateNotesMigrationName },
        limit: 1
    });
    if (!applied.length) {
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: lessonPrivateNotesMigrationName,
            appliedAt: new Date()
        }]);
    }
};

const applyChatMessageDeliveryAndReactionsMigration = async (queryInterface) => {
    let tables = await getTables(queryInterface);
    if (hasTable(tables, "ChatMessages")) {
        const columns = await queryInterface.describeTable("ChatMessages");
        if (!Object.prototype.hasOwnProperty.call(columns, "deliveredAt")) {
            await queryInterface.addColumn("ChatMessages", "deliveredAt", {
                type: DataTypes.DATE,
                allowNull: true
            });
        }
    }

    tables = await getTables(queryInterface);
    if (hasTable(tables, "ChatMessages") && hasTable(tables, "ChatProfiles") &&
        !hasTable(tables, "ChatMessageReactions")) {
        await queryInterface.createTable("ChatMessageReactions", {
            id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
            messageId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: { model: "ChatMessages", key: "id" },
                onDelete: "CASCADE"
            },
            profileId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: { model: "ChatProfiles", key: "id" },
                onDelete: "CASCADE"
            },
            emoji: { type: DataTypes.STRING(16), allowNull: false },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
        });
    }

    tables = await getTables(queryInterface);
    if (hasTable(tables, "ChatMessageReactions")) {
        const indexes = await queryInterface.showIndex("ChatMessageReactions");
        if (!indexes.some((index) => index.name === "chat_message_reaction_unique")) {
            await queryInterface.addIndex("ChatMessageReactions", ["messageId", "profileId", "emoji"], {
                unique: true,
                name: "chat_message_reaction_unique"
            });
        }
    }

    const applied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: chatMessageDeliveryAndReactionsMigrationName },
        limit: 1
    });
    if (!applied.length) {
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: chatMessageDeliveryAndReactionsMigrationName,
            appliedAt: new Date()
        }]);
    }
};

const ensureIdentityIndexes = async () => {
    const tables = await getTables(sequelize.getQueryInterface());
    if (hasTable(tables, "Users")) {
        const columns = await sequelize.getQueryInterface().describeTable("Users");
        if (columns.email) {
            await sequelize.query(
                'CREATE UNIQUE INDEX IF NOT EXISTS "users_email_case_insensitive_unique" ON "Users" (LOWER("email"))'
            );
        }
    }
    if (hasTable(tables, "ChatProfiles")) {
        const columns = await sequelize.getQueryInterface().describeTable("ChatProfiles");
        if (columns.username) {
            await sequelize.query(
                'CREATE UNIQUE INDEX IF NOT EXISTS "chat_profiles_username_case_insensitive_unique" ON "ChatProfiles" (LOWER("username"))'
            );
        }
    }
};

module.exports = async () => {
    const queryInterface = sequelize.getQueryInterface();
    const quote = (identifier) => queryInterface.quoteIdentifier(identifier);
    const checkExistingMigrations = async () => {
        const rows = await sequelize.query(
            'SELECT "name" FROM "SchemaMigrations"',
            { type: QueryTypes.SELECT }
        );
        return new Set(rows.map((row) => row.name));
    };

    const schemaMigrationsExists = await sequelize.query(
        "SELECT to_regclass('public.\"SchemaMigrations\"') AS \"schemaMigrations\"",
        { type: QueryTypes.SELECT }
    );
    if (schemaMigrationsExists[0]?.schemaMigrations) {
        const appliedMigrations = await checkExistingMigrations();
        if (migrationNames.every((name) => appliedMigrations.has(name))) {
            await applyLessonReadingProgressMigration(queryInterface);
            await applyAssignmentWorkTypeMigration(queryInterface);
            await applyLessonPrivateNotesMigration(queryInterface);
            await applyChatMessageDeliveryAndReactionsMigration(queryInterface);
            await ensureIdentityIndexes();
            return;
        }
        const previousMigrations = migrationNames.slice(0, -1);
        if (previousMigrations.every((name) => appliedMigrations.has(name))) {
            await applyAnnouncementCommentsMigration(queryInterface);
            await applyLessonReadingProgressMigration(queryInterface);
            await applyAssignmentWorkTypeMigration(queryInterface);
            await applyLessonPrivateNotesMigration(queryInterface);
            await applyChatMessageDeliveryAndReactionsMigration(queryInterface);
            await ensureIdentityIndexes();
            return;
        }
    }

    let tables = await getTables(queryInterface);
    if (!hasTable(tables, "SchemaMigrations")) {
        await queryInterface.createTable("SchemaMigrations", {
            name: { type: DataTypes.STRING(100), primaryKey: true, allowNull: false },
            appliedAt: { type: DataTypes.DATE, allowNull: false }
        });
    }

    const applied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: migrationName },
        limit: 1
    });
    if (!applied.length) {
        for (const [tableName, columns] of Object.entries(additions)) {
            tables = await getTables(queryInterface);
            if (!hasTable(tables, tableName)) continue;
            const existing = await queryInterface.describeTable(tableName);
            for (const [columnName, definition] of Object.entries(columns)) {
                if (!Object.prototype.hasOwnProperty.call(existing, columnName)) {
                    await queryInterface.addColumn(tableName, columnName, definition);
                }
            }
        }

        tables = await getTables(queryInterface);
        if (hasTable(tables, "Quizzes")) {
            const quizColumns = await queryInterface.describeTable("Quizzes");
            if (Object.prototype.hasOwnProperty.call(quizColumns, "question")) {
                await queryInterface.changeColumn("Quizzes", "question", {
                    type: DataTypes.TEXT,
                    allowNull: false
                });
            }
        }

        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: migrationName,
            appliedAt: new Date()
        }]);
    }

    const followupApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: followupMigrationName },
        limit: 1
    });
    if (!followupApplied.length) {
        for (const [tableName, columns] of Object.entries({
            CalendarEvents: {
                eventType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "event" }
            },
            QuizAssessments: {
                maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
            }
        })) {
            tables = await getTables(queryInterface);
            if (!hasTable(tables, tableName)) continue;
            const existing = await queryInterface.describeTable(tableName);
            for (const [columnName, definition] of Object.entries(columns)) {
                if (!Object.prototype.hasOwnProperty.call(existing, columnName)) {
                    await queryInterface.addColumn(tableName, columnName, definition);
                }
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: followupMigrationName,
            appliedAt: new Date()
        }]);
    }

    const rolesApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: lecturerStudentRolesMigrationName },
        limit: 1
    });
    if (!rolesApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Users")) {
            const userColumns = await queryInterface.describeTable("Users");
            if (Object.prototype.hasOwnProperty.call(userColumns, "role")) {
                const tokenVersionUpdate = Object.prototype.hasOwnProperty.call(userColumns, "tokenVersion")
                    ? `, ${quote("tokenVersion")} = ${quote("tokenVersion")} + 1`
                    : "";
                await queryInterface.sequelize.query(
                    `UPDATE ${quote("Users")} SET ${quote("role")} = 'lecturer'${tokenVersionUpdate} WHERE ${quote("role")} = 'admin'`
                );
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: lecturerStudentRolesMigrationName,
            appliedAt: new Date()
        }]);
    }

    const roleEnumCleanupApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: roleEnumCleanupMigrationName },
        limit: 1
    });
    if (!roleEnumCleanupApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Users")) {
            const userColumns = await queryInterface.describeTable("Users");
            if (Object.prototype.hasOwnProperty.call(userColumns, "role")) {
                if (Object.prototype.hasOwnProperty.call(userColumns, "tokenVersion")) {
                    await queryInterface.sequelize.query(
                        `UPDATE ${quote("Users")} SET ${quote("role")} = 'lecturer', ${quote("tokenVersion")} = ${quote("tokenVersion")} + 1 WHERE ${quote("role")} = 'admin'`
                    );
                } else {
                    await queryInterface.sequelize.query(
                        `UPDATE ${quote("Users")} SET ${quote("role")} = 'lecturer' WHERE ${quote("role")} = 'admin'`
                    );
                }
                const roleDefinition = {
                    type: DataTypes.ENUM("student", "lecturer"),
                    allowNull: userColumns.role.allowNull
                };
                if (userColumns.role.defaultValue !== undefined) {
                    roleDefinition.defaultValue = userColumns.role.defaultValue;
                }
                await queryInterface.changeColumn("Users", "role", roleDefinition);
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: roleEnumCleanupMigrationName,
            appliedAt: new Date()
        }]);
    }

    const enforceTwoRoleEnumApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: enforceTwoRoleEnumMigrationName },
        limit: 1
    });
    if (!enforceTwoRoleEnumApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Users")) {
            const userColumns = await queryInterface.describeTable("Users");
            if (Object.prototype.hasOwnProperty.call(userColumns, "role")) {
                await queryInterface.changeColumn("Users", "role", {
                    type: DataTypes.ENUM("student", "lecturer"),
                    allowNull: true,
                    defaultValue: "student"
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: enforceTwoRoleEnumMigrationName,
            appliedAt: new Date()
        }]);

        const reconcileLmsSchemaApplied = await queryInterface.select(null, "SchemaMigrations", {
            where: { name: reconcileLmsSchemaMigrationName },
            limit: 1
        });
        if (!reconcileLmsSchemaApplied.length) {
            tables = await getTables(queryInterface);
            let addedTokenVersion = false;
            for (const [tableName, columns] of Object.entries({
                ...additions,
                CalendarEvents: {
                    eventType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "event" }
                },
                QuizAssessments: {
                    maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
                }
            })) {
                if (!hasTable(tables, tableName)) continue;
                const existing = await queryInterface.describeTable(tableName);
                for (const [columnName, definition] of Object.entries(columns)) {
                    if (!Object.prototype.hasOwnProperty.call(existing, columnName)) {
                        await queryInterface.addColumn(tableName, columnName, definition);
                        if (tableName === "Users" && columnName === "tokenVersion") {
                            addedTokenVersion = true;
                        }
                    }
                }
            }
            if (addedTokenVersion) {
                await queryInterface.sequelize.query(
                    `UPDATE ${quote("Users")} SET ${quote("tokenVersion")} = 1`
                );
            }
            await queryInterface.bulkInsert("SchemaMigrations", [{
                name: reconcileLmsSchemaMigrationName,
                appliedAt: new Date()
            }]);
        }
    };

    const userTokenVersionMigrationApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: userTokenVersionMigrationName },
        limit: 1
    });
    if (!userTokenVersionMigrationApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Users")) {
            const userColumns = await queryInterface.describeTable("Users");
            if (!Object.prototype.hasOwnProperty.call(userColumns, "tokenVersion")) {
                await queryInterface.addColumn("Users", "tokenVersion", additions.Users.tokenVersion);
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: userTokenVersionMigrationName,
            appliedAt: new Date()
        }]);
    }

    const reconcileSchemaApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: reconcileSchemaMigrationName },
        limit: 1
    });
    if (!reconcileSchemaApplied.length) {
        for (const [tableName, columns] of Object.entries(additions)) {
            tables = await getTables(queryInterface);
            if (!hasTable(tables, tableName)) continue;
            const existing = await queryInterface.describeTable(tableName);
            for (const [columnName, definition] of Object.entries(columns)) {
                if (!Object.prototype.hasOwnProperty.call(existing, columnName)) {
                    await queryInterface.addColumn(tableName, columnName, definition);
                }
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: reconcileSchemaMigrationName,
            appliedAt: new Date()
        }]);
    }

    const calendarAndAssessmentApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: reconcileCalendarAndAssessmentMigrationName },
        limit: 1
    });
    if (!calendarAndAssessmentApplied.length) {
        for (const tableName of ["CalendarEvents", "QuizAssessments"]) {
            tables = await getTables(queryInterface);
            if (!hasTable(tables, tableName)) continue;
            const existing = await queryInterface.describeTable(tableName);
            for (const [columnName, definition] of Object.entries(additions[tableName])) {
                if (!Object.prototype.hasOwnProperty.call(existing, columnName)) {
                    await queryInterface.addColumn(tableName, columnName, definition);
                }
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: reconcileCalendarAndAssessmentMigrationName,
            appliedAt: new Date()
        }]);
    }

    const googleAccountApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: googleAccountMigrationName },
        limit: 1
    });
    if (!googleAccountApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Users")) {
            const userColumns = await queryInterface.describeTable("Users");
            if (!Object.prototype.hasOwnProperty.call(userColumns, "googleId")) {
                await queryInterface.addColumn("Users", "googleId", {
                    type: DataTypes.STRING(255),
                    allowNull: true
                });
            }
            if (!Object.prototype.hasOwnProperty.call(userColumns, "passwordLoginEnabled")) {
                await queryInterface.addColumn("Users", "passwordLoginEnabled", {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                });
            }
            const indexes = await queryInterface.showIndex("Users");
            if (!indexes.some((index) => index.name === "users_google_id_unique")) {
                await queryInterface.addIndex("Users", ["googleId"], {
                    unique: true,
                    name: "users_google_id_unique"
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: googleAccountMigrationName,
            appliedAt: new Date()
        }]);
    }

    const courseContentsApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: courseContentsMigrationName },
        limit: 1
    });
    if (!courseContentsApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Courses")) {
            const courseColumns = await queryInterface.describeTable("Courses");
            for (const [columnName, definition] of Object.entries({
                contentFileUrl: { type: DataTypes.STRING, allowNull: true },
                contentFileName: { type: DataTypes.STRING, allowNull: true }
            })) {
                if (!Object.prototype.hasOwnProperty.call(courseColumns, columnName)) {
                    await queryInterface.addColumn("Courses", columnName, definition);
                }
            }
        }
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Lessons")) {
            const lessonColumns = await queryInterface.describeTable("Lessons");
            if (!Object.prototype.hasOwnProperty.call(lessonColumns, "fileName")) {
                await queryInterface.addColumn("Lessons", "fileName", {
                    type: DataTypes.STRING,
                    allowNull: true
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: courseContentsMigrationName,
            appliedAt: new Date()
        }]);
    }

    const passwordRecoveryApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: passwordRecoveryMigrationName },
        limit: 1
    });
    if (!passwordRecoveryApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Users")) {
            const userColumns = await queryInterface.describeTable("Users");
            for (const [columnName, definition] of Object.entries({
                passwordResetTokenHash: { type: DataTypes.STRING(64), allowNull: true },
                passwordResetExpiresAt: { type: DataTypes.DATE, allowNull: true }
            })) {
                if (!Object.prototype.hasOwnProperty.call(userColumns, columnName)) {
                    await queryInterface.addColumn("Users", columnName, definition);
                }
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: passwordRecoveryMigrationName,
            appliedAt: new Date()
        }]);
    }

    const auditLogApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: auditLogMigrationName },
        limit: 1
    });
    if (!auditLogApplied.length) {
        tables = await getTables(queryInterface);
        if (!hasTable(tables, "AuditLogs")) {
            await queryInterface.createTable("AuditLogs", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                actorId: { type: DataTypes.INTEGER, allowNull: false },
                action: { type: DataTypes.STRING(100), allowNull: false },
                entityType: { type: DataTypes.STRING(50), allowNull: false },
                entityId: { type: DataTypes.INTEGER, allowNull: false },
                oldValues: { type: DataTypes.JSON, allowNull: true },
                newValues: { type: DataTypes.JSON, allowNull: true },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
            });
        }
        const auditLogIndexes = await queryInterface.showIndex("AuditLogs");
        if (!auditLogIndexes.some((index) => index.name === "audit_logs_entity_created")) {
            await queryInterface.addIndex("AuditLogs", ["entityType", "entityId", "createdAt"], {
                name: "audit_logs_entity_created"
            });
        }
        if (!auditLogIndexes.some((index) => index.name === "audit_logs_actor_created")) {
            await queryInterface.addIndex("AuditLogs", ["actorId", "createdAt"], {
                name: "audit_logs_actor_created"
            });
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: auditLogMigrationName,
            appliedAt: new Date()
        }]);
    }

    const performanceIndexesApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: performanceIndexesMigrationName },
        limit: 1
    });
    if (!performanceIndexesApplied.length) {
        const indexesToAdd = [
            ["Courses", ["lecturerId", "createdAt"], "courses_lecturer_created"],
            ["Enrollments", ["courseId", "studentId"], "enrollments_course_student"],
            ["Assignments", ["courseId", "dueDate"], "assignments_course_due_date"],
            ["Assignments", ["dueDate"], "assignments_due_date"],
            ["Submissions", ["studentId", "createdAt"], "submissions_student_created"],
            ["Submissions", ["assignmentId", "createdAt"], "submissions_assignment_created"],
            ["Submissions", ["assignmentId", "grade"], "submissions_assignment_grade"],
            ["QuizResults", ["studentId", "createdAt"], "quiz_results_student_created"],
            ["QuizResults", ["quizId"], "quiz_results_quiz"],
            ["CalendarEvents", ["courseId", "startsAt"], "calendar_events_course_start"],
            ["Announcements", ["courseId", "createdAt"], "announcements_course_created"]
        ];
        for (const [tableName, fields, name] of indexesToAdd) {
            tables = await getTables(queryInterface);
            if (!hasTable(tables, tableName)) continue;
            const indexes = await queryInterface.showIndex(tableName);
            const hasEquivalentIndex = indexes.some((index) => (
                index.name === name ||
                (index.fields || []).map((field) => typeof field === "string"
                    ? field
                    : field.attribute || field.name || field.field).join(",") === fields.join(",")
            ));
            if (!hasEquivalentIndex) {
                await queryInterface.addIndex(tableName, fields, { name });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: performanceIndexesMigrationName,
            appliedAt: new Date()
        }]);
    }

    const courseManagementFieldsApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: courseManagementFieldsMigrationName },
        limit: 1
    });
    if (!courseManagementFieldsApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Courses")) {
            const courseColumns = await queryInterface.describeTable("Courses");
            const fields = {
                academicCode: { type: DataTypes.STRING(50), allowNull: true },
                category: { type: DataTypes.STRING(100), allowNull: true },
                status: { type: DataTypes.ENUM("active", "archived"), allowNull: false, defaultValue: "active" },
                enrollmentEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
                startDate: { type: DataTypes.DATEONLY, allowNull: true },
                endDate: { type: DataTypes.DATEONLY, allowNull: true }
            };
            for (const [columnName, definition] of Object.entries(fields)) {
                if (!Object.prototype.hasOwnProperty.call(courseColumns, columnName)) {
                    await queryInterface.addColumn("Courses", columnName, definition);
                }
            }
        }
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Lessons")) {
            const lessonColumns = await queryInterface.describeTable("Lessons");
            if (!Object.prototype.hasOwnProperty.call(lessonColumns, "fileName")) {
                await queryInterface.addColumn("Lessons", "fileName", {
                    type: DataTypes.STRING,
                    allowNull: true
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: courseManagementFieldsMigrationName,
            appliedAt: new Date()
        }]);
    }

    const courseIntegrityIndexesApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: courseIntegrityIndexesMigrationName },
        limit: 1
    });
    if (!courseIntegrityIndexesApplied.length) {
        tables = await getTables(queryInterface);
        const uniqueIndexes = [
            ["Enrollments", ["studentId", "courseId"], "enrollments_student_course_unique"],
            ["Courses", ["classCode"], "courses_class_code_unique"]
        ];
        for (const [tableName, fields, indexName] of uniqueIndexes) {
            if (!hasTable(tables, tableName)) continue;
            const indexes = await queryInterface.showIndex(tableName);
            const alreadyUnique = indexes.some((index) => index.unique &&
                (index.fields || []).map((field) => typeof field === "string"
                    ? field
                    : field.attribute || field.name || field.field).join(",") === fields.join(","));
            if (alreadyUnique) continue;

            const [duplicates] = tableName === "Enrollments"
                ? await sequelize.query(
                    `SELECT ${quote("studentId")}, ${quote("courseId")} FROM ${quote("Enrollments")} GROUP BY ${quote("studentId")}, ${quote("courseId")} HAVING COUNT(*) > 1 LIMIT 1`
                )
                : await sequelize.query(
                    `SELECT ${quote("classCode")} FROM ${quote("Courses")} WHERE ${quote("classCode")} IS NOT NULL GROUP BY ${quote("classCode")} HAVING COUNT(*) > 1 LIMIT 1`
                );
            if (duplicates.length) {
                throw new Error(`Cannot enforce ${indexName}: duplicate existing records must be reviewed first`);
            }
            await queryInterface.addIndex(tableName, fields, { unique: true, name: indexName });
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: courseIntegrityIndexesMigrationName,
            appliedAt: new Date()
        }]);
    }

    const learningMaterialMetadataApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: learningMaterialMetadataMigrationName },
        limit: 1
    });
    if (!learningMaterialMetadataApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Lessons")) {
            const lessonColumns = await queryInterface.describeTable("Lessons");
            const fields = {
                description: { type: DataTypes.TEXT, allowNull: true },
                mimeType: { type: DataTypes.STRING(127), allowNull: true },
                fileSize: { type: DataTypes.INTEGER, allowNull: true },
                uploadedById: { type: DataTypes.INTEGER, allowNull: true }
            };
            for (const [columnName, definition] of Object.entries(fields)) {
                if (!Object.prototype.hasOwnProperty.call(lessonColumns, columnName)) {
                    await queryInterface.addColumn("Lessons", columnName, definition);
                }
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: learningMaterialMetadataMigrationName,
            appliedAt: new Date()
        }]);
    }

    const reconcileMaterialAndQuizGradesApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: reconcileMaterialAndQuizGradesMigrationName },
        limit: 1
    });
    if (!reconcileMaterialAndQuizGradesApplied.length) {
        const schemaAdditions = {
            Lessons: {
                fileName: { type: DataTypes.STRING, allowNull: true }
            }
        };
        for (const [tableName, columns] of Object.entries(schemaAdditions)) {
            tables = await getTables(queryInterface);
            if (!hasTable(tables, tableName)) continue;
            const existingColumns = await queryInterface.describeTable(tableName);
            for (const [columnName, definition] of Object.entries(columns)) {
                if (!Object.prototype.hasOwnProperty.call(existingColumns, columnName)) {
                    await queryInterface.addColumn(tableName, columnName, definition);
                }
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: reconcileMaterialAndQuizGradesMigrationName,
            appliedAt: new Date()
        }]);
    }

    const quizTheoryMigrationApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: quizTheoryAndQuestionTypesMigrationName },
        limit: 1
    });
    if (!quizTheoryMigrationApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Quizzes")) {
            const quizColumns = await queryInterface.describeTable("Quizzes");
            const fields = {
                questionType: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "MCQ" },
                marks: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 1 }
            };
            for (const [columnName, definition] of Object.entries(fields)) {
                if (!Object.prototype.hasOwnProperty.call(quizColumns, columnName)) {
                    await queryInterface.addColumn("Quizzes", columnName, definition);
                }
            }
            for (const columnName of ["optionA", "optionB", "optionC", "optionD", "correctAnswer"]) {
                if (quizColumns[columnName] && !quizColumns[columnName].allowNull) {
                    await queryInterface.changeColumn("Quizzes", columnName, {
                        type: columnName === "correctAnswer" ? DataTypes.STRING : DataTypes.STRING,
                        allowNull: true
                    });
                }
            }
        }

        tables = await getTables(queryInterface);
        if (hasTable(tables, "QuizAttempts")) {
            const attemptColumns = await queryInterface.describeTable("QuizAttempts");
            const fields = {
                totalMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
                theoryPending: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
            };
            for (const [columnName, definition] of Object.entries(fields)) {
                if (!Object.prototype.hasOwnProperty.call(attemptColumns, columnName)) {
                    await queryInterface.addColumn("QuizAttempts", columnName, definition);
                }
            }
            if (attemptColumns.score) {
                await queryInterface.changeColumn("QuizAttempts", "score", {
                    type: DataTypes.DECIMAL(10, 2),
                    allowNull: true
                });
            }
        }

        tables = await getTables(queryInterface);
        if (!hasTable(tables, "QuizAttemptAnswers")) {
            await queryInterface.createTable("QuizAttemptAnswers", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                attemptId: { type: DataTypes.INTEGER, allowNull: false },
                questionId: { type: DataTypes.INTEGER, allowNull: false },
                answer: { type: DataTypes.TEXT, allowNull: false },
                marksAwarded: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
                feedback: { type: DataTypes.TEXT, allowNull: true },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
            });
        }
        const responseIndexes = await queryInterface.showIndex("QuizAttemptAnswers");
        if (!responseIndexes.some((index) => index.name === "quiz_attempt_question_unique")) {
            await queryInterface.addIndex("QuizAttemptAnswers", ["attemptId", "questionId"], {
                unique: true,
                name: "quiz_attempt_question_unique"
            });
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: quizTheoryAndQuestionTypesMigrationName,
            appliedAt: new Date()
        }]);
    }

    const assignmentCalendarMigrationApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: assignmentFilesAndCalendarAssessmentsMigrationName },
        limit: 1
    });
    if (!assignmentCalendarMigrationApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Assignments")) {
            const assignmentColumns = await queryInterface.describeTable("Assignments");
            for (const [columnName, definition] of Object.entries({
                fileUrl: { type: DataTypes.STRING, allowNull: true },
                fileName: { type: DataTypes.STRING, allowNull: true }
            })) {
                if (!Object.prototype.hasOwnProperty.call(assignmentColumns, columnName)) {
                    await queryInterface.addColumn("Assignments", columnName, definition);
                }
            }
        }
        tables = await getTables(queryInterface);
        if (hasTable(tables, "CalendarEvents")) {
            const eventColumns = await queryInterface.describeTable("CalendarEvents");
            if (!Object.prototype.hasOwnProperty.call(eventColumns, "assessmentId")) {
                await queryInterface.addColumn("CalendarEvents", "assessmentId", {
                    type: DataTypes.INTEGER,
                    allowNull: true
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: assignmentFilesAndCalendarAssessmentsMigrationName,
            appliedAt: new Date()
        }]);
    }

    const assignmentReadMigrationApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: assignmentReadMigrationName },
        limit: 1
    });
    if (!assignmentReadMigrationApplied.length) {
        tables = await getTables(queryInterface);
        if (!hasTable(tables, "AssignmentReads")) {
            await queryInterface.createTable("AssignmentReads", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                assignmentId: { type: DataTypes.INTEGER, allowNull: false },
                studentId: { type: DataTypes.INTEGER, allowNull: false },
                readAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
            });
        }
        const readIndexes = await queryInterface.showIndex("AssignmentReads");
        if (!readIndexes.some((index) => index.name === "assignment_read_student_unique")) {
            await queryInterface.addIndex("AssignmentReads", ["assignmentId", "studentId"], {
                unique: true,
                name: "assignment_read_student_unique"
            });
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: assignmentReadMigrationName,
            appliedAt: new Date()
        }]);
    }

    const studentAnnouncementPermissionApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: studentAnnouncementPermissionMigrationName },
        limit: 1
    });
    if (!studentAnnouncementPermissionApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Enrollments")) {
            const enrollmentColumns = await queryInterface.describeTable("Enrollments");
            if (!Object.prototype.hasOwnProperty.call(enrollmentColumns, "canPostAnnouncements")) {
                await queryInterface.addColumn("Enrollments", "canPostAnnouncements", {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: studentAnnouncementPermissionMigrationName,
            appliedAt: new Date()
        }]);
    }

    const submissionFileNameApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: submissionFileNameMigrationName },
        limit: 1
    });
    if (!submissionFileNameApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Submissions")) {
            const submissionColumns = await queryInterface.describeTable("Submissions");
            if (!Object.prototype.hasOwnProperty.call(submissionColumns, "fileName")) {
                await queryInterface.addColumn("Submissions", "fileName", {
                    type: DataTypes.STRING,
                    allowNull: true
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: submissionFileNameMigrationName,
            appliedAt: new Date()
        }]);
    }

    const announcementRolesApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: announcementRolesMigrationName },
        limit: 1
    });
    if (!announcementRolesApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Enrollments")) {
            const columns = await queryInterface.describeTable("Enrollments");
            if (!Object.prototype.hasOwnProperty.call(columns, "announcementRoleName")) {
                await queryInterface.addColumn("Enrollments", "announcementRoleName", {
                    type: DataTypes.STRING(80),
                    allowNull: true
                });
            }
        }
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Announcements")) {
            const columns = await queryInterface.describeTable("Announcements");
            if (!Object.prototype.hasOwnProperty.call(columns, "authorRoleName")) {
                await queryInterface.addColumn("Announcements", "authorRoleName", {
                    type: DataTypes.STRING(80),
                    allowNull: true
                });
            }
        }
        tables = await getTables(queryInterface);
        if (hasTable(tables, "CalendarEvents")) {
            const indexes = await queryInterface.showIndex("CalendarEvents");
            if (!indexes.some((index) => index.name === "calendar_course_occurrence_unique")) {
                await queryInterface.addIndex("CalendarEvents", ["courseId", "occurrenceDate"], {
                    unique: true,
                    name: "calendar_course_occurrence_unique"
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: announcementRolesMigrationName,
            appliedAt: new Date()
        }]);
    }

    const announcementEngagementApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: announcementEngagementMigrationName },
        limit: 1
    });
    if (!announcementEngagementApplied.length) {
        tables = await getTables(queryInterface);
        if (!hasTable(tables, "AnnouncementReactions")) {
            await queryInterface.createTable("AnnouncementReactions", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                announcementId: { type: DataTypes.INTEGER, allowNull: false },
                userId: { type: DataTypes.INTEGER, allowNull: false },
                emoji: { type: DataTypes.STRING(16), allowNull: false },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
            });
        }
        const reactionIndexes = await queryInterface.showIndex("AnnouncementReactions");
        if (!reactionIndexes.some((index) => index.name === "announcement_reaction_user_unique")) {
            await queryInterface.addIndex("AnnouncementReactions", ["announcementId", "userId"], {
                unique: true,
                name: "announcement_reaction_user_unique"
            });
        }
        tables = await getTables(queryInterface);
        if (!hasTable(tables, "AnnouncementViews")) {
            await queryInterface.createTable("AnnouncementViews", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                announcementId: { type: DataTypes.INTEGER, allowNull: false },
                userId: { type: DataTypes.INTEGER, allowNull: false },
                viewedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
            });
        }
        const viewIndexes = await queryInterface.showIndex("AnnouncementViews");
        if (!viewIndexes.some((index) => index.name === "announcement_view_user_unique")) {
            await queryInterface.addIndex("AnnouncementViews", ["announcementId", "userId"], {
                unique: true,
                name: "announcement_view_user_unique"
            });
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: announcementEngagementMigrationName,
            appliedAt: new Date()
        }]);
    }

    const assignmentTextRepliesApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: assignmentTextRepliesMigrationName },
        limit: 1
    });
    if (!assignmentTextRepliesApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Submissions")) {
            const columns = await queryInterface.describeTable("Submissions");
            if (columns.fileUrl && !columns.fileUrl.allowNull) {
                await queryInterface.changeColumn("Submissions", "fileUrl", {
                    type: DataTypes.STRING,
                    allowNull: true
                });
            }
            if (!Object.prototype.hasOwnProperty.call(columns, "answerText")) {
                await queryInterface.addColumn("Submissions", "answerText", {
                    type: DataTypes.TEXT,
                    allowNull: true
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: assignmentTextRepliesMigrationName,
            appliedAt: new Date()
        }]);
    }

    const learningResourceLinksApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: learningResourceLinksMigrationName },
        limit: 1
    });
    if (!learningResourceLinksApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Lessons")) {
            const lessonColumns = await queryInterface.describeTable("Lessons");
            if (Object.prototype.hasOwnProperty.call(lessonColumns, "videoUrl")) {
                await queryInterface.changeColumn("Lessons", "videoUrl", {
                    type: DataTypes.STRING(2048),
                    allowNull: true
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: learningResourceLinksMigrationName,
            appliedAt: new Date()
        }]);
    }

    const courseStudentPermissionsApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: courseStudentPermissionsMigrationName },
        limit: 1
    });
    if (!courseStudentPermissionsApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Enrollments")) {
            const enrollmentColumns = await queryInterface.describeTable("Enrollments");
            if (!Object.prototype.hasOwnProperty.call(enrollmentColumns, "permissionRole")) {
                await queryInterface.addColumn("Enrollments", "permissionRole", {
                    type: DataTypes.ENUM("student_assistant", "class_representative"),
                    allowNull: true
                });
            }
            if (!Object.prototype.hasOwnProperty.call(enrollmentColumns, "permissions")) {
                await queryInterface.addColumn("Enrollments", "permissions", {
                    type: DataTypes.JSON,
                    allowNull: true
                });
            }
            await sequelize.query(
                `UPDATE ${quote("Enrollments")} SET ${quote("permissions")} = '["postAnnouncements"]'::json WHERE ${quote("canPostAnnouncements")} = true AND (${quote("permissions")} IS NULL OR ${quote("permissions")}::jsonb = '[]'::jsonb)`
            );
            await sequelize.query(
                `UPDATE ${quote("Enrollments")} SET ${quote("permissionRole")} = 'class_representative' WHERE ${quote("canPostAnnouncements")} = true AND ${quote("permissionRole")} IS NULL`
            );
            await sequelize.query(
                `UPDATE ${quote("Enrollments")} SET ${quote("permissions")} = '[]'::json WHERE ${quote("permissions")} IS NULL`
            );
            await queryInterface.changeColumn("Enrollments", "permissions", {
                type: DataTypes.JSON,
                allowNull: false
            });
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: courseStudentPermissionsMigrationName,
            appliedAt: new Date()
        }]);
    }

    const chatProfileAndAttachmentsApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: chatProfileAndAttachmentsMigrationName },
        limit: 1
    });
    if (!chatProfileAndAttachmentsApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "ChatProfiles")) {
            const profileColumns = await queryInterface.describeTable("ChatProfiles");
            if (!Object.prototype.hasOwnProperty.call(profileColumns, "about")) {
                await queryInterface.addColumn("ChatProfiles", "about", {
                    type: DataTypes.STRING(200),
                    allowNull: false,
                    defaultValue: ""
                });
            }
            if (Object.prototype.hasOwnProperty.call(profileColumns, "avatarUrl")) {
                await queryInterface.changeColumn("ChatProfiles", "avatarUrl", {
                    type: DataTypes.TEXT,
                    allowNull: true
                });
            }
        }
        tables = await getTables(queryInterface);
        if (hasTable(tables, "ChatMessages")) {
            for (const value of ["image", "file", "contact"]) {
                await sequelize.query(
                    `ALTER TYPE public."enum_ChatMessages_type" ADD VALUE IF NOT EXISTS '${value}'`
                );
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: chatProfileAndAttachmentsMigrationName,
            appliedAt: new Date()
        }]);
    }

    const chatProfilePermissionsApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: chatProfilePermissionsMigrationName },
        limit: 1
    });
    if (!chatProfilePermissionsApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "ChatProfiles") && !hasTable(tables, "ChatProfilePermissions")) {
            await queryInterface.createTable("ChatProfilePermissions", {
                id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
                profileId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: { model: "ChatProfiles", key: "id" },
                    onDelete: "CASCADE"
                },
                viewerProfileId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: { model: "ChatProfiles", key: "id" },
                    onDelete: "CASCADE"
                },
                canViewPhone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
                createdAt: { type: DataTypes.DATE, allowNull: false },
                updatedAt: { type: DataTypes.DATE, allowNull: false }
            });
        }
        tables = await getTables(queryInterface);
        if (hasTable(tables, "ChatProfilePermissions")) {
            const indexes = await queryInterface.showIndex("ChatProfilePermissions");
            if (!indexes.some((index) => index.name === "chat_profile_viewer_unique")) {
                await queryInterface.addIndex("ChatProfilePermissions", ["profileId", "viewerProfileId"], {
                    unique: true,
                    name: "chat_profile_viewer_unique"
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: chatProfilePermissionsMigrationName,
            appliedAt: new Date()
        }]);
    }

    const contactVisibilityApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: chatProfileContactVisibilityMigrationName },
        limit: 1
    });
    if (!contactVisibilityApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "ChatProfiles")) {
            const columns = await queryInterface.describeTable("ChatProfiles");
            for (const columnName of ["phoneVisibility", "emailVisibility", "matNumberVisibility"]) {
                if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
                    await queryInterface.addColumn("ChatProfiles", columnName, {
                        type: DataTypes.STRING(20),
                        allowNull: false,
                        defaultValue: "private_contacts"
                    });
                }
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: chatProfileContactVisibilityMigrationName,
            appliedAt: new Date()
        }]);
    }

    const contactApprovalApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: chatProfileContactApprovalMigrationName },
        limit: 1
    });
    if (!contactApprovalApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "ChatProfilePermissions")) {
            const columns = await queryInterface.describeTable("ChatProfilePermissions");
            if (!Object.prototype.hasOwnProperty.call(columns, "canViewContactDetails")) {
                await queryInterface.addColumn("ChatProfilePermissions", "canViewContactDetails", {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: chatProfileContactApprovalMigrationName,
            appliedAt: new Date()
        }]);
    }

    const classScheduleMigrationApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: classScheduleAndAutomaticAnnouncementsMigrationName },
        limit: 1
    });
    if (!classScheduleMigrationApplied.length) {
        for (const [tableName, columns] of Object.entries({
            Courses: {
                classDays: { type: DataTypes.JSON, allowNull: true },
                classStartTime: { type: DataTypes.STRING(5), allowNull: true },
                classEndTime: { type: DataTypes.STRING(5), allowNull: true },
                classTimeZone: { type: DataTypes.STRING(100), allowNull: true }
            },
            CalendarEvents: {
                occurrenceDate: { type: DataTypes.DATEONLY, allowNull: true },
                status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "scheduled" }
            },
            Announcements: {
                automaticKey: { type: DataTypes.STRING(255), allowNull: true }
            }
        })) {
            tables = await getTables(queryInterface);
            if (!hasTable(tables, tableName)) continue;
            const existing = await queryInterface.describeTable(tableName);
            for (const [columnName, definition] of Object.entries(columns)) {
                if (!Object.prototype.hasOwnProperty.call(existing, columnName)) {
                    await queryInterface.addColumn(tableName, columnName, definition);
                }
            }
        }
        tables = await getTables(queryInterface);
        if (hasTable(tables, "Announcements")) {
            const indexes = await queryInterface.showIndex("Announcements");
            if (!indexes.some((index) => index.name === "announcements_automatic_key_unique")) {
                await queryInterface.addIndex("Announcements", ["automaticKey"], {
                    unique: true,
                    name: "announcements_automatic_key_unique"
                });
            }
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: classScheduleAndAutomaticAnnouncementsMigrationName,
            appliedAt: new Date()
        }]);
    }

    const submissionReadMigrationApplied = await queryInterface.select(null, "SchemaMigrations", {
        where: { name: submissionReadMigrationName },
        limit: 1
    });
    if (!submissionReadMigrationApplied.length) {
        tables = await getTables(queryInterface);
        if (hasTable(tables, "SubmissionReads")) {
            const columns = await queryInterface.describeTable("SubmissionReads");
            for (const [columnName, definition] of Object.entries({
                submissionId: { type: DataTypes.INTEGER, allowNull: false },
                lecturerId: { type: DataTypes.INTEGER, allowNull: false },
                viewedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
            })) {
                if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
                    await queryInterface.addColumn("SubmissionReads", columnName, definition);
                }
            }
        } else {
            await queryInterface.createTable("SubmissionReads", {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
                submissionId: { type: DataTypes.INTEGER, allowNull: false },
                lecturerId: { type: DataTypes.INTEGER, allowNull: false },
                viewedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
                updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
            });
        }
        const indexes = await queryInterface.showIndex("SubmissionReads");
        if (!indexes.some((index) => index.name === "submission_read_lecturer_unique")) {
            await queryInterface.addIndex("SubmissionReads", ["submissionId", "lecturerId"], {
                unique: true,
                name: "submission_read_lecturer_unique"
            });
        }
        await queryInterface.bulkInsert("SchemaMigrations", [{
            name: submissionReadMigrationName,
            appliedAt: new Date()
        }]);
    }

    await applyAnnouncementCommentsMigration(queryInterface);

    await applyLessonReadingProgressMigration(queryInterface);
    await applyAssignmentWorkTypeMigration(queryInterface);
    await applyLessonPrivateNotesMigration(queryInterface);
    await applyChatMessageDeliveryAndReactionsMigration(queryInterface);
    await ensureIdentityIndexes();
};

module.exports.ensureIdentityIndexes = ensureIdentityIndexes;
module.exports.ensureLessonReadingProgressSchema = applyLessonReadingProgressMigration;
module.exports.ensureLessonPrivateNotesSchema = applyLessonPrivateNotesMigration;
module.exports.ensureChatMessageDeliveryAndReactionsSchema = applyChatMessageDeliveryAndReactionsMigration;
