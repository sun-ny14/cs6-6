# 학생 창 실행·Firebase 연결 확인

이번 보완 ZIP은 기존 프로젝트 폴더에 덮어씁니다. 현재 PC에서 설정한 `.vscode/settings.json`은 ZIP에 넣지 않았습니다.

## 학생 창 열기

1. VS Code에서 Go Live를 실행해 교사 화면을 엽니다.
2. `index.html` 옆의 **`open-student.cmd`를 더블클릭**합니다.
3. 별도 학생용 Chrome 창이 열리면 처음 한 번 학생 계정으로 로그인합니다. 교사 계정으로 로그인하면 이 창에도 교사 화면이 표시됩니다.

교사 창은 기존 `Profile 5`를 사용합니다. 학생 창은 `%LOCALAPPDATA%\CS6-Classroom\StudentBrowser`에 별도 브라우저 데이터를 보관해 교사 창과 로그인 상태가 섞이지 않도록 했습니다. 기존 Chrome Default의 로그인 자료를 복사하거나 삭제하지 않습니다. 실행 후 창이 뒤에 있으면 작업 표시줄 또는 Alt+Tab에서 확인할 수 있습니다.

Go Live 자동 실행은 앞서 제공한 `setup-two-windows.cmd`를 한 번 실행한 뒤 Live Server를 중지하고 다시 시작하면 수정된 두 창 실행 파일에 연결됩니다. 직접 실행하는 `open-student.cmd`는 이 설정 여부와 무관하게 학생 창을 열도록 요청합니다. Go Live 포트가 5500이 아니라면 `open-student.cmd`의 주소를 실제 포트로 맞춰야 합니다.

## Firebase 연결 확인

교사 창의 새 탭에서 `http://127.0.0.1:5500/connection-check.html`을 엽니다. 약 15초 뒤 결과 화면을 캡처해 주세요.

- Firebase 프로그램 초기화 여부
- 서버 HTTPS 응답 여부
- 실시간 DB 연결 여부
- 현재 창의 로그인 여부
- 로그인한 계정으로 설정을 읽을 수 있는지

데이터를 쓰거나 구매하지 않습니다. 화면에는 이름, 이메일, 인증 토큰을 표시하지 않습니다. HTTPS 응답이 와도 실시간 연결까지 정상이라는 뜻은 아닙니다. 원인은 실제 PC에서의 결과를 보고 구분해야 합니다.

## 확인 범위

CMD 경로와 분기, JavaScript 문법, 참조 파일을 점검했습니다. 이 환경에서 Windows Chrome을 실행하거나 교실 네트워크 상태를 확인하지는 못했습니다.

근거: [Chromium 사용자 데이터 폴더](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md), [Firebase 연결 상태](https://firebase.google.com/docs/database/web/offline-capabilities#section-connection-state).
