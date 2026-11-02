# Pixelorama + AI 전신 스프라이트 편집

무료 Pixelorama 1.2.3 설치: `%LOCALAPPDATA%\Programs\Pixelorama\Pixelorama-Windows-64bit\Pixelorama.exe`.
공식 Windows64 ZIP의 SHA256: `942e38288b818ef44e0c834691a00a521f811739af523a2cfdc09aae58753646`.

프로젝트 폴더에서 PowerShell로 실행:

```powershell
.\tools\sprites.ps1 -Action open -Sprite p1.walk
.\tools\sprites.ps1 -Action ai -Sprite p1.walk -Instruction '좌우 발이 교대하도록 순서와 시간을 점검하고, 부족한 자세를 표시해'
.\tools\sprites.ps1 -Action export -Sprite p1.walk
.\tools\sprites.ps1 -Action sync -Sprite p1.walk
.\tools\sprites.ps1 -Action apply-all -Instruction '모든 캐릭터 모든 동작의 전신 연결과 타이밍을 점검해'
```

- `prepare -Sprite all`: 11캐릭터99동작의 현재 프레임 전체를 Pixelorama 프로젝트로 준비. 걷기만 준비하려면 `-Sprite walks`.
- `ai -Sprite all -Instruction 내용`: 캐릭터별 AI 분석, 모든 동작 후보 생성(중단 후 동일 명령으로 재개).
- `sync -Sprite all -UseAi`: 모든 AI 후보를 앱에서 검증한 후 게임에 한 번에 연결.
- `open-character -Sprite p1 -UseAi`: 주인공 전체17동작을 태그로 묶어 앱에서 열기. 다른 이름: bear, boar, boss, boss2, boss3, dino1_0, dino1_1, dino1_2, spider, nuga.
- `sync-character -Sprite p1`: 캐릭터 통합 파일의 편집을 동작별로 풀어 게임에 연결. 태그 이름 유지.
- `apply-all`: 전체 AI 분석부터 검증·게임 연결까지 실행. 모든 원본 프레임을 유지하고 일회 동작과 반복 동작을 구분.
- 연결 시 게임용 시트는 자동으로 캐릭터별 압축 배치. 투명 여백만 줄이며 픽셀·발 기준점·표시 크기는 유지. 편집용 PXO 여백은 그대로 보존.
- 재원화 시트 가져오기: `python tools/sprite_workflow.py import-cycle bear.walk --sheet 시트.png --columns 4 --rows 2`. 전신8프레임을 기존 크기·접지·주기에 맞춰 가져온 뒤 sync로 연결.
- `export -Sprite all`: 앱 CLI로 PNG/JSON/GIF 내보내기. 알파와 보이는 픽셀의 왕복 일치를 검사.
- `ai`: 현재 편집본을 백업한 뒤 현재 Codex 로그인으로 전신 프레임을 분석하고 JSON 지시 및 `ai-candidate.pxo` 생성·열기. Codex 이용 한도가 적용되며 별도 API 키를 만들지 않음.
- AI는 기존 그림의 순서·시간·전체 위치를 조정. 빠진 발 자세는 `needs_redraw`에 표시. 새 그림을 자동으로 그리는 기능은 아님.
- AI 후보를 연결하려면 `-Action sync -Sprite p1.walk -Project 'D:\99.Work\ugauga\art-src\pixelorama\p1.walk\ai-candidate.pxo'` 사용.
- AI에 연결하지 않고 이 채팅에서 `plan.json`을 수정한 뒤 `prepare -Plan 파일경로`로 적용할 수도 있음.
- `prepare -SourceSheet 경로 -Columns 4 -Rows 3`: 투명 여백을 포함한 픽셀 크기 시트 입력. 그림은 확대·축소·신체 분리하지 않음.

작업 파일: `art-src/pixelorama/<이름>/`. `source.pxo`는 원본, `project.pxo`는 수동 편집용, `ai-candidate.pxo`는 AI 후보.
앱에서 수정 후 **저장**하고 export/sync 실행. 프로젝트는 일반 RGBA 픽셀 레이어·보통 혼합 사용.
원본/게임 manifest 백업은 해당 작업 폴더의 `backups/`에 보관. 연결 뒤 게임 화면 새로고침.

Python은 기존 Codex 번들 런타임(Pillow 포함)을 사용. 스크립트는 이미지/JSON 데이터만 처리하고 임의 AI 코드를 실행하지 않음.

공식 문서: https://pixelorama.org/user_manual/cli/ · https://pixelorama.org/user_manual/Import/ · https://learn.chatgpt.com/docs/non-interactive-mode
