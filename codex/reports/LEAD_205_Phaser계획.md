# LEAD_205 — Phaser 3 전면 이전 계획
범위: 이번에는 계획서만 작성. 구현은 phaser 브랜치·src-phaser/에서 진행하고 src/·public/assets 원본·현재 main/Pages는 유지한다.
불변: DECISIONS 최신 결정 우선, 1인용·15판·킹콩 오프닝·누가 공주 구출·먹이바→보스문·3타 기절 후 2타 고기·동굴 입구=출구·LEAD_170 판별 패턴·그림 글자·던지기 없음·←→↑Space.
| 기존 src 기능·근거 | Phaser 3 구현 대응 |
|---|---|
| App.vue, GameView·TitleScreen·ResultScreen, game.ts 실행/일시정지 | 별도 진입점 + Boot/Title/Play/Cave/Journey/Ending Scene, 공통 진행 상태·이벤트, 단일 게임 루프 |
| stages.ts·level.ts: 15판, 지형·사다리·물·스폰·보스 구역 | 최종 StageDef 및 Level 보정 결과를 변환 스크립트로 .tmj 출력; 충돌 Tile Layer와 사다리/문/스폰/패턴 Object Layer, 판 속성 보존 |
| paintedMap·pixelMap·cloudTerrain·terrainThemes·background·stageSign | 기존 그림을 Image/TileSprite·Container로 배치, 충돌층과 장식층 분리; 원본 비율·발판 표면·사다리 끝·깊이·카메라 시차 유지 |
| input·entities(Player)·gait·traversal | Keyboard + Arcade Body, 기존 고정 STEP·이동/점프/착지 유예/사다리 상태 이식; 물/산소·낙하 복귀·현재 연결된 탑승/덩굴 동작만 유지 |
| entities(적/아이템)·weapons·encounterPlan·world-cast·piranha | Sprite Animation + 상태기계·Group/overlap, 근접 히트박스·피격 무적·3+2타·고기/무기/시계 등 드롭·접촉 피해 |
| game.ts·boss·caveRewards: FOOD·목숨·점수·TIME·문·동굴·보스 | 공통 상태 + 문 overlap/입력, Cave Scene 복귀 좌표 저장, 보스 상태기계·머리 위 체력바·죽음/부활·15판 순차 진행 |
| stagePatterns·patternRuntime, LEAD_170_패턴기획.md | 판별 전용 등장체 + 예고/공격/회수 상태, 실제 지형 앵커·안전지점·화면 안 공격·판별 간격을 데이터화; 미구현 기획은 별도 완료 대상으로 명시 |
| art·sprites·opening·journey·audio·GameHud·그림 글자 컴포넌트 | 기존 이미지/시트·그림 글리프를 Texture/Animation/Image로 재사용, Timeline/Tween·Sound·고정 HUD, 로딩 진행/실패 재시도·지역 이동·구출/결과 연출 |
각 단계는 아래 구현 묶음 1건 → 창 없는 미리보기 PNG 제출 → 개발팀장 검수·수정 완료 후 다음 단계. 아래 그림은 향후 구현 때 만들 산출물이며 이번에는 생성하지 않는다.
| 단계 | 구현 1건 | 완료 확인 기준 + 눈으로 볼 미리보기 그림 |
|---|---|---|
| 1 | 독립 Phaser 실행 골격 | Phaser 3 버전 고정·별도 빌드 진입·원화 로드/실패 재시도·Scene 종료 시 해제 확인; 205_01.png에 기존 타이틀·주인공·로딩 화면 |
| 2 | 15판 Tiled 변환·맵 표시 | 실행 시 보정된 지형/사다리/스폰/문/앵커를 빠짐없이 변환, 왕복 좌표·개수 대조; 205_02.png에 15판 전체도와 1판 충돌층 겹침 |
| 3 | 플레이어 이동 체계 | ←→↑Space·발 접지·단방향 발판·사다리 출입·물/산소·낙하/부활·활성 이동 장치 재현, 프레임률별 속도 동일; 205_03.png에 이동/점프/사다리/수면 연속 장면 |
| 4 | 일반 전투·아이템 체계 | 접촉 피해·근접 판정·중복 타격 방지·3타 기절→추가 2타 고기·무기/시계/먹이·점수 검수; 205_04.png에 타격→별 기절→고기→획득 순서 |
| 5 | 한 판 진행 체계 | HUD·TIME·목숨·일시정지·먹이 부족 문 차단/가득 참 개방·동굴 보상/함정·동일 문 복귀·보스 처치→다음 판 확인; 205_05.png에 문 전후/동굴 복귀/보스 머리 체력바 |
| 6 | 15판 전용 패턴 체계 | LEAD_170 15종을 판별로 검수, 예고/회피/회수·지형 접점·안전 공간·타판 비출현·15판 A/B 비동시 검증; 205_06.png에 15판 각각 예고/공격/안전 위치 |
| 7 | 전체 여정·시청각 연출 | 킹콩 오프닝→준비/불꽃→지역 이동→15판 보스→누가 구출/결과/재시작, 그림 글자·BGM/SFX·배경/원화 비율 검수; 205_07.png에 시작/이동/구출/결과 |
| 8 | 이전 완성본 통합 | 1~15판 실제 완주·동굴/사망/시간초과/재시작 회귀·해상도/성능/누수·빌드 확인, 기존판과 동일 구간 비교; 205_08.png에 전판 비교와 엔딩. 개발팀장 동등성 승인 후에만 main·Pages 교체 |
위험① 변환 누락: 문자열 맵만 옮기면 런타임 보정·추가 속성·동굴 생성·앵커가 소실된다. 변환 결과를 원본 실행 데이터와 대조하고 .tmj를 이후 편집 원본으로 삼아 이중 수정을 막는다.
위험② 물리/그림 불일치: Arcade 기본값으로 조작감이 달라질 수 있어 기존 STEP·치수·타이밍을 기준으로 맞춘다. 투명 여백/발바닥 기준·원본 비율·타일 이음·사다리 끝을 프레임별 비교한다.
위험③ 규모/동시 작업: 각 단계의 15판 반복은 동일 구현의 데이터 검수로 처리하되 실패 판은 통과시키지 않는다. 기존 미해결 원화 이음/패턴 미구현을 완료로 간주하지 않고, 다른 작업 파일·Pages를 건드리지 않는다.
위험④ 로더/자원: Phaser 3에서 .tmj JSON·tileset 경로/임베딩·GID·자원 base URL을 먼저 확인; 거대 원화의 텍스처 한계·메모리·오디오 자동재생·Scene 복귀 중복 이벤트를 검수한다.
기술 참고: [Phaser Tiled 파서](https://docs.phaser.io/api-documentation/namespace/tilemaps-parsers-tiled), [Object Layer](https://docs.phaser.io/api-documentation/class/tilemaps-objectlayer). 실제 API는 1단계에서 고정한 Phaser 3 버전 기준으로 확인한다.
