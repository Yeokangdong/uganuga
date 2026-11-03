지적
| 문제 | 근거 파일:줄 | 고칠 방법 | 우선순위 |
|---|---|---|---|
| 몽둥이 적중 전용 효과가 피격·빈 바닥 내려찍기에도 발생한다. 공통 burst를 연결해 피해를 입어도 별 효과와 45ms 정지가 생기며, 적이 없는 내려찍기도 정지한다. | src-phaser/movementScene.ts:109; src/game/entities.ts:524; src/game/entities.ts:580 | 일반 입자 burst와 적중 효과를 분리하고, 몽둥이가 적에게 실제 적중한 경로에서만 별·정지 효과를 호출한다. | P2 |

검증: 235 지시·구현 보고서·c679ae9 및 최근 커밋·관련 DECISIONS 대조. build:phaser 1회 성공. 1~14판 clear→travel→다음 판, 15판 clear→rescue→result 분기에 코드상 진행 차단은 확인되지 않음(실제 플레이 완주 미검증). LEAD_229 취소 결정과 점수·시간 보너스 계산 일치. 코드 수정 없음.
