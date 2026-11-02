# 현재 빌드 검수 (107)
| 문제 | 근거(파일:줄) | 고칠 방법 | 우선순위(상중하) |
|---|---|---|---|
| 3판 클리어로 구출·엔딩에 도달하지 않음: 최초 3판 결정과 현재 20판 구성 불일치 | src/game/stages.ts:336,366,390; src/game/game.ts:848,867 — 마지막 판만 final | 3판 종료 요구라면 빙하를 final로 지정하고 후속 판 분리; 20판 확장이 최종 요구인지 결정 문서 정리 | 상 |
| 참고 화면의 층층 바위벽·벽 속 굴 대신 나무 기둥 위 분리 발판 중심 | src/game/paintedMap.ts:40,58; src/game/stages.ts:365; codex/ref/ref_game.png 대 shots/jungle-vine-swing.png(기존 캡처) | 원화 스타일을 유지하며 바위벽·흙 띠·내부 통로와 동굴 입구를 한 구조로 구성 | 상 |
| 보스 체력바가 머리 위와 화면 하단에 중복 표시 | src/game/boss.ts:65; src/components/GameHud.vue:42,82 | 하단 boss-meter 제거, 머리 위 게이지만 유지 | 중 |
| 글자 전부 그림 결정 미준수: READY·이동 안내·보스 이름 등이 일반 글자 | src/game/game.ts:1053,1076; src/game/journey.ts:80; src/components/GameHud.vue:18,41,42,47 | 기존 그림 글자 경로에 편입하고 누락 문구 에셋 추가 | 중 |
| 걷기 4장 결정과 달리 주인공 8장 전체 순환 | public/assets/painted-v6/manifest.json:1(p1.walk=8); src/game/art.ts:156,288; src/game/entities.ts:659 | 가까운 다리/통과/먼 다리/통과의 4프레임을 골라 거리 기반 순환 | 중 |
| 동굴 방에 천장 거미·바닥 횃불이 없음 | src/game/stages.ts:161 — 생성 마커는 ?뿐, 1~3판 동굴 생성 결과 S/X=0; src/game/game.ts:653,658 | 천장 왕복 거미와 점프로 피하는 불 함정 배치, 접촉 피해 연결 | 중 |
| 던지기 금지 결정과 달리 X로 무기 투척 가능 | src/game/input.ts:27; src/game/entities.ts:418,527; src/components/GameHud.vue:47 | X 투척 경로 제거 또는 최종 조작 결정에 변경 사유 명시; 방향키·Space 기본 조작은 일치 | 중 |
| dist 229,647,545바이트(219.0MiB), public 전체 복사로 구세대 에셋까지 포함 | package.json:8; src/game/art.ts:119; public/assets/painted-v6/manifest.json:1 | 실제 최종 참조 파일만 배포하고 덮어쓴 구세대 그림 제외; JS 233.74kB와 이미지 용량 구분 | 중 |
| 바이트 동일 중복 에셋 54그룹, 약 2.68MiB 낭비 | public/assets/painted-v6/manifest.json:1; public/assets/painted-v6/fire-pillar.webp:해당없음(바이너리)와 fire-pillar-14f17f9235dd.webp 동일 해시 | 매니페스트를 단일 파일로 통일 후 미참조 복사본 배포 제외 | 하 |
| 미참조 소스 잔존 | src/game/gait.ts:1; src/game/pixelMap.ts:1 — src 내 import 사용처 없음 | 과거 방식 보관 필요를 판단하고 런타임 소스 밖으로 정리 | 하 |
| 검증 범위 한계: 실제 브라우저 콘솔·1~3판 무보정 완주는 미검증 | src/components/GameView.vue:23; src/game/game.ts:864; npm run build 성공(vue-tsc 포함), 로드 대상 매니페스트 참조 파일 누락 0 | 브라우저에서 로딩·사망/불꽃 재등장·사다리·동굴 왕복·보스 격파를 3판 연속 확인; 콘솔 오류 0으로 단정 금지 | 하 |
| 코드상 1~3판 필수조건은 존재하나 전 구간 도달성은 미확정 | src/game/encounterPlan.ts:27; src/game/game.ts:601,780,864; src/game/entities.ts:1074 — 판당 적16·사다리21·횡단장치6/7/7, 고기3개=FOOD60, 기절 후3타로 고기, 보스 사망 후 다음 판 | 먹이·체력 강제 설정 없이 낙하/사다리/횡단장치 경로를 통과해 소프트록 확인; 1판 보스는 저속 왕복·피격 경직으로 쉬운 패턴 유지 | 하 |