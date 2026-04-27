# 합주 (hapjoo)

기타 코드 악보 뷰어 + 편집기 + 튜너. Next.js 16 (App Router) + Supabase.

## 기능

- 악보 보기 — 코드/가사 마디 그리드, 키 트랜스포즈, 메트로놈/카운트인
- 악보 편집 — 마디·줄·구간 드래그 정렬, 코드 자동 보정
- 코드표 — 다이어그램 + 대체 코드
- 튜너 — 마이크 입력 기반 피치 인식
- 메모 — 마디별 개인 메모 (로컬 + 공유)

## 개발

```bash
npm install
cp .env.example .env.local   # 본인 Supabase 값으로 채우기
npm run dev
```

`http://localhost:3000` 에서 접속.

## 환경변수

`.env.local` 파일에 다음 키 설정:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
MIGRATE_SECRET=<random-string>
```

`MIGRATE_SECRET` 은 `/api/migrate` 엔드포인트 가드용. 시드 마이그레이션 외엔 설정 안 해도 됨.

## 스크립트

| 명령                   | 설명               |
| ---------------------- | ------------------ |
| `npm run dev`          | 개발 서버          |
| `npm run build`        | 프로덕션 빌드      |
| `npm run start`        | 빌드 산출물 실행   |
| `npm run lint`         | ESLint             |
| `npm run typecheck`    | `tsc --noEmit`     |
| `npm run format`       | Prettier 적용      |
| `npm run format:check` | 포맷 검사          |
| `npm test`             | Vitest 단위 테스트 |

## Supabase 스키마

`supabase/schema.sql` 참고. 주요 정책:

- `songs` — 모든 로그인 사용자 read/write (공유 카탈로그)
- `user_songs` — `user_id = auth.uid()` 본인 한정
- `rooms` — 로그인 사용자 read/write (코드 기반 공유)

## 구조

```
app/
  (tabs)/                 # 탭 레이아웃 그룹
    songs/                # 곡 목록 (RSC) + 서버 액션
    chords/               # 코드표 페이지
    tuner/                # 튜너 (마이크)
    settings/             # 계정 설정
    viewer/[id]/          # 악보 뷰어 + 편집
  api/migrate/            # 시크릿 가드 시드 엔드포인트
  layout.tsx
  page.tsx                # /songs 로 redirect

components/
  SongEditor/             # 편집기 (분해된 모듈)
  SheetViewer/            # 뷰어 (분해된 모듈)
  ChordDiagram/           # 코드 다이어그램
  AuthButton/             # 헤더 로그인 버튼

lib/
  supabase/               # supabase client (env fail-fast)
  db/                     # 도메인별 DB CRUD
  sheet/                  # 악보 파서/노멀라이저/에디터 유틸
  auth.ts                 # 인증 헬퍼
  realtime.ts             # 합주 모드 (rooms)
  constants.ts            # storage keys, routes, music keys
  storage.ts              # localStorage safe-* 헬퍼
  transpose.ts            # 트랜스포즈

types/                    # 도메인 타입 (sheet, song)
scripts/seed-songs.ts     # data/songs/*.txt → DB 시드 유틸
test/                     # vitest 단위 테스트
data/songs/               # seed 자료 (런타임 사용 안 함)
docs/                     # 매뉴얼/메모
supabase/schema.sql       # RLS 포함 스키마
```

## 데이터 시드 마이그레이션

`data/songs/*.txt` 파일을 supabase에 일괄 업로드하려면:

```bash
# .env.local 에 MIGRATE_SECRET 설정 후
curl -X POST -H "x-migrate-secret: $MIGRATE_SECRET" http://localhost:3000/api/migrate
```
