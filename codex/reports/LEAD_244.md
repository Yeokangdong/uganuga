지적
| 문제 | 근거 파일:줄 | 고칠 방법 | 우선순위 |
|---|---|---|---|
| 최신 결정은 모든 판 60·TIME UP 20인데 공용 규칙은 30·15로 남아 엔진별 시간이 다름. 현재 Phaser는 60·20 적용으로 결정 준수하나 233 보고서는 현행과 불일치. | codex/DECISIONS.md:147; src/game/game.ts:72; src/game/game.ts:73; src-phaser/movementScene.ts:105; src-phaser/movementScene.ts:201; codex/reports/구현_233.md:1 | 최신 결정 60·20으로 공용 상수와 Phaser 초기화·연장을 통일하고 보고서 갱신. | P1 |
| 1~15판 통과 시간 검증 부족: 거리÷최대속도 하한이 30 미만이어도 먹이 60·지형·보스 처치까지 제한 시간 내 가능한지는 입증되지 않음. | codex/reports/구현_233.md:4; codex/reports/구현_233.md:5; src-phaser/movementScene.ts:203; src-phaser/movementScene.ts:204 | 최신 제한 60 기준으로 각 판 먹이 획득·실제 지형 경로·보스전 포함 가능한 경로 시간을 확인하고 초과 판 번호 보고. | P1 |

검수: 233 커밋 9ee9b0c 및 후속 현행 코드·결정 대조. npm run build, npm run build:phaser 모두 성공(청크 크기 경고만 존재). 1~14판 다음 판 전환·15판 구출 분기는 연결됨; 시간 변경에 따른 확정 진행 차단은 코드상 발견하지 못했으나 실제 완주·제한 시간 내 통과는 미검증. 코드 수정·배포·커밋 없음.