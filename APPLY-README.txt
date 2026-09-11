긴급 수정 적용 순서 (2026-09-11)

1. 이 압축파일의 폴더 구조를 유지한 채 현재 프로젝트 폴더에 모두 덮어씁니다.

2. VS Code 터미널에서 GitHub에 올립니다.
   git add blackboard.html css/style.css css/classroom-dashboard.css database.rules.json functions/index.js index.html js/auth.js js/blackboard-display.js js/checkin-seat.js js/global.js js/home-dashboard.js js/point-guide.js js/point-shop.js js/settings.js tests/attendance-stability.test.cjs
   git commit -m "학생 화면과 상점 설정 오류 수정"
   git pull --rebase origin main
   git push origin main

3. Cloud Shell에서 함수와 데이터베이스 규칙을 배포합니다.
   cd ~/cs6-6-deploy
   git pull origin main
   npm --prefix functions install
   firebase deploy --only "database,functions:checkin-password:purchasePointShop,functions:checkin-password:syncHousingRewards,functions:checkin-password:getPopularShopItems,functions:checkin-password:mirrorOrder,functions:checkin-password:teacherQuickCheckin,functions:checkin-password:adjustStudentScores,functions:checkin-password:mirrorScoreChangeReceipt" --project cs6-6class

4. 배포 완료 후 학생·교사 브라우저에서 Ctrl+F5를 누릅니다.

수정 내용
- 학생 홈의 전자칠판 열기/보기 버튼 제거(교사 화면은 유지)
- 방꾸미기 보상 함수가 학생 전체 데이터를 반환하던 문제 제거
- 설정 저장 시 /settings 전체 transaction 대신 필요한 필드만 update
- 상점 구매에서 데이터베이스 전체 transaction 제거 및 구매 재시도 중복 차감 방지
- 구매 트랜잭션의 첫 null 값을 학생 없음으로 오판하던 문제 수정
- 학생 포인트 즉시 반영, 복구 데이터의 중복 학생 카드 병합
- 홈에 실제 누적 구매량 TOP 3 인기 상품과 오늘의 청소 현황 표시
- 등교 안정화 및 교사 자동 로그아웃 3시간 적용
- 모든 포인트 증감 경로에 학생별 포인트 연대기 기록 추가
- 좌석 원클릭 정상 등교를 교사 전용 서버 함수로 안정화
- 정상/지각/조퇴 기록은 결석으로 명시 변경하기 전까지 미등교에서 제외
- 포인트·경험치·두 연대기 기록을 교사 전용 서버 함수에서 함께 처리
- 포인트 지급 학생 행을 체크박스·이름·현재 포인트·포인트 입력·경험치 입력의 가로 배치로 고정

주의
- 전자칠판의 공개 주소 자체는 기존 요구대로 로그인 없이 열립니다.
- 학생 홈페이지 안의 전자칠판 진입 버튼만 제거됩니다.
