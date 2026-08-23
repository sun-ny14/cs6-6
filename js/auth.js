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
    const sidebarToggleBtn = document.getElementById('sidebar-toggle'); 

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
                        ['btn-logs', 'btn-admin', 'btn-budget', 'floating-point-btn', 'floating-multi-btn'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.style.display = 'block';
                        });

                        const myInv = document.getElementById('my-inventory');
                        if (myInv) myInv.style.display = 'none';

                        if (!sessionStorage.getItem('activeTab') && typeof currentTab !== 'undefined') {
                            currentTab = 'logs';
                        }
                    }
                    
                    if (typeof startApp === 'function') startApp(); 
                    if (typeof showTab === 'function' && typeof currentTab !== 'undefined') {
                        showTab(currentTab);
                    }
                });
            } else { 
                alert("미등록 용사입니다!"); 
                auth.signOut(); 
            }
        });
    } else { 
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

// 2. 특정 용사의 정보 및 연대기(로그)를 팝업으로 띄워주는 함수
window.openUserHistory = function(un) {
    db.ref('users/' + un).once('value', sn => {
        const u = sn.val() || {}; 
        const lv = u.lv || 1; 
        const pts = u.points || 0; 
        const isMeOrAdmin = (isAdmin || un === myName);
        
        // 관리자 전용 특정 상품 구매한도 리셋 버튼
        const adminResetBtn = isAdmin ? `<button onclick="resetUserItemLimit('${un}')" style="margin-top:10px; padding:8px 12px; background:var(--purple, #9b59b6); color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; width:100%;">🔄 특정 상품 구매한도 리셋</button>` : '';
        const visitRoomBtn = `<button onclick="visitRoom('${un}')" style="margin-top:10px; padding:10px; background:var(--primary, #3498db); color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; width:100%;">🏠 방명록 방문하기</button>`;

        let h = `
        <div style="display:flex; flex-wrap:wrap; gap:20px; align-items:center; background:#f8f9fa; padding:20px; border-radius:20px; border:2px solid #eee;">
            <div style="flex:0 0 100px; text-align:center;">
                ${typeof getAvatar === 'function' ? getAvatar(lv, u.selectedAnimal) : ''}
                <div style="margin-top:8px; font-weight:bold;">LV.${lv}</div>
                ${un === myName ? `<button onclick="openAvatarPicker()" style="padding:5px; font-size:0.8rem; background:var(--gold, #f1c40f); border:none; border-radius:5px; cursor:pointer;">모습 변경</button>` : ''}
            </div>
            
            <div style="flex:1; min-width: 150px;">
                <h3 style="margin:0 0 10px 0;">${un} 용사</h3>
                ${isMeOrAdmin ? `<div>💰 <b>${pts}P</b></div><div>✨ EXP: <b>${u.exp||0} / 100</b></div>${adminResetBtn}` : `<p style="color:var(--red, #e74c3c); font-weight:bold;">🛡️ 정보는 비밀입니다!</p>`}
            </div>
            
            <div style="width: 100%;">
                ${visitRoomBtn}
            </div>
        </div>`;
        
        if (isMeOrAdmin) { 
            db.ref('pointLogs').once('value', lsn => { 
                let uL = []; 
                lsn.forEach(l => { if (l.val().name === un) uL.push(l.val()); }); 
                let logHtml = `<div style="max-height:200px; overflow-y:auto; margin-top:10px;">`; 
                uL.reverse().slice(0, 20).forEach(l => { 
                    logHtml += `<div class="list-item"><span>${l.reason}<br><small>${l.time}</small></span><strong>${l.amount}P</strong></div>`; 
                }); 
                if (typeof openPopup === 'function') {
                    openPopup(`${un} 정보`, h + logHtml + `</div>`); 
                }
            }); 
        } else { 
            if (typeof openPopup === 'function') {
                openPopup(`${un} 정보`, h); 
            }
        }
    });
};