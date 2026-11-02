# 우가우가! 일러스트 제작 지시서 (Codex용)

횡스크롤 액션 게임 **"우가우가!"** (원시인 형제 vs 공룡, 고인돌 스타일)의 그래픽을
**Samhan_Girls 그림체**로 새로 그린다. 게임 코드는 이미 있으니 **그림 파일만** 만들면 된다.

## 1. 그림체 기준 (반드시 참고)

참고 이미지 (화풍·비율·채색만 참고, 인물/의상은 복사 금지):
- `D:\99.Work\Samhan_Girls\art\select\heroes-fullbody-v1\kim.png`
- `D:\99.Work\Samhan_Girls\art\select\heroes-fullbody-v1\yeon.png`
- `D:\99.Work\Samhan_Girls\art\enemies\male-v2\tang.png` (남자 SD 비율 참고)
- `D:\99.Work\Samhan_Girls\art\comics\backgrounds-v1\kim.png` (배경 채색 참고)

공통 스타일 프롬프트:
> Match the established Samhan Girls 2D illustration style: true THREE-HEAD-TALL super-deformed chibi, very large round head, compact torso, short chunky limbs, big readable expressive eyes. Crisp warm dark-brown ink contours, rich hand-painted anime cel shading, warm saturated colors, polished game-ready finish. No pixel art, no 3D render, no photorealism. No text, no frame, no UI.

캐릭터/아이템/소품 공통 규칙:
- **진짜 투명 배경 (alpha 0)**, 그림자·광택 번짐·색 테두리 없음
- 정사각형 1024×1024, 대상은 가운데, 위아래 8% 여백, **발(바닥 닿는 곳)은 캔버스 높이 92% 지점**
- **모두 화면 오른쪽을 바라보는 옆모습(약간의 3/4)** — 왼쪽은 코드에서 좌우반전
- 같은 캐릭터의 모든 포즈는 **얼굴·머리·옷·색·크기 완전히 동일** (한 장 완성 후 그 그림을 참조해서 나머지 포즈를 그릴 것)

## 2. 저장 위치

모든 파일을 `D:\99.Work\ugauga\art-src\` 아래 아래 이름 그대로 PNG로 저장한다.
(폴더: `heroes\`, `enemies\`, `boss\`, `items\`, `props\`, `bg\`, `tiles\`, `title\`)

## 3. 주인공 (heroes\)

**우가 (1P)**: 씩씩하고 장난스러운 원시인 소년. 크게 뻗친 **주황색** 머리, 큰 눈, 표범 무늬 가죽 원피스(한쪽 어깨), 맨발 또는 가죽 감싼 발, 손에 **돌도끼**(나무 자루 + 회색 돌날, 덩굴로 묶음).
**부가 (2P)**: 우가의 형제. 같은 체형과 옷 구조, **보라색** 머리(뒤로 묶은 짧은 꽁지), 호랑이 무늬 가죽 옷, 살짝 장난꾸러기 표정, 같은 돌도끼.

각 캐릭터마다 (예: `uga_idle_1.png`, `buga_idle_1.png`):
| 파일 | 포즈 |
|---|---|
| `{id}_idle_1`, `{id}_idle_2` | 서 있기, 2번은 숨 쉬듯 살짝 내려앉음 |
| `{id}_run_1` ~ `{id}_run_4` | 달리기 4프레임 순환 (다리 교차) |
| `{id}_jump` | 점프 (무릎 접고 팔 위로) |
| `{id}_throw_1` | 돌도끼를 머리 뒤로 젖힘 |
| `{id}_throw_2` | 앞으로 던진 직후 (팔 뻗음, 손에 무기 없음) |
| `{id}_throw_up` | 위로 던지는 자세 |
| `{id}_hurt` | 맞아서 뒤로 젖혀짐, 눈 찔끔 |
| `{id}_dead` | 눈이 X/소용돌이, 뒤로 넘어짐 (코믹) |
| `{id}_win` | 만세 승리 포즈 |
| `{id}_portrait` | 얼굴 클로즈업(어깨 위), 웃는 표정 — HUD용 |

## 4. 적 (enemies\)

- **몽둥이맨** (덩치 큰 수염 원시인, 갈색 헝클 머리, 회색 털가죽, 큰 나무 몽둥이):
  `caveman_walk_1`, `caveman_walk_2`, `caveman_windup`(몽둥이 머리 위로), `caveman_swing`(내려침)
- **랩터** (작고 귀여운 SD 초록 랩터, 노란 배, 날카로운 이빨):
  `raptor_run_1` ~ `raptor_run_4`, `raptor_jump`
- **익룡** (보라색 익룡, 노란 부리):
  `ptero_fly_1`(날개 위), `ptero_fly_2`(날개 아래), `ptero_dive`(급강하)

## 5. 보스 (boss\) — "폭군룡 쿵쾅이"

빨간 티라노사우루스, 크림색 배, 등 가시, 노란 눈, 짧은 팔, 코믹하지만 위협적인 SD 비율.
캔버스 1536×1024, 오른쪽을 보는 옆모습, 발은 92% 높이.
`trex_idle`, `trex_walk_1`, `trex_walk_2`, `trex_roar`(입 크게 벌림), `trex_charge`(머리 숙이고 돌진), `trex_stun`(어지러움, 별), `trex_jump`(공중), `trex_spit`(입에서 불꽃 직전), `trex_dead`(뒤집어짐)

## 6. 아이템·무기 (items\) — 각 512×512 투명

`meat`(뼈 달린 고기), `bigmeat`(큰 통고기), `fruit`(열대 과일 묶음), `bone`(뼈 부메랑), `torch`(횃불), `axe`(돌도끼 — 던지는 투사체), `wheel`(돌 바퀴), `fireball`(공룡 불덩이), `rock`(낙석)

## 7. 소품 (props\) — 각 1024×1024 투명, 바닥 92%

`palm_1`~`palm_3`(야자수, 키 크게), `bush_1`, `bush_2`(열대 덤불, 빨간 열매), `rock_1`, `rock_2`(이끼 바위), `bones`(공룡 뼈 무더기), `fern`(고사리), `totem`(해골 토템 기둥 — 보스 입구)

## 8. 배경 (bg\) — 옆에서 보는 횡스크롤 원근 (위에서 내려다보지 말 것)

- `bg_far.png` 3072×1024: 하늘, 구름, 멀리 연기 나는 화산, 보랏빛 산맥. **좌우 끝이 이어지는(tileable)** 파노라마. 하단 1/3은 먼 정글 숲 띠로 마무리.
- `bg_mid.png` 3072×1024 **투명 배경**: 중간 거리 정글 언덕과 야자수 실루엣(채색), 하늘 부분 투명, 좌우 이어짐.
- `bg_near.png` 3072×1024 **투명 배경**: 가까운 큰 잎·덩굴, 하단에 수풀, 좌우 이어짐.
- `bg_far_boss.png`: bg_far와 같은 구도, 붉게 물든 저녁 하늘과 분화하는 화산.

## 9. 지형 타일 (tiles\)

- `ground.png` 1024×1024: **상하좌우 이음매 없는(seamless)** 흙 단면 텍스처 (갈색 흙, 자갈, 뿌리) — 옆에서 본 땅 속.
- `grass.png` 2048×512 투명: 땅 윗면 잔디 띠. 아래쪽은 흙 위를 덮는 잔디 뿌리, 위쪽은 풀잎 끝. **좌우 이음매 없음**.
- `log.png` 1536×384 투명: 덩굴로 묶은 통나무 발판(옆모습).

## 10. 타이틀 (title\)

- `title_bg.png` 1920×1080: 정글과 화산 배경 앞에서 우가·부가가 돌도끼를 들고 달리고, 뒤에서 쿵쾅이가 쫓아오는 키비주얼. 글자 없음.
- `logo.png` 투명: 돌에 새긴 듯한 "우가우가!" 한글 로고.

## 우선순위

1) 우가 전 포즈 → 2) 부가 → 3) 적 → 4) 보스 → 5) 배경·타일 → 6) 아이템·소품 → 7) 타이틀.
한 묶음 끝날 때마다 바로 저장해 줘 (게임 쪽에서 저장된 파일부터 순서대로 반영한다).
