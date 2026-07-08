create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text not null,
  action text not null,
  target text,
  details jsonb
);

alter table public.system_logs enable row level security;

create policy "Admins podem ler logs"
  on public.system_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid() and profiles.role = 'admin'
    )
  );
