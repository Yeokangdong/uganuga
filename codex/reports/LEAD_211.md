지적
| 문제 | 근거 파일:줄 | 고칠 방법 | 우선순위 |
| 로딩 중 이미 표시된 판을 클릭하면 collision-tiles 로드 전 showMap이 실행되어 타일셋/레이어 생성 실패 가능. 15판을 순차 로드하므로 클릭 가능한 시간이 길다. | src-phaser/mapScene.ts:24,33,54 | 타일 이미지와 전체 맵 준비가 끝난 뒤 클릭 활성화하거나 준비 상태로 차단한다. | 높음 |
| 일반 실행도 원본 Level을 생성하고 저장 TMJ와 완전 일치를 강제하므로 Tiled에서 지형·객체를 편집하면 round trip mismatch로 맵 진입이 중단된다. 계획의 TMJ 편집 원본 전환과 어긋난다. | src-phaser/mapScene.ts:14,18; src-phaser/tiled.ts:40; codex/reports/LEAD_205_Phaser계획.md 위험① | 원본 대조는 변환·검수 경로로 분리하고 일반 실행은 TMJ를 기준으로 표시한다. | 중간 |

검수: npm run build 및 npm run build:phaser 성공. 209 커밋은 src/·public/assets 변경 없음. 기존 1~15판 순차 진행·최종 구출 분기의 신규 변경 없음. Phaser 이동·전투는 이후 단계 범위이며 실제 완주는 검수하지 않음.