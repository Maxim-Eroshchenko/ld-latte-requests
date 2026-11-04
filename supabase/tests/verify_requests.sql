-- SQL Editor: replace the two UUID placeholders with EXISTING Auth test users.
-- Run this entire file as postgres, after applying the requests migration.
-- No passwords or privileged API keys are needed. All test writes are rolled back.
begin;
select set_config('ld_latte.test_a', 'REPLACE_WITH_USER_A_UUID', true);
select set_config('ld_latte.test_b', 'REPLACE_WITH_USER_B_UUID', true);

do $$
declare a uuid := current_setting('ld_latte.test_a')::uuid;
        b uuid := current_setting('ld_latte.test_b')::uuid;
begin
 if a = b then raise exception 'Choose two DIFFERENT Auth users'; end if;
 if not exists(select 1 from auth.users where id = a)
    or not exists(select 1 from auth.users where id = b) then
   raise exception 'Both UUIDs must exist in auth.users';
 end if;
 if not exists(select 1 from pg_class where oid = 'public.requests'::regclass
               and relrowsecurity and relforcerowsecurity) then
   raise exception 'Requests RLS must be enabled and forced';
 end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('ld_latte.test_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ld_latte.test_a'), 'role', 'authenticated')::text, true);
do $$
declare r public.requests%rowtype;
begin
 if current_user <> 'authenticated' or auth.uid() <> current_setting('ld_latte.test_a')::uuid then
   raise exception 'Test A is not running as an authenticated owner';
 end if;
 insert into public.requests(title, description, category)
 values ('SQL RLS temporary A', 'Rolled back at the end', 'Бот') returning * into r;
 if r.user_id <> auth.uid() or r.status <> 'Новая' or r.created_at is null or r.updated_at is null then
   raise exception 'Incorrect defaults for A';
 end if;
 perform set_config('ld_latte.request_a', r.id::text, true);
end $$;

select set_config('request.jwt.claim.sub', current_setting('ld_latte.test_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ld_latte.test_b'), 'role', 'authenticated')::text, true);
do $$
declare r public.requests%rowtype; changed integer;
begin
 if current_user <> 'authenticated' or auth.uid() <> current_setting('ld_latte.test_b')::uuid then
   raise exception 'Test B is not running as an authenticated owner';
 end if;
 if exists(select 1 from public.requests where user_id <> auth.uid()) then
   raise exception 'B can read another owner in the list';
 end if;
 if exists(select 1 from public.requests where id = current_setting('ld_latte.request_a')::uuid) then
   raise exception 'B can read A by UUID';
 end if;
 update public.requests set title = 'Unauthorized B change'
 where id = current_setting('ld_latte.request_a')::uuid;
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'B modified A'; end if;
 insert into public.requests(title, description, category)
 values ('SQL RLS temporary B', 'Rolled back at the end', 'Отчёт') returning * into r;
 if r.user_id <> auth.uid() then raise exception 'Incorrect owner for B'; end if;
 perform set_config('ld_latte.request_b', r.id::text, true);
 begin
   insert into public.requests(title, description, category, user_id)
   values ('Spoof', 'Must fail', 'Бот', current_setting('ld_latte.test_a')::uuid);
   raise exception 'Owner spoof INSERT was allowed';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.requests set user_id = current_setting('ld_latte.test_a')::uuid where id = r.id;
   raise exception 'Owner transfer UPDATE was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('ld_latte.test_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('ld_latte.test_a'), 'role', 'authenticated')::text, true);
do $$
declare r public.requests%rowtype; changed integer;
begin
 if exists(select 1 from public.requests where user_id <> auth.uid())
    or exists(select 1 from public.requests where id = current_setting('ld_latte.request_b')::uuid) then
   raise exception 'A can read B';
 end if;
 update public.requests set title = 'Unauthorized A change'
 where id = current_setting('ld_latte.request_b')::uuid;
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'A modified B'; end if;
 select * into strict r from public.requests where id = current_setting('ld_latte.request_a')::uuid;
 if r.title <> 'SQL RLS temporary A' then raise exception 'B changed A data'; end if;
 update public.requests set title = 'Edited A', description = 'Edited description', category = 'Другое', status = 'В работе'
 where id = r.id returning * into r;
 if r.title <> 'Edited A' or r.status <> 'В работе' then raise exception 'Owner edit failed'; end if;
 begin
   update public.requests set user_id = current_setting('ld_latte.test_b')::uuid where id = r.id;
   raise exception 'A can transfer ownership';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.requests set title = E'\t\n' where id = r.id;
   raise exception 'Whitespace-only title was accepted';
 exception when check_violation then null;
 end;
 begin
   update public.requests set description = '' where id = r.id;
   raise exception 'Empty description was accepted';
 exception when check_violation then null;
 end;
 begin
   update public.requests set category = 'Invalid' where id = r.id;
   raise exception 'Invalid category was accepted';
 exception when check_violation then null;
 end;
 begin
   update public.requests set status = 'Invalid' where id = r.id;
   raise exception 'Invalid status was accepted';
 exception when check_violation then null;
 end;
 begin
   insert into public.requests(title, description, category, status) values ('Spoof status', 'Must fail', 'Бот', 'Завершена');
   raise exception 'Initial status spoof was accepted';
 exception when insufficient_privilege then null;
 end;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
 begin
   perform 1 from public.requests;
   raise exception 'Anonymous SELECT privilege was allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select 'PASS: PostgreSQL RLS and column permissions checked for A/B. API/Auth not tested by this SQL script.' as result;
rollback;
