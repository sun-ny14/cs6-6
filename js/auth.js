// js/auth.js - 로그인 보안 정책(COOP) 우회 및 권한 인증 안정화 버전

// 구글 로그인 실행 (팝업 차단 및 정책 충돌 방지를 위해 리디렉션 방식 또는 안전한 팝업 처리)
function handleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    // 팝업 정책 에러를 우회하기 위해 redirect 방식을 사용하거나 팝업을 유지합니다.
    auth.signInWithPopup(provider).catch((error) => {
        console.error("로그인 팝업 에러, 리디렉션으로 전환 시도:", error);
        auth.signInWithRedirect(provider);
    });
}

// 페이지 로드 시 리디렉션 로그인 결과 처리
auth.getRedirectResult().catch((error) => {
    console.error("리디렉션 로그인 에러:", error);
});

// 사용자 인증 상태 변화 감지
auth.onAuthStateChanged((user) => {
    if (user) {
        const email = user.email ? user.email.trim().toLowerCase() : "";
        console.log("현재 로그인 성공한 구글 이메일:", email);
        
        db.ref('users').once('value').then((snapshot) => {
            const usersData = snapshot.val() || {};
            let matchedUser = null;

            // 데이터베이스 데이터 순회하며 이메일 대조
            Object.keys(usersData).forEach(key => {
                const u = usersData[key];
                if (u && u.email) {
                    const dbEmail = u.email.toString().trim().toLowerCase();
                    if (dbEmail === email) {
                        matchedUser = u;
                    }
                }
            });
            
            // 관리자 이메일 비교 (공백 및 대소문자 무시)
            const targetAdminEmail = (typeof adminEmail !== 'undefined' ? adminEmail : "").trim().toLowerCase();
            isAdmin = (email === targetAdminEmail);

            if (matchedUser) {
                myName = matchedUser.name;
                isHelper = matchedUser.isHelper || false;
                console.log(`[로그인 통과] 학생 이름: ${myName}, 역할: ${matchedUser.role || '일반'}`);
            } else if (isAdmin) {
                myName = "선생님";
                isHelper = true;
                console.log("[로그인 통과] 관리자(선생님)로 로그인되었습니다.");
            } else {
                console.warn(`[로그인 차단] DB에 일치하는 이메일(${email})이 없습니다.`);
                alert(`[로그인 실패]\n등록되지 않은 사용자 이메일(${email})입니다.\n선생님께 이메일 주소를 문의하여 데이터베이스에 등록해 주세요.`);
                auth.signOut();
                return;
            }

            // 앱 화면 표시
            forceScreenDisplay('app');
            
            // 관리자 및 도우미 메뉴 표시
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

            // 앱 초기화
            if (typeof initApp === 'function') {
                initApp();
            } else {
                showTab(currentTab);
            }
        }).catch(err => {
            console.error("Firebase users 데이터 조회 중 오류 발생:", err);
            alert("사용자 정보를 불러오는 중 오류가 발생했습니다.");
        });
    } else {
        forceScreenDisplay('login');
    }
});

// 메뉴 열고 닫기 토글 함수
function toggleTabMenu() {
    const menuBox = document.getElementById('tab-menu-box');
    if (menuBox) {
        menuBox.style.display = (menuBox.style.display === 'none') ? 'flex' : 'none';
    }
}
