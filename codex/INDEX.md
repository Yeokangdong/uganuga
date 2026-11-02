# codex 파일 안내

## 지금 쓰는 것
- 먼저 담당 BRIEF 요약판을 읽고, 필요한 원본 절만 확인한다.
- 변경 적용: 낱장→SHEET, 근접 공격→ATTACK_CAVE, 타이틀→TITLE. 원본은 보존한다.

- [ART_ROLES.md](ART_ROLES.md) — 그림 담당 역할 규칙.
- [CODEX_ART_BRIEF.md](CODEX_ART_BRIEF.md) — 상세 원본; 같은 이름의 _요약.md부터 확인.
- [CODEX_ART_BRIEF_요약.md](CODEX_ART_BRIEF_요약.md) — 팀원용 요약판(20줄 이내); 담당 작업 시작점.
- [CODEX_ATTACK_CAVE_BRIEF.md](CODEX_ATTACK_CAVE_BRIEF.md) — 상세 원본; 같은 이름의 _요약.md부터 확인.
- [CODEX_ATTACK_CAVE_BRIEF_요약.md](CODEX_ATTACK_CAVE_BRIEF_요약.md) — 팀원용 요약판(20줄 이내); 담당 작업 시작점.
- [CODEX_CAVE_UI_BRIEF.md](CODEX_CAVE_UI_BRIEF.md) — 상세 원본; 같은 이름의 _요약.md부터 확인.
- [CODEX_CAVE_UI_BRIEF_요약.md](CODEX_CAVE_UI_BRIEF_요약.md) — 팀원용 요약판(20줄 이내); 담당 작업 시작점.
- [CODEX_SHEET_BRIEF.md](CODEX_SHEET_BRIEF.md) — 상세 원본; 같은 이름의 _요약.md부터 확인.
- [CODEX_SHEET_BRIEF_요약.md](CODEX_SHEET_BRIEF_요약.md) — 팀원용 요약판(20줄 이내); 담당 작업 시작점.
- [CODEX_STAGE23_BRIEF.md](CODEX_STAGE23_BRIEF.md) — 상세 원본; 같은 이름의 _요약.md부터 확인.
- [CODEX_STAGE23_BRIEF_요약.md](CODEX_STAGE23_BRIEF_요약.md) — 팀원용 요약판(20줄 이내); 담당 작업 시작점.
- [CODEX_TITLE_BRIEF.md](CODEX_TITLE_BRIEF.md) — 상세 원본; 같은 이름의 _요약.md부터 확인.
- [CODEX_TITLE_BRIEF_요약.md](CODEX_TITLE_BRIEF_요약.md) — 팀원용 요약판(20줄 이내); 담당 작업 시작점.
- [dispatcher.ps1](dispatcher.ps1) — 작업 배분 실행 스크립트.
- [dispatcher.vbs](dispatcher.vbs) — 작업 배분 실행 보조.
- [dispatcher-alive.txt](dispatcher-alive.txt) — 배분기 생존 표시.
- [dispatcher-log.txt](dispatcher-log.txt) — 배분기 실행 기록.
- [progress.txt](progress.txt) — 기존 산출물 기록; 완료 이력 확인용.
- [README_팀운영.md](README_팀운영.md) — 팀 운영 안내.
- [RULES.md](RULES.md) — 팀 공통 작업 규칙.
- [TEAM_LEAD.md](TEAM_LEAD.md) — 실장 역할과 운영 기준.
- [TIDY.md](TIDY.md) — 정리 담당 범위와 금지 사항.
- [INDEX.md](INDEX.md) — 현재 문서와 보관 파일의 진입점.

## 운영·참고 폴더
- queue/, running/, done/, logs/ — 운영 상태·기록; 이번 정리 대상 제외.
- ref/ — 그림 참조 자료; 원본 보존.
- tools/ — 기존 원화 저장·검사 도구; 이번 정리 대상 제외.

- [ref/hud_mockup.png](ref/hud_mockup.png) — HUD 기준 그림.
- [ref/logo_guide.png](ref/logo_guide.png) — 로고 참고 그림.
- [reports/LEAD_11_E_cave_hazard_ui_art.md](reports/LEAD_11_E_cave_hazard_ui_art.md) — 기존 실장 작업 지시·보고.
- [reports/LEAD_12_F_logo_redo.md](reports/LEAD_12_F_logo_redo.md) — 기존 실장 작업 지시·보고.
- [reports/TIDY_제안.md](reports/TIDY_제안.md) — 토큰 절약 제안 3개; 실장 검토용 기존 실장 작업 지시·보고.
- [tools/finalize-cave-alpha.ps1](tools/finalize-cave-alpha.ps1) — 동굴 투명도 마무리 도구.
- [tools/inspect-sheet.ps1](tools/inspect-sheet.ps1) — 시트 확인 도구.
- [tools/save-attack-cave.ps1](tools/save-attack-cave.ps1) — 원화 저장 보조 도구.
- [tools/save-cave-final.ps1](tools/save-cave-final.ps1) — 원화 저장 보조 도구.
- [tools/save-generated.ps1](tools/save-generated.ps1) — 원화 저장 보조 도구.
- [tools/save-sheet.ps1](tools/save-sheet.ps1) — 원화 저장 보조 도구.
- [tools/save-stage2.ps1](tools/save-stage2.ps1) — 원화 저장 보조 도구.
- [tools/save-stage3.ps1](tools/save-stage3.ps1) — 원화 저장 보조 도구.
- [tools/validate-art.ps1](tools/validate-art.ps1) — 원화 검사 도구.
- [tools/validate-attack-cave.ps1](tools/validate-attack-cave.ps1) — 원화 검사 도구.
- [tools/validate-stage2.ps1](tools/validate-stage2.ps1) — 원화 검사 도구.

## 옛것: _old/
- prompts/ — 이번에 옮긴 완료 작업 지시서.
- runs/ — 이번에 옮긴 완료 작업 실행 파일(.cmd/.vbs).
- done/ — 이번에 옮긴 완료 표시 파일; 빈 파일도 그대로 보존.
- _old/ 루트의 기존 보관물은 그대로 유지하며 현재 지시로 사용하지 않는다.

- [_old/CODEX_ART_BRIEF.md](_old/CODEX_ART_BRIEF.md) — 과거 지시서 원본.
- [_old/CODEX_SHEET_BRIEF.md](_old/CODEX_SHEET_BRIEF.md) — 과거 지시서 원본.
- [_old/CODEX_TITLE_BRIEF.md](_old/CODEX_TITLE_BRIEF.md) — 과거 지시서 원본.
- [_old/codex-prompt.txt](_old/codex-prompt.txt) — 과거 작업 지시·생성 기록.
- [_old/codex-prompt2.txt](_old/codex-prompt2.txt) — 과거 작업 지시·생성 기록.
- [_old/codex-prompt-title.txt](_old/codex-prompt-title.txt) — 과거 작업 지시·생성 기록.
- [_old/DONE.txt](_old/DONE.txt) — 과거 완료 표시.
- [_old/done/DONE_A.txt](_old/done/DONE_A.txt) — 과거 완료 표시.
- [_old/done/DONE_B.txt](_old/done/DONE_B.txt) — 과거 완료 표시.
- [_old/done/DONE_C.txt](_old/done/DONE_C.txt) — 과거 완료 표시.
- [_old/done/DONE_D.txt](_old/done/DONE_D.txt) — 과거 완료 표시.
- [_old/done/DONE_E.txt](_old/done/DONE_E.txt) — 과거 완료 표시.
- [_old/done/DONE_F.txt](_old/done/DONE_F.txt) — 과거 완료 표시.
- [_old/done/DONE_S2.txt](_old/done/DONE_S2.txt) — 과거 완료 표시.
- [_old/done/DONE_S3.txt](_old/done/DONE_S3.txt) — 과거 완료 표시.
- [_old/generation-prompts.json](_old/generation-prompts.json) — 과거 작업 지시·생성 기록.
- [_old/prompt-A-bg.txt](_old/prompt-A-bg.txt) — 과거 작업 지시·생성 기록.
- [_old/prompt-B-title.txt](_old/prompt-B-title.txt) — 과거 작업 지시·생성 기록.
- [_old/prompt-C-items.txt](_old/prompt-C-items.txt) — 과거 작업 지시·생성 기록.
- [_old/prompts/prompt-A-bg.txt](_old/prompts/prompt-A-bg.txt) — 과거 작업 지시·생성 기록.
- [_old/prompts/prompt-B-title.txt](_old/prompts/prompt-B-title.txt) — 과거 작업 지시·생성 기록.
- [_old/prompts/prompt-C-items.txt](_old/prompts/prompt-C-items.txt) — 과거 작업 지시·생성 기록.
- [_old/prompts/prompt-D.txt](_old/prompts/prompt-D.txt) — 과거 작업 지시·생성 기록.
- [_old/prompts/prompt-E.txt](_old/prompts/prompt-E.txt) — 과거 작업 지시·생성 기록.
- [_old/prompts/prompt-F-logo.txt](_old/prompts/prompt-F-logo.txt) — 과거 작업 지시·생성 기록.
- [_old/prompts/prompt-S2.txt](_old/prompts/prompt-S2.txt) — 과거 작업 지시·생성 기록.
- [_old/prompts/prompt-S3.txt](_old/prompts/prompt-S3.txt) — 과거 작업 지시·생성 기록.
- [_old/restart-art.cmd](_old/restart-art.cmd) — 과거 실행 파일.
- [_old/run-3codex.cmd](_old/run-3codex.cmd) — 과거 실행 파일.
- [_old/run-codex-art.cmd](_old/run-codex-art.cmd) — 과거 실행 파일.
- [_old/runs/run-3codex.cmd](_old/runs/run-3codex.cmd) — 과거 실행 파일.
- [_old/runs/run-3codex.vbs](_old/runs/run-3codex.vbs) — 과거 실행 파일.
- [_old/runs/run-D.cmd](_old/runs/run-D.cmd) — 과거 실행 파일.
- [_old/runs/run-D.vbs](_old/runs/run-D.vbs) — 과거 실행 파일.
- [_old/runs/run-E.cmd](_old/runs/run-E.cmd) — 과거 실행 파일.
- [_old/runs/run-E.vbs](_old/runs/run-E.vbs) — 과거 실행 파일.
- [_old/runs/run-F.cmd](_old/runs/run-F.cmd) — 과거 실행 파일.
- [_old/runs/run-F.vbs](_old/runs/run-F.vbs) — 과거 실행 파일.
- [_old/runs/run-stage23.cmd](_old/runs/run-stage23.cmd) — 과거 실행 파일.
- [_old/runs/run-stage23.vbs](_old/runs/run-stage23.vbs) — 과거 실행 파일.
- [_old/run-title.cmd](_old/run-title.cmd) — 과거 실행 파일.
- [_old/start-art.cmd](_old/start-art.cmd) — 과거 실행 파일.
