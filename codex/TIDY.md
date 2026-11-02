# 정리 담당 (개발 실장 직속)

목표: 파일·폴더를 찾기 쉽게 하고, Codex가 읽는 글을 줄여 토큰을 아낀다.

## 할 일
- 다 쓴 지시서·배치 파일·DONE 표시 파일은 codex\_old\ 아래로 옮긴다 (날짜 말고 종류별 폴더).
- codex\INDEX.md 를 최신으로 유지: 파일마다 한 줄 설명, 지금 쓰는 것 / 옛것 구분.
- 긴 BRIEF는 원본을 그대로 두고, 팀원용 짧은 요약판(<이름>_요약.md, 20줄 이내)을 따로 만든다.
- 토큰 아끼는 방법을 찾으면 codex\reports\TIDY_제안.md 에 적는다 (실장이 보고 결정).

## 절대 건드리지 않음
- queue\ running\ done\ logs\ 폴더, dispatcher.*, RULES.md, TEAM_LEAD.md, ART_ROLES.md, ref\
- 게임 코드(src, public, tools), art-src
- 파일 삭제 금지(옮기기만), 원본 내용 줄이기 금지, git push 금지
