등교/학생 포인트 안정화 수정 적용 방법
========================================

포함된 수정
- 일부 학생 등교 시 internal 오류 완화
  · submitStudentCheckin 메모리 1GiB/제한시간 60초
  · 과거 출결 전체가 아니라 해당 날짜만 조회
- 학생 본인 포인트가 0으로 보이던 문제 수정
  · 공개 명단에는 포인트를 노출하지 않고 로그인한 본인 값만 화면에 결합
- 교사용 원클릭 등교 수정
  · 좌석 한 번 클릭 즉시 등교 처리
  · 중복 클릭 방지
- 출결 상세 수정창이 바로 닫히던 문제 수정
  · 더블클릭 타이머 제거
  · 각 좌석의 '상세 수정' 버튼으로 분리
- 출결 날짜 조회 인덱스 추가
- 교사 자동 로그아웃 대기시간을 30분에서 3시간으로 연장
  · 학생 자동 로그아웃은 기존 2시간 유지

1. 압축을 현재 GitHub 프로젝트 폴더에 그대로 덮어쓰기

2. 프로젝트 최상위 폴더에서 Firebase 배포

   npm.cmd --prefix functions install
   npx.cmd firebase-tools deploy --only "database,functions:checkin-password:getSecureSession,functions:checkin-password:submitStudentCheckin" --project cs6-6class

   삭제 여부를 물으면 No를 선택해도 됩니다.
   마지막에 Deploy complete!가 나오는지 확인하세요.

3. GitHub 반영

   git add css/style.css database.rules.json functions/index.js index.html js/auth.js js/checkin-seat.js js/global.js tests/attendance-stability.test.cjs
   git commit -m "등교 및 학생 포인트 안정화"
   git pull --rebase origin main
   git push origin main

4. 확인
- 학생 계정에서 Ctrl+F5 후 본인 포인트 확인
- 학생 등교 암호 입력 후 정상/지각 처리 확인
- 교사 계정에서 좌석 한 번 클릭으로 등교 처리 확인
- 좌석 안의 '상세 수정' 버튼을 눌러 수정창이 유지되는지 확인

주의
- Firebase Functions 배포 없이 GitHub만 푸시하면 학생 internal 오류 수정은 적용되지 않습니다.
- database.rules.json 배포 없이 GitHub만 푸시하면 날짜 인덱스가 적용되지 않습니다.
