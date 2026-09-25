-- Emboss v1 accepts short PDFs containing one to three pages.
alter table public.jobs
  drop constraint if exists jobs_page_count_check;

alter table public.jobs
  add constraint jobs_page_count_check check (page_count between 1 and 3);
