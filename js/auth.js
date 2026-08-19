// js/auth.js
// 로그인, 로그아웃 및 사용자 권한 인증 관리

// Google 로그인 실행 함수
function handleLogin() {
    auth.signInWithPopup(provider).then((result) => {
        // 로그인 성공 시 onAuthStateChanged에서 후속 처리 진행
    }).catch((error) => {
        console.error("로그인 에러:", error);
        alert("로그인에 실패했습니다. 다시 시도해 주세요.");
    });
}

// 사용자 인증 상태 변화 감지 및 초기 앱 구동
auth.onAuthStateChanged((user) => {
    if (user) {
        const email = user.email;
        
        // 데이터베이스에서 학생 명단 및 사용자 정보 불러오기
        db.ref('users').once('value').then((snapshot) => {
            const usersData = snapshot.val() || {};
            currentUsers = Object.values(usersData);
            
            // 관리자 여부 확인
            isAdmin = (email === adminEmail);
            
            // 현재 로그인한 사용자가 명단에 있는지 확인
            const matchedUser = currentUsers.find(u => u.email === email);
            
            if (matchedUser) {
                myName = matchedUser.name;
                isHelper = matchedUser.isHelper || false;
            } else if (isAdmin) {
                myName = "선생님";
                isHelper = true;
            } else {
                // 등록되지 않은 사용자인 경우 차단 또는 기본 처리
                alert("등록되지 않은 사용자 이메일입니다. 선생님께 문의하세요.");
                auth.signOut();
                return;
            }

            // 화면을 메인 앱 화면으로 전환
            forceScreenDisplay('app');
            
            // 관리자 및 도우미 권한에 따른 메뉴 표시 여부 설정
            if (isAdmin || isHelper) {
                if(document.getElementById('btn-logs')) document.getElementById('btn-logs').style.display = 'block';
                if(document.getElementById('btn-grades')) document.getElementById('btn-grades').style.display = 'block';
                if(document.getElementById('btn-budget')) document.getElementById('btn-budget').style.display = 'block';
                if(document.getElementById('btn-cleaning')) document.getElementById('btn-cleaning').style.display = 'block';
                if(document.getElementById('btn-admin')) document.getElementById('btn-admin').style.display = 'block';
                if(document.getElementById('admin-order-mgr')) document.getElementById('admin-order-mgr').style.display = 'block';
                if(document.getElementById('admin-housing-control')) document.getElementById('admin-housing-control').style.display = 'block';
                if(document.getElementById('floating-point-btn')) document.getElementById('floating-point-btn').style.display = 'flex';
                if(document.getElementById('floating-multi-btn')) document.getElementById('floating-multi-btn').style.display = 'flex';
            }

            // 앱의 핵심 데이터 초기 로드 실행
            if (typeof initApp === 'function') {
                initApp();
            } else {
                // 기본 탭으로 이동
                showTab(currentTab);
            }
        });
    } else {
        // 로그아웃 상태이거나 인증되지 않은 경우 로그인 화면 표시
        forceScreenDisplay('login');
    }
});
