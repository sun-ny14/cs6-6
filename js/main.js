// js/main.js

window.startApp = function() {
    // 1. 권한 판별 변수 설정 (총사령관, 관리자, 도우미 여부)
    window.isMaster = (typeof myName !== 'undefined' && myName === "총사령관");
    window.isAdmin = window.isMaster || (typeof isAdmin !== 'undefined' && isAdmin);
    window.isHelperRole = (typeof myName !== 'undefined' && (myName === "관리자1" || myName === "관리자2" || myName.includes("도우미")));

    // 2. 관리자 또는 주문 승인 도우미일 경우 상점 승인 매니저 표시
    const orderMgr = document.getElementById('admin-order-mgr'); 
    if (orderMgr) {
        orderMgr.style.display = (isAdmin || window.isHelperRole) ? 'block' : 'none'; 
    }

    // 3. 탭 메뉴 권한별 노출 제어 (학생 vs 관리자/도우미)
    const btnCleaning = document.getElementById('btn-cleaning');
    const btnBlackboardAdmin = document.getElementById('btn-blackboard-admin');
    const btnManagement = document.getElementById('btn-management');
    const btnAdmin = document.getElementById('btn-admin');

    if (isAdmin) {
        // 교사(총사령관) 전용 탭 전체 노출
        if (btnCleaning) btnCleaning.style.display = 'inline-block';
        if (btnBlackboardAdmin) btnBlackboardAdmin.style.display = 'inline-block';
        if (btnManagement) btnManagement.style.display = 'inline-block';
        if (btnAdmin) btnAdmin.style.display = 'inline-block';
    } else {
        // 일반 학생 및 일반 도우미: 관리자 전용 탭 숨김
        if (btnCleaning) btnCleaning.style.display = 'none';
        if (btnBlackboardAdmin) btnBlackboardAdmin.style.display = 'none';
        if (btnManagement) btnManagement.style.display = 'none';
        if (btnAdmin) btnAdmin.style.display = 'none';
    } 

    // 4. 관리자 또는 도우미일 경우 등교로그 및 좌석 버튼 노출
    if (isAdmin || window.isHelperRole) {
        document.querySelectorAll('.admin-only-checkin-btn').forEach(el => {
            el.style.display = 'block';
        });
    }

    window.isHousingEnabled = true;

    // 5. 시스템 설정 로딩
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

    // 6. 유저 목록 불러오기 및 메인 그리드 렌더링 (학생용 정보 노출 제한 적용)
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
            
            // 💡 [요구사항 반영] 본인일 때만 포인트 표시, 다른 친구는 캐릭터와 레벨만 표시
            let pointDisplay = "";
            if (isMe || isAdmin) {
                pointDisplay = `<span style="color:var(--primary); font-weight:bold; font-size:1.1rem; display:block; margin-top:5px;">${u.points || 0}P</span>`;
            }

            h += `<div class="hero-card" onclick="openUserHistory('${u.name}')" style="${isMe ? 'border: 4px solid var(--gold); background: #fffdf2;' : ''}">
                    <span>${avatarHtml}</span><br>
                    <b style="font-size:1.3rem; display:block; margin-top:12px; color:var(--dark);">
                        ${isMe ? '⭐ ' : ''}${title}LV.${u.lv || 1} ${u.name}
                    </b>
                    ${pointDisplay}
                  </div>`; 
        }); 
        
        const gridEl = document.getElementById('hero-grid');
        if (gridEl) {
            gridEl.innerHTML = h || '<p style="text-align:center; grid-column:1/-1;">등록된 용사가 없습니다.</p>';
        }
        
        if (isAdmin && typeof renderAdminList === 'function') renderAdminList();
    });

    // 7. 용사의 방 온오프 및 교사 차단 시 탭 숨기기 제어
    db.ref('settings/housingEnabled').once('value').then(snap => {
        window.isHousingEnabled = snap.val() !== false; 
        
        const adminPanel = document.getElementById('admin-housing-control');
        if (adminPanel) adminPanel.style.display = isAdmin ? 'block' : 'none';

        const housingTabBtn = document.getElementById('btn-housing'); 
        const housingTabContent = document.getElementById('tab-housing'); 
        
        // 💡 [요구사항 반영] 교사가 차단했거나 비활성화된 경우 학생에게 탭 자체를 숨김
        if (!isAdmin && !window.isHousingEnabled) {
            if (housingTabBtn) housingTabBtn.style.display = 'none';
            if (housingTabContent) housingTabContent.style.display = 'none';

            if (typeof currentTab !== 'undefined' && currentTab === 'housing') {
                if(typeof showTab === 'function') showTab('main');
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