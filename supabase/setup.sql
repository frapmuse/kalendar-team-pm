-- Kalendar Team PM: setup Supabase (jalankan SEKALI dalam Supabase > SQL Editor).
-- Selamat dijalankan semula. Tiada PIN dalam fail ini; PIN ditetapkan di langkah berasingan (lihat README).
--
-- Reka bentuk keselamatan:
--   * Kunci "anon/publishable" dalam app memang awam. Ia TIDAK boleh baca/tulis jadual terus.
--   * App hanya boleh panggil 3 fungsi (avail_list, avail_toggle, avail_note) dan setiap fungsi semak PIN team dulu.
--   * PIN disimpan dalam skema "private" yang tidak didedahkan melalui API.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.avail_settings (
  key   text primary key,
  value text not null
);

create table if not exists public.avail_marks (
  date    date        not null,
  person  text        not null check (person in ('Firdaus', 'Amin', 'Hana', 'Amalina')),
  slot    text        not null default 'hari' check (slot in ('hari', 'pagi', 'petang')),
  note    text        not null default '' check (char_length(note) <= 60),
  updated timestamptz not null default now(),
  primary key (date, person, slot)
);
alter table public.avail_marks enable row level security;   -- tiada policy = tiada akses terus
revoke all on public.avail_marks from anon, authenticated;

create or replace function private.avail_check_pin(p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  select value into v from private.avail_settings where key = 'team_pin';
  if v is null then raise exception 'PIN team belum ditetapkan'; end if;
  if p_pin is distinct from v then
    perform pg_sleep(1);  -- lambatkan teka PIN
    raise exception 'PIN salah';
  end if;
end $$;
revoke all on function private.avail_check_pin(text) from public, anon, authenticated;

create or replace function public.avail_list(p_pin text)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.avail_check_pin(p_pin);
  return coalesce((
    select json_agg(json_build_object(
      'date', to_char(m.date, 'YYYY-MM-DD'), 'person', m.person, 'slot', m.slot,
      'note', m.note, 'updated', m.updated) order by m.date, m.person)
    from public.avail_marks m), '[]'::json);
end $$;

create or replace function public.avail_toggle(p_pin text, p_date date, p_person text)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.avail_check_pin(p_pin);
  delete from public.avail_marks where date = p_date and person = p_person and slot = 'hari';
  if not found then
    insert into public.avail_marks (date, person) values (p_date, p_person);
  end if;
  return public.avail_list(p_pin);
end $$;

create or replace function public.avail_note(p_pin text, p_date date, p_person text, p_note text)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.avail_check_pin(p_pin);
  update public.avail_marks set note = left(coalesce(p_note, ''), 60), updated = now()
   where date = p_date and person = p_person and slot = 'hari';
  return public.avail_list(p_pin);
end $$;

revoke all on function public.avail_list(text), public.avail_toggle(text, date, text), public.avail_note(text, date, text, text) from public;
grant execute on function public.avail_list(text), public.avail_toggle(text, date, text), public.avail_note(text, date, text, text) to anon, authenticated;
