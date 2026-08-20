// js/auth.js - 이메일 매칭 안전성 강화 버전

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
        const email = user.email ? user.email.trim().toLowerCase() : "";
        
        db.ref('users').once('value').then((snapshot) => {
            const usersData = snapshot.val() || {};
            let matchedUser = null;

            // 데이터베이스 구조가 객체(Key-Value) 형태일 때 안전하게 탐색
            Object.keys(usersData).forEach(key => {
                const u = usersData[key];
                if (u && u.email) {
                    const dbEmail = u.email.trim().toLowerCase();
                    if (dbEmail === email) {
                        matchedUser = u;
                    }
                }
            });
            
            isAdmin = (email === adminEmail.trim().toLowerCase());

            if (matchedUser) {
                myName = matchedUser.name;
                isHelper = matchedUser.isHelper || false;
            } else if (isAdmin) {
                myName = "선생님";
                isHelper = true;
            } else {
                alert(`등록되지 않은 사용자 이메일(${email})입니다. 선생님께 문의하세요.`);
                auth.signOut();
                return;
            }

            forceScreenDisplay('app');
            
            if (isAdmin || isHelper) {
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
            }

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
