# 우가누가 프로젝트 규칙 (Codex가 자동으로 읽음)

대표가 Codex 앱 채팅으로 직접 지시할 때도 아래를 반드시 지킨다.

## 시작 전
- (Codex 앱 채팅으로 대표가 직접 지시할 때만) `codex\running` 폴더에 파일이 있으면 실장 작업이 도는 중이다. 같은 파일을 고치지 말고 대표에게 알린다. 작업 관리자가 넘긴 작업(지시문이 codex\running 의 자기 파일)은 이 규칙과 상관없이 그대로 진행한다.
- 결정 사항은 `codex\DECISIONS.md` 를 따른다.

## 작업 중
- 파일 삭제 금지. 필요하면 `_old` 폴더로 옮긴다. `art-src` 는 절대 지우지 않는다.
- 지시받은 것만 바꾼다.

## 끝난 뒤 (채팅 지시일 때 매번 반드시 — 작업 관리자 작업은 지시문의 "끝나면"만 따름)
1. `npm run build` 성공 확인.
2. `codex\DECISIONS.md` 맨 아래에 한 줄 추가:
   `- YYYY-MM-DD | 사용자(채팅): 「대표가 한 말」 | 한 일 요약`
3. 메인 저장소 커밋·푸시:
   `git add -A` → `git commit -m "한 일 요약"` → `git push origin main`
4. 게임 화면이 바뀌었으면 페이지 배포 (.bat 실행 금지, 아래 명령 직접):
   `robocopy dist _pages /MIR /XD .git` → `_pages` 에 `.nojekyll` 유지 →
   `cd _pages` → `git add -A` → `git commit -m "한 일 요약"` → `git push -f origin gh-pages`
