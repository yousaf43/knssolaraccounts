create or replace function public.list_unclaimed_devices()
returns table (id uuid, serial text, name text, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public, private
as $$
  select d.id, d.serial, d.name, d.last_seen_at
  from public.attendance_devices d
  where d.company_id is null
    and private.current_company_id() is not null
  order by d.last_seen_at desc nulls last
  limit 20
$$;

create or replace function public.claim_attendance_device(_id uuid, _name text default null)
returns public.attendance_devices
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  rec public.attendance_devices;
begin
  if private.current_company_id() is null then
    raise exception 'No company context';
  end if;

  update public.attendance_devices
     set company_id = private.current_company_id(),
         user_id = auth.uid(),
         name = coalesce(nullif(_name, ''), name),
         updated_at = now()
   where id = _id
     and company_id is null
  returning * into rec;

  if rec.id is null then
    raise exception 'Device not available to claim';
  end if;

  return rec;
end;
$$;

revoke all on function public.list_unclaimed_devices() from public;
revoke all on function public.claim_attendance_device(uuid, text) from public;
grant execute on function public.list_unclaimed_devices() to authenticated;
grant execute on function public.claim_attendance_device(uuid, text) to authenticated;