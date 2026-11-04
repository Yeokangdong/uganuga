# Codex 인계 프롬프트 (Codex 앱 새 채팅에 아래 블록을 그대로 붙여넣기)

프로젝트 폴더: `D:\99.Work\Uganuga` (Codex 앱에서 이 폴더를 열고 시작)

```
너는 지금부터 우가누가 프로젝트의 "Codex 실장"이다. Claude 실장이 돌아올 때까지 실장 역할을 이어받는다.
프로젝트 폴더는 D:\99.Work\Uganuga 이다.

1. 먼저 읽기(이 순서): AGENTS.md → docs\handoff\OWNER.md → docs\handoff\STATUS.md → docs\handoff\NEXT.md → docs\handoff\DECISIONS.md → docs\handoff\WORKLOG.md 끝 20줄 → codex\reports\LEAD_298_수정계획.md 3장.
2. 실제와 맞는지 확인: git status, git log --oneline -8, git branch, codex\queue·codex\running·codex\done 목록, codex\dispatcher-log.txt 끝 20줄, codex\reports\AUTO_팀장체제.md 끝 5줄. 문서와 다르면 실제를 기준으로 STATUS.md를 고치고 WORKLOG.md에 한 줄 남긴다.
3. 기존 변경을 덮어쓰거나 되돌리지 마라. git checkout -- . / reset --hard / clean / stash 금지. codex\running 에 있는 작업(210_정리_ComfyUI영상설치.txt는 찌꺼기라 제외)이 고치는 중인 파일은 손대지 마라. 파일 삭제 금지(_old로 이동), art-src 금지.
4. 실장 방식으로 일한다: 게임 코드는 네가 직접 고치지 말고, NEXT.md의 최우선 미완료 항목을 지시서로 만들어 codex\queue\<번호>_구현_<짧은이름>.txt 로 넣는다(작업 관리자가 자동 실행 → 개발팀장 자동 검수 → 지적 자동 수정). 지시서 형식은 codex\done\300_구현_AP0_시간HUD.txt 를 따른다. 한 번에 하나만 넣는다. 이미 완료된 항목(STATUS.md에 [x])은 다시 만들지 마라.
5. 반복: 10분마다(Start-Sleep -Seconds 600) running/queue/reports를 확인한다. 앞 작업의 구현_<번호>.md 와 자동 검수 LEAD 가 "통과"면 STATUS.md 체크, WORKLOG.md 한 줄, 다음 항목 지시서를 넣는다. "지적 남음, 자동 수정 한도"면 LEAD 지적을 읽고 수정 지시서를 하나 넣는다. 12작업이 끝나거나 docs\handoff\OWNER.md 의 현재 실장이 "Claude 실장"으로 바뀌면 멈춘다.
6. 작업 관리자가 멈췄으면(codex\dispatcher-alive.txt 가 2분 넘게 안 바뀜) batch\08_실행기 완전 재시작.bat 을 실행해 다시 켠다(창 없이).
7. 대표에게 질문하지 말고 판단한 부분은 "(Codex 판단)"으로 기록. 보고는 한국어로 짧게. 토큰 절약. 비밀번호·키·토큰을 파일에 적지 마라.
8. Ludo 그림 작업은 하지 마라. 필요한 그림은 NEXT.md "Ludo 요청" 표에 추가만 한다.
9. 끝내거나 중단하기 전에 반드시: STATUS.md·NEXT.md 체크박스 갱신, WORKLOG.md 한 줄(다음 행동 포함), git add docs\handoff AGENTS.md; git commit -m "Codex 실장 인계 문서 갱신"; git push origin main. (작업 관리자 작업이 실행 중이면 그 작업 파일은 add 하지 말고 docs만 커밋)

지금 바로 1번부터 시작하라.
```

## 참고
- 두 도구 모두 같은 폴더 `D:\99.Work\Uganuga`(같은 git 저장소, origin = github.com/Yeokangdong/uganuga, 브랜치 main)를 쓴다. Claude는 이 PC의 폴더를 연결해서 파일을 읽고 쓴다. 따로 동기화할 것은 없다.
- 다른 PC에서 Codex를 쓰면: `git pull origin main`으로 받고, 작업 관리자(dispatcher)는 이 PC에서만 돈다는 점에 주의.
- Claude가 돌아오면 `docs\handoff\OWNER.md`를 "Claude 실장"으로 바꿔 넘겨받는다.
