지적
| 문제 | 근거 파일:줄 | 고칠 방법 | 우선순위 |
|---|---|---|---|
| 지역 이동 화면의 「클릭 · Enter로 계속」 안내가 작동하지 않음. 입력해도 6.2초 자동 전환만 기다림 | src/game/journey.ts:129; src-phaser/journeyScene.ts:27,54 | travel 입력 시 다음 Play로 전환하고 점수·목숨 전달 | P2 |
| 그림 글자 결정 미준수: 이동 지역명·설명·안내와 구출/재시작 문구 등이 시스템 폰트로 출력됨 | codex/DECISIONS.md:27; src/game/journey.ts:121~129; src-phaser/journeyScene.ts:14,74~80; src/game/art.ts:295~299 | src-phaser 안에서 그림 글자/숫자 조합 렌더링으로 교체. 기존 src·원본 자산은 수정 금지 | P2 |
검수: 047a4fa 및 후속 변경 대조. npm run build / npm run build:phaser 성공(번들 크기 경고만). 228 미리보기 존재(546,746바이트). 1~15판 clear→travel→다음 판 및 최종 구출→결과→재시작 분기에 코드상 확정 차단은 발견하지 못함. 실제 완주·시청각 재생은 미검증.