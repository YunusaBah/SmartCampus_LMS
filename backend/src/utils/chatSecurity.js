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
        -- These helper functions are only needed by RLS policies. Keep them out
        -- of the Data API exposed public schema and grant access only to signed-in
        -- users whose JWT subject is a SmartCampus ChatProfile UUID.
        CREATE SCHEMA IF NOT EXISTS private;
        REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
        GRANT USAGE ON SCHEMA private TO authenticated;

        CREATE OR REPLACE FUNCTION private.smartcampus_chat_can_access_course(
            target_course_id integer,
            target_profile_id uuid
        ) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = ''
        AS $$
            SELECT EXISTS (
                SELECT 1
                FROM public."ChatProfiles" cp
                JOIN public."Enrollments" e ON e."studentId" = cp."userId"
                JOIN public."Users" u ON u.id = cp."userId"
                WHERE cp.id = target_profile_id
                  AND e."courseId" = target_course_id
                  AND u.role = 'student'
            );
        $$;

        CREATE OR REPLACE FUNCTION private.smartcampus_chat_profiles_share_course(
            first_profile_id uuid,
            second_profile_id uuid
        ) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = ''
        AS $$
            SELECT EXISTS (
                SELECT 1
                FROM public."ChatProfiles" first_profile
                JOIN public."Enrollments" first_enrollment
                  ON first_enrollment."studentId" = first_profile."userId"
                JOIN public."Enrollments" second_enrollment
                  ON second_enrollment."courseId" = first_enrollment."courseId"
                JOIN public."ChatProfiles" second_profile
                  ON second_profile."userId" = second_enrollment."studentId"
                JOIN public."Users" first_user ON first_user.id = first_profile."userId"
                JOIN public."Users" second_user ON second_user.id = second_profile."userId"
                WHERE first_profile.id = first_profile_id
                  AND second_profile.id = second_profile_id
                  AND first_profile.id <> second_profile.id
                  AND first_user.role = 'student'
                  AND second_user.role = 'student'
            );
        $$;

        CREATE OR REPLACE FUNCTION private.smartcampus_chat_can_view_profile(
            requester_profile_id uuid,
            target_profile_id uuid
        ) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = ''
        AS $$
            SELECT requester_profile_id = target_profile_id
                OR private.smartcampus_chat_profiles_share_course(
                    requester_profile_id,
                    target_profile_id
                );
        $$;

        REVOKE ALL ON FUNCTION private.smartcampus_chat_can_access_course(integer, uuid)
            FROM PUBLIC, anon, authenticated, service_role;
        REVOKE ALL ON FUNCTION private.smartcampus_chat_profiles_share_course(uuid, uuid)
            FROM PUBLIC, anon, authenticated, service_role;
        REVOKE ALL ON FUNCTION private.smartcampus_chat_can_view_profile(uuid, uuid)
            FROM PUBLIC, anon, authenticated, service_role;
        GRANT EXECUTE ON FUNCTION private.smartcampus_chat_can_access_course(integer, uuid)
            TO authenticated;
        GRANT EXECUTE ON FUNCTION private.smartcampus_chat_profiles_share_course(uuid, uuid)
            TO authenticated;
        GRANT EXECUTE ON FUNCTION private.smartcampus_chat_can_view_profile(uuid, uuid)
            TO authenticated;

        -- Direct Data API access is intentionally limited to the two read-only
        -- chat tables required by Realtime. Application writes and all LMS data
        -- continue to go through the authenticated Express API.
        REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
            FROM PUBLIC, anon, authenticated;
        REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
            FROM PUBLIC, anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
            REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
            REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
            REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

        GRANT SELECT ("id", "username", "fullName", "avatarUrl", "about")
            ON TABLE public."ChatProfiles" TO authenticated;
        GRANT SELECT ON TABLE public."ChatMessages" TO authenticated;

        ALTER TABLE public."ChatProfiles" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public."ChatMessages" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public."ChatMessages" REPLICA IDENTITY FULL;
        ALTER TABLE public."ChatMessageMedia" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public."ChatReadStates" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public."ChatSavedMessages" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public."ChatHiddenMessages" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public."ChatProfilePermissions" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS chat_profiles_shared_students ON public."ChatProfiles";
        CREATE POLICY chat_profiles_shared_students ON public."ChatProfiles"
            FOR SELECT TO authenticated
            USING (private.smartcampus_chat_can_view_profile((SELECT auth.uid()), id));

        DROP POLICY IF EXISTS chat_messages_participant_access ON public."ChatMessages";
        CREATE POLICY chat_messages_participant_access ON public."ChatMessages"
            FOR SELECT TO authenticated
            USING (
                (
                    "courseId" IS NOT NULL
                    AND private.smartcampus_chat_can_access_course("courseId", (SELECT auth.uid()))
                )
                OR (
                    "courseId" IS NULL
                    AND "receiverProfileId" IS NOT NULL
                    AND ("senderProfileId" = (SELECT auth.uid()) OR "receiverProfileId" = (SELECT auth.uid()))
                )
            );

        DROP POLICY IF EXISTS chat_messages_member_insert ON public."ChatMessages";
        CREATE POLICY chat_messages_member_insert ON public."ChatMessages"
            FOR INSERT TO authenticated
            WITH CHECK (
                "senderProfileId" = (SELECT auth.uid())
                AND (
                    (
                        "courseId" IS NOT NULL
                        AND "receiverProfileId" IS NULL
                        AND private.smartcampus_chat_can_access_course("courseId", (SELECT auth.uid()))
                    )
                    OR (
                        "courseId" IS NULL
                        AND "receiverProfileId" IS NOT NULL
                        AND "receiverProfileId" <> (SELECT auth.uid())
                    )
                )
            );

        DROP POLICY IF EXISTS chat_read_states_owner ON public."ChatReadStates";
        CREATE POLICY chat_read_states_owner ON public."ChatReadStates"
            FOR ALL TO authenticated
            USING ("profileId" = (SELECT auth.uid()))
            WITH CHECK ("profileId" = (SELECT auth.uid()));

        DROP POLICY IF EXISTS chat_saved_messages_owner ON public."ChatSavedMessages";
        CREATE POLICY chat_saved_messages_owner ON public."ChatSavedMessages"
            FOR ALL TO authenticated
            USING (
                "profileId" = (SELECT auth.uid())
                AND EXISTS (SELECT 1 FROM public."ChatMessages" m WHERE m.id = "messageId")
            )
            WITH CHECK (
                "profileId" = (SELECT auth.uid())
                AND EXISTS (SELECT 1 FROM public."ChatMessages" m WHERE m.id = "messageId")
            );

        DROP POLICY IF EXISTS chat_hidden_messages_owner ON public."ChatHiddenMessages";
        CREATE POLICY chat_hidden_messages_owner ON public."ChatHiddenMessages"
            FOR ALL TO authenticated
            USING (
                "profileId" = (SELECT auth.uid())
                AND EXISTS (SELECT 1 FROM public."ChatMessages" m WHERE m.id = "messageId")
            )
            WITH CHECK (
                "profileId" = (SELECT auth.uid())
                AND EXISTS (SELECT 1 FROM public."ChatMessages" m WHERE m.id = "messageId")
            );

        -- Remove the old callable public API functions after all policies point
        -- to the private equivalents.
        REVOKE ALL ON FUNCTION public.smartcampus_chat_can_access_course(integer, uuid)
            FROM PUBLIC, anon, authenticated, service_role;
        REVOKE ALL ON FUNCTION public.smartcampus_chat_profiles_share_course(uuid, uuid)
            FROM PUBLIC, anon, authenticated, service_role;
        REVOKE ALL ON FUNCTION public.smartcampus_chat_can_view_profile(uuid, uuid)
            FROM PUBLIC, anon, authenticated, service_role;
        DROP FUNCTION IF EXISTS public.smartcampus_chat_can_access_course(integer, uuid);
        DROP FUNCTION IF EXISTS public.smartcampus_chat_profiles_share_course(uuid, uuid);
        DROP FUNCTION IF EXISTS public.smartcampus_chat_can_view_profile(uuid, uuid);

        -- This is invoked by a PostgreSQL event trigger, not by application RPC.
        REVOKE ALL ON FUNCTION public.rls_auto_enable()
            FROM PUBLIC, anon, authenticated, service_role;

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
