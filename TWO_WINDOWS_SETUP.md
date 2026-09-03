# 관리자용·학생용 창 자동 실행 복구

이 수정본은 `.vscode/settings.json`을 포함하지 않습니다. 기존 PC의 사용자 지정 실행 경로, 호스트 및 포트를 덮어쓰지 않습니다.

## 한 번만 설정

1. Live Server가 실행 중이면 VS Code 아래의 `Port: 5500`을 눌러 중지합니다.
2. 이 ZIP의 파일을 기존 프로젝트 폴더에 같은 경로로 덮어씁니다. `.vscode/open-two-views.cmd`도 필요합니다.
3. 프로젝트의 `setup-two-windows.cmd`를 더블클릭합니다. 관리자 권한은 필요하지 않습니다.
4. `Two-window Go Live setup complete.`를 확인합니다.
5. VS Code에서 `Go Live`를 누릅니다. 관리자용 Chrome과 학생용 Chrome을 각각 실행합니다.

설정 파일이 VS Code에 열려 있다면, 설정 작업 후 이전 내용을 다시 저장하지 마세요. ‘파일이 더 새롭다’는 저장 충돌이 나오고 직접 편집한 내용이 없다면 저장하지 않고 탭을 닫았다가 다시 여세요.

설정 도구는 기존 VS Code 설정을 읽은 뒤 두 창 실행 명령 관련 항목만 바꿉니다. 호스트·포트·루트는 기존 값이 있으면 유지하며, 설정 변경 전 날짜가 붙은 백업을 남깁니다. 기존 설정 JSON을 읽지 못하면 파일을 변경하지 않고 오류를 표시합니다.

## 지금 두 창을 직접 열기

Live Server를 켠 상태에서 **`open-two-windows.cmd`를 더블클릭**하면 두 창을 함께 엽니다. 이 직접 실행 파일의 기본 주소는 `http://127.0.0.1:5500/index.html`입니다.

다른 주소를 사용하는 경우 아래처럼 실제 주소를 인자로 전달하세요. Go Live 자동 실행에서는 Live Server가 실제 주소를 전달하므로 따로 바꿀 필요가 없습니다.

```bat
open-two-windows.cmd "http://localhost:5501/index.html"
```

학생 창만 다시 열려면 기존 `open-student.cmd`를 사용할 수 있습니다. 기본 포트는 5500입니다.

## 로그인

- 관리자용: 기존 Chrome **Profile 5**.
- 학생용: `%LOCALAPPDATA%\CS6-Classroom\StudentBrowser`의 별도 브라우저 데이터.
- 기존 프로필이나 쿠키를 지우거나 복사하지 않습니다.
- 프로필에 해당 사이트의 유효한 Firebase 로그인이 저장되어 있으면 다시 사용합니다. 새 프로필 또는 저장된 인증이 없는 경우 최초 한 번 각 창에서 해당 계정으로 Google 로그인해야 합니다.
- 관리자 권한은 실제 로그인한 계정으로 판정합니다. 학생용 창에서 관리자 계정으로 로그인하면 관리자 화면이 표시됩니다. 창을 여는 스크립트가 인증을 생략하거나 임의로 학생·관리자 권한을 부여하지 않습니다.
- `localhost`와 `127.0.0.1`처럼 주소를 바꾸면 저장된 로그인이 다르게 보일 수 있습니다. 기존에 사용하던 주소를 유지하세요.

## 콘솔 메시지

`favicon.ico 404`는 사이트 아이콘 파일을 찾지 못했다는 뜻이며 두 창 실행 설정과는 관계가 없습니다. `Cross-Origin-Opener-Policy ... window.closed`는 로그인 팝업 상태 확인과 관련된 메시지입니다. 이 메시지만으로 로그인이 실패했다고 판단할 수 없습니다. 실제 로그인 완료 여부 또는 별도의 Firebase 오류 코드를 확인해야 합니다.

## 검증 범위

Live Server의 사용자 지정 실행 명령 처리 소스, CMD 경로·두 Chrome 프로필 실행 분기, 설치 파일의 설정 보존 및 ZIP 제외 항목을 확인했습니다. 이 환경에서 실제 Windows Chrome 실행은 검증하지 못했습니다.

공식 근거:
- https://ritwickdey.github.io/vscode-live-server/docs/settings.html
- https://firebase.google.com/docs/auth/web/auth-state-persistence
