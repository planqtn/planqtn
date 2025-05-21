create table "public"."tasks" (
    "uuid" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" uuid not null,
    "sent_at" timestamp with time zone,
    "started_at" timestamp without time zone,
    "ended_at" timestamp without time zone,
    "state" smallint,
    "args" json,
    "updates" json,
    "result" json);


alter table "public"."tasks" enable row level security;

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant references on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant trigger on table "public"."tasks" to "anon";

grant truncate on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";


create policy "INSERT user's own rows only"
on "public"."tasks"
as permissive
for INSERT
to public
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "SELECT user's own rows only"
on "public"."tasks"
as permissive
for SELECT
to public
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "UPDATE user's own rows only"
on "public"."tasks"
as permissive
for UPDATE
to public
using ((( SELECT auth.uid() AS uid) = user_id));
