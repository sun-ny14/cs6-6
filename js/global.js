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
    
    document.querySelectorAll('.tab-content').forEach(s => {
        s.classList.remove('active');
        s.style.display = ''; 
    }); 
    
    document.querySelectorAll('.tab-menu button').forEach(b => b.classList.remove('active')); 
    document.getElementById('tab-'+t).classList.add('active'); 
    if(document.getElementById('btn-'+t)) document.getElementById('btn-'+t).classList.add('active'); 
    
    if(t==='points') loadMyLogs(); 
    if(t==='logs') renderCheckinBoard(); 
}

function openPopup(t,h,r=false) { 
    document.getElementById('pop-title').innerHTML=t; 
    document.getElementById('pop-content').innerHTML=h; 
    document.getElementById('common-overlay').style.display='flex'; 
    window.routineActive=r; 
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
// 등교 탭 내부 서브 메뉴 전환 (등교하기 <-> 등교로그 및 좌석)
function switchCheckinSub(subId) {
    document.getElementById('sub-checkin-main').style.display = (subId === 'checkin-main') ? 'block' : 'none';
    document.getElementById('sub-checkin-logs').style.display = (subId === 'checkin-logs') ? 'block' : 'none';
    
    document.getElementById('sub-btn-checkin-main').style.background = (subId === 'checkin-main') ? 'var(--dark)' : '#ddd';
    document.getElementById('sub-btn-checkin-main').style.color = (subId === 'checkin-main') ? 'white' : '#333';
    
    document.getElementById('sub-btn-checkin-logs').style.background = (subId === 'checkin-logs') ? 'var(--dark)' : '#ddd';
    document.getElementById('sub-btn-checkin-logs').style.color = (subId === 'checkin-logs') ? 'white' : '#333';
    
    if (subId === 'checkin-logs') {
        generateNewLayout();
    }
}

// 학급관리 탭 내부 서브 메뉴 전환 (성적 관리 <-> 학급 운영비)
function renderManagementSub(type) {
    const container = document.getElementById('management-sub-container');
    const btnGrades = document.getElementById('sub-btn-grades');
    const btnBudget = document.getElementById('sub-btn-budget');
    
    if (type === 'grades') {
        btnGrades.style.background = 'var(--primary)'; btnGrades.style.color = 'white';
        btnBudget.style.background = '#ddd'; btnBudget.style.color = '#333';
        
        container.innerHTML = `
            <div class="card">
                <h2>📝 성적 및 평가 관리</h2>
                <p>학생들의 성적과 수행평가 기록을 관리하는 공간입니다.</p>
                <div style="background:#f8f9fa; padding:15px; border-radius:12px; margin-top:15px;">
                    <p style="margin:0; color:#666;">등록된 성적 데이터를 불러오는 중...</p>
                </div>
            </div>
        `;
    } else if (type === 'budget') {
        btnBudget.style.background = 'var(--primary)'; btnBudget.style.color = 'white';
        btnGrades.style.background = '#ddd'; btnGrades.style.color = '#333';
        
        container.innerHTML = `
            <div style="background:white; padding:20px; border-radius:20px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                <h2 style="margin-top:0;">💵 학급운영비 현황</h2>
                <div id="budget-summary" style="font-size:1.2rem; margin-bottom:20px; padding:15px; background:var(--gold); border-radius:12px; font-weight:bold;">
                    잔액 계산 중...
                </div>
                <button onclick="openAddBudgetPopup()" style="width:100%; background:var(--primary); color:white; margin-bottom:15px; padding:15px; font-size:1.1rem; font-weight:bold; border-radius:10px; border:none;">+ 내역 추가하기</button>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; min-width:500px; text-align:center;">
                        <thead>
                            <tr style="border-bottom:2px solid #eee; background:#f8f9fa;">
                                <th style="padding:15px 10px;">날짜</th>
                                <th style="padding:15px 10px;">쇼핑몰/처</th>
                                <th style="padding:15px 10px;">용도</th>
                                <th style="padding:15px 10px;">금액</th>
                                <th style="padding:15px 10px;">관리</th>
                            </tr>
                        </thead>
                        <tbody id="budget-list"></tbody>
                    </table>
                </div>
            </div>
        `;
    }
}
function startApp() {
    // 1. 관리자/도우미 UI 제어
    if (isAdmin || isHelper || myName === "총사령관") { 
        const orderMgr = document.getElementById('admin-order-mgr'); 
        if (orderMgr) orderMgr.style.display = 'block'; 
        
        // 전자칠판 관리 탭 버튼 표시
        const bbAdminBtn = document.getElementById('btn-blackboard-admin');
        if (bbAdminBtn) bbAdminBtn.style.display = 'inline-block';
    }

    // 💡 2. 역할별 탭 제어
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

    window.isHousingEnabled = true;

    // 3. 시스템 설정 불러오기
    db.ref('settings').on('value', snap => {
        const s = snap.val() || {}; 
        giftList = s.giftList || []; 
        routineItems = s.routineText?.split('\n').filter(t => t.trim()) || [];
        
        if (isAdmin) { 
            document.getElementById('conf-pass').value = s.password || ""; 
            document.getElementById('conf-late').value = s.lateTime || "08:40"; 
            document.getElementById('conf-close').value = s.closeTime || "09:00"; 
            document.getElementById('conf-routine').value = s.routineText || ""; 
            document.getElementById('conf-gifts').value = s.giftList?.join('\n') || ""; 
        }
        const guide = document.getElementById('checkin-guide');
        if(guide) guide.innerText = `✅ 정상: ~${s.lateTime || '08:40'} | ⚠️ 지각: ${s.closeTime || '09:00'} 마감`;
        
        window.currentDefaultBg = s.defaultBg || "";
    });

    generateNewLayout();

    // 4. 유저 목록 불러오기 및 카드 렌더링
    db.ref('users').on('value', snap => {
        let users = []; 
        snap.forEach(c => { let u = c.val(); u.name = c.key; users.push(u); });
        currentUsers = users.sort((a, b) => (a.name === myName ? -1 : b.name === myName ? 1 : (a.no || 99) - (b.no || 99)));
        
        let h = ""; 
        currentUsers.forEach(u => { 
            if(u.name === "총사령관") return; 
            const isMe = (u.name === myName);
            const title = u.selectedAnimal ? `${u.selectedAnimal} ` : "";
            
            h += `<div class="hero-card" onclick="openUserHistory('${u.name}')" style="${isMe ? 'border: 4px solid var(--gold); background: #fffdf2;' : ''}">
                    <span>${getAvatar(u.lv || 1, u.selectedAnimal)}</span><br>
                    <b style="font-size:1.3rem; display:block; margin-top:12px; color:var(--dark);">
                        ${isMe ? '⭐ ' : ''}${title}LV.${u.lv || 1} ${u.name}
                    </b>
                    ${(isMe || isAdmin) ? `<span style="color:var(--primary); font-weight:bold; font-size:1.1rem;">${u.points || 0}P</span>` : ''}
                </div>`; 
        }); 
        const heroGrid = document.getElementById('hero-grid');
        if(heroGrid) heroGrid.innerHTML = h;
        
        if (isAdmin) renderAdminList(); // 기존에 구현하셨던 관리자 리스트 함수
        generateNewLayout();   
    });
}
// js/global.js 에 추가 또는 수정
if (typeof window.loadMyLogs === 'undefined') {
    window.loadMyLogs = function() {
        // 기록 로드 관련 함수 (에러 방지용 빈 함수)
    };
}
