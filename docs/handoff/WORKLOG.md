# WORKLOG — 작업 기록 (맨 아래에 한 줄씩 추가, 위 줄은 고치지 않음)

형식: `- MM-DD HH:MM | 누가(Claude실장/Codex실장/작업 번호) | 변경 파일 | 한 일 | 검증·결과 | 다음 행동`

- 11-04 08:09 | 296_긴급_되돌리기 | gh-pages, main, `_old\phaser_20261104` | Phaser 판 내림, 예전 엔진 복구 | 빌드 OK, 브라우저 확인 | —
- 11-04 10:47 | 298 개발팀장 | `codex\reports\LEAD_298_수정계획.md`, `shots\298_점검.png` | A·B 적용 12작업 계획 | 빌드 1회 OK, 코드 수정 없음 | 1번부터 진행
- 11-04 11:18 | 300 구현 | `src\game\game.ts`, `src\components\GameHud.vue`, `src\game\audio.ts` | 시간 60/+20/+10, FOOD 35/60·FULL 1회, 효과음 BASE_URL | 빌드 OK, Pages 982d3cc, 효과음 404=0 | 자동 검수
- 11-04 11:29 | 301→302→303 | `GameHud.vue` | aria-label 깨짐 수정 | LEAD_303 통과, Pages a985f0a | 2번(304)
- 11-04 12:05 | 304 구현 (진행 중) | `stages.ts`·`game.ts` 수정 시작 확인(12:07, 12:09) | 1판 먹이 길·동굴 흔적·접지 | 미완료 | 304 끝나면 자동 검수 결과 확인
- 11-04 12:20 | Claude실장 | `AGENTS.md`(보완), `CODEX_CONTINUE.md`, `docs\handoff\*` | 인계 체계 작성. 실장은 계속 Claude(대표가 「codex 실장한테 넘길께」 하면 Claude가 Codex 앱에 직접 입력) | 305 작업으로 Codex 읽기·WORKLOG 규칙 확인 예정 | 304 결과 확인 후 3번 지시
- 11-04 12:20 | 305 정리 | docs/handoff/_codex_check.md, docs/handoff/WORKLOG.md | 지정 인계 문서 읽기 및 Git·폴더 상태 대조 | 304 커밋 36afb49·검수 통과 확인, 코드 수정·add·커밋·push 없음 | Claude 실장이 STATUS·NEXT 갱신 후 3번 지시 판단
- 11-04 12:30 | Claude실장 | `codex\queue\306·307·308`, STATUS/NEXT | 304 통과·305 인계 검증 확인. 쉬던 테스트·원화 담당에 병행 작업(306 검사기, 307 Ludo 그림 정리), 3번 지시(308) | 306·307은 src 미수정 조건 | 308 결과 확인 후 4번
- 11-04 | 307 원화 | public/assets/ludo, codex/reports/캐릭터_307.md, shots/307_ludo.png | 16시트 414장 정리·manifest·제외/Ludo 요청 기록 | 빌드 OK, 원본·src 유지 | 다음: 298 계획 4·10 구현 시 manifest 사용
- 11-04 13:20 | 308 구현 | environmentEvents.ts·game.ts·구현_308.md·shots/308_*.png | 환경 상태 머신·1판 나무·전환 정리 | 빌드 OK, 입력 FOOD60→보스 문, 회피 HP10·피격1회, 15판 분기 OK | 자동 검수

- 11-04 12:43 | 309 정리 | codex/RULES.md, codex/reports/정리_309_토큰.md | 토큰 상위·평균 및 210 잠금 PID 조사 | 완료 32개 집계, 코드 수정·프로세스 종료 없음 | 실장이 210 관련 PID 생존 여부 확인
