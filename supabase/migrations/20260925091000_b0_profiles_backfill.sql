-- B0: 레거시 정책 정리 및 trigger 도입 전 계정의 profile 보정

-- profile row는 서버(auth trigger)만 만든다. 클라이언트 insert 경로는 제거한다.
drop policy if exists profiles_insert_own on public.profiles;

-- trigger 적용 전에 만들어진 auth user에게 profile row를 채운다.
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;
