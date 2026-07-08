create index system_logs_user_id_idx on public.system_logs (user_id);
create index system_logs_created_at_idx on public.system_logs (created_at desc);
