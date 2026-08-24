// js/global.js
// 공통으로 사용되는 유틸리티 함수 모음

function getTodayKST() { 
    const now = new Date(); 
    const krTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); 
    return krTime.getUTCFullYear() + "-" + String(krTime.getUTCMonth() + 1).padStart(2, '0') + "-" + String(krTime.getUTCDate()).padStart(2, '0'); 
}

function forceScreenDisplay(status) {
    const load = document.getElementById('loading-screen'), login = document.getElementById('login-screen'), app = document.getElementById('main-app');
    if(load) load.style.display = 'none';
    if(status === 'app') { if(login) login.style.display = 'none'; if(app) app.style.display = 'block'; }
    else { if(login) login.style.display = 'flex'; if(app) app.style.display = 'none'; }
}

function showTab(t) { 
    currentTab = t; 
    sessionStorage.setItem('activeTab', t); 
    
    // 모든 탭 컨텐츠 숨기기
    document.querySelectorAll('.tab-content').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; 
    }); 
    
    // 사이드바의 모든 버튼에서 active 클래스 제거
    document.querySelectorAll('.sidebar-menu button').forEach(b => {
        b.classList.remove('active');
        // 기존 인라인 스타일로 박아둔 배경색이 덮어씌워지지 않도록 초기화 방지 처리
    }); 
    
    // 선택된 탭 컨텐츠만 보이게 활성화
    const targetTab = document.getElementById('tab-' + t);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.display = 'block';
    }
    
    // 선택된 사이드바 버튼 활성화 표시
    const targetBtn = document.getElementById('btn-' + t);
    if (targetBtn) {
        targetBtn.classList.add('active'); 
    }
    
    // 💡 탭별 추가 초기화 함수 연결
    if (t === 'checkin') {
        if (typeof switchCheckinSub === 'function') switchCheckinSub('checkin-main');
    }
    if (t === 'shop') {
        if (typeof renderShop === 'function') renderShop();
        if (typeof loadOrderRecords === 'function') loadOrderRecords();
    }
    if (t === 'points') {
        if (typeof renderPointGuide === 'function') renderPointGuide();
        if (typeof initPointsTabListeners === 'function') initPointsTabListeners();
    }
    if (t === 'management') {
        renderManagementSub('grades');
    }
}

function closePopup() { 
    if(window.routineActive && ++rIdx < routineItems.length) {
        document.getElementById('pop-content').innerText = `[루틴 ${rIdx+1}단계]\n${routineItems[rIdx]}`; 
    } else { 
        document.getElementById('common-overlay').style.display='none'; 
        rIdx = 0; 
    } 
}

function getAvatar(lv, selectedAnimal) {
    return "";
}

function switchCheckinSub(subId) {
    const subMain = document.getElementById('sub-checkin-main');
    const subLogs = document.getElementById('sub-checkin-logs');
    const btnMain = document.getElementById('sub-btn-checkin-main');
    const btnLogs = document.getElementById('sub-btn-checkin-logs');

    if (subMain) subMain.style.display = (subId === 'checkin-main') ? 'block' : 'none';
    if (subLogs) subLogs.style.display = (subId === 'checkin-logs') ? 'block' : 'none';
    
    if (btnMain) {
        btnMain.style.background = (subId === 'checkin-main') ? 'var(--dark, #2c3e50)' : '#ddd';
        btnMain.style.color = (subId === 'checkin-main') ? 'white' : '#333';
    }
    
    if (btnLogs) {
        btnLogs.style.background = (subId === 'checkin-logs') ? 'var(--dark, #2c3e50)' : '#ddd';
        btnLogs.style.color = (subId === 'checkin-logs') ? 'white' : '#333';
    }
    
    if (subId === 'checkin-logs') {
        if (typeof generateNewLayout === 'function') generateNewLayout();
    }
}

function renderManagementSub(type) {
    const container = document.getElementById('management-sub-container');
    const btnGrades = document.getElementById('sub-btn-grades');
    const btnBudget = document.getElementById('sub-btn-budget');
    
    if (type === 'grades') {
        if(btnGrades) { btnGrades.style.background = 'var(--primary)'; btnGrades.style.color = 'white'; }
        if(btnBudget) { btnBudget.style.background = '#ddd'; btnBudget.style.color = '#333'; }
        
        if (typeof renderGradesMain === 'function') {
            renderGradesMain();
        } else if (container) {
            container.innerHTML = `
                <div class="card">
                    <h2>📝 성적 및 평가 관리</h2>
                    <p>학생들의 성적과 수행평가 기록을 관리하는 공간입니다.</p>
                </div>
            `;
        }
    } else if (type === 'budget') {
        if(btnBudget) { btnBudget.style.background = 'var(--primary)'; btnBudget.style.color = 'white'; }
        if(btnGrades) { btnGrades.style.background = '#ddd'; btnGrades.style.color = '#333'; }
        
        if (typeof initBudgetManager === 'function') {
            initBudgetManager();
        }
    }
}

function startApp() {
    // 1. 관리자, 도우미, 총사령관인 경우에만 관리자 메뉴 및 설정 버튼 노출
    if (isAdmin || isHelper || myName === "총사령관") { 
        const orderMgr = document.getElementById('admin-order-mgr'); 
        if (orderMgr) orderMgr.style.display = 'block'; 
        
        const bbAdminBtn = document.getElementById('btn-blackboard-admin');
        if (bbAdminBtn) bbAdminBtn.style.display = 'inline-block';

        // 👉 관리자 권한일 때만 설정(Admin) 버튼 표시
        const adminBtn = document.getElementById('btn-admin');
        if (adminBtn) adminBtn.style.display = 'block';
    } else {
        // 👉 일반 학생인 경우 설정 버튼을 무조건 숨김
        const adminBtn = document.getElementById('btn-admin');
        if (adminBtn) adminBtn.style.display = 'none';
    }

    if (myName === "총사령관") {
        const checkinTabBtn = document.getElementById('btn-checkin');
        if (checkinTabBtn) checkinTabBtn.style.display = 'none';
        
        const cleaningTabBtn = document.getElementById('btn-cleaning');
        if (cleaningTabBtn) cleaningTabBtn.style.display = 'inline-block';
    } else {
        if (typeof currentUser !== 'undefined' && currentUser.role === '청소') {
            const cleaningTabBtn = document.getElementById('btn-cleaning');
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'inline-block';
        }
    }
    // ... (이하 기존 코드 동일)

    window.isHousingEnabled = true;

    db.ref('settings').on('value', snap => {
        const s = snap.val() || {}; 
        giftList = s.giftList || []; 
        routineItems = s.routineText?.split('\n').filter(t => t.trim()) || [];
        
        if (isAdmin) { 
            const passEl = document.getElementById('conf-pass');
            const lateEl = document.getElementById('conf-late');
            const closeEl = document.getElementById('conf-close');
            const routineEl = document.getElementById('conf-routine');
            const giftsEl = document.getElementById('conf-gifts');

            if(passEl) passEl.value = s.password || ""; 
            if(lateEl) lateEl.value = s.lateTime || "08:40"; 
            if(closeEl) closeEl.value = s.closeTime || "09:00"; 
            if(routineEl) routineEl.value = s.routineText || ""; 
            if(giftsEl) giftsEl.value = s.giftList?.join('\n') || ""; 
        }
        const guide = document.getElementById('checkin-guide');
        if(guide) guide.innerText = `✅ 정상: ~${s.lateTime || '08:40'} | ⚠️ 지각: ${s.closeTime || '09:00'} 마감`;
        
        window.currentDefaultBg = s.defaultBg || "";
    });

    if (typeof generateNewLayout === 'function') generateNewLayout();

    if (typeof renderPointGuide === 'function') renderPointGuide();
    if (typeof initPointsTabListeners === 'function') initPointsTabListeners();
    if (typeof loadOrderRecords === 'function') loadOrderRecords();

    db.ref('users').on('value', snap => {
        let users = []; 
        snap.forEach(c => { let u = c.val(); u.name = c.key; users.push(u); });
        currentUsers = users.sort((a, b) => (a.name === myName ? -1 : b.name === myName ? 1 : (a.no || 99) - (b.no || 99)));
        
        let h = ""; 
        currentUsers.forEach(u => { 
            if(u.name === "총사령관") return; 
            const isMe = (u.name === myName);
            const title = u.selectedAnimal ? `${u.selectedAnimal} ` : "";
            
            const pointDisplay = (isMe || isAdmin) ? `<span style="color:var(--primary); font-weight:bold; font-size:1.1rem;">${u.points || 0}P</span>` : '';
            h += `<div class="hero-card" onclick="openUserHistory('${u.name}')" style="${isMe ? 'border: 4px solid var(--gold); background: #fffdf2;' : ''}">
                    <span>${getAvatar(u.lv || 1, u.selectedAnimal)}</span><br>
                    <b style="font-size:1.3rem; display:block; margin-top:12px; color:var(--dark);">
                        ${isMe ? '⭐ ' : ''}${title}LV.${u.lv || 1} ${u.name}
                    </b>
                    ${pointDisplay}
                </div>`; 
        }); 
        const heroGrid = document.getElementById('hero-grid');
        if(heroGrid) heroGrid.innerHTML = h;
        
        if (isAdmin && typeof renderAdminList === 'function') renderAdminList(); 
        if (typeof generateNewLayout === 'function') generateNewLayout();   
    });
}

window.openMultiPopup = function(title, points, reason) {
    if (typeof openBulkPointPopup === 'function') {
        openBulkPointPopup(reason || title, points);
    } else {
        alert("일괄 지급 팝업 함수를 찾을 수 없습니다.");
    }
};
/* 사이드바 메뉴 버튼 활성화(active) 되었을 때 스타일 */
.sidebar-menu button.active {
    background: #2c3e50 !important;
    color: white !important;
    border-left: 6px solid #e74c3c !important;
}
