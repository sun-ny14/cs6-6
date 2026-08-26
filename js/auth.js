// js/auth.js - 로그인, 권한 인증 및 사용자 정보 팝업 통합 관리 파일

const DEV_MODE = false; 

function handleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("로그인 에러:", error);
        alert("로그인에 실패했습니다. 다시 시도해 주세요.");
    });
}

// 1. 인증 상태 변화 감지 및 로그인 처리
auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const mainApp = document.getElementById('main-app');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

    if (DEV_MODE) return; 

    if (user) {
        isAdmin = (user.email === adminEmail);
        db.ref('userEmails/' + user.email.replace(/\./g, ',')).once('value', snap => {
            if (snap.exists() || isAdmin) {
                myName = snap.val() || "총사령관";
                
                db.ref('users/' + myName).once('value', uSnap => {
                    isHelper = uSnap.val()?.isHelper || false;
                    
                    if (typeof forceScreenDisplay === 'function') {
                        forceScreenDisplay('app');
                    } else {
                        if (loginScreen) loginScreen.style.display = 'none';
                        if (loadingScreen) loadingScreen.style.display = 'none';
                        if (mainApp) mainApp.style.display = 'flex';
                    }

                    if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'block';

                    if (isAdmin || isHelper) {
                        const orderMgr = document.getElementById('admin-order-mgr');
                        if (orderMgr) orderMgr.style.display = 'block';
                    }

                    if (isAdmin) {
                        // 💡 [수정] 학급관리 버튼('btn-management') 및 관리자 전용 메뉴들이 확실히 뜨도록 추가!
                        ['btn-logs', 'btn-admin', 'btn-budget', 'btn-management', 'btn-blackboard-admin', 'btn-cleaning', 'floating-point-btn', 'floating-multi-btn'].forEach(id => {
                        // 💡 [수정] 학급관리 버튼('btn-management') 및 관리자 전용 메뉴들이 확실히 뜨도록 추가!
                        ['btn-logs', 'btn-admin', 'btn-budget', 'btn-management', 'btn-blackboard-admin', 'btn-cleaning', 'floating-point-btn', 'floating-multi-btn'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.style.display = 'block';
                        });

                        const myInv = document.getElementById('my-inventory');
                        if (myInv) myInv.style.display = 'none';
                    }
                    
                    if (typeof startApp === 'function') startApp(); 
                    
                    // 💡 [수정] 로그인 직후 무조건 '용사들' 탭('main')이 뜨도록 강제 설정하여 흰 바탕 문제 원천 차단
                    if (typeof showTab === 'function') {
                        showTab('main');
                    
                    // 💡 [수정] 로그인 직후 무조건 '용사들' 탭('main')이 뜨도록 강제 설정하여 흰 바탕 문제 원천 차단
                    if (typeof showTab === 'function') {
                        showTab('main');
                    }
                });
            } else { 
                alert("미등록 용사입니다!"); 
                auth.signOut(); 
            }
        });
    } else { 
        window.appStarted = false;
        if (typeof forceScreenDisplay === 'function') {
            forceScreenDisplay('login');
        } else {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (mainApp) mainApp.style.display = 'none';
        }
        if (sidebarToggleBtn) sidebarToggleBtn.style.display = 'none'; 
    }
});

// 이전 카드 코드가 호출하던 이름을 현재 프로필 기능으로 연결합니다.
window.openUserHistory = function(userName) {
    if (window.isAdmin && typeof openStudentProfile === 'function') {
        openStudentProfile(userName);
    } else if (userName === window.myName && typeof openOwnStudentProfile === 'function') {
        openOwnStudentProfile(userName);
    } else if (typeof openFriendRoom === 'function') {
        openFriendRoom(userName);
    }
};
