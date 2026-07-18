begin;

create table public.video_generations (
  id uuid primary key,
  project_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  variation_seed text not null check (variation_seed ~ '^[a-f0-9]{32}$'),
  template_id text,
  layout_family text,
  palette_id text,
  heading_font text,
  body_font text,
  asset_ids jsonb not null default '[]'::jsonb,
  scene_fingerprints jsonb not null default '[]'::jsonb,
  creative_fingerprint text,
  canva_design_id text,
  canva_edit_url text,
  canva_view_url text,
  canva_template_id text,
  inspector jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index video_generations_project_recent_idx on public.video_generations(project_id, created_at desc);
alter table public.video_generations enable row level security;
revoke all on public.video_generations from anon, authenticated;

commit;
