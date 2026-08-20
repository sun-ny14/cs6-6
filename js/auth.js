// js/auth.js - 데이터베이스 매칭 상태 확인용 디버깅 버전
function handleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("로그인 팝업 에러:", error);
    });
}

auth.onAuthStateChanged((user) => {
    if (user) {
        const email = user.email ? user.email.trim().toLowerCase() : "";
        console.log("👉 [로그인 시도 계정]:", email);
        
        db.ref('users').once('value').then((snapshot) => {
            const usersData = snapshot.val() || {};
            console.log("👉 [파이어베이스에 등록된 전체 users 데이터]:", usersData);

            let matchedUser = null;

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
                console.log(`✅ [매칭 성공] 이름: ${myName}`);
            } else if (isAdmin) {
                myName = "선생님";
                isHelper = true;
                console.log("✅ [매칭 성공] 관리자(선생님)");
            } else {
                console.error(`❌ [매칭 실패] DB 데이터와 '${email}'이 일치하는 항목이 없습니다.`);
                alert(`[로그인 실패]\nDB에서 이메일(${email})을 찾지 못했습니다.\n콘솔창(F12)의 '전체 users 데이터'를 확인해 주세요.`);
                auth.signOut();
                return;
            }

            forceScreenDisplay('app');
            if (typeof initApp === 'function') initApp();
            else showTab(currentTab);
        });
    } else {
        forceScreenDisplay('login');
    }
});
