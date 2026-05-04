-- is_admin(): kshh423@naver.com (카카오 로그인) 추가
create or replace function is_admin() returns boolean
  language sql stable security definer as $$
    select coalesce(
      (auth.jwt() ->> 'email') in ('kshh423@gmail.com', 'kshh423@naver.com'),
      false
    );
$$;
