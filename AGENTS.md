# 우가누가 프로젝트 규칙 (Codex가 자동으로 읽음)

> 이 파일은 작업 관리자(dispatcher)가 넘긴 작업에도 매번 읽힌다(`codex exec -C D:\99.Work\Uganuga`). 그래서 짧게 유지한다. 자세한 인계 내용은 `docs\handoff\`에 있다.

## 0. 프로젝트 한 줄
원시인 우가가 15판을 건너 누가 공주를 구하는 1인용 횡스크롤 액션 웹게임(고인돌/Joe & Mac 풍). Vue 3 + TypeScript + Canvas(`src\`). Phaser 판은 대표 지시로 내렸다(되살리지 말 것).

## 1. 누가 무엇을 하나 (작업 담당)
| 담당 | 하는 일 | 고치는 곳 |
|---|---|---|
| 대표(사용자) | 결정 | — |
| 실장(Claude) | 대표와 대화, 작업 지시서를 `codex\queue\`에 넣음, 결과 확인·보고, 인계 문서 갱신 | `codex\queue\`, `docs\handoff\`, `AGENTS.md`, `CODEX_CONTINUE.md` |
| 팀원(Codex, 작업 관리자) | queue 지시서 구현 + **자체 검증**(개발팀장 없음, 11-04 대표 지시 「코덱스 팀장도 없애」) | 지시서에 적힌 파일만 |
| 정리 담당(Codex, 1시간마다 자동) | 토큰 점검, `docs\handoff\요약_실장용.md` 작성, 기록·보고서 정리 | `codex\RULES.md`, `codex\reports`, `docs\handoff` |
| **Codex 팀장**(11-04 대표 지시로 Codex 실장에서 명칭 변경; 이 채팅의 지시 담당) | `CODEX_CONTINUE.md` 절차대로: NEXT.md 순서로 지시서를 queue에 하나씩 넣고, 검수 결과 확인, handoff 문서 갱신 | `codex\queue\`, `docs\handoff\` (게임 코드는 직접 고치지 않고 작업 관리자에게 맡김) |
| Codex 앱 채팅(대표가 직접 한 가지를 시킬 때) | 그 지시만 | 지시받은 파일 |

**지금 실장이 누구인지는 `docs\handoff\OWNER.md`가 기준이다.** 실장은 한 명만. 넘길 때 OWNER.md를 고친다.

**충돌 방지:** `codex\running\`에 `210_정리_ComfyUI영상설치.txt`(오래 남은 찌꺼기, 무시)를 뺀 파일이 있으면 작업 관리자가 그 작업의 파일을 고치는 중이다. Codex 앱 채팅은 그 작업이 끝날 때까지 같은 파일을 고치지 않는다. 직접 오래 고칠 때는 먼저 `codex\HOLD_ON.txt`를 만들어 자동 작업을 멈추고, 끝나면 `codex\_old\`로 옮겨 다시 푼다. (`HOLD.txt`는 예전 스위치라 무시된다.)

## 2. 시작 전
- 결정 사항은 `codex\DECISIONS.md`(원본 기록)와 `docs\handoff\DECISIONS.md`(요약)를 따른다.
- **Codex 앱 채팅으로 이어받을 때만** 읽기: `docs\handoff\STATUS.md` → `NEXT.md` → `DECISIONS.md` → `WORKLOG.md` 끝 20줄. 그다음 `git status`, `git log -5`로 문서와 실제가 맞는지 확인.
- **작업 관리자 작업은** 지시서와 지시서에 적힌 문서만 읽는다(토큰 절약). handoff 문서 전체를 읽지 않는다.

## 3. 반드시 지킬 것 (대표 요구)
- 파일 삭제 금지. 필요하면 `_old` 폴더로 옮긴다. `art-src`는 절대 지우지 않는다.
- 지시받은 것만 바꾼다. 남이 고친 내용을 덮어쓰거나 되돌리지 않는다(`git checkout -- .`, `git reset --hard`, `git clean` 금지).
- 창을 띄우지 않는다(브라우저는 headless). 시작프로그램 등록 금지. `Samhan_Girls` 폴더에 저장 금지.
- 화면에 연도 표시 금지. 2P(부가)·던지기 없음. Prehistorik 등 남의 원본 에셋·캐릭터 복사 금지.
- 움직임이 많은 그림(여러 장 애니메이션)은 Codex가 그리지 않는다. 임시 도형으로 구현하고 보고서에 "Ludo 요청" 표를 남긴다.
- 대표에게 확인 질문 없이 끝까지 진행하고, 판단한 부분은 "(Codex 판단)"으로 표시. 보고는 한국어로 짧게. 토큰 절약(`codex\RULES.md`).
- 비밀번호·API 키·토큰을 파일에 적지 않는다.

## 4. 실행·빌드·배포
- 개발: `npm run dev -- --port 5298 --no-open` (기본 5173). 확인은 headless Chrome.
- 빌드: `npm run build` (vue-tsc + vite). 완료 확인에 1회.
- 페이지 배포(.bat 실행 금지, 명령 직접): `robocopy dist _pages /MIR /XD .git` → `_pages`에 `.nojekyll` 유지 → `cd _pages` → `git add -A` → `git commit -m "요약"` → `git push -f origin gh-pages`
- 공개 주소: https://yeokangdong.github.io/uganuga/ (`?stage=1~15`로 판 바로 진입)

## 5. 끝난 뒤
**Codex 앱 채팅 작업(매번 반드시):**
1. `npm run build` 성공 확인.
2. `codex\DECISIONS.md` 맨 아래에 한 줄: `- YYYY-MM-DD | 사용자(채팅): 「대표가 한 말」 | 한 일 요약`
3. `docs\handoff\WORKLOG.md` 맨 아래에 한 줄(형식은 그 파일 머리말), `STATUS.md`·`NEXT.md`의 해당 체크박스 갱신, 다음 할 행동 1줄.
4. `git add -A` → `git commit -m "한 일 요약"` → `git push origin main`
5. 게임 화면이 바뀌었으면 위 페이지 배포.

**작업 관리자 작업:** 지시서의 "끝나면"을 따르고, 추가로 끝나기 직전에 `docs\handoff\WORKLOG.md` 맨 아래에 한 줄만 붙인다(다른 handoff 문서는 고치지 않음 — 실장 또는 인계받은 쪽이 갱신).

**중단될 것 같으면(토큰 부족 등):** 하던 파일·남은 일·다음 행동을 `WORKLOG.md`에 먼저 한 줄 남기고, 미완성 코드는 커밋 메시지에 `[미완성]`을 붙여 커밋한다(되돌리지 않음).

- 최신 역할 지시(11-04 18:30): Codex 팀장은 대표와 대화하고 팀원에게 지시만 한다. 구현은 dispatcher 팀원 담당. 진행321 유지, 자체 검증·문서 인계 방식 유지 (Codex 판단).

- 18:31 대표 추가 지시 「검수도 니가 해야돼」: Codex 팀장이 구현 지시뿐 아니라 보고서·검증 결과·스크린샷 직접 검수와 통과/수정 판정을 책임진다. 구현은 팀원 담당, 자동 개발팀장 체계는 재도입하지 않음.

- 최신 대표 지시(11-04 20:25): 「모두중지하고 게임사이트 열어봐」. 전체 작업 중지·HOLD_ON.txt 유지·예약삭제. 명시적 재개 전 새 작업/검사/실행기 재시작 금지. 이전 자동 진행 규칙보다 우선.
