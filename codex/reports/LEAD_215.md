지적
| 문제 | 근거 파일:줄 | 고칠 방법 | 우선순위 |
|---|---|---|---|
| 이동 검증 중 3회 사망하면 OUT에 고정되어 같은 판을 재시도할 수 없음. 원본은 전원 탈락 시 결과 화면으로 전환하지만 새 Scene은 Player.update만 계속 호출함. | src-phaser/movementScene.ts:98; src/game/entities.ts:282; src/game/entities.ts:605; src/game/game.ts:884 | 탈락 감지 후 재시작 입력 또는 타이틀 복귀를 연결하고, 일반 수역·낙하로 목숨 소진 후 재진입 확인. | P2 |

214 지시·계획 3단계·최신 결정·d74cd05(origin/phaser 동일) 대조. 기존 src/·public/assets 변경 없음. 1~15판 공통 이동/사다리/수역/부활 분기 정적 확인; 전투·판 전환은 후속 단계 범위. 실제 15판 완주는 검증하지 않음.
npm run build 및 npm run build:phaser 성공(청크 크기 경고만 존재). 구현 보고서 5줄 및 214_phaser.png 존재·594460바이트 확인. 코드 수정·배포·다른 큐 등록 없음.