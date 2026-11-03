const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = async () => {
    const [schema] = await sequelize.query(
        "SELECT to_regnamespace('auth') IS NOT NULL AS \"authSchema\"",
        { type: QueryTypes.SELECT }
    );
    if (!schema?.authSchema) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("Supabase auth schema is required to enable chat row-level security");
        }
        console.warn("Supabase auth schema not found; skipping Supabase chat row-level security for local development.");
        return;
    }

    await sequelize.query(`
        CREATE OR REPLACE FUNCTION public.smartcampus_chat_can_access_course(
            target_course_id integer,
            target_profile_id uuid
        ) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT EXISTS (
                SELECT 1
                FROM "ChatProfiles" cp
                JOIN "Enrollments" e ON e."studentId" = cp."userId"
                JOIN "Users" u ON u.id = cp."userId"
                WHERE cp.id = target_profile_id
                  AND e."courseId" = target_course_id
                  AND u.role = 'student'
            );
        $$;

        CREATE OR REPLACE FUNCTION public.smartcampus_chat_profiles_share_course(
            first_profile_id uuid,
            second_profile_id uuid
        ) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT EXISTS (
                SELECT 1
                FROM "ChatProfiles" first_profile
                JOIN "Enrollments" first_enrollment
                  ON first_enrollment."studentId" = first_profile."userId"
                JOIN "Enrollments" second_enrollment
                  ON second_enrollment."courseId" = first_enrollment."courseId"
                JOIN "ChatProfiles" second_profile
                  ON second_profile."userId" = second_enrollment."studentId"
                JOIN "Users" first_user ON first_user.id = first_profile."userId"
                JOIN "Users" second_user ON second_user.id = second_profile."userId"
                WHERE first_profile.id = first_profile_id
                  AND second_profile.id = second_profile_id
                  AND first_profile.id <> second_profile.id
                  AND first_user.role = 'student'
                  AND second_user.role = 'student'
            );
        $$;

        CREATE OR REPLACE FUNCTION public.smartcampus_chat_can_view_profile(
            requester_profile_id uuid,
            target_profile_id uuid
        ) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT requester_profile_id = target_profile_id
                OR public.smartcampus_chat_profiles_share_course(
                    requester_profile_id,
                    target_profile_id
                );
        $$;

        REVOKE ALL ON FUNCTION public.smartcampus_chat_can_access_course(integer, uuid) FROM PUBLIC;
        REVOKE ALL ON FUNCTION public.smartcampus_chat_profiles_share_course(uuid, uuid) FROM PUBLIC;
        REVOKE ALL ON FUNCTION public.smartcampus_chat_can_view_profile(uuid, uuid) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.smartcampus_chat_can_access_course(integer, uuid) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.smartcampus_chat_profiles_share_course(uuid, uuid) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.smartcampus_chat_can_view_profile(uuid, uuid) TO authenticated;

        ALTER TABLE "ChatProfiles" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "ChatMessages" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "ChatMessages" REPLICA IDENTITY FULL;
        ALTER TABLE "ChatMessageMedia" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "ChatReadStates" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "ChatSavedMessages" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "ChatHiddenMessages" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "ChatProfilePermissions" ENABLE ROW LEVEL SECURITY;

        REVOKE ALL ON TABLE "ChatProfiles", "ChatMessages", "ChatReadStates",
            "ChatSavedMessages", "ChatHiddenMessages", "ChatMessageMedia",
            "ChatProfilePermissions" FROM anon, authenticated;
        GRANT SELECT ("id", "username", "fullName", "avatarUrl", "about")
            ON TABLE "ChatProfiles" TO authenticated;
        GRANT SELECT ON TABLE "ChatMessages" TO authenticated;
        GRANT SELECT, INSERT, DELETE ON TABLE "ChatSavedMessages" TO authenticated;
        GRANT SELECT, INSERT, DELETE ON TABLE "ChatHiddenMessages" TO authenticated;

        DROP POLICY IF EXISTS chat_profiles_shared_students ON "ChatProfiles";
        CREATE POLICY chat_profiles_shared_students ON "ChatProfiles"
            FOR SELECT TO authenticated
            USING (public.smartcampus_chat_can_view_profile(auth.uid(), id));

        DROP POLICY IF EXISTS chat_messages_participant_access ON "ChatMessages";
        CREATE POLICY chat_messages_participant_access ON "ChatMessages"
            FOR SELECT TO authenticated
            USING (
                (
                    "courseId" IS NOT NULL
                    AND public.smartcampus_chat_can_access_course("courseId", auth.uid())
                )
                OR (
                    "courseId" IS NULL
                    AND "receiverProfileId" IS NOT NULL
                    AND ("senderProfileId" = auth.uid() OR "receiverProfileId" = auth.uid())
                )
            );

        DROP POLICY IF EXISTS chat_messages_member_insert ON "ChatMessages";
        CREATE POLICY chat_messages_member_insert ON "ChatMessages"
            FOR INSERT TO authenticated
            WITH CHECK (
                "senderProfileId" = auth.uid()
                AND (
                    (
                        "courseId" IS NOT NULL
                        AND "receiverProfileId" IS NULL
                        AND public.smartcampus_chat_can_access_course("courseId", auth.uid())
                    )
                    OR (
                        "courseId" IS NULL
                        AND "receiverProfileId" IS NOT NULL
                        AND "receiverProfileId" <> auth.uid()
                    )
                )
            );

        DROP POLICY IF EXISTS chat_read_states_owner ON "ChatReadStates";
        CREATE POLICY chat_read_states_owner ON "ChatReadStates"
            FOR ALL TO authenticated
            USING ("profileId" = auth.uid())
            WITH CHECK ("profileId" = auth.uid());

        DROP POLICY IF EXISTS chat_saved_messages_owner ON "ChatSavedMessages";
        CREATE POLICY chat_saved_messages_owner ON "ChatSavedMessages"
            FOR ALL TO authenticated
            USING (
                "profileId" = auth.uid()
                AND EXISTS (SELECT 1 FROM "ChatMessages" m WHERE m.id = "messageId")
            )
            WITH CHECK (
                "profileId" = auth.uid()
                AND EXISTS (SELECT 1 FROM "ChatMessages" m WHERE m.id = "messageId")
            );

        DROP POLICY IF EXISTS chat_hidden_messages_owner ON "ChatHiddenMessages";
        CREATE POLICY chat_hidden_messages_owner ON "ChatHiddenMessages"
            FOR ALL TO authenticated
            USING (
                "profileId" = auth.uid()
                AND EXISTS (SELECT 1 FROM "ChatMessages" m WHERE m.id = "messageId")
            )
            WITH CHECK (
                "profileId" = auth.uid()
                AND EXISTS (SELECT 1 FROM "ChatMessages" m WHERE m.id = "messageId")
            );

        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
            ) AND NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime'
                  AND schemaname = 'public'
                  AND tablename = 'ChatMessages'
            ) THEN
                ALTER PUBLICATION supabase_realtime ADD TABLE public."ChatMessages";
            END IF;
        END
        $$;
    `);
};
