// js/auth.js
// 로그인, 로그아웃 및 사용자 권한 인증 관리 (에러 방지 안전장치 적용)

function handleLogin() {
    auth.signInWithPopup(provider).then((result) => {
        // 로그인 성공 시 onAuthStateChanged에서 처리
    }).catch((error) => {
        console.error("로그인 에러:", error);
        alert("로그인에 실패했습니다. 다시 시도해 주세요.");
    });
}

auth.onAuthStateChanged((user) => {
    if (user) {
        const email = user.email;
        
        db.ref('users').once('value').then((snapshot) => {
            const usersData = snapshot.val() || {};
            currentUsers = Object.values(usersData);
            
            isAdmin = (email === adminEmail);
            const matchedUser = currentUsers.find(u => u.email === email);
            
            if (matchedUser) {
                myName = matchedUser.name;
                isHelper = matchedUser.isHelper || false;
            } else if (isAdmin) {
                myName = "선생님";
                isHelper = true;
            } else {
                alert("등록되지 않은 사용자 이메일입니다. 선생님께 문의하세요.");
                auth.signOut();
                return;
            }

            forceScreenDisplay('app');
            
            // 관리자 및 도우미 권한: 요소가 존재하는지 확인(안전장치) 후 표시
            if (isAdmin || isHelper) {
                const adminMenuIds = [
                    'btn-management', 'btn-cleaning', 'btn-admin', 
                    'btn-blackboard-admin', 'admin-blackboard-panel', // 전자칠판 관리 관련 추가
                    'admin-order-mgr', 'admin-housing-control', 
                    'floating-point-btn', 'floating-multi-btn'
                ];
                
                adminMenuIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.display = (id.includes('floating')) ? 'flex' : 'block';
                    }
                });
            }

            // 스크립트 충돌 없이 안전하게 앱 초기화 실행
            if (typeof initApp === 'function') {
                initApp();
            } else {
                showTab(currentTab);
            }
        });
    } else {
        forceScreenDisplay('login');
    }
});
// 메뉴 열고 닫기 토글 함수
function toggleTabMenu() {
    const menuBox = document.getElementById('tab-menu-box');
    if (menuBox) {
        if (menuBox.style.display === 'none') {
            menuBox.style.display = 'flex';
        } else {
            menuBox.style.display = 'none';
        }
    }
}
