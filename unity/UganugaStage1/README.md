> **2026-11-07 대표 지시로 중지·참고용 미완성 보관.** 실제 Unity 프로젝트 import/코드 검증/Windows 빌드 및 게임창 실행까지 성공했습니다. 자동 입력으로 등반·전투 6처치·출구 도착을 확인했으나 마지막 필수적을 건너뛰어 완주·재시작 검증은 미통과입니다. 실제 카메라 렌더 2장 확인(HUD 미포함), 배경 패널 이음 개선은 남았습니다. 아래 초기 라이선스 대기 기록은 현재 상태가 아닙니다. 기존 웹판은 변경하지 않았으며, 새 지시 전 작업/검증을 재개하지 않습니다.

# 우가누가 — Unity 정글 1판

기존 웹판과 독립된 Unity 2D 프로젝트입니다. 웹판 `src`, `public`, `package.json`, 배포 폴더를 수정하거나 대체하지 않습니다. 기존 그림 중 필요한 파일만 이 프로젝트로 복사했습니다.

## 열기와 실행

1. Unity Hub에서 Unity **6000.3.28f1** 설치 및 개인 계정의 적합한 라이선스를 활성화합니다.
2. Hub의 **Add → Add project from disk**에서 이 README가 있는 `UganugaStage1` 폴더를 선택합니다.
3. `Assets/Scenes/JungleStage1.unity`를 열고 **Play**를 누릅니다. 맵·카메라·캐릭터는 `StageOne`이 실행 시 생성합니다. 편집 화면의 씬이 단순한 것은 정상입니다.
4. Windows 실행 파일은 메뉴 **Uganuga → Build Windows preview**로 만듭니다. 결과: `Builds/Windows/UganugaStage1.exe`.

방향키 또는 A/D 이동, **Z / 스페이스 점프**, **X / J 몽둥이**, **위아래 / W/S 덩굴**, P/ESC 일시정지, R 처음부터. 첫 번째 나무 아래에서 위 키로 덩굴을 잡습니다. 사과와 작은 표식을 따라 나무 위를 이동하고, 오른쪽 아래 쉼터 앞 뱀을 처치해 입구에 도착하면 1판이 끝납니다. 먹이를 모두 모을 필요는 없습니다.

## 1판 구성

- 가지 중심 정글 길, 넓은 덩굴 잡기 범위, 점프 입력 버퍼·짧은 발판 이탈 유예, 아래쪽 복귀 가지와 덩굴.
- 우가의 대기·걷기·점프·공격·등반은 기존 동일 원화와 고정 80px/unit를 사용합니다. 프레임마다 몸 크기를 맞춰 늘이거나 줄이지 않습니다.
- 뱀은 경고 후 짧게 돌진합니다. 원숭이는 가지에 꼬리를 걸고, 경고 후 **수평 직선** 코코넛을 던집니다. 몽둥이로 기절시킨 다음 마무리 공격하면 먹이를 떨어뜨립니다.
- FOOD는 열매 +5 / 고기 +20 / 큰 고기 +40의 누적 점수입니다. 체력과 목숨은 별도이며, 표식에서 다시 시작해도 먹이 점수는 유지됩니다. 60점 상한이나 진행 제한은 없습니다.
- 표식 3곳은 복귀 지점입니다. 낙하는 체력 2를 잃고 복귀합니다. 체력이 소진되면 목숨을 사용합니다. 마지막 쉼터 앞 뱀은 필수 전투이며, 나머지 적을 반드시 전부 잡아야 하는 조건은 없습니다.
- 가까운 정글 배경 3종, 나무 2종, 지지되는 뿌리, 가지 표면에 놓인 열매, 실제 꼬리와 접촉하는 원숭이 발판.

## 명령행 빌드

아래 예시는 모든 명령을 기존 프로젝트 루트에서 시작합니다. Editor 경로는 실제 설치 위치에 맞춥니다.

```powershell
Set-Location D:\99.Work\Uganuga
& 'D:\99.Work\Uganuga\codex\_old\unity-setup\Editor-6000.3.28f1\Editor\Unity.exe' -batchmode -nographics -quit -projectPath 'D:\99.Work\Uganuga\unity\UganugaStage1' -executeMethod Uganuga.UnityStageOne.Editor.StageOneBuilder.ValidateProject -logFile 'D:\99.Work\Uganuga\unity\UganugaStage1\validation.log'
```

빌드는 같은 인수의 `-executeMethod`를 `Uganuga.UnityStageOne.Editor.StageOneBuilder.BuildWindows`로 바꿉니다. 실제 Unity 라이선스가 필요합니다. 라이선스 없이 DLL 참조로 C#을 컴파일한 결과는 에디터 실행·플레이 통과를 뜻하지 않습니다.

## 검증 상태와 증거

2026-11-07: 설치된 Unity 6000.3.28f1의 실제 UnityEngine/UnityEditor 참조 DLL과 Roslyn으로 **런타임 및 에디터 C# 컴파일 성공**. 아트 atlas의 원본 크기·모든 사각형·고정 우가 배율을 정적 검증했습니다. **Unity 라이선스 활성화 대기 때문에 에디터 import/Windows 빌드/실제 플레이/화면 검증은 아직 미실시**입니다. 따라서 이 소스를 플레이 검증을 마친 완성 실행 파일이라고 표기하지 않습니다.

실제 플레이 중 F9를 누르면 화면과 현재 결과를 `%USERPROFILE%/AppData/LocalLow/Uganuga/Uganuga - Jungle Stage 1/Evidence`에 기록합니다. 실행 시 `--evidence=절대경로`로 변경할 수 있습니다. 이 기능은 상태를 바꾸거나 자동 완주하지 않습니다. 클리어 시에도 결과를 저장합니다. 스크린샷은 게임을 조작한 실제 화면이며 상태 수치 JSON만으로 키 입력 완주를 주장하지 않습니다.

## 파일 범위

`Assets/Scripts`: 독립 게임 로직, `Assets/Editor`: 아트 원본 크기 보존·씬 열기·검증·Windows 빌드, `Assets/Resources/Art`: 복사한 기존 원화/atlas/출처. `Library`, `Builds`, `Logs`, `Evidence`는 생성 결과이므로 Git에 넣지 않습니다. 불필요한 새 원화나 외부 게임 에셋은 만들거나 가져오지 않았습니다.
