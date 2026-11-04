# 현재 실장(지시 담당)

| 항목 | 값 |
|---|---|
| 현재 실장 | **Codex 실장 (Codex 앱 우가누가 프로젝트 채팅)** |
| 갱신 | 2026-11-04 17:55 KST (대표 「코덱스 실장으로 옮기자」) |
| Claude 상태 | 부재. Claude 예약 확인 모두 취소함 |
| 넘기는 조건 | 대표가 Claude에게 「codex 실장한테 넘길께」라고 하면 넘긴다 |

## 넘기는 절차 (Claude가 직접 함)
1. 이 표의 현재 실장을 **Codex 실장**으로 고치고, `STATUS.md`·`NEXT.md`·`WORKLOG.md`를 최신으로 갱신.
2. Claude 쪽 예약 확인(send_later)을 모두 취소(둘이 동시에 queue에 넣지 않게).
3. Codex 앱 → 왼쪽 프로젝트 "우가누가" → 새 채팅 → `CODEX_CONTINUE.md`의 프롬프트 블록을 붙여넣고 보냄.
4. Codex가 읽기 시작했는지 화면으로 확인.

## 규칙
- 실장은 한 명만 queue에 작업을 넣는다.
- 현재 실장이 Claude일 때 Codex 앱 채팅은 실장 일을 하지 않는다(대표가 직접 시킨 한 가지 일만).
- Claude가 돌아오면: 이 파일과 `WORKLOG.md` 끝을 읽고, 넘겨받는다는 줄을 WORKLOG에 남긴 뒤 위 표를 "Claude 실장"으로 고친다. 그리고 Codex 실장 채팅에 "Claude 실장이 돌아왔다, 멈춰라"라고 입력한다.
- Codex 실장이 대화가 끊겨 다시 시작할 때도 이 파일 → `CODEX_CONTINUE.md` 순서로 다시 읽는다.
