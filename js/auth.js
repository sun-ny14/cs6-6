// js/auth.js - 로그인 및 권한 인증 최종 수정본

function handleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("로그인 에러:", error);
        alert("로그인에 실패했습니다. 다시 시도해 주세요.");
    });
}

auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById('login-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const mainApp = document.getElementById('main-app');

    if (user) {
        // 오타 제거 완료된 정상적인 이메일 추출 로직
        const email = user.email ? user.email.trim().toLowerCase() : "";
        console.log("👉 [현재 로그인된 구글 계정 이메일]:", email);
        
        db.ref('users').once('value').then((snapshot) => {
            const usersData = snapshot.val() || {};
            let matchedUser = null;

            // 데이터베이스의 모든 유저를 순회하며 이메일 대조
            Object.keys(usersData).forEach(key => {
                const u = usersData[key];
                if (u && u.email) {
                    const dbEmail = u.email.toString().trim().toLowerCase();
                    if (dbEmail === email) {
                        matchedUser = u;
                    }
                }
            });
            
            const targetAdminEmail = (typeof adminEmail !== 'undefined' ? adminEmail : "").trim().toLowerCase();
            isAdmin = (email === targetAdminEmail);

            if (matchedUser) {
                myName = matchedUser.name;
                isHelper = matchedUser.isHelper || false;
                console.log(`✅ [로그인 성공] 학생 이름: ${myName}`);
            } else if (isAdmin) {
                myName = "선생님";
                isHelper = true;
                console.log("✅ [로그인 성공] 관리자(선생님)");
            } else {
                console.warn(`❌ [로그인 실패] 등록되지 않은 이메일: ${email}`);
                alert(`[로그인 실패]\n등록되지 않은 사용자 이메일(${email})입니다.\n선생님께 이메일 주소를 문의하여 데이터베이스에 등록해 주세요.`);
                auth.signOut();
                return;
            }

            // 화면 전환 처리
            if (loginScreen) loginScreen.style.display = 'none';
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (mainApp) mainApp.style.display = 'flex';
            
            // 관리자 및 도우미 메뉴 강제 표시
            const adminMenuIds = [
                'btn-management', 'btn-cleaning', 'btn-admin', 
                'btn-blackboard-admin', 'admin-blackboard-panel',
                'admin-order-mgr', 'admin-housing-control', 
                'floating-point-btn', 'floating-multi-btn'
            ];
            
            adminMenuIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = (id.includes('floating')) ? 'flex' : 'block';
                }
            });

            // 앱 초기화 실행
            if (typeof initApp === 'function') {
                initApp();
            } else if (typeof showTab === 'function') {
                showTab('main');
            }
        }).catch(err => {
            console.error("Firebase 데이터 조회 오류:", err);
            alert("사용자 정보를 불러오는 중 오류가 발생했습니다.");
        });
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'none';
    }
});

// 메뉴 열고 닫기 토글 함수
function toggleTabMenu() {
    const menuBox = document.getElementById('tab-menu-box');
    if (menuBox) {
        menuBox.style.display = (menuBox.style.display === 'none') ? 'flex' : 'none';
    }
}
