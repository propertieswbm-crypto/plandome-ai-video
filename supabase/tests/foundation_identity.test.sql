begin;
select plan(8);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'workspaces', 'workspaces table exists');
select has_table('public', 'workspace_members', 'workspace_members table exists');
select has_table('public', 'audit_logs', 'audit log table exists');
select policies_are('public', 'workspaces', array['workspaces_select_member', 'workspaces_update_admin']);
select policies_are('public', 'profiles', array['profiles_select_self_or_coworker', 'profiles_update_self']);
select col_is_pk('public', 'profiles', 'user_id', 'profile user id is the primary key');
select col_is_pk('public', 'workspace_members', array['workspace_id', 'user_id'], 'membership has a composite primary key');

select * from finish();
rollback;
