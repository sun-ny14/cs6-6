// js/main.js - 앱 전역 공통 코어 함수, 점수/경험치/레벨업 관리, 앱 초기화(startApp) 및 제어 통합 로직

// ==========================================
// 1. 점수, 경험치, 레벨업 및 로그 관리
// ==========================================

window.addScore = function(n, p, e, r) {
    const studentName = n.trim(); 
    db.ref('users/' + studentName).once('value', sn => {
        const u = sn.val();
        if (!u) return;

        let nP = (u.points || 0) + p;
        let nE = (u.exp || 0) + e;
        let nL = (u.lv || 1);
        let up = false;

        while (nE >= 100) {
            nL++;
            nE -= 100;
            up = true;
        }

        db.ref('users/' + studentName).update({
            points: nP,
            exp: nE,
            lv: nL
        }).then(() => {
            if (r !== "정상 등교" && typeof getTodayKST === 'function') {
                db.ref('pointLogs').push({
                    name: studentName,
                    amount: p, 
                    reason: r,
                    time: new Date().toLocaleString(),
                    date: getTodayKST()
                });
            }
            if (up && typeof triggerLevelUpRoulette === 'function') {
                triggerLevelUpRoulette(studentName, nL);
            }
        });
    });
};

window.triggerLevelUpRoulette = function(n, l) {
    if (typeof giftList === 'undefined' || !giftList.length) return;
    
    const pick = giftList[Math.floor(Math.random() * giftList.length)];
    
    db.ref('orders').push({
        user: n, 
        item: `[레벨업] ${pick}`, 
        status: '대기', 
        time: new Date().toLocaleString()
    });
    
    if (typeof myName !== 'undefined' && n === myName && typeof openPopup === 'function') {
        openPopup("🎉 LEVEL UP!", `LV.${l} 달성! 획득한 보상: <b>${pick}</b><br><small>인벤토리 및 상점에서 확인하세요!</small>`);
    }
};

window.loadMyLogs = function() {
    const listEl = document.getElementById('point-history-list');
    if (!listEl) return;

    let query = isAdmin ? db.ref('pointLogs') : db.ref('pointLogs').orderByChild('name').equalTo(myName);
    
    query.once('value', snap => {
        let logs = [];
        snap.forEach(l => { logs.push(l.val()); });
        logs.reverse();

        let html = isAdmin ? `<div style="background:#444; color:white; padding:8px; text-align:center; border-radius:5px; margin-bottom:10px;">🛡️ 관리자 모드</div>` : "";
        
        if (logs.length === 0) {
            html += `<div style="text-align:center; padding:20px; color:#999;">기록이 없습니다.</div>`;
        } else {
            logs.slice(0, 50).forEach(l => {
                const color = l.amount >= 0 ? "var(--green, #2ecc71)" : "var(--red, #e74c3c)";
                const sign = l.amount >= 0 ? "+" : "";
                html += `
                    <div class="list-item" style="border-left:8px solid ${color}; margin-bottom:8px; background:white; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <span>
                            <b style="font-size:1.1rem;">${isAdmin ? '['+l.name+'] ' : ''}${l.reason}</b><br>
                            <small style="color:#888;">${l.time}</small>
                        </span>
                        <strong style="color:${color}; font-size:1.2rem;">${sign}${l.amount}P</strong>
                    </div>`;
            });
        }
        listEl.innerHTML = html;
    });
};


// ==========================================
// 2. 앱 실행 및 초기화 제어 (startApp) - ⚡ 리스너 최적화 적용
// ==========================================

window.startApp = function() {
    // 관리자 또는 도우미 권한일 경우 주문 관리 매니저 표시
    if (isAdmin || isHelper || myName === "총사령관") { 
        const orderMgr = document.getElementById('admin-order-mgr'); 
        if (orderMgr) orderMgr.style.display = 'block'; 
    }
    
    // 💡 1. 선생님 로그인 시: 등교 탭 숨기고 청소 탭 보이기
    if (myName === "총사령관") {
        const checkinTabBtn = document.getElementById('btn-checkin');
        if (checkinTabBtn) checkinTabBtn.style.display = 'none';
        
        const cleaningTabBtn = document.getElementById('btn-cleaning');
        if (cleaningTabBtn) cleaningTabBtn.style.display = 'inline-block';
    } 
    // 💡 2. 학생 로그인 시: 내 역할이 '청소'일 때만 청소 탭 보이기
    else {
        if (typeof currentUser !== 'undefined' && currentUser.role === '청소') {
            const cleaningTabBtn = document.getElementById('btn-cleaning');
            if (cleaningTabBtn) cleaningTabBtn.style.display = 'inline-block';
        }
    }

    window.isHousingEnabled = true;

    // 1. 핵심 시스템 설정 (once로 변경하여 과도한 대역폭 소모 방지)
    db.ref('settings').once('value').then(snap => {
        const s = snap.val() || {}; 
        giftList = s.giftList || []; 
        routineItems = s.routineText?.split('\n').filter(t => t.trim()) || [];
        
        if (isAdmin) { 
            const cp = document.getElementById('conf-pass'); if(cp) cp.value = s.password || ""; 
            const cl = document.getElementById('conf-late'); if(cl) cl.value = s.lateTime || "08:40"; 
            const cc = document.getElementById('conf-close'); if(cc) cc.value = s.closeTime || "09:00"; 
            const cr = document.getElementById('conf-routine'); if(cr) cr.value = s.routineText || ""; 
            const cg = document.getElementById('conf-gifts'); if(cg) cg.value = s.giftList?.join('\n') || ""; 
        }
        const cgGuide = document.getElementById('checkin-guide');
        if (cgGuide) cgGuide.innerText = `✅ 정상: ~${s.lateTime || '08:40'} | ⚠️ 지각: ${s.closeTime || '09:00'} 마감`;
    });
    
    if (typeof generateNewLayout === 'function') generateNewLayout();

    // 2. 유저 목록 불러오기 및 메인 그리드 렌더링 (once 적용 및 이메일/데이터 안전 유지)
    db.ref('users').once('value').then(snap => {
        let users = []; 
        snap.forEach(c => { 
            let u = c.val() || {}; 
            u.name = c.key; 
            users.push(u); 
        });
        
        currentUsers = users.sort((a, b) => (a.name === myName ? -1 : b.name === myName ? 1 : (a.no || 99) - (b.no || 99)));
        
        let h = ""; 
        currentUsers.forEach(u => { 
            if (u.name === "총사령관") return; 
            const isMe = (u.name === myName);
            const title = u.selectedAnimal ? `${u.selectedAnimal} ` : "";
            const avatarHtml = (typeof window.getAvatar === 'function') ? window.getAvatar(u.lv || 1, u.selectedAnimal) : `<div style="width:85px; height:85px; background:#ddd; margin:0 auto; border-radius:20px;"></div>`;
            
            h += `<div class="hero-card" onclick="openUserHistory('${u.name}')" style="${isMe ? 'border: 4px solid var(--gold); background: #fffdf2;' : ''}">
                    <span>${avatarHtml}</span><br>
                    <b style="font-size:1.3rem; display:block; margin-top:12px; color:var(--dark);">
                        ${isMe ? '⭐ ' : ''}${title}LV.${u.lv || 1} ${u.name}
                    </b>
                    <span style="color:var(--primary); font-weight:bold; font-size:1.1rem; display:block; margin-top:5px;">${u.points || 0}P</span>
                  </div>`; 
        }); 
        
        const gridEl = document.getElementById('hero-grid');
        if (gridEl) {
            gridEl.innerHTML = h || '<p style="text-align:center; grid-column:1/-1;">등록된 용사가 없습니다.</p>';
        }
        
        if (isAdmin && typeof renderAdminList === 'function') renderAdminList();
        if (typeof generateNewLayout === 'function') generateNewLayout();    
    });

    // 3. 용사의 방 온오프 상태 관리 (once 적용)
    db.ref('settings/housingEnabled').once('value').then(snap => {
        window.isHousingEnabled = snap.val() !== false; 
        
        const adminPanel = document.getElementById('admin-housing-control');
        if (adminPanel) adminPanel.style.display = isAdmin ? 'block' : 'none';

        const housingTabBtn = document.getElementById('btn-housing'); 
        const housingTabContent = document.getElementById('tab-housing'); 
        
        if (!isAdmin && !window.isHousingEnabled) {
            if (housingTabBtn) housingTabBtn.style.display = 'none';
            if (housingTabContent) housingTabContent.style.display = 'none';

            if (currentTab === 'housing') {
                showTab('main');
                alert("🚧 총사령관님이 용사의 방을 임시로 닫았습니다. 메인 화면으로 이동합니다.");
            }
        } else {
            if (housingTabBtn) housingTabBtn.style.display = ''; 
            if (housingTabContent) housingTabContent.style.display = ''; 
        }
        
        const statusText = document.getElementById('housing-current-status');
        const toggleBtn = document.getElementById('housing-toggle-btn');
        if (statusText && toggleBtn) {
            statusText.innerText = window.isHousingEnabled ? "켜짐 (ON)" : "꺼짐 (OFF)";
            statusText.style.color = window.isHousingEnabled ? "#2ecc71" : "#e74c3c";
            toggleBtn.innerText = window.isHousingEnabled ? "끄기(OFF)로 변경하기" : "켜기(ON)으로 변경하기";
            toggleBtn.style.backgroundColor = window.isHousingEnabled ? "#e74c3c" : "#2ecc71";
        }
    });
};


// ==========================================
// 3. 화면, 인증, 탭 및 유틸리티 제어
// ==========================================

window.getTodayKST = function() { 
    const now = new Date(); 
    const krTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); 
    return krTime.getUTCFullYear() + "-" + String(krTime.getUTCMonth() + 1).padStart(2, '0') + "-" + String(krTime.getUTCDate()).padStart(2, '0'); 
};

window.forceScreenDisplay = function(status) {
    const load = document.getElementById('loading-screen');
    const login = document.getElementById('login-screen');
    const app = document.getElementById('main-app');
    
    if (load) load.style.display = 'none';
    if (status === 'app') { 
        if (login) login.style.display = 'none'; 
        if (app) app.style.display = 'block'; 
    } else { 
        if (login) login.style.display = 'flex'; 
        if (app) app.style.display = 'none'; 
    }
};

window.handleLogin = function() { 
    auth.signInWithPopup(provider); 
};

window.showTab = function(t) { 
    currentTab = t; 
    sessionStorage.setItem('activeTab', t); 
    
    document.querySelectorAll('.tab-content').forEach(s => {
        s.classList.remove('active');
        s.style.display = ''; 
    }); 
    
    document.querySelectorAll('.tab-menu button, .sidebar-menu button').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById('tab-' + t);
    const targetBtn = document.getElementById('btn-' + t);
    
    if (targetTab) targetTab.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    
    if (t === 'points') loadMyLogs(); 
    if (t === 'logs' && typeof renderCheckinBoard === 'function') renderCheckinBoard(); 
};

window.openPopup = function(t, h, r = false) { 
    document.getElementById('pop-title').innerHTML = t; 
    document.getElementById('pop-content').innerHTML = h; 
    document.getElementById('common-overlay').style.display = 'flex'; 
    window.routineActive = r; 
};

window.closePopup = function() { 
    if (window.routineActive && typeof routineItems !== 'undefined' && ++rIdx < routineItems.length) {
        document.getElementById('pop-content').innerText = `[루틴 ${rIdx+1}단계]\n${routineItems[rIdx]}`; 
    } else { 
        document.getElementById('common-overlay').style.display = 'none'; 
        rIdx = 0; 
    } 
};

window.closePointPopup = function() { 
    document.getElementById('point-popup').style.display = 'none'; 
};

window.closeMultiPopup = function() { 
    document.getElementById('multi-popup').style.display = 'none'; 
};


// ==========================================
// 4. 육육이(아바타) 및 좌석 데이터 연동 시스템
// ==========================================

window.getAvatar = function(lv, selectedAnimal) {
    const githubImageUrl = "https://github.com/sun-ny14/cs6-6/blob/main/%EC%9C%A1%EC%9C%A1%EC%9D%B4.png?raw=true"; 
    const animals = ["귀여운", "신사", "사랑스러운", "패셔니스타", "밥먹는", "날쌘돌이", "즐거운", "행복한", "정의로운", "천사", "닌자", "왕자", "공주", "근육맨", "마법사", "용사", "공부하는", "춤추는", "노래하는", "무지개"];
    
    const name = selectedAnimal || animals[Math.min(lv - 1, 19)];
    const index = animals.indexOf(name) === -1 ? 0 : animals.indexOf(name);
    
    const col = index % 5;
    const row = Math.floor(index / 5);
    
    const posX = col * 25; 
    const posY = row * 33.33; 

    return `
    <div style="width: 85px; height: 85px; overflow: hidden; border: 2px solid #eee; border-radius: 20px; background: white; margin: 0 auto; display: flex; align-items: center; justify-content: center; position: relative;">
        <div style="
            width: 100%; 
            height: 100%; 
            background-image: url('${githubImageUrl}'); 
            background-size: 500% 400%; 
            background-position: ${posX}% ${posY}%; 
            background-repeat: no-repeat;
            image-rendering: pixelated;
            transform: scale(1.15);
            transform-origin: center;
        "></div>
    </div>`;
};

window.openAvatarPicker = function() {
    const animals = ["귀여운", "신사", "사랑스러운", "패셔니스타", "밥먹는", "날쌘돌이", "즐거운", "행복한", "정의로운", "천사", "닌자", "왕자", "공주", "근육맨", "마법사", "용사", "공부하는", "춤추는", "노래하는", "무지개"];
    db.ref('users/' + myName).once('value', snap => {
        const lv = snap.val()?.lv || 1;
        const availableCount = Math.min(lv, 20);
        let h = `<p style="text-align:center; font-weight:bold; color:var(--primary); margin-bottom:15px;">✨ 레벨이 오를수록 새로운 칭호가 해금됩니다!</p>`;
        h += `<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; padding:10px;">`;
        for (let i = 0; i < 20; i++) {
            if (i < availableCount) {
                h += `<div onclick="selectAnimal('${animals[i]}')" style="cursor:pointer; text-align:center; border:2px solid var(--gold); border-radius:15px; padding:10px; background:#fffdf2; box-shadow:0 3px 6px rgba(0,0,0,0.1);">
                        ${window.getAvatar(i + 1, animals[i])}
                        <div style="font-size:0.8rem; font-weight:bold; margin-top:8px; color:var(--dark);">${animals[i]}</div>
                      </div>`;
            } else {
                h += `<div style="text-align:center; border:1px solid #eee; border-radius:15px; padding:10px; background:#f5f5f5; opacity: 0.6;">
                        <div style="width: 85px; height: 85px; display:flex; align-items:center; justify-content:center; margin: 0 auto; font-size:1.8rem; background:#ddd; border-radius:15px;">🔒</div>
                        <div style="font-size:0.7rem; color:#888; margin-top:8px;">LV.${i+1} 해금<br>(${animals[i]})</div>
                      </div>`;
            }
        }
        openPopup("🎭 육육이 전직 본부", h + `</div>`);
    });
}; 

window.selectAnimal = function(animalName) { 
    if (confirm(`${animalName}(으)로 변신하시겠습니까?`)) { 
        db.ref('users/' + myName).update({ selectedAnimal: animalName }).then(() => { 
            alert("변신 완료! ✨"); 
            closePopup(); 
        }); 
    } 
};

window.generateNewLayout = function() {
    db.ref('seatLayoutData').once('value', snap => {
        const savedData = snap.val();
        
        if (savedData && savedData.layout) {
            currentLayout = savedData.layout;
            const rows = savedData.config.rows;
            const cols = savedData.config.cols;
            
            const rowsInput = document.getElementById('seat-rows');
            const colsInput = document.getElementById('seat-cols');
            if (rowsInput) rowsInput.value = rows;
            if (colsInput) colsInput.value = cols;
            
            if (typeof renderSeatMap === 'function') {
                renderSeatMap(rows, cols);
            }
        } else {
            const rowsEl = document.getElementById('seat-rows');
            const colsEl = document.getElementById('seat-cols');
            const rows = rowsEl ? rowsEl.value || 6 : 6;
            const cols = colsEl ? colsEl.value || 5 : 5;
            if (typeof renderSeatMap === 'function') {
                renderSeatMap(parseInt(rows), parseInt(cols));
            }
        }
    });
};