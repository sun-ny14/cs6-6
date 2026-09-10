# 보안 수정 적용 안내

이 묶음은 오늘 디자인·체크박스·출결·암호·전자칠판 수정과 보안 수정을 함께 포함합니다. 기존 프로젝트에 같은 경로로 덮어쓰세요. 전체 폴더를 삭제하지 마세요.

## 먼저 알아둘 점

- 관리자: `ksosuny@cberi.go.kr`로 Google 로그인한 이메일 인증 완료 계정 하나입니다. 학생의 역할·이름·isAdmin·isHelper 값을 관리 권한으로 사용하지 않습니다.
- 학생의 포인트·경험치·레벨·권한·코인·구매 기록 직접 쓰기를 차단합니다. 상점 구매, 본인 등교, 가구 구매/배치, 프로필 선택, 아이템 사용 요청, 방 반응은 서버의 허용된 작업만 수행합니다.
- 성적·예산·관리 설정·출결 원본 등 교사용 데이터는 관리자만 접근합니다. 과제 목록/완료 상태와 공개 전자칠판은 기존 학생 표시 기능을 위해 읽기를 허용합니다.
- 기존 청소 담당 학생은 청소 확인만, 기존 상점 담당 학생(`role`/`studentRoles`의 `상점` 또는 기존 `isHelper`)은 주문 승인·거절만 할 수 있습니다. 다른 교사용 탭 권한은 생기지 않습니다.
- 개인정보·포인트·경험치·보유 아이템이 있는 `users/본인이름`은 본인과 관리자만 읽을 수 있습니다. 학생끼리는 개인정보가 제거된 `publicStudents`와 별도 `rooms`만 공유합니다.
- 정적 홈페이지의 HTML/JavaScript나 개발자 도구로 만든 가짜 화면 자체를 숨길 수는 없습니다. 실제 관리 데이터 읽기/쓰기 권한을 Firebase에서 거부합니다.
- 이미 조작된 포인트·권한·기록은 자동 복구되지 않습니다. 적용 전 현재 값과 백업을 비교해 교사가 확인해야 합니다.

## 필수 적용 순서

웹 파일이나 규칙만 단독 적용하면 구매·등교가 실패할 수 있습니다. 서버 함수 배포까지 필요하며, Functions 배포는 Blaze 요금제가 필요합니다. 무료 Spark 유지용 버전이 아닙니다.

1. Firebase 데이터와 기존 규칙, VS Code 프로젝트를 백업하세요. 학생이 사용하지 않는 시간에 진행하세요.
2. 압축파일을 프로젝트에 덮어쓰세요. 아직 웹에 공개하지 마세요.
3. Node.js 22를 설치하고 VS Code 터미널에서 프로젝트 최상위 폴더를 여세요.
4. 아래 로컬 테스트를 먼저 실행하세요.

```sh
npm --prefix functions ci
node --test tests/security-core.test.cjs tests/security-ui.test.cjs tests/blackboard.test.cjs tests/blackboard-share.test.cjs
npm --prefix security-tests install
npm --prefix security-tests test
```

규칙 테스트에는 Firebase CLI가 요구하는 Java 설치가 필요합니다. demo-cs66-security라는 로컬 에뮬레이터 프로젝트만 사용하므로 실데이터를 수정하지 않습니다. 규칙 테스트가 실패하면 운영 적용을 멈추고 오류를 확인하세요.

5. 관리자 Google 계정으로 CLI 로그인 후 새 함수만 배포하세요.

```sh
npx firebase-tools login
npx firebase-tools deploy --only "functions:studentAction,functions:migratePublicData,functions:syncPublicStudent,functions:syncPublicExperience" --project cs6-6class
```

함수 이름 `studentAction`, 리전 `asia-northeast3`입니다. 배포 실패 시 이후 단계를 진행하지 마세요. 기존 다른 함수 삭제를 요구하는 메시지가 나오면 그대로 승인하지 말고 선택 범위를 확인하세요.

6. 기존 방식대로 수정한 웹 파일을 GitHub에 푸시/배포하세요. 아래 규칙 적용까지 바로 이어서 진행하세요.
7. `database.rules.json`의 **전체 내용**을 Firebase 콘솔 → Realtime Database → 규칙에 붙여넣고 **게시**하세요. GitHub에 파일만 올리면 운영 규칙은 바뀌지 않습니다. CLI를 쓰면 다음 명령으로 대체할 수 있습니다.

```sh
npx firebase-tools deploy --only database --project cs6-6class
```

8. **반드시 관리자 계정으로 홈페이지에 먼저 한 번 로그인하세요.** 그러면 기존 `users`의 공개 프로필과 `myRoom`이 `publicStudents`, `rooms`로 한 번만 이전됩니다. 그 다음 홈페이지와 전자칠판에서 Ctrl+Shift+R 후 관리자와 테스트 학생 계정을 별도 브라우저 프로필로 확인하세요.

## 확인할 동작

- 학생: 정상 구매 시 저장 가격만큼 차감, 재고/구매한도 확인, 중복 전송 시 한 번만 차감.
- 학생: 암호 등교 시 서버 한국시간 적용, 정상 코인 하루 한 번, 등교제외 감점 없음, 교사가 이미 기록한 결석을 학생이 변경하지 못함.
- 교사: 포인트 일괄 지급, 성적/예산/설정, 출결 수정, 청소 확인, 사용요청 승인 가능.
- 일반 학생: 교사용 관리 탭으로 이동 불가, 다른 학생의 `users`/포인트/이메일/경험치/아이템 조회 불가.
- 청소 담당 학생: 청소 확인만 가능. 상점 담당 학생: 전체 주문 확인과 승인·거절만 가능. 두 경우 모두 다른 교사용 데이터 접근 불가.
- 학생끼리: 공개 프로필과 방만 조회 가능.
- 전자칠판: 로그인 없는 보기 유지. 메모 편집은 홈페이지에 관리자 로그인 후 기존 열기 버튼 이용. 별도 로그인 버튼 없음.
- 학생: 가구 보관함 구매/배치, 방꾸미기 좌표 수정, 해금된 배경·캐릭터·칭호 선택 가능.

## 검증 결과와 범위

- 서버 로직·기존 전자칠판/UI 관련 자동 테스트 50개 통과. Functions 패키지 설치 및 callable 모듈 로딩 확인.
- 실제 Firebase 규칙 에뮬레이터 실행은 작업 환경에서 네트워크 승인 취소로 완료하지 못했습니다. 규칙 테스트 파일과 실행 설정을 포함했습니다. '운영 검증 완료'를 의미하지 않습니다.
- 실제 Google 로그인, 운영 함수 배포, 운영 데이터 변경, 브라우저 E2E 검수는 수행하지 않았습니다.
- 브라우저 활동 기준 자동 로그아웃은 서버 세션 만료 정책과 다릅니다. 이번 수정의 서버 권한 판정은 검증된 로그인 토큰 및 등록 명부 기준입니다.
- 현재 데이터 구조를 유지하기 위해 서버 구매/등교는 루트 트랜잭션을 사용합니다. 이미지·기록이 커질수록 서버 처리량과 트래픽이 증가합니다. 비용 최적화 또는 대규모 사용을 보장한 설계는 아닙니다. 재시도 방지 영수증 secureReceipts를 임의 삭제하면 중복 구매 방지가 깨질 수 있습니다.
- 브라우저 저장소가 차단된 경우 중복 구매 방지를 위해 작업을 중단합니다. 결과 확인 실패 후에는 같은 동작을 재시도하고 저장소를 지우지 마세요.
- 함수의 인스턴스 상한은 비용의 절대 상한이 아닙니다. App Check 강제 적용 및 요청량 제한은 이 버전에 포함하지 않았습니다.

공식 참고: https://firebase.google.com/docs/functions/callable
https://firebase.google.com/docs/functions/get-started
https://firebase.google.com/docs/database/security/core-syntax
