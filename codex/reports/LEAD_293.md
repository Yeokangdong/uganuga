지적
| 문제 | 근거 파일:줄 | 고칠 방법 | 우선순위 |
|---|---|---|---|
| 축소 시트 594프레임 중 86개의 사각형이 PNG 밖으로 1px 초과하며 일부 이웃 칸과 겹침. charge 마지막 칸 (679,354,136,71)은 814×424 밖이고 hug 마지막 칸 (79,88,16,18)은 94×105 밖임. 칸 경계 보존 요구 위반 및 렌더 잘림 위험. | src-phaser/assets/runtime/kingkong_charge.json:1; src-phaser/assets/runtime/suukuret_hug.json:1; src-phaser/ludoHero.ts:26 | 각 칸의 시작·끝 경계를 각각 변환하고 w/h를 끝−시작으로 산출하여 PNG 범위·이웃 칸 경계를 보존. 원본은 유지. | P1 |

검수: b356bf3 및 290 지시·보고서·DECISIONS 대조. npm run build 1회 성공. 1~15판 전환·보스·구출 분기에서 이번 변경으로 인한 진행 차단은 코드상 발견하지 못함. 실제 완주 및 성능 수치 재측정은 하지 않음.