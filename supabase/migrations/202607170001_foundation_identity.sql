begin;

create extension if not exists pgcrypto with schema extensions;

create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.membership_status as enum ('active', 'invited', 'suspended');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  avatar_object_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_members_user_active_idx
  on public.workspace_members (user_id, workspace_id)
  where status = 'active';
create index audit_logs_workspace_created_idx on public.audit_logs (workspace_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid, public.workspace_role[]) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  requested_name text;
  generated_slug text;
begin
  requested_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'workspace_name'), ''), 'My Studio'), 80);
  generated_slug := trim(both '-' from regexp_replace(lower(requested_name), '[^a-z0-9]+', '-', 'g'));
  if generated_slug = '' then generated_slug := 'studio'; end if;
  generated_slug := left(generated_slug, 50) || '-' || substr(replace(new.id::text, '-', ''), 1, 10);

  insert into public.profiles (user_id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 100));

  insert into public.workspaces (name, slug, created_by)
  values (requested_name, generated_slug, new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (new_workspace_id, new.id, 'owner', 'active');

  insert into public.audit_logs (workspace_id, actor_user_id, action, target_type, target_id)
  values (new_workspace_id, new.id, 'workspace.created', 'workspace', new_workspace_id::text);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self_or_coworker on public.profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and theirs.user_id = profiles.user_id and theirs.status = 'active'
  )
);
create policy profiles_update_self on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy workspaces_select_member on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_update_admin on public.workspaces
for update to authenticated
using (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));

create policy workspace_members_select_member on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_members_insert_admin on public.workspace_members
for insert to authenticated
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy workspace_members_update_admin on public.workspace_members
for update to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy workspace_members_delete_admin on public.workspace_members
for delete to authenticated
using (
  public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
  and not (user_id = (select auth.uid()) and role = 'owner')
);

create policy audit_logs_select_admin on public.audit_logs
for select to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

revoke all on public.profiles, public.workspaces, public.workspace_members, public.audit_logs from anon;
grant select, update on public.profiles to authenticated;
grant select, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select on public.audit_logs to authenticated;

commit;
