begin;
create table public.requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (length(title) between 1 and 160 and title ~ '[^[:space:]]'),
 description text not null check (length(description) between 1 and 10000 and description ~ '[^[:space:]]'),
 category text not null check (category in ('Бот','Интеграция','Отчёт','Другое')),
 status text not null default 'Новая' check (status in ('Новая','В работе','Завершена')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index requests_owner_date_idx on public.requests(user_id,created_at desc);
create index requests_owner_status_idx on public.requests(user_id,status);
alter table public.requests enable row level security;
alter table public.requests force row level security;
revoke all on public.requests from anon, authenticated;
grant select on public.requests to authenticated;
-- Clients may neither supply an owner/initial status nor modify ownership/timestamps.
grant insert(title,description,category) on public.requests to authenticated;
grant update(title,description,category,status) on public.requests to authenticated;
create policy requests_select_own on public.requests for select to authenticated
 using (user_id = (select auth.uid()));
create policy requests_insert_own on public.requests for insert to authenticated
 with check (user_id = (select auth.uid()) and status = 'Новая');
create policy requests_update_own on public.requests for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));
create function public.touch_request() returns trigger language plpgsql set search_path = '' as $$
begin
 new.updated_at = now();
 return new;
end;
$$;
create trigger requests_touch before update on public.requests
 for each row execute function public.touch_request();
revoke all on function public.touch_request() from public, anon, authenticated;
commit;
