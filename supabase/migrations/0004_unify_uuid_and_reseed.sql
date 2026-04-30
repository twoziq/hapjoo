-- 자동 생성: scripts/generate-seed-sql.mjs
-- songs.id를 uuid로 통일 + 65곡 reseed.
-- 실행: Supabase Dashboard SQL Editor에서 통째 붙여넣기.
-- 0001(schema) ~ 0003(song_change_requests) 적용된 DB가 전제.

begin;

-- 1) 기존 songs 데이터 + cascade로 의존 테이블(user_songs/collection_songs/rooms/song_change_requests) 비우기
truncate table songs cascade;

-- 2) songs.id를 참조하는 의존성(policy, function, FK) 모두 떼기
--    PostgreSQL: 컬럼 타입 변경 시 그 컬럼을 참조하는 policy/FK가 있으면 ERROR 0A000.
drop policy if exists "Editors update songs" on songs;
drop function if exists can_edit_song(text);
alter table user_songs           drop constraint if exists user_songs_song_id_fkey;
alter table collection_songs     drop constraint if exists collection_songs_song_id_fkey;
alter table rooms                drop constraint if exists rooms_song_id_fkey;
alter table song_change_requests drop constraint if exists song_change_requests_song_id_fkey;

-- 3) 모든 관련 컬럼 text → uuid (테이블 비어있어 cast 트리거 없음)
alter table songs alter column id drop default;
alter table songs alter column id type uuid using id::uuid;
alter table songs alter column id set default gen_random_uuid();
alter table user_songs           alter column song_id type uuid using song_id::uuid;
alter table collection_songs     alter column song_id type uuid using song_id::uuid;
alter table rooms                alter column song_id type uuid using song_id::uuid;
alter table song_change_requests alter column song_id type uuid using song_id::uuid;

-- 4) function/policy/FK 재생성 (signature는 uuid 기반으로)
create or replace function can_edit_song(sid uuid) returns boolean
  language sql stable security definer as $$
    select is_admin() or exists (
      select 1 from collection_songs cs
        join collection_members cm on cm.collection_id = cs.collection_id
       where cs.song_id = sid and cm.user_id = auth.uid()
    );
$$;

create policy "Editors update songs" on songs for update using (can_edit_song(id));

alter table user_songs add constraint user_songs_song_id_fkey
  foreign key (song_id) references songs(id) on delete cascade;
alter table collection_songs add constraint collection_songs_song_id_fkey
  foreign key (song_id) references songs(id) on delete cascade;
alter table rooms add constraint rooms_song_id_fkey
  foreign key (song_id) references songs(id);
alter table song_change_requests add constraint song_change_requests_song_id_fkey
  foreign key (song_id) references songs(id) on delete cascade;

-- 4) song_change_requests: proposed_id 제거 + 일관성 제약 갱신
alter table song_change_requests drop constraint if exists song_change_requests_kind_consistency;
alter table song_change_requests drop column if exists proposed_id;
alter table song_change_requests add constraint song_change_requests_kind_consistency check (
  (kind = 'create' and song_id is null) or
  (kind = 'edit'   and song_id is not null)
);

-- 5) approve RPC 재정의: create 시 RETURNING으로 새 uuid 받기
create or replace function approve_song_change_request(req_id uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  r record;
  applied_id uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from song_change_requests where id = req_id and status = 'pending';
  if r is null then raise exception 'not found or not pending'; end if;

  if r.kind = 'create' then
    insert into songs (title, artist, key, capo, bpm, content)
    values (r.title, r.artist, r.music_key, r.capo, r.bpm, r.content)
    returning id into applied_id;
  else
    update songs set
      title = r.title, artist = r.artist, key = r.music_key,
      capo = r.capo, bpm = r.bpm, content = r.content
     where id = r.song_id;
    applied_id := r.song_id;
  end if;

  update song_change_requests set
    status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   where id = req_id;
  return applied_id;
end $$;
revoke all on function approve_song_change_request(uuid) from public;
grant execute on function approve_song_change_request(uuid) to authenticated;

-- 6) 65곡 seed (id는 DB가 gen_random_uuid()로 자동 발급)
insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '0310',
  'The New Gap',
  'D',
  0,
  100,
  null,
  $song${title: 0310}
{artist: The New Gap}
{key: D}
{capo: 0}
{bpm: 100}

[Verse 1]
[D]You smoked and you [Am7]looked at me | [G6]I hate it [Gmaj7]when you do |
[D]I said "No, thanks" [Am7]to you, you asked me | [G6]If I was okay, [Gmaj7]what if I wasn't? |
[D]Leaving is fine, [Am7]it's just | [G6]I don't wanna be all by [Gmaj7]myself again |
[D]Like every time, [Am7]like every [G6]last time | [Gmaj7] |

[Chorus 1]
[D]You knew that I was [Am7]no good for you | [G]When we lay down [Gmaj7]after doing that |
[D]Things you loved, [Am7]you knew that I | [G]wasn't better than [Gmaj7]you |
[D]I hope that I could [Am7]be, seemed really [G]fine with your [Gmaj7]leaving |
[D] | [Am7] | [G] | [Gmaj7] |

[Verse 2]
[D]You stroked me and [Am7]stared at me | [G]I like it [Gmaj7]when you do |
[D]I said "I know you love [Am7]me, too," I asked [G]you | "If you are the [Gmaj7]same, what if I quit it?" |
[D]Leaving is fine, [Am7]it's just | [G]I don't wanna be falling [Gmaj7]behind again |
[D]Like every time, [Am7]like every [G]moment in the [Gmaj7]end |

[Bridge]
[D]Suddenly, all the [Am7]things complicated | [G]You could only fix [Gmaj7]it, but my lips won't |
[D]Let me tell the [Am7]truth. | [G]Tell me how not to get hurt or [Gmaj7]broken |
[D]Even if you can't [Am7]afford loving [G]me [Gmaj7]anymore |
[D] | [Am7] | [G] | [Gmaj7] |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '너에게 난 나에게 넌',
  '자전거 탄 풍경',
  'G',
  0,
  74,
  null,
  $song${title: 너에게 난 나에게 넌}
{artist: 자전거 탄 풍경}
{key: G}
{capo: 0}
{bpm: 74}

[Chorus]
[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |
[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |

[Verse 1]
[G.D.]나에게 넌 | [Em.Bm.]내 외롭던 지난 시간을 | [C.G.]환하게 비춰주던 | [Am.D.]햇살이 되고 |
[G.D.]조그맣던 | [Em.G.]너의 하얀 손 위에 | [C.G.]빛나는 보석처럼 | [Am.D.]영원의 약속이 되어 |

[Chorus]
[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |
[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |

[Interlude]
[C.D.] ||
[G.D.] | [Em.Bm.] | [C.G.] | [Am.D.] |

[Verse 2]
[G.D.]나에게 넌 | [Em.Bm.]초록의 슬픈 노래로 | [C.G.]내 작은 가슴 속에 | [Am.D.]이렇게 남아 |
[G.D.]반짝이던 | [Em.G.]너의 예쁜 눈망울에 | [C.G.]수많은 별이 되어 | [Am.D.]영원토록 빛나고 싶어 |

[Chorus]
[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |
[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |

[Chorus]
[G.D.]너에게 난 | [Em.Bm.]해질 | [C.G.]녘 노을처럼 한편의 아 | [Am.D.]름다운 추억이 되고 |
[G.D.]소중했던 우리 | [Em.G.]푸르던 날을 기억하며 | [C.G.]우 후회 없이 | [Am.D.]그림처럼 남아주기를 |

[Outro]
[Am.C.]그림처럼 남아주기를 | [D.G.] |
$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '노래방에서',
  '장범준',
  'C',
  0,
  100,
  null,
  $song${title: 노래방에서}
{artist: 장범준}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[C]나는 사랑이 | [Gsus/B]어렵고 | [Am7]이뤄지는지 | [Dm7]연극했지 |
[Fmaj7]사랑 때문에 | [G]불렀던 | [Em7]노래는 가 | [Am7]련한 이 |
[Dm7]날에는 새들도 | [G]모두 | [C] | [Gm7.C7.] |

[Verse 2]
[C]너가 좋아하는 | [Gsus/B]노랠 | [Am7]알아내는 것은 | [Dm7]필수 |
[Fmaj7]근데 그 낸 남자 | [G]친구는 없었지 | [Em7]그것은 내 | [Am7]실수 |
[Dm7]마이크 조절이 | [G]꽤 장히 | [C]조심스러 | [F/G]웠었지 |
[Dm7]복잡한 맘 | [G]달랬네 | [C]맨날 올 | [Gm7.C7.]르가 노래에 갔었지 |

[Chorus]
[Fmaj7]나는 그렇게 | [G/F]노래방으로 | [Em7]그녀가 좋아하는 | [Am7]노래를 |
[Dm7]그렇게 노래방이 | [G]취미가 되고 | [C]그녀가 좋아하는 | [Gm7.C7.]노래를 |

[Bridge]
[Fmaj7]내가 멋있는 척 | [G/F]노랠 불렀지 | [Em7]네 어이 | [Am7] |
[Dm7]괜찮은 척 | [G]노랠 불렀지 | [C]네 어이 | [Gm7.C7.] |

[Outro]
[Dm7]그렇게 내가 노랠 | [G]불렀지 | [C]그녀의 반응을 | [Gm7.C7.]상상하곤 |
[Dm7]그렇게 내가 노랠 | [F/G]불렀지 | [C]우연히 집에 가려 | [Gm7.C7.]하는데 |
[Dm7]좀 터질 불어볼 | [F/G]뻔 | [C]노랠 하던 그녀가 | [Dm7.F/G.] |
[C]갑자기 그녀가 | [C/E]노래방에 가자 | [Fmaj7]하네 | [G] |


[Bridge]
[Fmaj7.Fm7.]그렇게 나는 그녀를 | [G/F.C7.]따라 걸어보지만 | [E/G#]괜찮은 척 사실 난 | [Am7]너 많이 떨려요 |
[Dm7.Em7.]그녀 아무렇지 | [F/G.C.]않아도 나는 | [Am7]아무렇지 | [G/B.C.C.]않지 않아요 |
[Fmaj7]근데 그녀는 | [G/F]나를 바라보는 | [E/G#]눈빛은 지금 | [Am7]아무렇지 않지 않대요 |
[Dm7]무슨 말이냐고 | [F/G]물어보네 | [C] | [Gm7.G.] |

[Chorus]
[Fmaj7]그렇게 노래방을 | [G/F]나오고 그녀를 | [Em7]집에 데려다주려다 | [Am7]준지 |
[Dm7]무슨 일인가 | [F/G]괜찮은 건가 | [C] | [Gm7.G.] |

[Verse 2]
[Fmaj7]한 곡도 없는 | [G/F]늘은 새벽 | [Em7]집에 계속 | [Am7]잠은 안 오고 |
[Dm7]그녀가 좋아하던 | [F/G]노래 흥얼거렸네 | [C] | [C] |
[Dm7] | [F/G] | [C] | [C] |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '당신과는 천천히',
  '장범준',
  'E',
  0,
  100,
  null,
  $song${title: 당신과는 천천히}
{artist: 장범준}
{key: E}
{capo: 0}
{bpm: 100}

[Verse 1]
[Ebadd9]퇴근 [G7]두 시간 [Abm7]전에는 | [Abm7]시간이 너무 느리게 |
[Gm7]평일 [Gm7]낮 다섯 [Gm7]시에는 | [Gm7]시간이 너무 느리게 |

[Verse 2]
[Fm7]가는 [Abm7]데 왜 [Ab/Bb.G7sus4.]집에만 오면 | [Bb7.G7.]시간이 너무 빨라 |
[Fm7]가는 [Abm7]데 왜 [Ab/Bb.G7sus4.]주말만 되면 | [Bb7.G7.]시간이 너무 빨라 |

[Pre-Chorus]
[FM7]그냥 [Fm]시간이 [Em]똑같이 | [Am]흘러가기만이라도 |
[FM7]짧은 [Dm7]시간만은 [Gm7]천천히 | [C7.F#m7.] |
[FM7]사랑의 [Dm7]꿈에 [Em]취해 | [Am]쉬이 잦아드는 밤이던 |
[FM7]당신과 [F/G]함께 | []하는 순간만은 | []천천히 | [] |

[Chorus]
[Am]왜 이래 [Em]왜 이래 | [Dm7]당신과는 [G.E/G#.]천천히 |
[Am]왜 이래 [Em]왜 이래 | [Dm7]당신과는 [G.E/G#.]천천히 |
[Am] | [Em] | [Dm7] | [G.E/G#.] |
[Am] | [Em] | [Dm7] | [G.E/G#.] |


[Verse 1]
[C]시간이 또 [Fmaj7.Fm6.]같이 | [Em]흘러가기만이라도 | [Am] |
[Fmaj7]좋은 소식 [Dm7]많은 천천히 | [Gmaj7] | [C7.F#m7.] |
[Fmaj7]사랑의 꿈에 [Dm7]젖혀진 | [Em]척이는 밤이라도 | [Am] |
[Fmaj7]당신과는 [F/G]함께 순간만은 [C]천천히 |

[Chorus 1]
[Am]아아아아 [Em]그댈 보면서 | [Dm7]위이이이 [G.E/G#.]그댈 보면서 |
[Am]우워어 [Em]그댈 보면서 | [Dm7]위워어어어 [G.E/G#.]그녀의 곁에서 |
[Am]짧은 밤들을 [Em]난 잠 못 드네요 | [Dm7]짧은 밤들을 [G.E/G#.]난 잠 못 드네요 |
[Am]당신과는 [Em]천천히 | [Dm7] | [G.E/G#.] |

[Verse 2]
[Fmaj7/A]아직은 [G6/B]밤의 이별이 | [C]무서워요 [Fmaj7]난 |
[Fmaj7]내일 [G6]하루 시작이 | [Cadd9.G/B.]싫어 밤을 |
[Fmaj7/A]우우우우 [G6/B]욱 이 모든 | [C]밤을 | [Fmaj7] |
[Fmaj7]좋은 사람 [F/G]당신과는 천천히 | [Fm9] |

[Chorus 2]
[Am]아아아아 [Em]그댈 보면서 | [Dm7]위이이이 [G.E/G#.]그댈 보면서 |
[Am]우워어 [Em]그댈 보면서 | [Dm7]위워어어어 [G.E/G#.]그녀의 곁에서 |
[Am]짧은 밤들을 [Em]난 잠 못 드네요 | [Dm7]짧은 밤들을 [G.E/G#.]난 잠 못 드네요 |
[Am]당신과는 [Em]천천히 | [Dm7] | [G.E/G#.] |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '정말로 사랑한다면',
  '이은미',
  'Dm',
  0,
  100,
  null,
  $song${title: 정말로 사랑한다면}
{artist: 이은미}
{key: Dm}
{capo: 0}
{bpm: 100}

[Verse 1]
[Dm7]사랑 한단 | [Dm7/E]말로는 사랑 | [A+9]할 수 없네요 | [F#m11]그대 기억하나요 |
[Dm7]나의 변한 | [Dm7/E]그 말이 | [A+9] | [F#m11] |

[Verse 2]
[Dm7]그댈 웃게 | [Dm7/E]했던 밤 너무 | [A+9]짧은 그 밤은 | [F#m11]다 지나갔네요 |
[Dm7]모두 다 | [Dm7/E]지나갔군요 | [A+9] | [F#m11] |

[Verse 3]
[Dm7]무엇을 | [Dm7/E]말했는지 얼마 | [A+9]나 원했는지 | [F#m11]기억하지 않아요 |
[Dm7]그대만 | [Dm7/E]지켜왔나요 | [A+9] | [F#m11] |

[Chorus 1]
[Dm7]많이 힘들었나요 | [Dm7/E]그대가 오늘은 | [A+9]헤어지자 말해요 | [F#m11]정말로 사랑한다면 |

[Bridge]
[Dm7]그대 또 흔들린 | [Dm7]손 잡으려 | [Am9]건네는 이 | [Am9]변한 한마디 |
[Bm11]사랑한단 | [Bm11]말로는 사랑 | [Am9]할 수 없네요 | [Am9.Bm11.C#m7.]함께 뱉은 말 |
[Dm7]사랑한단 | [Dm7]말로는 사랑 | [Am9]할 수 없네요 | [Am9]아아아 |
[Bm11]이젠 사랑할 | [Bm11]수 없나요 | [Am9]사랑 할 수 없나요 | [Bm11.C#m7.]사랑한다 |

[Chorus 2]
[Dm7]많이 힘들었나요 | [Dm7/E]그대가 오늘은 | [A+9]헤어지자 말해요 | [F#m11]정말로 사랑한다면 |

[Outro]
[Dm7] | [Dm7/E] | [A+9] | [F#m11] |
[Dm7] | [Dm7/E] | [A+9] | [F#m11] |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '주저하는 연인들을 위해',
  '잔나비',
  'A',
  0,
  100,
  null,
  $song${title: 주저하는 연인들을 위해}
{artist: 잔나비}
{key: A}
{capo: 0}
{bpm: 100}

[Intro]
[A] | [A] | [A] | [A] |

[Verse 1]
[A]어색해진 [C#m/G#]짧은 머리 | [D]아무 말 [Dm]없는 눈물 |
[A]점점 더 [C#m/G#]멀어져만 [F#m7]가는 서 [Bm]로를 [E]우린 |
[A]붙잡을 [C#m/G#]수 없을 [D.Dm]것 같아 [A.A7]이젠 |
[DM7]다시 돌아갈 [G#dim]수 없는 [C#m7]시간 속에 [F#m7]멈춰있지만 | [Bm]우린 알고있죠 [E]다시 만날 거란 [E]걸 |

[Chorus 1]
[A]눈이 [C#m/G#]부어오면 | [F#m7]우리 둘만의 [A7]비밀을 |
[D]간직하며 [Dm]그리웠던 [A.A7]그 밤 뒤에 [A]찾아올 |
[DM7]늦은 밤 [G#dim]괜히 [C#m7]펼$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '촛불하나',
  'god',
  'C',
  0,
  100,
  null,
  $song${title: 촛불하나}
{artist: god}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[C]왜 이렇게 [E/B]사는게 힘들기만 [Am]한지 누가 [C/G]인생이 아름답다고 |
[F]말한 건지 [C/E]태어날 때부터 [Dm]삶이 내게 [G]준 건 |
[Bm]끝없이 이기려 [E]했던 고난들뿐인 [Am]걸 | [D/F#]그럴 때마다 |
[C/G]나는 거울 속의 [G]나에게 물어봤지 [C]원망했지 [G] |

[Pre-Chorus]
[C]하지만 그러면 [E]안돼 그러면 [Am]안돼 죽으려고 하면 [C]안돼 |
[F]포기하려고 하면 [C]안돼 세상이 주는 [Dm]대로 끄지 죽어간 [G]대로 |
[Bm]이렇게 불공평한 [E]세상에 주는 [Am]대로 받기만 하면 [D]모든 건 그대로 |
[C]싸울 텐가 [G]포기할 텐가 [C]주어진 운명에 [G]굴복하고 말 텐가 |

[Chorus]
[C]세상 앞에 [E]그저 숙이지 [Am]마라 그리고 [C]우릴 봐라 |
[F]지치고 힘들 [C]땐 내게 [Dm]기대 [G]언제나 |
[Bm]니 곁에 [E]서있을게 [Am]혼자라는 [D]생각이 들지 |
[C]않게 [G]내가 너의 [C]손잡아줄게 [G] |

[Verse 2]
[C]너무 어두워 [E]길이 보이지 [Am]않아 내게 있는 [C]건 |
[F]성냥 하나와 [C]촛불 하나 [Dm]이 작은 촛불 [G]하나 |
[Bm]가지고 무엇을 [E]하나 | [Am]저 멀리 보이는 [D]화려한 불빛 |
[C]어둠 속에서 [G]발버둥 치는 [C]나의 이 몸짓 [G] |

[Bridge]
[C]불빛을 향해서 [E]날고 싶어도 [Am]날 수 없는 [C]나의 날개짓 |
[F]하지만 그렇지 [C]않아 작은 촛불 [Dm]하나 켠다고 [G]어둠이 달아나나 |
[Bm]물론 변하는 [E]건 없어 보일지 [Am]몰라 [D]아직 아무것도 |
[C]없다고 느낄지 [G]몰라 믿었던 [C]내 주위엔 또 [G]다른 초 하나가 |

[Outro]
[Bm]놓여져 있었기에 | [Am]불을 밝히니 [D]촛불이 두 개가 [C]되고 |
[G]그 불빛으로 [C]다른 촛불 켜주고 [G]세 개가 되고 |
[C]네 개가 되고 [G]어둠은 사라져가고 |

[Verse 1]
[C]왜 이렇게 [E/B]사는지 | [Am]힘들기만 [C/G]한지 | [F]누가 인생이 [C/E]아름답다고 | [Dm]말한 건지 [G]태어났을 때부터 |
[C]내게 주어진 [E]끊없이 | [Am]이겨내야 [C]했던 | [F]고난들 [C]뿐인걸 | [Dm] | [G] |

[Pre-Chorus]
[Bm]그럴 때마다 [E]나는 거울 속의 | [Am]나에게 물어 [D/F#]봤지 | [C/G]원망했지 [G]억울했지 | [C]도대체 내가 뭘 [G]잘못 했길래 |
[C]내 미래는 달라질 [G]것 같지 않아 | [C]내일 또 [G]모레 |
[Chorus]
[C]하지만 그러면 [E]안돼 주저 앉으면 | [Am]안돼 세상이 [C]주는 대로 | [F]그저 받기만 [C]하면 | [Dm]모든 것은 [G]그대로 |
[Bm]바뀌는 건 [E]하나 없어 $song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '26',
  '윤하 (YOUNHA)',
  'F',
  0,
  92,
  'entertain',
  $song${title: 26}
{artist: 윤하 (YOUNHA)}
{key: F}
{capo: 0}
{bpm: 92}

[Intro]
[F/A] | [Bb] | [C] | [Dm7] |
[F/A] | [Bb] | [C] | [C] |

[Verse 1]
[F/A]천천히- 숫자를- | [Bb]거꾸로 세고- | [C]난 이제- | [Dm7]떠나보려 해 |
[F/A]아득히- 네게서- | [Bb]멀어질 거야- | [C]그럼 난- | [C]이 별과- |
[Gm7]이 별을 할래- | [Am7]너는 어느새 | [Bb]작은 점이 돼 | [C]창백한 저 |
[C]야광별처럼 | [Gm7]한껏 설렜고 | [Am7]흠뻑 울었던 | [Bb]시간들을 |
[C]스쳐가는 길 | [C] |

[Chorus 1]
[F/A]Good bye bye | [Bb]이제는 안녕 | [C]저기 멀리 | [Dm7]내가 사랑한 곳 |
[F/A]만약 다시 너의 | [Bb]이름을 듣게 | [C]된다면 | [Dm7]웃어볼게 |
[F/A]어렴풋하게 | [Bb] | [C] | [C] |

[Verse 2]
[F/A]멀리서- 외치는- | [Bb]작별 인사가- | [C]언젠가- | [Dm7]닿기를 바래 |
[F/A]좋았던- 날들을- | [Bb]두고 갈 테니- | [C]너는 늘- | [C]그렇게- |
[Gm7]예쁘길 바래- | [Am7]너의 눈 속엔 | [Bb]내가 없는데 | [C]너무 오래 |
[C]머물러왔어 | [Gm7]들뜬 마음과 | [Am7]우울까지 다 | [Bb]내려두고 |
[C]돌아가야지 | [C] |

[Chorus 2]
[F/A]Good bye bye | [Bb]이제는 안녕 | [C]저기 멀리 | [Dm7]내가 사랑한 곳 |
[F/A]만약 다시 너의 | [Bb]이름을 듣게 | [C]된다면 | [Dm7]웃어볼게 |
[F/A]어렴풋하게 | [Bb] | [C] | [C] |

[Bridge]
[Bb]세상 끝에서 난 | [C]다시 뛰어올라 | [Dm7]언덕 너머 | [Am7]저편으로 Fly |
[Bb]나의 멋진 | [C]우주여 안녕 | [Dm7]비록 끝이 | [C]여기까지라도 |

[Chorus 3]
[F/A]진짜 안녕 | [Bb]너를 향한 내 | [C]마지막 인사 | [Dm7]사랑했던 |
[F/A]나의 너에게 | [Bb] | [C] | [Dm7] |

[Outro]
[F/A] | [Bb] | [C] | [Dm7] |
[F/A] | [Bb] | [C] | [F] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  'Hi Bully',
  '터치드 (Touched)',
  'Em',
  0,
  100,
  'entertain',
  $song${title: Hi Bully}
{artist: 터치드 (Touched)}
{key: Em}
{capo: 0}
{bpm: 100}

[Intro]
[Em.D/E] | [C/E.B/E] | [Em.D/E] | [C/E.B/E] |

[Verse 1]
[Em]안-녕 날 괴롭히던- [D]너 | [C]좋아 보여 웃는 네 모 [D]습 | [Em]여전히 나를 깔보- [D]며 | [C]짝다리 짚고 있는 [D]너 |
[Em]얼마나- 오랜 시간- [D]이 | [C]지나야- 나의 아픔- [D]이 | [C]사라져 무너져 [D] | [C]아직도 나를 짓누르고 [D]있는 너 |

[Chorus 1]
[Em]Hi bully my name is [G]jerck | [C]너를 피해 눈을 피해 [B]도망을 가- | [Em]Hi bully my name is [G]jerck | [C]얼굴만 때리지 말아 [B]줘- |
[Em]Hi bully my name is [G]jerck | [C]너를 피해 눈을 피해 [B]도망을 가- | [Em]Hi bully my name is [G]jerck | [C]얼굴만 때리지 말아 [B]줘- |

[Interlude]
[Em.D/E] | [C/E.B/E] | [Em.D/E] | [C/E.B/E] |

[Verse 2]
[Em]어-두운 골목길 안- [D]가 | [C]돌아서 큰길로만- [D]가 | [Em]저 멀리 너 걸어올까 [D]봐 | [C]마음 졸이며 고개 숙인 [D]다 |
[Em]Nightmare 반복되는 [D]꿈 | [C]기도해 평범한 꿈 [D]을 | [C]눈 감아도 꿈에서 [D]계속해서 | [C]날 짓누르고 있는 [D]너 |

[Bridge]
[Em./F#] | [/G./A] | [Em./F#] | [G.A] |
[Em./F#] | [/G.A] | [Em./F#] | [/G.A] |
[Em]가벼운- 너의 바람- [D]이- 나 | [C]에겐 시린 아픔이 [D]야 | [Em]가벼운- 너의 바람- [D]이- 나 | [C]에겐- 너무 [D]도 |
[Em]가벼운- 너의 바람- [D]이- 나 | [C]에겐 시린 아픔이 [D]야 | [Em]가벼운- 너의 바람- [D]이- 나 | [C]에겐- 너무 [D]도 |

[Chorus 2]
[Em]Hi bully my name is [G]jerck | [C]너를 피해 눈을 피해 [B]도망가던 나 | [Em]Hi bully my name is [G]jerck | [C]이제 고갤 들어 널 바 [B]라본다 |
[Em]Hi bully my name is [G]jerck | [C]너를 피해 눈을 피해 [B]도망가던 나 | [Em]Hi bully my name is [G]jerck | [C]이제 고갤 들어 널 바 [B]라본다 |

[Outro]
[Em]Hi bully [G] | [C]Hi bully [B] | [Em]Hi bully my name is [G]jerck | [C]이제 고갤 들어 널 바 [B]라본다 |
[Em] | [Em] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  'Pretender',
  'Official髭男dism',
  'Ab',
  0,
  92,
  'entertain',
  $song${title: Pretender}
{artist: Official髭男dism}
{key: Ab}
{capo: 0}
{bpm: 92}

[Intro]
[Ab] | [Gm7b5.C7] | [Fm7] | [Bbsus4.Eb] |
[Ab] | [Gm7b5.C7] | [Fm7] | [Bb9] |

[Verse 1]
[Ab]키미토노 라브스토- | [Gm7b5.C7]리 소레와 요소오도오- | [Fm7]리 이자 하지마레바 | [Bbsus4.Eb]히토리시바이다 |
[Ab]줏토 소바니 이탓- | [Gm7b5.C7]테 켁쿄쿠 타다노 | [Fm7]칸-캬쿠다 | [Bb9] |

[Verse 2]
[Ab]칸-죠노 나이 아이 무소- | [Gm7b5.C7]리 소레와 이츠모도오- | [Fm7]리 나레테 시마에바 | [Bbsus4.Eb]와루쿠와 나이케도 |
[Ab]핀-토 코나쿠테 | [Gm7b5.C7]다레카가 에라소오- | [Fm7]니 카타루 렌-아이노 론- | [Bb9]리 |

[Pre-Chorus 1]
[DbM7]키미토노 로망스와 진- | [Eb7]세이가라 츠즈키와 시나이코 | [Ab]토-오 싯타 | [Ab] |
[DbM7]히코오키노 마도-카라 | [C7]미-시타오로 시타 | [Fm7]시라나이 마치노 야- | [Ebm7.Daug]케이 미타이다 |

[Chorus 1]
[DbM7]못-토 치가우 셋-테이데 | [C7]못-토 치가우 칸-케이데 | [Fm7]데아에루 세카이센- | [Bb9]에라베타라 요캇타 |
[DbM7]못-토 치가우 세이카쿠데 | [C7]못-토 치가우 카치칸-데 | [Fm7]아이오 츠타-에라레타라 | [Bb9]이이 나- |
[DbM7]소오 네갓-테모 무다다카라 | [Dbm9] |

[Chorus 2]
[Ab]굿-바이 | [Eb/G]키미노 운-메이노 히토와 | [Fm7]보쿠쟈나이 츠라이케도 | [Ebm7.Ab7]이나메나이 데모 |
[DbM7]하나레가타이노사 | [Eb]소노 카미니 후레타 다케데 | [Ab]이타이야 이야데모 | [Gm7b5.C7]아마이나 이야이야 |
[Ab]굿-바이 | [Eb/G]소레쟈 보쿠니 톳-테 키미와 | [Fm7]나니? 코타에와 와카라나이 | [Ebm7.Ab7]와카리타쿠모 나이노사 |
[DbM7]탓-타 히토츠 타시카나 코토가 | [Eb]아루토스루노 나라바 | [Ab]키미와 키레이다 | [Ab] |

[Verse 3]
[Ab] | [Gm7b5.C7] | [Fm7] | [Bbsus4.Eb] |
[Ab] | [Gm7b5.C7] | [Fm7] | [Bb9] |

[Pre-Chorus 2]
[DbM7]이탓-테 쥰-나 코코로데 | [C7]카낫-타 코이오 다키시메테 | [Fm7]스키다토카 무세키닌-니 | [Ebm7.Daug]이에타라 이이 나 |
[DbM7]소오 네갓-테모 무나시이노사 | [Dbm9] |

[Chorus 3]
[Ab]굿-바이 | [Eb/G]츠나이다 테노 무코오니 | [Fm7]엔-도라인- 히키노바스 | [Ebm7.Ab7]타비니 우즈키다스 |
[DbM7]미라이니와 키미와 이나이 | [Eb]소노 지지츠니 Cry | [Ab]소랴 쿠루시이요나 | [Gm7b5.C7] |

[Chorus 4]
[Ab]굿-바이 | [Eb/G]키미노 운-메이노 히토와 | [Fm7]보쿠쟈나이 츠라이케도 | [Ebm7.Ab7]이나메나이 데모 |
[DbM7]하나레가타이노사 | [Eb]소노 카미니 후레타 다케데 | [Ab]이타이야 이야데모 | [Gm7b5.C7]아마이나 이야이야 |
[Ab]굿-바이 | [Eb/G]소레쟈 보쿠니 톳-테 키미와 | [Fm7]나니? 코타에와 와카라나이 | [Ebm7.Ab7]와카리타쿠모 나이노사 |
[DbM7]탓-타 히토츠 타시카나 코토가 | [Eb]아루토스루노 나라바 | [Ab]키미와 키레이다 | [Ab] |

[Outro]
[DbM7]소레모 코레모 로망스노 | [Eb]사다메나라 와쿠나이요나 | [Fm7]에이엔-모 야쿠소쿠모 | [Bb9]나이케레도 |
[DbM7]토테모 키레이다 | [Dbm9] | [Ab] | [Ab] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  'Rules',
  'The Volunteers (더 발룬티어스)',
  'Ab',
  0,
  90,
  'entertain',
  $song${title: Rules}
{artist: The Volunteers (더 발룬티어스)}
{key: Ab}
{capo: 0}
{bpm: 90}

[Intro]
[Ab] | [Db] | [Db/F] | [Gb] |
[Ab] | [Db] | [Db/F] | [Gb] |

[Verse 1]
[Ab]I'm living a life | [Db]that has no rules | [Db/F]Am I going through some | [Gb]kind of metamorphosis? |
[Ab]Thought I'd already | [Db]gone through puberty | [Db/F]But I'm still stuck with the | [Gb]fools who don't know a thing |

[Verse 2]
[Ab]I'm living my life | [Db]and it's all good | [Db/F]Did I miss anything? | [Gb]Yea, there is something missing |
[Ab]I'm tryna believe | [Db]that I'm going the right | [Db/F]way Wish I wouldn't cry | [Gb]tonight or ever |

[Pre-Chorus 1]
[Fm]No one controls | [Gb]me Since I got some | [Fm]fame No one tells me | [Gb]you can't do that or say that |
[Fm]Even you couldn't control | [Gb]me, when I was fucking | [Bbm]drunk- But when I am | [Db]sober, I want you around me |

[Chorus 1]
[Ab]Please, lock me | [Db]up with some rules | [Db/F]Please, lock me | [Gb]up with a map to you |
[Ab]Please, lock me | [Db]up and wait at the door | [Db/F]I need the truth you | [Gb]used to tell me |

[Interlude]
[Ab] | [Db] | [Db/F] | [Gb] |

[Pre-Chorus 2]
[Fm]No one controls | [Gb]me Since I got some | [Fm]fame No one tells me | [Gb]you can't do that or say that |
[Fm]Even you couldn't control | [Gb]me, when I was fucking | [Bbm]drunk- But when I am | [Db]sober, I want you around me |

[Chorus 2]
[Ab]Please, lock me | [Db]up with some rules | [Db/F]Please, lock me | [Gb]up with a map to you |
[Ab]Please, lock me | [Db]up and wait at the door | [Db/F]I need the truth you | [Gb]used to tell me |

[Outro]
[Ab] | [Db] | [Db/F] | [Gb] |
[Ab] | [Db] | [Db/F] | [Gb] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '눈이 마주쳤을 때',
  '0.0.0',
  'Am',
  0,
  113,
  'entertain',
  $song${title: 눈이 마주쳤을 때}
{artist: 0.0.0}
{key: Am}
{capo: 0}
{bpm: 113}

[Intro]
[F.E7.] | [Am] | [F.E7.] | [Am] |
[F.E7.] | [Am] | [F.E7.] | [Am] |

[Verse 1]
[F]하나 [E7]둘 | [Am]셋 넷 | [F]너가 [E7]오고 | [Am]있어 |
[F]하나 [E7]둘 | [Am]셋 넷 | [F]너에게 [E7]가고 | [Am]있어 |

[Verse 2]
[F]눈이 마주쳤을 [E7]때 서로를 스칠 [Am]때 | [F]호기심만 남기 [E7]고 너가 멀어져갈 [Am]때 |
[F]너의 뒤를 따라 [E7]가 너를 불러 세우고 [Am]oh | [F]다시 눈이 마주 [E7]쳤을 때 |

[Chorus 1]
[C]나도 몰래 [E7]널 불러버렸 [Am]어 | [F]어떡하지 [C]너가 내 눈 앞에 [E7]있어 [Am]oh |
[F]눈이 마주쳤을 [E7]때 조금 놀란 널 볼 [Am]때 oh | [F]내가 왜 이랬을 [E7]까 바보 같은 날 탓하 [Am]며 |
[F]먼 산만 바라보 [E7]다 바닥도 쳐다보 [Am]다 oh | [F]다시 눈이 마주 [E7]쳤을 때 [Am]woo |

[Interlude 1]
[Dm] | [G7] | [C] | [C] |
[F.E7.] | [Am] | [Dm] | [G7] | [Am] |

[Verse 3]
[F]눈이 마주쳤을 [G]때 흔들리던 네 눈 [Em]빛 긴장일 [Am]까 | [F]불안일까 혹은 [G]작은 설렘일며 나의 [Em]어떤 말 한마디 [Am]가 |
[F]너를 웃게 만들 [G]까 oh 다시 눈이 마주 [Em]쳤을 때 [Am]woo |

[Chorus 2]
[F]눈이 마주쳤을 [E7]때 흔들리던 네 눈 [Am]빛 | [F]긴장일까 불안일 [E7]까 혹은 작은 설렘일 [Am]며 나의 |
[F]어떤 말 한마디 [E7]가 너를 웃게 만들 [Am]까 oh | [F]다시 눈이 마주 [E7]쳤을 때 [Am]woo |

[Bridge]
[F]woo | [E7]woo | [Am]woo | [Am]woo |
[F]woo | [E7]woo | [Am]woo | [Am]woo |

[Guitar Solo]
[Dm] | [E7] | [Am] | [Am] |
[Dm] | [E7] | [Am] | [Am] |
[Dm] | [E7] | [Am] | [Am] |
[Dm] | [E7] | [Am] | [Am] |
[Dm] | [E7] | [Am] | [Am] |
[Dm] | [E7] | [Am] | [Am] |

[Outro]
[Dm] | [E7] | [Am] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '범퍼카 (New Day Ver.)',
  '데이브레이크(Daybreak)',
  'C',
  0,
  148,
  'entertain',
  $song${title: 범퍼카 (New Day Ver.)}
{artist: 데이브레이크(Daybreak)}
{key: C}
{capo: 0}
{bpm: 148}

[Intro]
[C.] | [Gsus4.] | [Am.] | [F6.] |
[C.] | [Gsus4.] | [Am.] | [F6.] |

[Verse 1]
[C.]상처투성 | [G7sus4.]이- 외롭고 | [D#dim7.]험한 싸움-터 | [Em7.]홀로 버려 |
[Dm7.]진- | [G7sus4.]두려움 앞 | [C.]에서 | [G7sus4.] |

[Verse 2]
[C.]돌격 앞으 | [G7sus4.]로- 우물쭈 | [D#dim7.]물 하다-가는 | [Em7.]큰일 납니 |
[Dm7.]다- | [G7sus4.]비켜나세 | [BbM7.]요 | [A7.Bdim.C#dim7.]언젠가 |

[Pre-Chorus 1]
[Dm7.]는- | [G7sus4.] | [C/E.]드넓은 대 | [Fm.]지에- 달 |
[Fm.]리-는 나-를 꿈 | [Bb7sus4.]- - - 꾸며 | [G7sus4.]- | [G7sus4.] |

[Chorus 1]
[Dm7.]들이받고 또 | [G7.]들이- 받아- 봐-도- | [Em7.]지치지- 않-는 | [A7sus4.A7(b9).]나- |
[Dm7.]의 엔진-에 | [G7.G7(b9).]더- 큰 | [CM7.]용-기를 | [A.Bdim.A7/C#.] |
[Dm7.]들이받-고- 받 | [G7.]-아-도- | [Em7.]사-라지지- 않 | [A7.A7(b9).]을- |
[Dm7.]나-의 꿈-이 이 | [G7.]-루어-지-길 | [C.] | [Gsus4.] |

[Interlude]
[Am.] | [F6.] | [C.] | [Gsus4.] |
[Am.] | [F6.]이리저 | [C.]리- - 로 | [G7sus4.] |

[Verse 3]
[D#dim7.]핸들을 | [Em7.]돌-려보-지-만- | [Dm7.]막다른 벽 | [G7sus4.]이- |
[BbM7.]원망스-러 | [A7.]-워- | [C#dim7.]언젠가 | [Dm7.]는- |

[Pre-Chorus 2]
[C/E.]드넓은 대 | [Fm.]지에- 달 | [Fm.]리-는 나-를 꿈 | [Bb7sus4.]- 꾸며 |
[G7sus4.]- | [G7sus4.] | [Dm7.]나-의 꿈-이 이 | [G7.G7(b9).]루어-지-기- |

[Bridge]
[CM7.]- - - 를 | [A7.] | [Dm7.] | [G7.] |
[Em7.] | [A7.] | [Dm7.] | [G7.] |
[C.] | [A7.] | [Dm7.] | [G7.] |
[Em7.] | [A7.] | [Dm7.] | [G7.] |
[C.] | [A7.] | [FM7.]두- | [FM7.]눈을 감-고 |

[Pre-Chorus 3]
[C/E.]시-동을- 켜- 고- | [Dm7.]조-심스-레- 속 | [G7sus4.]도를- 올-려- | [A.] |
[FM7.]눈-앞-에 펼-쳐-진 | [G.E.Am.]대-지-에- 힘-차-게 | [D7(b5).]달려 | [D7.]힘-차-게 |
[G7sus4.]달려 | [Dm7.]들이받고 또 들이- 받-아 | [G7.]-봐-도- | [Em7.]지치지- 않-는 |

[Chorus 2]
[A7sus4.A7(b9).]나- 의 엔진-에 | [Dm7.]더 큰 | [G7.G7(b9).]용-기를 | [CM7.] |
[A.Bdim.A/C#.] | [Dm7.]들-이 받-고- 받 | [G7.]-아-도- | [Em7.]사-라지지- 않 |
[A7.A7(b9).]을- | [Dm7.]나-의 꿈-이 이 | [G7.]루어-지-기- | [CM7.]를 |
[A.Bdim.A7/C#.] | [Dm7.] | [G7sus4.] | [Em7.] |

[Outro]
[A7.]su bi doo- | [Dm7.] | [G.] | [CM7.] |
[A7(b9).] | [Dm7.] | [G7.]사-라지-지- 않-을- | [Em7.] |
[A7(b9).]나-의 꿈-이 이 | [Dm7.] | [G7sus4.]-루어-지-길 | [C.] |
[Gsus4.] | [Am.] | [F6.]uh | [C.]huh- - |
[Gsus4.]huh- - | [Am.]hoo | [F6.] | [F6.] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '불',
  '유다빈밴드',
  'E',
  0,
  178,
  'entertain',
  $song${title: 불}
{artist: 유다빈밴드}
{key: E}
{capo: 0}
{bpm: 178}

[Intro]
[DM7] | [E7sus4] | [C#m7] | [C#m7] |
[F#m7] | [F#m7] | [C#m7] | [C#m7] |

[Verse 1]
[DM7]난 왠지 모르게 | [C#m/E]슬픈 거 있지 | [C#m7]시들기만 할 꽃 | [C#m7]도 남지 않은 게 |
[F#m7]난 여전히 살아 | [D#m7(b5)]있고 싶을 뿐 | [DM7]이야 | [C#m7] |
[F#m7]단 하나로 남겨 | [D#m7(b5)]지고 싶을 뿐 | [DM7]이야 | [DM7] |

[Pre-Chorus 1]
[F#m7]숨을 죽여 말해 | [F#m7]들키지 않게 | [C#m7]그 아무도 모르게 | [CM7]춤을 출 거야 |
[Bm7]다시 또 무 | [C#m7]너질 걸 알지만 | [E7sus4] | [E7sus4] |

[Chorus 1]
[DM7]불이 꺼진 채로 | [E]밤을 불태울까 | [C#m7]우리에게 어떤 것도 | [F#m7]닿지 못하게 |
[DM7]눈을 감은 채로 | [E]마주 보며 있자 | [C#m7]내일 속의 어떤 것도 | [C#m7]알지 못하게 |

[Interlude]
[F#m7] | [F#m7] | [DM7] | [DM7] |
[E7sus4] | [E7sus4] | [C#m7] | [C#m7] |

[Verse 2]
[DM7]난 또 참을 수 없게 | [C#m/E]질린 거 있지 | [C#m7]끝내 더러운 꼴 | [C#m7]만 보이고 마는 게 |
[F#m7]난 여전히 살아 | [D#m7(b5)]있고 싶을 뿐 | [DM7]이야 | [C#m7] |
[F#m7]단 하나로 남겨 | [D#m7(b5)]지고 싶을 뿐 | [G#7]이야 | [G#7] |

[Pre-Chorus 2]
[C#m7]숨을 죽여 바래 | [C#m7]들키지 않게 | [CM7]그 아무도 넘볼 수 | [CM7]없는 순간을 |
[Bm7]다시 또 무 | [C#m7]너질 걸 알지만 | [E7sus4] | [E7sus4] |

[Chorus 2]
[DM7]불이 꺼진 채로 | [E]밤을 불태울까 | [C#m7]우리에게 어떤 것도 | [F#m7]닿지 못하게 |
[DM7]눈을 감은 채로 | [E]마주 보며 있자 | [C#m7]내일 속의 어떤 것도 | [C#m7]알지 못하게 |

[Chorus 3]
[DM7]부딪쳐 이대로 | [E]달을 불태울까 | [C#m7]우리에게 어떤 것도 | [F#m7]닿지 못하게 |
[DM7]눈을 감은 채로 | [E]마주 보며 웃자 | [C#m7]내일 속의 어떤 것도 | [C#m7]막지 못하게 |

[Outro]
[F#m7]하게 | [DM7]이렇 | [DM7]게 | [E] |
[C#m7] | [F#m7] | [DM7] | [E] |
[C#m7] | [C#m7] | [F#m7] | [F#m7] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '사랑하게 될 거야',
  '한로로',
  'G',
  0,
  93,
  'entertain',
  $song${title: 사랑하게 될 거야}
{artist: 한로로}
{key: G}
{capo: 0}
{bpm: 93}

[Intro]
[G] | [B7] | [Em] | [C.D] |

[Verse 1]
[G]영원을 꿈꾸던 | [B7]널 떠나보내고- | [Em]슬퍼하던 날까지 | [C.D]도 떠나보냈네- |
[G]오늘의 나에게 | [B7]남아있는 건- | [Em]피하지 못 | [B7]해- 자라난- |
[C]무던함뿐 | [D]야- | [G] | [G] |

[Verse 2]
[B7]그곳의 나는 얼 | [B7]만큼 울었는지 | [Em]이곳의 나는 | [Em]누구보다 잘 알기에 |
[C]후회로 가득 | [D]채운 유리잔만 | [G]내려다보 | [G]네- |

[Chorus 1]
[G]아- | [B7]아- 뭐가 그리 | [Em]샘이 났길 | [G7]래- 그토록 |
[C]휘몰아 | [D]쳤던 | [G]가- | [G] |
[G]그럼에도 | [B7]불구하고- | [Em]나는 너를 | [B7]용서하고- |
[C]사랑하게 | [D]될 거야 | [G] | [G] |

[Interlude]
[G] | [B7/F#] | [Em] | [B7] |
[C] | [D] | [G] | [G] |

[Verse 3]
[G]아파했지만 또 | [B7]아파도 되는 기억 | [Em]불안한 내게 모난 | [C.D]돌을 쥐여주던- |
[G]깨진 조각 틈 | [B7]새어 나온 눈물 | [Em]터뜨려 | [B7]보 |
[C]네- | [D] | [G] | [G] |

[Chorus 2]
[G]아- | [B7]아- 뭐가 그리 | [Em]샘이 났길 | [G7]래- 그토록 |
[C]휘몰아 | [D]쳤던 | [G]가- | [G] |
[G]그럼에도 | [B7]불구하고- | [Em]나는 너를 | [B7]용서하고- |
[C]사랑하게 | [D]될 거야 | [G] | [G] |

[Chorus 3]
[G]아- | [B7]아- 뭐가 그리 | [Em]샘이 났길 | [G7]래- 그토록 |
[C]휘몰아 | [D]쳤던 | [G]가- | [G] |
[G]그럼에도 | [B7]불구하고- | [Em]나는 너를 | [B7]용서하고- |
[C]사랑하게 | [D]될 거야 | [G] | [G] |

[Outro]
[C]사랑하게 | [D]될 거야 | [G] | [B7] |
[Em] | [C.D] | [G] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '슈퍼맨',
  '노라조',
  'C#m',
  0,
  144,
  'entertain',
  $song${title: 슈퍼맨}
{artist: 노라조}
{key: C#m}
{capo: 0}
{bpm: 144}

[Intro]
[C#m.] | [B.] | [A.] | [G#m.] |
[C#m.] | [B.] | [A.] | [G#m.] |
[C#m.]나 나 나나나나 나 | [C#m.]나 | [C#m.]나나 나나나나 나 | [C#m.]나 |
[C#m.]난 나라난 나라난 난 난나 | [C#m.]난 나라난 나라난 난 난 난 나 | [C#m.] | [C#m.] |

[Verse 1]
[C#m.]아들아- | [C#m.]지구를 부탁하노라 | [C#m.] | [C#m.] |
[A.]아버지- | [A.]걱정은 하지마세요 | [A.] | [A.]바지 |
[B.]위에 팬티입고 | [G#m.]오늘도 난 길을 나서 | [C#m.]네 | [C#m.] |

[Verse 2]
[C#m.]아들아- | [C#m.]망토는 하고가야지 | [C#m.] | [C#m.] |
[A.]아뿔사- | [A.]어쩐지 허전하더라 | [A.] | [A.]파란 |
[B.]타이즈에 빨간 | [G#m.]팬티는 내 Chaming po-in | [C#m.]t | [C#m.]오늘도 |

[Chorus 1]
[A.]달리고달리고달리고달리고 | [B.]살리고살리고살리고살리고 | [C#m.]돌아라 지구 열두 | [G#.]바퀴 올백 |
[C#m.]머리 근육빵빵 난 슈퍼맨 | [C#m.] | [A.]지구인의 친구 난 슈퍼맨 | [A.] |
[B.]멋지구나 잘생겼다 대인배의 | [G#m.]카리스마 사이즈가 | [C#m.]장난 아니지 어쨌 | [G#.]건 근육빵빵 난 슈퍼맨 |
[C#m.]지구인의 친구 난 슈퍼맨 | [C#m.] | [A.]유사품에 주의해요 오각형에 | [A.]S-자야 위 |
[B.]아래로 스판 100프로 | [G#m.] | [C#m.] | [C#m.] |

[Verse 3]
[C#m.]아들아- | [C#m.]아침은 먹고가야지 | [C#m.] | [C#m.] |
[A.]아버지- | [A.]빈속이 날기 편해요 | [A.] | [A.]서울 |
[B.]대전 대구 부산 | [G#m.]찍고 나서 독도 한 바 | [C#m.]퀴 | [C#m.]오늘도 |

[Chorus 2]
[A.]달리고달리고달리고달리고 | [B.]살리고살리고살리고살리고 | [C#m.]돌아라 지구 열두 | [G#.]바퀴 올백 |
[C#m.]머리 근육빵빵 난 슈퍼맨 | [C#m.] | [A.]지구인의 친구 난 슈퍼맨 | [A.] |
[B.]멋지구나 잘생겼다 대인배의 | [G#m.]카리스마 사이즈가 | [C#m.]장난 아니지 어쨌 | [G#.]건 근육빵빵 난 슈퍼맨 |
[C#m.]지구인의 친구 난 슈퍼맨 | [C#m.] | [A.]유사품에 주의해요 오각형에 | [A.]S-자야 위 |
[B.]아래로 스판 100프로 | [G#m.] | [C#m.] | [C#m.] |

[Interlude]
[C#m.]나 나 나나나나 나 | [C#m.]나 | [A.]나 나 나나나나 나 | [A.]나 |
[B.]난 나라난 나라난 난 난나 | [G#m.]난 나라난 나라난 난 난 난 나 | [C#m.] | [C#m.]스판 100프로 |
[C#m.] | [C#m.] | [A.] | [A.] |
[B.] | [B.] | [G#m.] | [G#m.] |

[Chorus 3]
[C#m.]오늘도 머리 근육빵빵 난 슈퍼맨 | [C#m.] | [A.]지구인의 친구 난 슈퍼맨 | [A.] |
[B.]위기 때면 나타난다 밤하늘의 | [G#m.]박쥐모양 아 | [C#m.]참 그건 배트맨이지 | [G#.]어쨌거나 근육빵빵 난 슈퍼맨 |
[C#m.]지구인의 친구 난 슈퍼맨 | [C#m.] | [A.]위험할 땐 불러줘요 언제든지 | [A.]달려갈게 나 |
[B.]는야 정의에 슈퍼맨 | [G#m.] | [C#m.] | [C#m.] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '알루미늄',
  '브로큰 발렌타인',
  'E',
  0,
  154,
  'entertain',
  $song${title: 알루미늄}
{artist: 브로큰 발렌타인}
{key: E}
{capo: 0}
{bpm: 154}

[Intro]
[E.] | [Bsus4.] | [F#m11.] | [A(add9).] | [Am.] |

[Verse 1]
[E.]부서진 황금의 | [Bsus4.]그 조각들도 누군가 | [F#m11.]에겐 당연한 온기도 | [A(add9).]그저 바라본 채 |
[Bsus4.]그저 스쳐간 채 | [F#m11.]난 오늘로 돌아왔고 | [A(add9).]애써 미소 짓는 | [Bsus4.]너의 입술에 |
[E.]아직 남아있는 | [Bsus4.]그 그늘처럼 모두 | [F#m11.]싸늘하고 너무도 | [A(add9).]차가워 오직 |

[Chorus 1]
[Bsus4.]너와 나의 지금만이 | [E.]눈부신 오늘 밤 이 | [Bsus4.]시간 속에 그보다 | [F#m11.]빛나는 너의 두 눈에 |
[A(add9).]빛나는 크리스탈이 | [Bsus4.]되지 못한 나의 | [E.]차가운 알루미늄만이 | [Bsus4.] |

[Verse 2]
[E.]애써 외면해왔던 | [Bsus4.]것들에게 그들과 | [F#m11.]같은 표정을 지었고 | [A(add9).]항상 그려왔던 |
[Bsus4.]항상 믿어왔던 | [F#m11.]난 점점 더 멀어지고 | [A(add9).]세상은 또 그 한 | [Bsus4.]순간도 |
[E.]모질지 않은 날이 | [Bsus4.]없겠지만 화려한 | [F#m11.]불빛도 따뜻한 | [A(add9).]벨벳도 없는 오직 |

[Chorus 2]
[Bsus4.]너와의 오늘만이 | [E.]눈부신 오늘밤 이 | [Bsus4.]시간 속에 그보다 | [F#m11.]빛나는 너의 두 눈에 |
[A(add9).]빛나는 크리스탈이 | [Bsus4.]되지 못한 나의 | [E.]차가운 알루미늄만이 | [Bsus4.] |
[F#m11.]눈부신 오늘밤 저 | [A(add9).]하늘 아래 그보다 | [Bsus4.]빛나는 너의 입술에 | [E.]빛나는 크리스탈이 |
[Bsus4.]되지 못한 나의 | [F#m11.]차가운 알루미늄만이 | [A(add9).] | [Bsus4.] |

[Bridge]
[E.]어쩌면 오늘 단 | [Bsus4.]하루일지 모르는 | [F#m11.]두 번 다시 오지 않을 | [A(add9).]것만 같은 밤 |
[E.]따뜻한 바람과 | [Bsus4.]조금은 맞지 않는 | [F#m11.]소리의 기타를 안고 | [A(add9).]오늘이 지나면 |
[E.]사라질 것만 같은 | [Bsus4.]이 노래를 조용히 | [F#m11.]흔들리는 불빛들과 | [A(add9).]말없이 미소 짓는 |
[E.]네 눈빛에 그저 난 | [Bsus4.]바라본 채 그저 난 | [F#m11.]바라본 채 믿을 수 | [A(add9).]없는 이 시간을 |

[Chorus 3]
[Bsus4.] | [E.]눈부신 오늘밤 이 | [Bsus4.]시간 속에 그보다 | [F#m11.]빛나는 너의 두 눈에 |
[A(add9).]빛나는 크리스탈이 | [Bsus4.]되지 못한 나의 | [E.]차가운 알루미늄만이 | [Bsus4.] |
[F#m11.]눈부신 오늘 밤 저 | [A(add9).]하늘 아래 그보다 | [Bsus4.]빛나는 너의 입술에 | [E.]빛나는 크리스탈이 |
[Bsus4.]되지 못한 나의 | [F#m11.]차가운 알루미늄만이 | [A(add9).] | [E.] ||
$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '야경',
  '터치드',
  'G',
  0,
  105,
  'entertain',
  $song${title: 야경}
{artist: 터치드}
{key: G}
{capo: 0}
{bpm: 105}

[Intro]
[G.] | [G.] | [G.] | [G.] |
[G.] | [/F.] | [C/E.] | [Eb.] |
[G.] | [/F.] | [C/E.] | [Eb.Dsus4.] |

[Verse 1]
[G.]이대로- 머무를 | [F.]수 있다면- 얼마나 | [Em.]좋을까- | [Cm.] |
[G.]저무는- 영원을 | [F.]노래하네- 마치 | [Em.]- 찬란한 지옥에 | [Cm.]있는 것 같아- 툭 |

[Verse 2]
[G.]던진 한마디- 에 | [F.]물결쳐도- | [C.]어째서인지 흔들리- | [Eb.]지 는 않아 넘 |
[G.]어진 건물 속- 불빛 | [F.]-들은- | [Eb.] | [D.] |

[Pre-Chorus 1]
[G.]어-진 건물 속- 불빛 | [D/F#.]-들은- | [F.]저 호수 속- 에 가-득 담-겨 있 | [C.]-어 많 |
[G.]은- 걸 바라지- 는 않 | [D/F#.]-아요- | [F.]우리 마-지 막- 일지 몰-라도 | [C.]오- |

[Chorus 1]
[C.]직-너와 나 둘 | [Eb.]이- 서- | [G.]낭만은- 그리- | [/F.]멀리 있지- 않아 |
[C/E.]너만은 놓지- 않 | [Eb.]기를 바라- | [G.]아픔도- 한철- | [F.]- 지나면- 시드니까 |
[Em.](시드니까 말야) | [Cm.]돌- |

[Verse 3]
[G.]아- 오기 힘-들 걸 | [F.]아는데도- | [C/E.]어째서인-지 흔들리- | [Eb.]지 는 않아 넘 |
[G.]어기 힘-들 걸 | [F.]아는데도- | [(N.C).] | [Eb.F.] |

[Chorus 2]
[G.]직-너와 나 둘 | [Eb.]이- 서- | [G.]낭만은- 그리- | [/F.]멀리 있지- 않아 |
[C/E.]너만은 놓지- 않 | [Eb.]기를 바라- | [G.]낭만은- 그리- | [F.]멀리 있지- 않아 |
[C/E.]너만은 놓지- 않 | [F.]기를 바라- 떠 |

[Bridge]
[G.]날까 너와 나 그 | [F.]냥 함께 취-해볼까 우릴 봐 | [C/E.]이런 맘 잠 | [C.]들지 못하--는 밤 너 |
[G.]무나 막연한 그 | [F.]냥 함께 취-해볼까 우릴 봐 | [C/E.]이런 맘 잠 | [Eb.]들지 못한- 넘 |

[Pre-Chorus 2]
[G.]어진 건물 속- 불빛 | [D/F#.]-들은- | [F.]저 호수 속- 에 가-득 담-겨 있 | [C.]-어 많 |
[G.]은- 걸 바라지- 는 않 | [D/F#.]-아요- | [F.]우리 마-지 막- 일지 몰-라도 | [C.]오- 직-너와 나 둘 |
[Eb.]이- 넘 |

[Chorus 3]
[G.]어-진 건물 속- 불빛 | [D/F#.]-들은- | [F.]저 호수 속- 에 가-득 담-겨 있 | [C.]-어 긴 |
[G.]밤- 을 새워- 더 불 | [D/F#.]빛- 을 태워- 그게 마 | [F.]-지 막- 일지 몰-라도 | [C.]오- 직-너와 나 둘 |
[Eb.]이- 서- |

[Outro]
[G.] | [F.] | [C/E.] | [Eb.] |
[G.] | [F.] | [C/E.] | [Eb.] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '좋지 아니한가',
  '유다빈밴드',
  'Bb',
  0,
  190,
  'entertain',
  $song${title: 좋지 아니한가}
{artist: 유다빈밴드}
{key: Bb}
{capo: 0}
{bpm: 190}

[Intro]
[Bb] | [F] | [Gm] | [Ab] |
[Eb] | [F] | [Bb] | [Bb] |

[Verse 1]
[Bb]나무가 사라져간 [D]산길 | [Gm]주인 없는 [Ab]바다 | [Eb]그래도 [F]좋지 아니한 [Bb]가 | [Bb] |
[Bb]내 마음대로 되는 [D]세상 | [Gm]밤이 오면 싸워왔던 [Ab]기억 | [Eb]일기를 쓸만한 [F]노트와 | [Bb]연필이 생기지 않았나 |

[Verse 2]
[Bb]내 마음대로 그린 [D]세상 | [Gm]저 푸른 [Ab]하늘 | [Eb]구름 위에 [F]독수리 높이 날고 | [Bb] |
[Bb]카우보이 세상을 [D]삼키려 [Gm]하고 | [Ab]총성은 이어지 [Eb]네 | [F]TV 속에 싸워 이긴 [Bb]전사 | [Bb] |

[Pre-Chorus]
[Gm]일기 쓰고 있는 [Ab]나의 천사 | [Eb]도화지에 그려질 [F]모습 | [Bb]그녀가 그려갈 [Bb]세상 | [Bb] ||

[Chorus 1]
[Gm]우린 노래해 [F]더 나아질 [D]거야 | [Eb]우린 [F]추억해 | [Gm]부질없이 지난날 [F]들 | [D]바보같이 지난날 [Eb]들 |
[Bb]그래도 우린 [D]좋지 아니한 [Gm]가 | [Ab]바람에 흐를 [Eb]세월 속에 | [F]우리 같이 있지 않 [Bb]나 | [Bb] |

[Chorus 2]
[Bb]이렇게 우린 [D]웃기지 않 [Gm]는가 | [Ab]울고 있었다 [Eb]면 | [F]다시 만날 수 없는 [Bb]세상에 | [Bb]우린 태어났으니까 [Bb]ㄴ |

[Chorus 3]
[Gm]우린 노래해 [F]더 나아질 [D]거야 | [Eb]우린 [F]추억해 | [Gm]부질없이 지난날 [F]들 | [D]바보같이 지난날 [Eb]들 |
[Bb]그래도 너는 [D]좋지 아니한 [Gm]가 | [Ab]강물에 넘칠 [Eb]눈물 속에 | [F]우리 같이 있지 않 [Bb]나 | [Bb] |

[Chorus 4]
[Bb]이렇게 우린 [D]웃기지 않 [Gm]는가 | [Ab]울고 있었다 [Eb]면 | [F]다시 만날 수 없는 [Bb]세상이 | [Bb]멋지지 않았는가 |

[Outro]
[Bb]아아아 | [F]아아아 | [Gm]아아아 | [Ab]아아아 |
[Eb]그녀가 [F]그려 갈 [Bb]세상 | [Bb] | [Bb] | [Bb] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  'No Make Up',
  'Zion.T',
  'A',
  0,
  100,
  'output',
  $song${title: No Make Up}
{artist: Zion.T}
{key: A}
{capo: 0}
{bpm: 100}

[Intro]
[DM7] | [C#m7] | [E/F#.Cdim.] | [Bm7] |
[D/E] | [AM7] | [Eb7] |
[DM7] | [C#m7] | [E/F#.Cdim.] | [Bm7] |
[D/E] | [AM7] | [A.Eb7.] |

[Verse 1]
[DM7]진하게 화장을 [C#m7]하고 | [E/F#.Cdim.]예쁘게 머리를 [Bm7]하고 |
[D/E]오늘도 집을 나서는 넌 [AM7]예뻐 | [A.Eb7.] |
[DM7]높은 구두를 [C#m7]신고 | [E/F#.Cdim.]짧은 치마를 [Bm7]입고 있는 [D/E]너 |
[AM7]너무나 아름[A]다워 | [Eb7] |

[Verse 2]
[DM9]넌 모를 거야 [C#m7]자다가 | [Bm7]일어나 살짝 부은 [Em7]얼굴 | [A7]이 얼마나 예쁜지 |
[DM7]넌 모를$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '골목길 어귀에서',
  '윤종신',
  'Gm',
  0,
  100,
  'output',
  $song${title: 골목길 어귀에서}
{artist: 윤종신}
{key: Gm}
{capo: 0}
{bpm: 100}

[Intro]
[Gm7] | [C7] | [Am7] | [D7] |

[Verse 1]
[Gm7.C7.]우리 다시 만난 거야 | [Am7.D7.]이 골목길 어귀에서 | [Gm7.C7.]함께한 시간들이 | [Am7.D7.]나를 또다시 설레게 해 |
[Gm7.C7.]사소했던 오해들도 | [Am7.D7.]이젠 다 사라져 | [Gm7.C7.]내 얼굴은 그날처럼 | [Am7.D7.]환하게 널 불러 |

[Chorus]
[Gm7]둘만이 걸었던 | [C7]거리라 | [Am7]서로를 보듬었던 | [D7]시간들 |
[Gm7]따뜻한 오월의 | [C7]잔디라 | [Am7]소중한 바람과 | [D7]기억들 |
[Gm7]밤이면 아련한 | [C7]공기라 | [Am7]메마른 가로등 | [D7]아래 |
[Gm7]골목길 뜨거운 | [C7]가로등 | [Am7]소중한 추억들은 | [D7]이젠 |

[Bridge]
[Gm7.C7.]우리 다시 만난 거야 | [Am7.D7.]사소했던 오해들도 | [Gm7.C7.]2021년 여름 그날처럼 | [Am7.D7.]나는 또 다시 설레게 해 |

[Outro]
[Gm7.C7.] | [Am7.D7.] | [Gm7.C7.]우리 다시 만난 거야 | [Am7.D7.]이 골목길 어귀에서 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '괜찮아도 괜찮아',
  '조이 (Joy)',
  'D',
  0,
  100,
  'output',
  $song${title: 괜찮아도 괜찮아}
{artist: 조이 (Joy)}
{key: D}
{capo: 0}
{bpm: 100}

[Intro]
[D] | [A/C#] | [Bm7] | [Asus] |
[GM7] | [F#m7] | [Em7] | [Em7/A] |

[Verse 1]
[D]솔직하게 [A/C#]스쳐간 [Bm7]감정들에 [Asus]무뎌지는 감각 |
[GM7]언제부턴가 [F#m7]익숙해져버린 [Em7]마음을 [Em7/A]숨기는 법들 |
[D]난 어디쯤에 [A/C#]와 있나 [Bm7]알아 [Asus]보려 애쓰지도 않던 |
[GM7]돌아보는 것도 [F#m7]왠지 겁이나 [Em7]미뤄 둔 [Em7/A]얘기들 |

[Pre-Chorus]
[Bm7]시간이 가듯 [A]내 안인 채로 [GM7]변해버린 [Asus4]어른 가슴이 저릴 만큼 |
[Bm7]눈물겹고 [A]날도 [GM7]마음같이 [D/F#]뜨는 [Em7]태양 아래서 달리네 |

[Chorus]
[D]때론 울고 [A/C#]때론 웃고 [Bm7]기뻐하고 [Asus]아파하지 다시 |
[GM7]설레고 [F#m7]무뎌지고 [Em7]마음이 [Em7/A]가는 대로 있는 그대로 |
[D]수많은 별이 [A/C#]그렇듯이 [Bm7]언제나 같은 [Asus]자리 제 몫의 빛으로 환하게 비출 테니 |
[GM7]숨기지 말고 [F#m7]너를 보여줄래 [Em7]편히 네 모습 [Em7/A]그대로 그게 괜찮아 [D]괜찮아도 |

[Verse 2]
[D]오늘 난 처음으로 [A/C#]솔직한 [Bm7]내 마음을 [Asus]아득히 |
[GM7]거울 앞에 [F#m7]서는 건 [Em7]어 모댈 이 [Em7/A]표정은 또 왜이리도 어색해 |
[D]아름다운 건 [A/C#]늘 소중하고 [Bm7]감히 어렵다 [Asus]아득히 멀어져도 |
[GM7]늘 마주 [F#m7]보듯 평범한 [Em7]일상은 [Em7/A]마음의 눈 |

[Bridge]
[Bm7]그 안에 감춰둔 [A]외로움도 [GM7]감히 어루만 [A7.A/F#]질 수 있게 해 그리 바라봐 |
[Bm7]부드러운 바람이 [F#m7]불면 [Em7]마음을 [Em7/A]열어 지나갈 하루도 |

[Chorus]
[D]때론 울고 [A/C#]때론 웃고 [Bm7]기뻐하고 [Asus]아파하지 다시 |
[GM7]설레고 [F#m7]무뎌지고 [Em7]마음이 [Em7/A]가는 대로 있는 그대로 |
[D]수많은 별이 [A/C#]그렇듯이 [Bm7]언제나 같은 [Asus]자리 제 몫의 빛으로 환하게 비출 테니 |
[GM7]숨기지 말고 [F#m7]너를 보여줄래 [Em7]편히 네 모습 [Em7/A]그대로 그게 괜찮아 [D]괜찮아도 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '그게 뭐라고',
  '바비킴',
  'G',
  0,
  100,
  'output',
  $song${title: 그게 뭐라고}
{artist: 바비킴}
{key: G}
{capo: 0}
{bpm: 100}

[Verse 1]
[CM7]너의 소식을 듣고 | [Bm7]난 멍하니 있어 | [Am7]하루 종일 널 [D7]생각하나 봐 | [GM7]
[CM7]일도 잘 안 잡히고 | [Bm7]집중이 안 돼 | [Am7]괜찮았는데 [D7]요즘따라 | [GM7]니가 [CM7]자꾸 생각나 |

[Verse 2]
[CM7]니 무릎을 베고 | [Bm7]하늘을 보며 | [Am7]웃고 있던 너와 [D7]내가 | [GM7]생각나는데 |
[CM7]먼 훗날의 여길 [Bm7]함께 하쟀었는데 | [Am7]사랑한다고 내게 [D7]말해줬던 너의 [GM7]목소리 |
[CM7]하나둘씩 떠오르지 | [Bm7]함께 한 추억들이 | [Am7]그게 뭐라고 [D7]또 생각나 | [GM7]그리워지네 |

[Bridge]
[Em7]그 누군가 [A7]내게 | [Am7]말을 했지 | [D7]세월이 곧 약일 거라고 | [GM7]
[Em7]널 많이 사랑하나 [A7]봐 | [Am7]이젠 잊을 때도 [D7]됐는데 | [GM7]그랬나 봐 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '그대를 만나고',
  '윤미래',
  'D',
  0,
  100,
  'output',
  $song${title: 그대를 만나고}
{artist: 윤미래}
{key: D}
{capo: 0}
{bpm: 100}

[Verse 1]
[D]그대를 만나고 [D/C#]그대와 | [Bm7.F#m7.]나눠먹을 [G]밥을 | [Gsus4.G.]지을 수 [D/F#]있어서 | [Em]그대를 만나고 |
[Asus.A7.]그대의 저린 [Dsus4.D.]손을 | [C/E.D/F#.]잡아줄 수 [G]있어서 | [A7/G.F#m7.]그대를 안고서 | [Bm7]되지 않는 위로라 |
[G]도 할 수 [C]있어서 | [G.Asus.]다행이다 [Dsus4.D.]그대라는 | [A/C#]아름다운 세상이 | [Bm7]여기 있어줘서 |

[Verse 2]
[G#m7b5]거친 바람 속에도 | [G]젖은 지붕 밑에도 | [D/F#]홀로 내팽개쳐져 [F#m7]있지 | [Bm7]않다는 게 |
[G#m7b5]지친 하루 살이와 | [G]그 어떤 무의미한 | [D/F#]일이 아니라 | [F#m7]언제나 나의 곁을 |
[Bm7.F#m7.]지켜주던 [G.D.]그대라는 | [C]놀라운 사람 [Asus.A7.]때문이란 | [Asus.A7.]걸 |

[Outro]
[D]그대를 만나고 | [D/C#]그대의 머리칼을 | [Bm7.F#m7.]만질 수가 [G]있어서 | |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '그댄 달라요',
  '한올',
  'Em',
  0,
  100,
  'output',
  $song${title: 그댄 달라요}
{artist: 한올}
{key: Em}
{capo: 0}
{bpm: 100}

[Verse 1]
[Em.Asus2.]비교할 수 없는 [G]사랑이죠 | [Em.Asus2.]뭐라고 말하려 [G]해도 |
[C]믿을 수 없이 [D]난 바뀌게 한 | [C]그대는 너무 [D]달라요 내가 본 어느 눈빛보다 |

[Verse 2]
[Em.Asus2.]비교할 수 없는 [D]설렘 [G]바로 그대 나에겐 그래요 |
[Em.Asus2.]바라보다가 건넨 [D]평범한 [G]인사 |
[Em]아직은 나만의 [Gmaj7]비밀 | [Em]그대라는 한 [Gmaj7]사람 날 기대하게 해 언젠가 날 너무나 |

[Bridge]
[C]감동시킬 것 같은 [D]고백이 있을 것 [Em]같아 | [Gmaj7]언제부턴가 기다려 |
[C]그대는 너무 [D]달라요 날 빠져들게 만든 [Em]시간 | [G]그댄 날 조급하게 만들었고 |

[Outro]
[C]한걸음만 더 [D]내게 다가와줘 | [Em]그댄 비밀일 수 [Gmaj7]없기에 |

[Interlude]$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '너도 그냥 날 놓아주면 돼',
  '윤딴딴',
  'Am',
  0,
  100,
  'output',
  $song${title: 너도 그냥 날 놓아주면 돼}
{artist: 윤딴딴}
{key: Am}
{capo: 0}
{bpm: 100}

[Verse 1]
[Fmaj7]왜 오늘도 이렇게 [Gsus]힘겨운 스물네 시간 | [C/E]반복 돼 오늘도 [Am]머릿속엔 온통 너라는 사람 |
[Fmaj7]오늘도 너에게 [Gsus]하지 못한 말 | [C/E]수없이 반복해 나도 [Am]모르게 너와 함께 듣던 이 노래 |

[Pre-Chorus 1]
[Fmaj7]마지막까지 날 [Gsus]걱정해주던 네 눈빛 잘 알아 | [C/E]그만큼 우리 [Am]미치도록 사랑했잖아 |
[Fmaj7]늘 안쓰러워하던 [Gsus]그날들이 지나가면 | [C/E]이젠 너도 맘 [Am]아플 일 없을 거니까 |

[Chorus 1]
[Fmaj7]흔들리지 마 [Gsus]이젠 나는 괜찮아 | [C/E]너도 이젠 너의 [Am]갈 길 그대로 그냥 가면 돼 |
[Fmaj7]내가 널 놓을 수 [Gsus]있게 너도 그냥 날 놓아주면 돼 | [C/E]아픈 기억들만 [Am]내게 두고 |
[A]제발 | [Am]가 |

[Verse 2]
[Fmaj7]왜 오늘도 이렇게 [Gsus]멍청히 하루가 | [C/E]또 반복해 너와 [Am]함께 듣던 이 노래 |

[Pre-Chorus 2]
[Fmaj7]마지막까지 날 [Gsus]위로해주던 네 눈물 잘 알아 | [C/E]그만큼 우리 [Am]미치도록 힘들었잖아 |
[Fmaj7]사랑 한만큼 [Gsus]아프던 그날들이 지나가면 | [C/E]이젠 너도 좋은 [Am]기억만 남을 거니까 |

[Chorus 2]
[Fmaj7]흔들리지 마 [Gsus]이젠 나는 괜찮아 | [C/E]너도 이젠 너의 [Am]갈 길 그대로 그냥 가면 돼 |
[Fmaj7]내가 널 놓을 수 [Gsus]있게 너도 그냥 날 놓아주면 돼 | [C/E]아픈 기억들만 [Am]내게 두고 |
[A]제발 | [Am]가 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '너의 의미',
  '아이유',
  'D',
  0,
  100,
  'output',
  $song${title: 너의 의미}
{artist: 아이유}
{key: D}
{capo: 0}
{bpm: 100}

[Verse 1]
[D9]그대여 | [G]아무 | [D/F#]말도 | [A7]하지 |
[Bm7]말아요 | [D/F#]지금 | [G]그대의 | [G/A]눈빛은 |
[D9]너무나도 | [G]아파 | [D/F#]보여요 | [A]그대여 |
[Bm7]울지 | [D/F#]말아요 | [G]지금 | [Gm7b5]그대의 |

[Verse 2]
[D9]슬픔은 | [G]나에게도 | [D/F#]전해 | [A7]져요 |
[Bm7]그대여 | [D/F#]웃어 | [G]봐요 | [G/A]지금 |
[D9]그대의 | [G]미소는 | [D/F#]나에게도 | [A]행복을 |
[Bm7]줘요 | [D/F#]그대여 | [G]날 사랑해 | [Gm7b5]줘요 |

[Bridge]
[C]너의 | [G]그 한마디 | [Am]말도 | [$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '널 생각해',
  'M.C The Max',
  'G',
  0,
  100,
  'output',
  $song${title: 널 생각해}
{artist: M.C The Max}
{key: G}
{capo: 0}
{bpm: 100}

[Verse 1]
[GM7.G7.]Tonight 널 바래다 | [CM7.Cm6.]주는 길 내내 | [GM7.G7.]내가 변했단 | [CM7.Cm6.]말하지 |
[Bm7]널 바라보고 | [E7b9]웃는다고 | [Am7]너는 투덜 | [C9]대지 |

[Verse 2]
[GM7.G7.]언제나 넌 | [CM7.Cm6.]사랑이 설레임이니 | [GM7.G7.]내겐 사랑은 | [CM7.Cm6.]익숙함이야 |
[Bm7]널 떠올리는 | [E7b9]그 시간을 | [Am7]따로 두지 | [C9]않아 |

[Chorus]
[G]늘 널 생각해 | [G/F]그래 널 생각해 | [C/E]바쁜 하루의 순간 순간 | [Cm]그 순간도 니가 보여 |
[G/D]모두 보여줄 수 없지만 | [Em]조금은 | [Am7]너도 느끼 | [C9]잖아 |
[G]늘 널 생각해 | [G/F]매일 널 생각해 | [C/E]잠이 들어 꿈꾸는 | [Cm7.Cm9.]순간도 |
[G/D]내 옆에 | [C/D]웃는 그런 | [GM7.G7.]널 생각해 | [CM7.Cm6.] |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '눈',
  'Zion.T',
  'Am',
  0,
  100,
  'output',
  $song${title: 눈}
{artist: Zion.T}
{key: Am}
{capo: 0}
{bpm: 100}

[Verse 1]
[GM7.C/G.]내일 아침 하얀 눈 | [Am7]쌓여 있었으면 해요 |
[C/D.D.]그럼 따뜻한 차를 | [Am7]한 잔 내어드릴게요 |
[F/G.G7.]서두르지 마요 못다한 | [Am7]얘기가 있어요 |
[C/D.D.]계속 내 옆에만 | [Am7]있어주면 돼요 |

[Chorus]
[Am7]눈이 올까요 | [C/D.D.]우리 아침 |
[Am7]감은 눈 | [D/E.E7.]위에 |

[Bridge]
[Am7]잘 [C/D]봐요 | [Am7]밖이 유난히 |
[C/D]하얗네요 | [Am7] |
[Bm7]눈이라오 | [Am7]창밖에도 |
[C/D]눈이라오 | [Am7] |

[Verse 2]
[GM7.C/G.]내일 아침 하얀 눈 | [GM7]쌓여 있었으면 해요 |
[C/D.D.]그럼 따뜻한 차를 | [C.D7.]한 잔 내어드릴게요$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '눈사람',
  '정승환',
  'G',
  0,
  100,
  'output',
  $song${title: 눈사람}
{artist: 정승환}
{key: G}
{capo: 0}
{bpm: 100}

[Verse 1]
[G]괜찮아요 [D/F#]이젠 [Em7]어느 정도 [B7]익숙해 [C]졌죠 | [D7]그리 [G]움 [D/F#]이라는 [Em7]것 [B7]나도 [C]알아요 | [D7]사랑은 [G]늘 그렇다는 [D/F#]걸 |
[G]애써 [D/F#]웃어 보였던 [Em7]지난 [B7]시간에 | [C]미련은 [D7]없어요 [G]어설픈 [D/F#]내 안에 [Em7]그대가 [B7]있을 [C]뿐 | [D7] | [G] |

[Verse 2]
[G]괜찮아요 [D/F#]이젠 [Em7]다 알아요 [B7]그대가 [C]나를 | [D7]얼마나 [G]사랑했었는지도 [D/F#]나도 [Em7]알아요 [B7] | [C]이별이 [D7]늘 그렇다는 [G]걸 |
[G]굳이 [D/F#]떠난 [Em7]그대를 [$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '다시 사랑한다 말할까',
  '김동률',
  'C',
  0,
  100,
  'output',
  $song${title: 다시 사랑한다 말할까}
{artist: 김동률}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[C]마치 어제 만난 [G/B]것처럼 | [F]잘 있었나 난 [Fm]인사가 [C/G]무색할만큼 |
[Bm7b5]괜찮아 [E7/G#]어려웠는지 | [Am]서먹한 [E7/G#]내가 되어 [D]어색할까 |

[Verse 2]
[C]어제 나의 전활 [G/B]받아서 | [F]몹시 한숨도 [Fm]못자 [C/G]엉망이라며 |
[Bm11]수줍게 [E7/G#]튼 얼굴 | [Am]어쩌면 [E7/G#]이럴지도 [D9]모르지 |

[Bridge]
[Am]그땐 우리 너무 [Em]어렸었다며 | [F]지난 [G7/F]얘기로 [Em]웃어[Am]줬다가 |
[G#dim]아직 혼자라는 [C/G]너의 [D/F#]그 말에 | [Dm.Em.F.D.]불쑥 나 몰래 가슴이 시려 | [G.B.A.G.] |

[Chorus 1]
[C]다시 사랑한다 [G/B]말할까 | [Am]조금 멀리 [Gm.C7.]돌아왔지만 | [F]기다려[G7/F]왔다고 |
[Em]널 기다리는 [Ddim]게 | [Dm7]나에게 제일 [G7]쉬운 일이라 | [C]시간이 가는 줄 | [C]몰랐다고 |

[Chorus 2]
[C]다시 사랑한다 [G/B]말할까 | [Am]여전히 난 [Gm.C7.]부족하지만 | [F]받아주[G7/F]겠냐고 |
[Esus4]널 사랑하는 [Dm7]게 | [Fm]내 삶에 전부라 [G]어쩔 수 없다고 말야 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '다행이다',
  '이적',
  'D',
  0,
  100,
  'output',
  $song${title: 다행이다}
{artist: 이적}
{key: D}
{capo: 0}
{bpm: 100}

[Verse 1]
[D]그대를 | [D/C#]만나고 [Bm]그대의 [F#m7]머릿결을 | [G]만질 수가 [Gsus4]있어서 | [G] |
[D/F#]그대를 [Em]만나고 | [Asus4]그대와 [A7]마주보며 | [Dsus4]숨을 쉴 수 [D]있어서 | [D/F#] |
[Bm7]그대를 [G]안고서 | [A7/G]힘이 들면 [F#m7]눈물 흘릴 수가 | [Bm7]있어서 [G]다행이다 | [Asus4]다행이다 [Dsus4] |
[C]그대라는 | [G]아름다운 [Asus4]세상이 | [D]여기 [A/C#]있어줘서 | [Bm7] |

[Bridge]
[G#m7b5]거친 [Bm7]바람 [G#m7b5]속에도 | [G]작은 [D/F#]지붕 [F#m7]밑에도 | [G]홀로 [D/F#]내팽개쳐 [F#7/A#]있지 않다는 게 | [Bm7] |
[Bm7]지친 [F#m7]하루살이와 | [G]고된 [D]살아남기가 | [Cadd9]행여 [Asus4]무의미한 [A]일이 아니라는 걸 | [Bm7] |

[Outro]
[G]언제나 [D]나의 [Cadd9]곁을 | [Asus4]지켜주던 [A]그대라는 | [D]놀라운 [D/F#]사람 [D]때문에 | [D]이런 걸 [D]다행이다 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '도망가자',
  '선우정아',
  'G',
  0,
  100,
  'output',
  $song${title: 도망가자}
{artist: 선우정아}
{key: G}
{capo: 0}
{bpm: 100}

[Verse 1]
[G9]도망가자 [G/B]어디든 | [C9]가야 할 곳 [G/B]같아 |
[Am11]걱정은 잠시 [D7]내려두고 | [G9]대신 가볍게 [G/B]짐을 챙기자 |
[C]신경 쓸 [D]것 없어 | [G9]다시 돌아오긴 [G/B]아쉽겠지만 |
[Em]괜찮아 좀 느려도 [E7]괜찮아 | [A7]거기서 거기야 [Cm.D7.]아무 생각 말고 |

[Verse 2]
[G9]너랑 있을게 [Gaug]이렇게 손 내밀면 |
[Em]내가 잡을게 있을까 [E7]두려울 게 |
[C9]어디를 간다 해도 [G/B]우린 서로를 | [C9]꼭 붙잡고 [G/B]있으니 |
[Am7]너라서 나는 충분해 | [Gm/Bb]나는 늘 [C]너와 눈 마주칠 때 |
[D7]너의 얼굴 위에 |

[Chorus]
[G9]빛이 스며들 때까지 [G/B]가보자 지금 [C9]나랑 |
[G/B]도망가자 멀리 안 가도 [Am11]괜찮을 거야 |
[G/B]너와 함께라면 [C]난 다 좋아 | [D]너의 맘이 |
[Em]편할 수 있는 [E7]곳 | [C9]그게 어디든지 [G/B]얘기해줘 |
[C]내가 안아줄게 | [D]괜찮아 좀 느려도 |
[G]천천히 걸어도 | [A/C#]나란 너랑 갈 거야 [Cm.D7.]어디든 |
[G]지금 나랑 도망가자 |

[Bridge]
[C]가보는 거야 | [G/B]달려도 볼까 | [A7]어디로든 | [Fmaj7]어떻게든 |
[C]내가 옆에 있을게 | [G/B]마음껏 울어도 돼 | [A7]그 다음에 | [Fmaj7]돌아와 씩씩하게 |
[C]기지개 펴 | [G/B]내가 안아줄게 | [A7]괜찮아 좀 느려도 | [Fmaj7]천천히 걸어도 |
[C]나란 너랑 갈 거야 | [G/B]어디든 | [A7]당연해 가자 | [Fmaj7]손잡고 사랑해 |

[Outro]
[C]눈 마주칠래 | [G/B]너의 얼굴위에 |
[A7]빛이 스며들 때까지 | [Fmaj7]가보자 지금 나랑 도망가자 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '도망가지마',
  '김나영',
  'Am',
  0,
  100,
  'output',
  $song${title: 도망가지마}
{artist: 김나영}
{key: Am}
{capo: 0}
{bpm: 100}

[Verse 1]
[FM7.Em7.]맘에 안 드는데 | [Dm7.CM7.]넌 왜 아직 | [FM7.G.]내 옆에 있어 | [Am7.C.]이러다 밤이라도 만날까 걱정돼 |

[Chorus 1]
[FM7.Em7.]몇 번을 부딪혀봐도 | [Dm7.CM7.]난 네가 좋은 걸 | [FM7.G.]어떡해 너도 | [Am7.C.G.]나와 같은 마음일 거라고 생각해 |

[Pre-Chorus]
[Am7.FM9.]I believe you and you | [G.C.]believe me 이젠 네 맘을 | [FM9.G.]보여줘도 돼 더 | [Am7.C.G.]숨기지 마 |

[Verse 2]
[FM7.Em7.]우린 서로 다가가면 | [Dm7.CM7.]더 멀어지는 게 | [FM7.G.]이상해 이러다 | [Am7.C.]혼자 남게 될까 난 걱정돼 |

[Chorus 2]
[FM7.Em7.]몇 번을 부딪혀봐도 | [Dm7.CM7.]난 네가 좋은 걸 | [FM7.G.]어떡해 너도 | [Am7.C.G.]나와 같은 마음일 거라고 생각해 |

[Bridge]
[FM7.G.]좀 서투른 내 말이 널 | [Em7.A#dim.]아프게 한 건 | [Dm7.G.]진심이 아니란 걸 | [Cadd9.Am7.]누구보다 네가 더 잘 알고 있잖아 |

[Outro]
[FM7.G.]분주해진 하루에 | [Em7.A#dim.]널 담고 가면 | [Dm7.G.]난 정말 괜찮을 텐데 | [C]너는 어떠니 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '뜨거운 여름 밤은 가고 남은건 볼품없지만',
  '장범준',
  'C',
  0,
  100,
  'output',
  $song${title: 뜨거운 여름 밤은 가고 남은건 볼품없지만}
{artist: 장범준}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[C]난 어떤 마[Am]음이었을까 | 내 모든 걸 [Dm7]주고도 | 얻을 수 없었[Fm.G.F.Em.Dm.]나 |
[C]그때는 또 어떤 마[Am]음이었길래 | 그 모든 걸 [Dm7]잃고도 | 되돌아 버렸[Fm.G.F.Em.Dm.]나 |

[Chorus]
[C.G/B.G/Bb.A7.]뜨거운 여름밤은 가고 남은 건 볼품없지[Dm.Dm/C#.F/C.G.]만 | [C.G/B.G/Bb.A7.]또 다시 찾아오는 누군갈 위[Dm.Fm.G.]해서 |
남겨두겠[C.F.G.]소 | [C.G/B.G/Bb.A7.]그대여 이제 그만 | 이별 앞에 그만 슬퍼[Dm.Dm/C#.F/C.G.]해요 |
[C.G/B.G/Bb.A7.]나는 다시 일어설 테니 | 그대도 이제 [Dm.Fm.G.]웃어요 | [C.F.G.] |

[Interlude]
[C] | [Am] | [Dm7] | [Fm.G.F.Em.Dm.] |

[Verse 2]
[C]다짐은 세[Am]월 속에 | 모래성처[Dm7]럼$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '멋지게 인사하는 법',
  '윤하 & 이석훈',
  'E',
  0,
  100,
  'output',
  $song${title: 멋지게 인사하는 법}
{artist: 윤하 & 이석훈}
{key: E}
{capo: 0}
{bpm: 100}

[Verse 1]
[E]인사까지 [Bm7.E7.]연습했는데 | [A]거기까진 [Am7]문제없었는데 |
[G#m7]왜 내 맘에 [C#m7]반 바퀴쯤 굴러 왜 | [F#m7]평소처럼만 [B]하면 돼

[Chorus 1]
[E]머리쯤은 [Bm7.E7.]넘기는 척했어 | [A]편한 [Am7]듯이 웃음 지었지 |
[G#m7]하필 또 [C#m7]표정 연기 | [F#m7]나머지 하나도 [B]안 맞았지

[Verse 2]
[E]최악의 [Bm7.E7.]망치는 짓 했어 | [A]사실 [Am7]나 그 영화도 못 봤어 |
[G#m7]겨우 알게 [C#m7]된 | [F#m7]사람 친구로 [B]여기잖아

[Chorus 2]
[E]인사까지 [Bm7.E7.]연습했는데 | [A]거기까진 [Am7]문제없었는데 |
[G$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '무릎',
  '이적',
  'C',
  0,
  100,
  'output',
  $song${title: 무릎}
{artist: 이적}
{key: C}
{capo: 0}
{bpm: 100}

[Intro]
[C9] | [G/B] | [A7sus4] | [Am7/G] |
[F] | [C/E] | [Dm7] | [F/G.G7.] |

[Verse 1]
[C9]꿈을 [G/B]꾸던 [A7sus4]두 발을 [Am7/G]담그던 | [F]다시 [C/E]너에게 [Dm7]내리던 | [F/G.G7.] |
[C9]나 그대 [G/B]지친 [G/Bb]발 맡겨 [A7]게으른 | [Dm7]모든 [G]걸 맡겨 | [G] | [G] |

[Pre-Chorus]
[F]나 조그만 [E7]것 같아 [Am]이 정도면 [A7]오래 | [Dm7] | [F/G] | [C] | [G7] |
[F]그만둘까? [G/F]지쳐서 [Em7]못 걸어 [A7]가겠어 | [Dm7] | [F/G] | [F] | [F] |

[Chorus]
[C9]$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '밤이 깊었네',
  '칵스',
  'D',
  2,
  100,
  'output',
  $song${title: 밤이 깊었네}
{artist: 칵스}
{key: D}
{capo: 2}
{bpm: 100}

[Verse 1]
[Em9]샤워를 마치 | [A13]고 머리를 만질 | [DM7]때 | [GM7] |
[Em9]코끝을 맴도 | [A13]는 그대만의 냄 | [DM7]새 | [GM7] |
[Em9]끌리지도 않 | [A13]고 질리지도 않 | [DM7]는 | [GM7] |
[Em9]밋밋한 매 | [A13]력의 그대만의 냄 | [DM7]새 | [GM7] |

[Chorus]
[G.E.]밤이 깊었네 | [E.C#]방황하며 춤을 추는 | [Am.F#m]불빛들 이 밤에 | [D.B.]취해 흔들리고 있네요 |
[G.E.]벌써 새벽인데 | [E.C#]아직도 혼자네요 | [Am.F#m]이 기분이 나쁘지는 | [D.B.]않네요 |
[C.A.]항상 당신 곁에 | [G.E.]머물고 싶지만 | [C.A.]이 밤에 취해 | [G.E.]떠나고 싶네요 |
[C.A.]이 슬픔을 알랑가 | [G.E.]모르겠어요 | [C.A.]나의 극의어 너만은 | [G.G7.]떠나지 마오 오오 |

[Verse 2]
[C.A.]하늘을 피워낸 | [G.E.]어여쁜 동화같은 별을 보면서 | [C.A.]오늘 밤 술에 취해 아름다운 | [G.E.D.B.]그대 품에 따라가고 싶어요 |
[C.A.]가라마라 하지 마 | [G.E.]나를 두고 떠나지 마라 | [C.A.]오늘 밤 시뻘건 핏빛처럼 | [G.E.D.B.]그대에게 머물고 싶어 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '밤편지',
  '아이유 (IU)',
  'Fm',
  0,
  100,
  'output',
  $song${title: 밤편지}
{artist: 아이유 (IU)}
{key: Fm}
{capo: 0}
{bpm: 100}

[Verse 1]
[Fm7]이 밤 | [BbM7]그 날의 | [Gsus4]반딧불을 | [G7]당신의 |
[EbM7]창 [AbM7]가까이 | [Cm7]보낼게요 | [Fm7]음 | [BbM7] |
[A7/E]사랑한다는 | [Em9]말이에요 | [BbM7] | [A7sus4] |

[Verse 2]
[Fm7]나 [BbM7]그 날의 | [Gsus4]반딧불을 [G7]당신의 |
[EbM7]창 [AbM7]가까이 | [Cm7]보낼게요 | [Fm7]음 | [BbM7] |
[A7/E]사랑한다는 | [Em9]말이에요 | [BbM7] | [A7sus4] |

[Chorus]
[Fm7]난 파도가 | [Fm6]머물던 | [EbM7]모래 위에 | [Am7]적힌 글씨처럼 |
[Dm7]그대가 | [E7]멀리 | [Am7]사라져 | [G.B.]버릴 것 같아 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '백야',
  'Unknown',
  'G',
  0,
  100,
  'output',
  $song${title: 백야}
{artist: Unknown}
{key: G}
{capo: 0}
{bpm: 100}

[Intro]
[G] | [C.G.] | [Em] | [C.D.G.] ||

[Verse 1]
[G]너와 내가 [A]떠난 | [C.G.]이 알 수 없는 [Em]여행 | [C]너를 바라보다 [G]잠이 | [Em.D.]들었는데 |
[G]밤이 찾아와도 | [C.G.]어둠이 내리지 [Em]않는 | [C]이 꿈 같은 [G]곳으로 | [Em.D.]날 데려 온거야 |

[Verse 2]
[G]빛나는 [D]하늘아 | [C.D.]떨리는 [G]두 눈과 | [C]나를 바라보는 [G]너의 그 | [Em.D.G.]깊은 미소가 |
[G]난 울지 [D]않을래 | [Em.D.]피하지 않을래 | [C]어둠 속이 [G]빌어온 | [C.D.G.]내게 머물러 |

[Verse 3]
[G]날아가는 [A]새들 | [C.G.]길을 묻는 [Em]사람들 | [C]모든 것이 [G]아직 | [C.D7.]잠들지 않았네 |
[G]어둠 속에 [A]묻혀 있던 | [C.G.]빛나는 [Em]이 밤 모두가 | [C]꿈같은 [G]세계로 [Em]빛을 | [C.D.G.]내고 있구나 |

[Chorus]
[G]잊어야 [D]한다는 | [Em.Bm.]마음으로 | [C]내 텅 빈 [G]방문을 | [D.G.]닫은 채로 |
[G]아직도 [D]남아있는 | [Em.Bm.]너의 향기 | [C]내 텅 빈 [G]방안엔 | [D.G.]가득 한데 |

[Bridge]
[G]이렇게 [D]홀로 누워 | [Em.Bm.]천정을 바라보니 | [C]눈 앞에 [G]맴도는 | [D.G.]너의 모습 |
[G]잊으려 [D]돌아 누운 | [Em.Bm.]내 눈가엔 | [C]말 없이 [G]흐르는 | [D.G.]이슬 방울들 |

[Outro]
[G.D/F#.]지나간 | [Em7.C.]시간은 | [Am]추억 속에 | [C]묻히면 |
[G.D.]그만인 것을 |
[G.D.]나는 왜 [Em]이렇게 | [C.Am.]긴긴 밤을 | [C.G.D.]또 잊지 못해 새울까 |
[G.D.] | [Em.Bm.] | [C.G.] | [D.G.] ||
[G]창틈이 [D]기다리던 | [Em.Bm.]새벽이 오면 | [C]어제보다 [G]커진 | [D.G.]내 방안에 |
[G]하얗게 [D]박아 놓은 | [Em]유리창엔 | [C.G.]뻗어 내려온 | [D.G.]널 사랑해 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '벌써 일년',
  '브라운 아이드 소울',
  'Em',
  0,
  100,
  'output',
  $song${title: 벌써 일년}
{artist: 브라운 아이드 소울}
{key: Em}
{capo: 0}
{bpm: 100}

[Verse 1]
[Em7]처음이라 | [Bm]그래 | [C/E]며칠 뒤엔 | [D#dim]괜찮아져 |
[G]그 생각만으로 | [G/F#]벌써 일년이 ||
[Em]너와 만든 | [Bm/D]기념일마다 | [CM7]슬픔은 | [Bm]나를 찾아와 |

[Verse 2]
[Am]처음 사랑 | [D]고백하며 | [Bm]설레던 | [Em]수줍음과 |
[Am]우리 처음 | [D]만난 날 | [G]지나가고 | [G/F#] |
[Em]너의 생일에 | [Bm/D]눈물의 | [CM7]케잌 촛불 | [Bm]켜서 축하해 |

[Bridge]
[Em]I believe in | [Bm]you | [Am]I believe in | [D]your mind |
[G]벌써 일년이 지났지만 ||

[Chorus]
[Em]일년 뒤에도 | [Bm]그 일년 뒤에도 | [C]널 | [D]기다려 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '별 보러 가자',
  'Standing Egg',
  'C',
  0,
  100,
  'output',
  $song${title: 별 보러 가자}
{artist: Standing Egg}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[C]밤바람이 [CM7/B]조금씩 [C7/A#]불어 [F/A]오면 | [F]네 [C/E]생각이 [D7]그렇게 [G7sus]나더라 |
[C]긴 하루를 [CM7/B]보내고 [C7/A#]집에 [F/A]돌아가는 길에 | [Fm]네 [C/G]생각이 [D7]문득 [G7sus]나더라 [C]|
[Gm7]어디야 [Fm7]지금 [E7sus4]뭐해 |

[Chorus 1]
[A]나랑 [E/G#]별 보러 [Em/G]가지 [F#m7b5]않을래 | [Bm]너희 [Bm(M7)]집 앞으로 잠깐 [D/A]나올래 [Gmaj7b5] | [C#7] |
[F#m]가볍게 [F#m(M7)]걸어 [A/E]나올 때 [Dmaj7]두 손은 [C#7]비어있지만 | [C#m7]왠지 [F#7b13]모르게 [Bm]설레 [E7sus4] |

[Verse 2]
[A]오랜만에 [E/G#]둘이 [Em/G]걷는 이 [F#m7b5]길 | [Bm]그냥 [Bm(M7)]아무 말 없이 걷는 [D/A]것만으로도 좋아서 [Gmaj7b5] | [C#7] |
[F#m]멍하니 [F#m(M7)]밤하늘만 [A/E]쳐다봐 | [Bm7]아마 [E7sus4]지금 이 순간이 [A]가장 빛나는 별 일거[G7sus]야 |

[Pre-Chorus$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '빨래',
  '이적',
  'C',
  0,
  100,
  'output',
  $song${title: 빨래}
{artist: 이적}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[Fmaj7]어쩌면 변한 마음이 | [G/F]사랑을 받아내도록 | [Em7]난 이제 괜찮다고 | [Am7]말하진 않아도 |
[Fmaj7]널 기다리던 [G7]여러 [Am7]밤들 중의 하나가 될 뿐 |
[Fmaj7]무너진 가슴이 | [G/F]다시 일어설 수 | [Em]있게 [Am7]해 |
[Dm7]난 어떡해야만 [G7]할까요 | [C] |

[Verse 2]
[Fmaj7]아무것도 남아 [G/F]있지 않기를 | [Em7]내 가슴속엔 [Am7] |
[Dm7]그게 맘 같처럼 [G7]쉽지가 [C]않아서 |
[Fmaj7]무너진 가슴이 | [G/F]다시 일어설 수 | [Em]있게 [Am7]해 |
[Dm7]난 어떡해야만 [G7]할까요 |

[Chorus]
[Fm]빨래를 해야겠어요 | [Bb7]오직인 이가 | [Ebmaj7]될까요 | [Abmaj7]$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '사랑 Two',
  '더 필름',
  'D',
  0,
  100,
  'output',
  $song${title: 사랑 Two}
{artist: 더 필름}
{key: D}
{capo: 0}
{bpm: 100}

[Verse 1]
[D.C.]나의 [A]하루를 [G]가만히 | [Bm.Am.]담아 [G]주는 [F]너 |
[G.F.]홀로 [D]남은 [C]골목길엔 | [C.Bb.]수줍은 [Asus]내 [G]마음만 |

[Verse 2]
[D.C.]눈물 [A]흘린 [G]시간 | [Em.Dm.]뒤엔 [Bm.Am.]언제나 [G]네가 [F]있어 |
[Bm.Am.A.G.]처음엔 [D.C.]그냥 [A]친구뿐만 | [A.G.]줄만 [G.F.]알았어 |

[Verse 3]
[A.G.]또 [G.F.G.]다시 [A.G.A.]사랑이라 | [G]부르지 [A.G.]않아 |
[G.F.]널 [A.G.]만나면 | [G.F.]말 [Bm.Am.]없이 [G.F.]있어도 |

[Verse 4]
[G.F.]널 [A.G.]만나면 | [C]순수한 [G/B]네$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '사랑에 그 어떤 말로도',
  '이정봉',
  'D',
  0,
  100,
  'output',
  $song${title: 사랑에 그 어떤 말로도}
{artist: 이정봉}
{key: D}
{capo: 0}
{bpm: 100}

[Intro]
[G6.F#m.] | [G6.F#m.] |
[G6.F#m.] | [G6.A2.] |

[Verse 1]
[G6]작은 마음 [F#m]한켠엔 [G6]누군가 [F#m]살고 있어 |
[G6]이제 막 [F#m]필요하대요 [G6]자꾸 나를 [A2]부르네요 |

[Verse 2]
[F#m]그 작은 마음 [G6]한켠엔 [Em]그댈 이제는 [A2]내가 만났으니 |
[F#m]더 이상 [G6]헤매이지 말고 [Em]내 이쁜 맘 [A2]주네요 |

[Chorus 1]
[F#m]그대에게 [G6]이 맘을 [Em]전해봅니다 [A2] |
[F#m]세상에 [G6]그 어떤 [Em]말보다 [A2]더한 말 |

[Interlude]
[F#m] | [G6] | [Em] | [F#m] |
[G6] | [F#m] | [G$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '사랑이 다른 사랑으로 잊혀지네',
  '하림',
  'C',
  4,
  100,
  'output',
  $song${title: 사랑이 다른 사랑으로 잊혀지네}
{artist: 하림}
{key: C}
{capo: 4}
{bpm: 100}

[Verse 1]
[C]어쩌면 [E]어쩌면 [Am]어쩌면 [G]
[F]현실에 닿는 [C.G/B.]말은 아마 [Am]도 [G]
[C]넌 아닐 것 [E]같아 널 [Am]보는 내 [G]내
[F]사랑은 [C/E]아니라고 [Dm]말하고 말았 [G7]어

[Verse 2]
[C]가끔 [E]스쳐가는 [Am]바람에 그댄 [G]떠올라
[F]그럴 땐 나 [C.G/B.]어떡해야 [Am]하죠 [G]
[C]그냥 [E]잊는 게 [Am]좋겠죠 [G]
[F]그냥 [C/E]잊는 게 [Dm]좋겠죠 [G7]

[Verse 3]
[C]다시 또 이 [E]별이 익숙해 [Am]진 건 [G]
[F]어떤 누구를 [C.G/B.]위해 어지러 [Am]워져 [G]
[C]이젠 내 [E]몸에 흐르는 [Am]눈물은 다 [G]식었어
[F]사랑이 [C/E]다른 사랑 [Dm]으로 잊혀지 [G7]네

[Outro]
[C]어떤 [E]누구를 [Am]위해 [G]
[F]그대가 [C.G/B.]떠올라 [Am]잊혀지네 [G]
[C]어떤 [E]누구를 [Am]위해 [G]
[F]라라라라 [C/E]라라라 [Dm]잊혀지네 [G7]$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '소녀',
  '이문세',
  'D',
  0,
  100,
  'output',
  $song${title: 소녀}
{artist: 이문세}
{key: D}
{capo: 0}
{bpm: 100}

[Intro]
[DM7] | [F#m7] | [Bm7.Am7.D7.] | [GM7.F#m7.Em7.] |
[A7sus4] | [DM7] | [D7] | [GM7.F#m7.E7.] |
[Em7] | [A7sus4] | | |

[Verse 1]
[DM7]내 곁에만 | [F#m7]머물러요 | [Bm7.Am7.D7.]떠나면 | [GM7.E7/G#]안돼요 |
[D/A]그리움 두고 | [Bm7]멀리 떠나면 | [Em7]그대 무지개를 | [A7sus4]찾아올 |
[DM7]수 없어요 | [D7]노을진 창가에 | [GM7]앉아 멀리 | [F#m7]떠가는 |
[Bm7]구름을 보면 | [F#7]옛 생각들 | [GM7]하늘에 그려 | [A7] |

[Verse 2]
[DM7]찬 바람 속에 | [F#7]몸을 웅크리며 | [Bm7.Am7.D7.]쓸쓸히 그대 | [G.E7/G#]외로워 |
[D]울지만 | [G.A7sus4] | [DM7] | [F#7] |

[Chorus]
[GM7]나 항상 | [F#7]그대 | [Bm7.E7/G#]곁에 | [G]머물겠어요 |
[Gm/Bb]떠나지 | [D.G.A7sus4.]않아요 |

[Bridge]
[D] | [Daug] | [D6] | [D7] |
[G] | [G#m7b5] | [G] | [A7] |
[F#m7] | [B7sus4] | [Em7] | [F#7] |
[Bm7] | [G#m7b5] | [G] | [Gm/Bb] |
[D] | [G] | [A7] | |

[Outro]
[D] | [DM7] | [D9] | [GM7.F#m7.Em7.] |
[A7sus4] | | | |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '스물다섯 스물하나',
  '자우림',
  'C',
  0,
  100,
  'output',
  $song${title: 스물다섯 스물하나}
{artist: 자우림}
{key: C}
{capo: 0}
{bpm: 100}

[Intro]
[C] | [G] | [Dm7] | [G] |
[C] | [G] | [Dm7] | [G] |

[Verse 1]
[C]바람에 날려 [G]꽃이 지는 | [Dm7]계절엔 [G]아직도 너의 손을 잡은 듯 그런 듯해 |
[C]그때는 아직 [G]꽃이 아름다운 [Dm7]걸 [G]지금처럼 사무치게 알지 못했어 |

[Pre-Chorus 1]
[Fmaj7.G.]어떤 향기가 | [Am7.D7.]바람에 실려 오네 |

[Chorus 1]
[Fmaj7]영원할 줄 [G]알았던 | [C]스물다섯 스물 [Csus4]하나 |
[C]그날의 바다는 [G]꿈을 꾸었지 |
[Dm7]빛바래는 햇살 [G]속에 너와 내가 [C]있었고 | [G] |

[Verse 2]
[Dm7]노래가 되었던 [G]수많은 얘기들 | [C] | [G] |

[Pre-Chorus 2]
[Fmaj$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '신청곡',
  'TOIL & Kid Milli (Feat. pH-1)',
  'D',
  0,
  100,
  'output',
  $song${title: 신청곡}
{artist: TOIL & Kid Milli (Feat. pH-1)}
{key: D}
{capo: 0}
{bpm: 100}

[Verse 1]
[Bm7]두 손에 가득 [F#m7]차 버린 추억들은 | [G]소중한 우리 [Em7]이야기 | [F#m7]진심이 담긴 [G]마음이 | [Em/A.A#dim7.] |
[Bm7]시간이 지나 [F#m7]다시 찾아올 [Asus4]때 | [G]말할 수 있을까 [F#m7]너무 행복하다고 [Em] |
[D]너와 울고 웃고 [D/A]또 같이 | [Bm7]사랑하고 마음이 [A]가는 대로 |
[D]있는 그대로 [G]말하지 못할 | [D/F#]고민거리 쌓여버릴 [Em7]테니 | [A]하룻밤이라도 그냥 [A7]괜찮아 괜찮아 |

[Intro]
[D] | [F#m7] | [Bm7] | [F#m7] |
[Em7] | [A7] | [D] | [A7] |

[Verse 2]
[D]창밖엔 또 [F#m7]비가 와 | [Bm7]$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '쓰담쓰담',
  '로꼬, 유주 (GFRIEND)',
  'C',
  0,
  100,
  'output',
  $song${title: 쓰담쓰담}
{artist: 로꼬, 유주 (GFRIEND)}
{key: C}
{capo: 0}
{bpm: 100}

[Intro]
[C] | [Dm7.G.] | [F] | [Dm7] |
[C] | [Dm7] | [G] | [C] |
[C] | [Dm7] | [G7] | [C.G.Am.G/B.] |
[C] | [Em7] | [Dm7] | [C] |

[Verse 1]
[Dm7]어디 [G7]있어 | [CM7]지금 [A]어디? |
[Dm7]나의 [G7]곁에 | [CM7]딱 와있 [Cdim.Edim.]어 |
[Dm7]들리는 [G7]목소리 | [CM7]난 다 [A]잊었어요 |
[Dm7]TV [G7]보는 [CM7]중 [A]식사 중이던 |
[Dm7]운전 [G7]중이던 | [CM7]뭐 상관없 [G/C.F/C.Em/B.Dm/A]어 넌 내게로 와 |

[Pre-Chorus]
[C]꽉 안고 [Dm7.G.]있지 | [F]날 놓지 [Dm7]않$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '아메리카노',
  '10cm',
  'C',
  0,
  100,
  'output',
  $song${title: 아메리카노}
{artist: 10cm}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[F]왜 오늘은 [Em7]날씨조차 [Dm7]도라무시하 [C]지 않는데 |
[F]왜 비는 [Em7]오고 우산은 [Dm7]니가 가져 [C]갔는지 |
[G]왜 돌아오는 [G]길은 이리도 [Dm7]험난한 [C]지 |
[G]전활 [G]걸었던 내가 | [Dm7]집 앞에 널 [C]앉혔는지 |

[Chorus]
[E]아메리카노 [A]좋아 [A]좋아 [E]좋아 |
[A]아메리카노 [E]진해 [A]진해 [E]진해 |

[Verse 2]
[A]어쩌냐고 [E]자꾸만 [A]묻는 [E]너에게 |
[D] | [E] |
[A]배고프면 [C#m.Cm.Bm.]편의점 가서 | [A]햄버거를 [C#m.Cm.Bm.]사주고 |
[A]졸리면 [C#m.Cm.Bm.]언제든 내게 | [A]기대도 [C#m.Cm.Bm.]돼 |
[A]하지만 너는 아직 내게 너무 [C#m.Cm.Bm.]예쁜 여자라 | [A]담배 피고 [C#m.Cm.Bm.]차 마실 때 밥 대신이 복잡해 |
[A]요즘엔 [C#m.Cm.Bm.]사글세 내고 | [A]돈 없을 때 [C#m.Cm.Bm.]짜장면 먹고 홧술 보고 |

[Outro]
[E]그런 건 [A]나 혼자 [E]해도 [A]충분해 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '애월',
  '볼빨간사춘기',
  'E',
  0,
  100,
  'output',
  $song${title: 애월}
{artist: 볼빨간사춘기}
{key: E}
{capo: 0}
{bpm: 100}

[Intro]
[EM7] | [D#m7b5] | [G#m7] | [C#m7] |
[F#7#11] | [D#m7] | [A7] | [B] |

[Verse 1]
[C#m7]사랑을 말하거나 | [D#m7] | [A7]바다를 바라볼 때 | [B] |
[C#m7]겁이 참 많았어요 | [D#m7] | [C#m7]내가 더 미워질까 봐 | [Asus2] |
[E]그 시절의 나는 | [G#7] | [E]널 참 좋아했나 봐요 | [G#7] |
[E]내 모든 것이 부끄러웠던 | [G#7] | [C#m7]너에게 빠져 많이 많이요 | [Asus2] |
[C#m7]남은 건 너 하나일 거예요 | [D#m7] | [F#m7]끝이 와야 아는 내 사랑 | [B] |

[Chorus]
[C#m7]눈가가 시려 오면 | [D#m7] | [A7]어른이 될 거래$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '어른',
  '스탠딩 에그',
  'F#m',
  0,
  100,
  'output',
  $song${title: 어른}
{artist: 스탠딩 에그}
{key: F#m}
{capo: 0}
{bpm: 100}

[Intro]
[F#m7] | [C#m7] | [Dmaj9] | [E] |
[F#m7] | [C#m7] | [D] | [Dm7] |

[Verse 1]
[F#m7]고단한 [C#m7]하루 끝에 따는 [Dmaj9]달 | [E]난 | [F#m7]어디 | [C#m7]로 향해가는 [Dmaj9]걸 | [E]
[F#m7]아무리 [C#m7]아름답다 [Dmaj9]생각한대 | [E]아직 | [F#m7]꿈을 | [C#m7]넘길 수 없을 [Dmaj9]까 | [E]

[Pre-Chorus]
[Esus4.E.]이 넓은 세상에 | [Dmaj9.E/D.]혼자인 것 처럼 |
[Esus4.E.]아무도 내 말을 | [Dmaj9.E/D.]이해 못하고 |

[Chorus]
[A]나는 내가 되고 싶은 [C#7]날 | [F#m7]날고 | [Dm]감동이 없는 |
[A]바깥은 나는 | [C#7]니가 될 수 없 [F#m7]던 다른 날을 뜨고 | [Dm]그걸 알게 됐어 |

[Verse 2]
[A]길은 [C#7]나의 어린 [F#m7]놈을 나를 [Dm]버리며 |
[A]모두 [C#7]정의라고 | [F#m7]믿었어 | [Dm] |
[Dm]모든 [C#m7]사람을 품에 [Dmaj9]안으려던 [E/D]다 큰 | [Dm]맘도 [C#m7]더 크게 울고 [Dmaj9]싶었어 | [E/D]
[Dm]길이 [C#m7]없는 [Dmaj9]혼란을 뒤덮던 [E/D]건 | [Dm]이젠 [C#m7]너무 [Dmaj9]늦어진 걸 | [E/D]

[Bridge]
[Esus4.E.]이 오랜 | [Dmaj9]손끝에 그려지다 |
[Esus4.E.]한참 전 | [Dmaj9.C#7.F#m7.]텐트를 펼 떠났어 |

[Chorus]
[A]나는 내가 되고 싶은 [C#7]날 | [F#m7]날고 | [Dm]감동이 없는 |
[A]바깥은 나는 | [C#7]니가 될 수 없 [F#m7]던 다른 날을 뜨고 | [Dm]그걸 알게 됐어 |

[Outro]
[F#m7]어떤 [C#m7]시간 | [Dmaj9]어떤 곳에 | [E]나의 |
[F#m7]아주 [C#m7]작은 세상은 [Dmaj9]웃어 | [E]줄까 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '어지러웠던',
  '정엽',
  'D',
  0,
  100,
  'output',
  $song${title: 어지러웠던}
{artist: 정엽}
{key: D}
{capo: 0}
{bpm: 100}

[Bridge]
[Em7.A/C#]어지러웠던 하루 | [D.Bm7]하루가 먹구름 | [C#m7b5.F#7]처럼 내 앞을 | [Bm7.Am7.D7]가로막아도 |
[Em7.A/C#]너의 눈빛이 [D.D/F#.G]마치 나침반처럼 | [Em7.Asus]내 갈 길 알려주고 [Dsus]있으니 |
[Em7.A/C#] | [D.D/F#.G] | [Em7.Asus] | [Dsus] |

[Verse 1]
[Em7.A/C#]아직 이 황량한 | [D.G/B]세상 속에 너는 | [C#m7b5.F#7]내 곁에 있어주니 | [Bm7.A/C#.D]까 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '여자들은 왜 화를 내는 걸까',
  '미상',
  'C',
  0,
  100,
  'output',
  $song${title: 여자들은 왜 화를 내는 걸까}
{artist: 미상}
{key: C}
{capo: 0}
{bpm: 100}

[Intro]
[CM7.Em7.] | [FM7.G.] | [CM7.Em7.] | [FM7.G.] |
[CM7.Em7.] | [FM7.G.] | [CM7.Em7.] | [FM7.G.] |

[Verse 1]
[CM7]여자들은 [Em7]왜 화를 [FM7]내는 [G]걸까 | [CM7]그대는 [Em7]왜 화를 [FM7]내는 [G]걸까 |
[Am7]아마도 [Em7]내가 [F]아마도 [G]바보이니까 | [CM7]여자는 [Am7]왜 여자는 [Dm7] | [G] |
[CM7.Em7.] | [FM7.G.] |
[CM7.Am7.] | [Dm7.G.] |

[Verse 2]
[CM7]글쎄요 | [Am7]오늘이 [Dm7]그대가 [G]힘든 그런 날인가요 | [CM7]아니면 [Am7]나에게 [Dm7]미움을 덜이라도 [G]박혔나요 |

[Pre-Chorus]
[Am7]사실은 [Em7]그댈위해 [F]딱히 준비한것도 [G]없지만 |
[Am7]가끔만 [Em7]이러시면 [F]내 입장이 [G]곤란하잖아요 |

[Chorus 1]
[CM7]할말있으면 [Em7]지금해요 | [F]욕을 할라면 [G]욕을하고 |
[Am7]당연히 [Em7]도무지 [F]알수가없이 [G]미치겠네 |

[Interlude]
[CM7.Em7.] | [F.G.] |

[Bridge]
[Am7]어젯밤 [Em7]길통화 | [Dm7]너보다 [G]먼저 끊어서 인가요 |
[CM7]아니면 [Am7]밥먹을때 [Dm7]수저를 챙기지 [G]않았군요 |
[CM7]아니면 [Am7]그댈본 [Dm7]눈빛에 초점이 [G]흔들렸나요 |
[Am7]가끔만 [Em7]이러시면 [F]남더라 뭘어떡하라고 [G] |

[Chorus 2]
[CM7]할말있으면 [Em7]그냥해요 | [F]한대 칠라면 [G]한대치고 |
[Am7]당연히 [Em7]도무지 [F]알수가없 미치겠네 [G] |

[Outro]
[CM7.Em7.] | [F.G.] |
[CM7.Em7.] | [F.G.] |
[Am7.Em7.] | [Dm7.G.] |
[CM7.Em7.] | [F.G.] |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '오늘',
  '어반자카파 (Urban Zakapa)',
  'E',
  0,
  100,
  'output',
  $song${title: 오늘}
{artist: 어반자카파 (Urban Zakapa)}
{key: E}
{capo: 0}
{bpm: 100}

[Verse 1]
[E.G#.]늘 맘을 | [C#m.F#.]졸이며 | [Asus2.B7.]하루하 | [E]루를 살았죠 |
[E.G#.]이젠 정 | [C#m.F#.]말 지쳤 | [Asus2.B7.]어요 | [E] |

[Chorus 1]
[E.G#.]나만 태 | [C#m.F#.]어나게 | [Asus2.B7.]힘든 건 | [E]가요 |

[Pre-Chorus 1]
[E.G#.]왜 외로 | [C#m.F#.]움 나를 | [Asus2.B7.]괴롭히 | [E]고 |

[Bridge]
[C#m.B.]아무것도 | [A.E.]함께 없는 | [C#m.B.]하루인 | [A.E.G#m.]데 |
[C#m.B.]나는 왜 이 | [A.E.]렇게 외로 | [F#m]운 걸까 | [Am.B.] |
[C#m.B.]아쉬운 날 | [A.E.]들이 찾아 | [C#m.B.]다가오 | [A.E.G#m.]네 |
[C#m.B.]괜찮은 밤 | [A.E.]이 맘에 | [F#m]닿아 | [Am.B.] |

[Chorus 2]
[E.G#.]나만 태 | [C#m.F#.]어나게 | [Asus2.B7.]힘든 건 | [E]가요 |

[Pre-Chorus 2]
[E.G#.]왜 외로 | [C#m.F#.]움 나를 | [Asus2.B7.]괴롭히 | [E]고 |

[Interlude]
[E.G#.] | [C#m.F#.] | [Asus2.B7.] | [E] |
[E.G#.] | [C#m.F#.] | [Asus2.B7.] | [E] |

[Verse 2]
[E.G#.]이런 날 | [C#m.F#.]들 또 보 | [Asus2.B7.]내야 하 | [E]니 |
[E.G#.]오늘도 | [C#m.F#.]슬픔에 | [Asus2.B7.]잠겨 내 맘 | [E]은 지쳐있나 봐 |

[Chorus 3]
[E.G#.]나만 태 | [C#m.F#.]어나게 | [Asus2.B7.]힘든 건 | [E]가요 |

[Pre-Chorus 3]
[E.G#.]왜 외로 | [C#m.F#.]움 나를 | [Asus2.B7.]괴롭히 | [E]고 |

[Outro]
[E.G#.]왜 외로 | [C#m.F#m.]움 나를 | [Asus2.B7.]괴롭히 | [E]고 ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '오래전 그날',
  '김광석',
  'D',
  0,
  100,
  'output',
  $song${title: 오래전 그날}
{artist: 김광석}
{key: D}
{capo: 0}
{bpm: 100}

[Verse 1]
[D]교복을 벗고 | [A/C#]처음으로 | [Bm]만났던 너 그 때가 | [A2]너도 가끔 생각 나니 |
[G9]뭐가 | [D/F#]그렇게 좋았었는지 | [Em7]우리 둘만 | [A]알고 있으면 |

[Verse 2]
[D]너의 | [A/C#]집 데려다주던 | [Bm]길을 걸으며 | [A2]수줍게 나눴던 많은 꿈 |
[G9]너를 | [D/F#]지켜주겠다던 | [Em7]다짐 속에 | [A7]그 정게 명해는 소리 나 |

[Bridge]
[D]너의 | [A/G]새 남자친구 | [D/F#]얘길 들었지 | [G9]나 레디하기 얼마 전 |
[Em]이해했던 | [A]만큼 | [Dsus4]미움도 커졌었지만 | [D] |

[Outro]
[Bm]오늘 난 | [A2]감사드렸어 | [G9]널 얼핏 | [A.F#]너를 봤을 때 |
[Bm]누군가 | [Em]널 | [A2]그처럼 아름답게 | [D.A7]지켜줬었음을 |
[Bm]그리고 | [Em]지금 내겐 | [A2]나만을 믿고 있는 | [A.F#]한 여자가 |
[Bm]잠 못드는 | [Em]널 달래는 | [A9]오래전 그 노래 | [D]많이 |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '오르막길',
  '윤종신',
  'Am',
  1,
  100,
  'output',
  $song${title: 오르막길}
{artist: 윤종신}
{key: Am}
{capo: 1}
{bpm: 100}

[Verse 1]
[Am]한 걸음 | [Fm]이제 한 걸음 | [C]일 뿐 | [F]
[Am]아득한 저 | [Dm7]끝 보리 | [G7]라 | [C]

[Pre-Chorus 1]
[Dm7]피는 험한 길 | [G7]만큼 더 | [C.G/B.Am7.]높은 곳 | [D7]에 |
[G7] ||
[Cm]계속 나를 바 | [G]라봐 더 | [Am]디게 와 | [E7]도 |

[Chorus 1]
[Am]사랑해 이 | [Dm7]길 함께 가 | [G7]는 그대 | [C]여 |
[F.F#dim.]굳이 고된 | [Em]오르막길 | [Am7]을 택한 우 | [Dm]리 | [G]
[C]가슴 벅찬 | [E7]발걸음 더 | [Am7]번질 수 | [Gm7.C7.]록 |
[F.F#dim.]앞에 놓인 | [Em]세상 더욱 | [Am7]아름다 | [Dm7]워 | [G$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '응급실',
  'izi',
  'C',
  0,
  100,
  'output',
  $song${title: 응급실}
{artist: izi}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[CM7]후회하고있어 | [G/B]요 우리 다퉜던 | [Bb]그날 금방 | [F.G7.]볼 줄 알았어 |
[C]날 찾길 | [E7]바랬어 | [Am.C/G.]괜한 자존심 | [F.C/E.]때문에 |
[Dm7.G.]끝내자고 말을 | [Em7b5.A7.]해버린거야 | [Dm7.C.]허나 며칠이 | [G9]지나도 |
[F]아무 [Fm]소식조차 | [C]없어 항상 | [Bbm7b5.E7.]내게 너무 | [Am.Gm7.C.]잘해줘서 |

[Pre-Chorus]
[Fm7]쉽게 [F#m7b5]생각했나봐 | [A7]이젠 알아 | [Dm7.F/C.]내 잘못이란 | [G]걸 |

[Chorus]
[C]이 바보야 정말 [Em]아니었을까 | [F.Fm.]아직도 나를 [C]그렇게 몰라 |
[Gm/C.C7/Bb.]널 가진 사람 [F]다 버렸는데 | [C/G]제발 [F#m7b5]나를 떠나가지 |
[F.C/E.]마 | [Dm.G.]너 하나만 사랑하는 | [C]데 | [Em7]이대로 나를 |
[F.Fm/Ab.]두고 가지 | [C.C7/Bb.]마 | [C]나를 [F.Fm.]버리지 마 그냥 | [C.A.]날 안아줘 다시 |
[F.C/E.]사랑하게 돌아 | [Dm7.G.]와 |

[Outro]
[F.C/E.] | [Dm7.G.] | [C] ||$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '일산으로',
  '볼빨간사춘기',
  'G',
  0,
  100,
  'output',
  $song${title: 일산으로}
{artist: 볼빨간사춘기}
{key: G}
{capo: 0}
{bpm: 100}

[Intro]
[GM7] | [Em7] | [F#m7] | [Bm7] |
[GM7] | [Em7] | [F#m7] | [Bm7] |

[Verse 1]
[GM7]이만 [Em7]이 시간 [F#m7]인생이 이 [Bm7]회로가 꼬인 듯
[GM7]무엇을 더 [Em7]기대했던 [F#m7]건지 모르 [F#]채
[GM7]머뭇 [Em7]거렸을까 [F#m7]생각하기는 [Bm7]매일 난
[GM7]조그만 [Em7]위로가 [F#m7]필요해 매 [F#]일 난

[Chorus 1]
[GM7]다섯 번은 [Em7]더 동안 [F#m7]살 수 없 [Bm7]을 것
[GM7]다시 아무 [Em7]것도 없던 [F#m7]그때로 돌 [Bm7]아가
[GM7]괜찮을 [Em7]만큼은 [F#m7]웃고 싶 [Bm7]어
[GM7]나도 모르게 [Em7]너를 사랑 [F#m7]하게 된 [Bm7]걸
[GM7]그게 나를 더 [Em7]아프게 할 [F#m7]줄은 몰랐 [Bm7]어

[Interlude]
[GM7]어찌 [Em7]대신 [F#m7]기다려 [Bm7]
[GM7]저 [Em7]수많은 [F#m7]밤들을 [Bm7]

[Verse 2]
[GM7]이만 [Em7]이 시간 [F#m7]인생이 이 [Bm7]회로가 꼬인 듯
[GM7]무엇을 더 [Em7]기대했던 [F#m7]건지 모르 [F#]채
[GM7]머뭇 [Em7]거렸을까 [F#m7]생각하기는 [Bm7]매일 난
[GM7]조그만 [Em7]위로가 [F#m7]필요해 매 [F#]일 난

[Chorus 2]
[GM7]다섯 번은 [Em7]더 동안 [F#m7]살 수 없 [Bm7]을 것
[GM7]다시 아무 [Em7]것도 없던 [F#m7]그때로 돌 [Bm7]아가
[GM7]괜찮을 [Em7]만큼은 [F#m7]웃고 싶 [Bm7]어
[GM7]나도 모르게 [Em7]너를 사랑 [F#m7]하게 된 [Bm7]걸
[GM7]그게 나를 더 [Em7]아프게 할 [F#m7]줄은 몰랐 [Bm7]어

[Outro]
[GM7]어찌 [Em7]대신 [F#m7]기다려 [Bm7]
[GM7]저 [Em7]수많은 [F#m7]밤들을 [Bm7]
[GM7]마냥 [Em7]걷네 밤 [F#m7]거리 마냥 [Bm7]걷네
[GM7] | [Em7] | [F#m7] | [F#] |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '잊을께',
  'YB',
  'G',
  0,
  100,
  'output',
  $song${title: 잊을께}
{artist: YB}
{key: G}
{capo: 0}
{bpm: 100}

[Verse 1]
[G.F.]아침에 [D/F#]눈을 [C/E]떴을 때 | [Em.Dm.]문득 [G.F.]너를 |
[D/F#]걷다가 [C/E]멈춰 선 [Em.Dm.]채로 | [G.F.]다시 [G.F.]너를 |

[Verse 2]
[Am.Gm.]지금은 [C/G]내 [Bb/F]곁에 없는 | [D/F#]너를 [C/E]그리워하며 |
[G]바보처럼 | [F] |

[Pre-Chorus]
[G.F.]나보다 [D/F#]더 [C/E]행복하기를 | [Em.Dm.]바래 |
[G.F.]내 [D/F#]생각 [C/E]하지 [Em.Dm.]않기를 | [G.F.]바래 |

[Chorus]
[Am.Gm.]더 [C/G]좋은 [Bb/F]사람 만나길 | [D/F#]바래 [C/E]다시는 |
[Em.Dm.]내게 [G.F.]올 수 없게 | [C.Bb.] | [$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '자니',
  '다이나믹 듀오',
  'C',
  0,
  100,
  'output',
  $song${title: 자니}
{artist: 다이나믹 듀오}
{key: C}
{capo: 0}
{bpm: 100}

[Verse 1]
[CM7]일 끝나고 | [D7]친구들과 한잔 | [Dm7]내일은 쉬는 | [G7]토요일이니까 |
[CM7]좋은 밤 |
[CM7]일 얘기 | [D7]사는 얘기 | [Dm7]재미난 얘기 | [G7]시간 가는 줄 |
[CM7]모르잖아 |

[Instrumental]
[FM7] | [Bb7] | [Am7] | [D7] |
[Em] | [F7] | [G7sus] |

[Verse 2]
[CM7]적적해서 | [D7]서로의 | [Dm7]전화기를 꺼내 | [G7]번호 목록을 |
[G7sus]뒤져보기 |
[CM7]너는 지금 | [D7]뭐해 자니 | [Dm7]밤이야 | [G7]뜨끔 없는 문자를 돌려보며 |
[CM7]난 |

[Bridge]
[CM7]어떻게 해볼까란 | [D7]뜻은 아니야 | [Dm7]그냥 심심해서 그래 | [G7]많이 외로워서 그래 |

[Pre-Chorus]
[CM$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '잘 지내자 우리',
  '정은지',
  'G',
  0,
  100,
  'output',
  $song${title: 잘 지내자 우리}
{artist: 정은지}
{key: G}
{capo: 0}
{bpm: 100}

[Verse 1]
[G]지금 생각해보면 [Bm7]그때 우리 | [Em7]내가 바보 같았지 | [C]헤어져 |
[Cm7]지고 [G/B]솔직해진 | [Am7]자신 있니 | [C/D.D7.]돌아오기만 하면 | [C/D.D7.]좋겠다 |

[Chorus 1]
[G]붐비던 인파가 [Bm]다시 | [Em]스쳐 갈 것 같지만 | [C]모른 척 지나가겠지 |
[C]최선을 다한 넌 [G/B]바보같이 믿었 | [Am7]던 서툴렀던 나는 아직도 | [C/D.D7.]기억을 꿈꾼다 |
[G]널 마주치면 [Bm]괜히 | [Em]미안했다 말하고 | [C]괜찮단 말 얘기하는 | [C]날 |
[C]언젠가 다시 [G]잘 | [Am7]지내자 우리 | [C/D.D7.]우리 |

[Verse 2]
[G9]마음을 다 보여줬 | [Bm7]던 너는 다르게 | [Em7]지난 사랑에 지워버린 | [Bm7]난 |
[Am7]나는 [C/D]뒤돌아선 | [G/B]모든 기억을 [C]지웠다 |

[Chorus 2]
[G9]너는 다르게 [Bm7]철저했지만 | [Em7]붐비던 인파가 [Bm7]하나 둘 스쳐갈 것 같아 |
[Cm7]생각뿐 [C/D]도망치기만 | [G/B]했던 [C]시간 |

[Bridge]
[G]감히 [C/G]가끔 | [G/B]경험 많은 | [C]나와 바라보며 |
[Dm7]정신없이 [CM7]한참 키만 | [Em7]크던 |
[Am7]당돌한 노력들이 | [C/D]쓰디쓴 | [Bm7]마음이 되어 | [Em7]다시 올런가 |
[Am7]난 | [C/D.D7.] |

[Chorus 3]
[G]널 마주치면 [Bm]괜히 | [Em]미안했다 말하고 | [C]괜찮단 말 얘기하는 | [C]날 |
[C]언젠가 다시 [G]잘 | [Am7]지내자 우리 | [C/D.D7.]우리 |

[Outro]
[C]그때까지 [G]잘 | [Am7]지내라$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '잡지 않았어',
  '이진아',
  'F',
  0,
  100,
  'output',
  $song${title: 잡지 않았어}
{artist: 이진아}
{key: F}
{capo: 0}
{bpm: 100}

[Verse 1]
[FM7]언제 봤던가 [Em7]얘기 나눌 때 | [A7]재미없단 표정 [Dm9]짓던 너 |
[Cm7]우린 어린 날 [F13]함께 들었던 | [BbM7]우리 얘깃 같던 [Am7]노래 가사가 |
[Gm7]남얘기가 됐어 | [C9] | | |

[Verse 2]
[FM7]널 보며 [Em7]웃어도 보고 | [A7]울어도 보고 | [Dm9]매달리기도 [Cm7]했어 | [F13]
[BbM7]애써 넌 [Am7]지려 해도 | [Gm7]자꾸 생각 [C9]나는데 | | |

[Bridge]
[FM7]잡지 않았어 [Em7]널 | [A7]그때는 몰랐어 | [Dm9]이렇게 아플 [Cm7]줄은 | [F13]
[BbM7]이제야 [Am7]알았어 | [Gm7]니가 없는 나의 [C9]모습이 |
[Gm7]이젠 | [C9] | | |$song$
);

insert into songs (title, artist, key, capo, bpm, folder, content) values (
  '정류장',
  '윤종신',
  'G',
  0,
  100,
  'output',
  $song${title: 정류장}
{artist: 윤종신}
{key: G}
{capo: 0}
{bpm: 100}

[Intro]
[Aaug] | [Aaug] | [Aaug] | [Aaug] |

[Verse 1]
[Emaj7]해질 [Bbdim/D#]무렵 [C#m7]바람도 [Gm7]붐비던 날 |
[Bm7]집에 [Bdim/F#]돌아오는 [Am/D]길 정거장 [Dm7]앉아 |
[G]불어오는 [Ddim/F#]바람에도 [C/E]못 본 척 난 [Gm]그리 멍하니 [G/D]보아왔지 |
[C#m7b5]낯익은 [Cmaj7]거리에 어리석은 [B9sus4]모습 세상이 [G]언젠가 아직 [Ddim/F#]모르는 길 |
[C/E]더 깊은 [Gm]밤에도 상처에 [G/D]내려앉아 [C#m7b5]울고 있네 |

[Pre-Chorus]
[Am7]저 멀리 [G#m7]까맣게 [F#m11]오는 정류장에 | [C.D.E.]희미한 게 널 [Am7]닮았네 |
[G#m7]언제부터 [F#m11]기다렸는지 | [C.Ddim/F#.]알 수 없는 [Am7]밤에 꿈을 [G#m7]꾸고 있네 |
[F#m11]그럴 땐 |

[Chorus 1]
[G]나는 [Ddim/F#]아무 말도 [C/E]못하고 그댈 [Gm]안고서 눈물만 [G/D]흘러 |
[C#m7b5]자꾸 [Cmaj7]눈물이 흘러 | [B9sus4]이대로 영원히 [G]있을 수만 [Ddim/F#]있다면 |
[C/E]그대 [Gm]곁에서 그대에게 [G/D]고마울 뿐 |
[E] | [C#m7] | [Aaug9] | [B9sus4] |

[Pre-Chorus 2]
[Am7]나약한 [G#m7]영혼이 [F#m11]들고 있는 정류장에 | [C.D.E.]희미한 게 널 [Am7]닮았네 |
[G#m7]까치발 [F#m11]들고 내 얼굴 | [C.Ddim/F#.]찾아 헤매는 [Am7]네가 사랑으로 [G#m7]널 보고 |
[F#m11]은 그럴 땐 |

[Chorus 2]
[G]나는 [Ddim/F#]아무 말도 [C/E]못하고 그댈 [Gm]안고서 눈물만 [G/D]흘러 |
[C#m7b5]자꾸 [Cmaj7]눈물이 흘러 | [B9sus4]이대로 영원히 [G]있을 수만 [Ddim/F#]있다면 |
[C/E]그대 [Gm]곁에서 그대에게 [G/D]고마울 뿐 |

[Outro]
[Am7] | [G#m7] | [F#m11] | [E] |
[Am7] | [G#m7] | [F#m11] | [F#m11.B9sus4.] |
[E] | [E] | [E] | [E] |$song$
);

commit;