-- ForensiDent: run this once in Supabase › SQL Editor › New query › Run

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  is_pro boolean not null default false,
  pro_since timestamptz,
  order_id text
);

alter table public.profiles enable row level security;

-- each user may only read their own row; nobody can change it from the app
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- create a profile row automatically for every new account
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- To give someone Pro for free: Table Editor › profiles › set is_pro = true
