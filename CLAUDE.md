@AGENTS.md

## 프로젝트 컨벤션

- Next.js **16** App Router. `params`는 `Promise`이므로 `await` 또는 `use()` 필요. 변경 사항은 `node_modules/next/dist/docs/` 우선 확인.
- 데이터 흐름: RSC에서 supabase 읽고, mutation은 server action (`app/(tabs)/<x>/actions.ts`).
- supabase 환경변수 미설정 시 `lib/supabase/client.ts:getSupabase()` 가 throw — 호출부는 `supabaseConfigured` 가드 후 호출.
- 악보 포맷 파서/유틸은 `lib/sheet/*` 에 모이며 순수 함수만 둔다 (vitest 대상).
- localStorage 직접 접근 금지. `lib/storage.ts` safe-\* 헬퍼 사용.
- 라우트/스토리지 키 같은 매직 문자열은 `lib/constants.ts` 에 모은다.
- 탭 네비게이션은 `<Link prefetch>` 만 사용 (`<a href>` 금지).
- 도메인 타입은 `types/` 에 두고 컴포넌트 안에서 정의하지 않는다.

## 도메인 용어

- **악보 (sheet)** — 한 곡의 ChordPro 비슷한 텍스트
- **구간 (section)** — Verse/Chorus 등 라벨 그룹
- **줄 (row)** — 4마디 단위
- **마디 (measure)** — `chord` + `lyric` 한 셀
- **합주 모드 (room)** — 코드를 공유해 실시간으로 같이 보는 모드

## 명령

```
npm run dev          # 개발
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run (단위)
npm run build        # next build
```
