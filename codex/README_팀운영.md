# Codex 팀 운영 방식

- **실장(Claude)**: 사용자와 대화 → 작업 지시서를 `codex\queue\` 에 넣음 → 결과 검토·보고
- **팀원(Codex)**: `dispatcher` 가 queue 의 지시서를 자동으로 가져가 창 없이 실행

| 폴더 | 뜻 |
|---|---|
| `queue\` | 대기 중인 작업 지시 (파일 이름 순서대로 시작) |
| `running\` | 실행 중 |
| `done\` | 끝난 작업 |
| `logs\` | 작업별 Codex 로그 |
| `dispatcher-alive.txt` | 배차기가 살아 있으면 10초마다 시간이 갱신됨 |

배차기 켜기: `dispatcher.vbs` 더블클릭 (창 없음, 한 번만). PC 켤 때 자동으로 켜지게 하려면 시작프로그램에 등록.
