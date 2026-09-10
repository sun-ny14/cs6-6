# 보안 유지 UI 통합본 적용 안내

이 압축파일은 현재 보안 강화본(커밋 `5977bc0`)을 기준으로 친구가 만든 UI 개선을 골라 합친 **변경 파일 묶음**입니다. Firebase 데이터는 포함하지 않으며, 적용만으로 Realtime Database 자료를 삭제하거나 초기화하지 않습니다.

## 반영한 내용

- 교사/학생 역할별 색상과 공통 카드·버튼·표 UI
- 등교 결과 카드, 미등교 명단, 번호 표시 등 화면 개선
- 과제 전원 완료/해제와 일부 관리자 작업의 짧은 되돌리기 UI
- 포인트 입력 화면의 검색·일괄 입력 및 감점 시 기본 미선택
- 용사 카드의 경험치/단계 표시와 방 꾸미기 카드 UI
- 기존 학생 일괄 등록 시 포인트·경험치·레벨을 덮어쓰지 않도록 보존
- 변경된 정적 파일이 즉시 갱신되도록 캐시 버전 변경

## 보안을 위해 그대로 유지하거나 다시 고친 내용

- 로그인은 브라우저를 닫으면 풀리는 `SESSION` 방식 유지
- 로그인 권한은 `getSecureSession`과 `access/{uid}`를 통해 확인
- 학생 등교는 `submitStudentCheckin` 서버 함수에서 암호·시간·포인트를 한 번에 검증
- 포인트 상점 구매는 `purchasePointShop` 서버 트랜잭션 사용
- 방 아이템 구매·반응·보상도 서버 함수 사용
- 상점 사용 요청/승인/반려는 `requestOrderUse`와 `manageShopOrder` 사용
- 학생 목록은 공개용 `publicProfiles`, 주문은 본인용 `ordersByUser` 경로 사용
- 친구 코드의 브라우저 직접 포인트 차감, 직접 구매, 절대값 복원 방식 포인트 되돌리기는 제외
- Cloud Functions 메모리를 512MiB로 유지하여 이전의 메모리 초과 500 오류 방지
- 수동 저장 등교 암호는 날짜가 바뀌어도 그대로 유지되고 전자칠판 공개 경로에도 저장

## 가장 안전한 적용 순서

1. Firebase Console에서 **Realtime Database → 데이터 → JSON 내보내기**로 현재 자료를 한 번 더 저장합니다.
2. 현재 VS Code 폴더에서 정상 상태를 먼저 커밋합니다.

   ```powershell
   git add -A
   git commit -m "UI 통합 전 정상 상태 백업"
   git tag backup-before-safe-ui
   ```

   Git 이름/이메일 오류가 나면 이 저장소에만 설정합니다.

   ```powershell
   git config user.name "본인이름"
   git config user.email "본인이메일"
   ```

3. 이 ZIP을 **별도 폴더에 먼저 압축 해제**합니다. 안의 파일 구조를 확인한 다음, `patch` 폴더의 내용만 현재 저장소 최상위 폴더에 덮어씁니다. `.git` 폴더나 Firebase 데이터는 건드리지 않습니다.
4. VS Code 터미널에서 변경 목록을 확인합니다.

   ```powershell
   git status --short
   git diff --check
   ```

5. Functions 의존성을 확인합니다.

   ```powershell
   cd functions
   npm ci
   cd ..
   ```

6. 서버 함수부터 배포합니다. 이 단계는 데이터 초기화가 아니라 함수 코드 교체입니다.

   ```powershell
   firebase use cs6-6class
   firebase deploy --only functions
   ```

7. `Deploy complete!`를 확인한 뒤 보안 규칙을 배포합니다.

   ```powershell
   firebase deploy --only database
   ```

8. 아래 순서로 실제 계정을 확인합니다.

   - 교사: 설정·학급관리·전자칠판 관리 진입
   - 일반 학생: 본인 포인트만 표시되고 교사 메뉴/다른 학생 상세정보 접근 불가
   - 청소 역할: 청소 확인만 가능
   - 상점 역할: 주문 확인·처리만 가능
   - 학생: 같은 상품을 빠르게 여러 번 눌러도 서버에서 재고·포인트·구매한도 검증
   - 등교 암호: 저장 후 전자칠판에서 즉시 변경되고 다음 날에도 동일하게 표시

9. 확인 후 커밋·푸시합니다.

   ```powershell
   git add -A
   git commit -m "보안 유지 UI 통합"
   git push origin main
   ```

## 절대 하지 않을 것

- 빈 JSON을 Realtime Database에 가져오기
- Database 최상위(`/`)에서 삭제 또는 `set` 실행
- Functions 배포가 실패한 상태에서 새 웹 코드만 먼저 공개
- `database.rules.json`을 전체 로그인 사용자 읽기/쓰기로 완화

문제가 보이면 먼저 `git switch --detach backup-before-safe-ui`로 백업 상태를 확인할 수 있습니다. 실제 운영 브랜치를 되돌릴 때는 데이터 백업을 보존한 채 Git 절차를 따르세요.
