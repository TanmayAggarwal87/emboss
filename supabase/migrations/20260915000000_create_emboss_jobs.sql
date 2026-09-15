-- Phase 0 persistence only. Uploaded files, raster images, and exported packages
-- intentionally do not live in Supabase Storage for Emboss v1.

create extension if not exists pgcrypto;

create type public.emboss_job_status as enum (
  'processing',
  'ready_for_review',
  'exported',
  'failed'
);

create type public.emboss_region_type as enum (
  'text',
  'diagram',
  'table'
);

create type public.emboss_review_status as enum (
  'pending',
  'approved',
  'edit_requested',
  'rejected'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  status public.emboss_job_status not null default 'processing',
  created_at timestamptz not null default now(),
  page_count integer not null check (page_count between 2 and 3),
  error_message text
);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  type public.emboss_region_type not null,
  bounding_box jsonb not null,
  review_status public.emboss_review_status not null default 'pending',
  extracted_data jsonb,
  geometry jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index regions_job_id_idx on public.regions(job_id);
create index regions_job_page_idx on public.regions(job_id, page_number);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger regions_set_updated_at
before update on public.regions
for each row execute function public.set_updated_at();

-- The app uses a server-only service-role client. With no authentication in v1,
-- no browser client should directly read or write job state.
alter table public.jobs enable row level security;
alter table public.regions enable row level security;
