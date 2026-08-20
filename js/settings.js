// js/settings.js - 학생 명단 및 좌석 배치 통합 관리
window.initSettings = function() {
    renderStudentAdminList();
};

// 1. 학생 명단 및 좌석 설정 통합 렌더링
window.renderStudentAdminList = function() {
    const adminListEl = document.getElementById('student-admin-list');
    if (!adminListEl) return;

    db.ref('users').once('value').then((snapshot) => {
        let currentUsers = [];
        snapshot.forEach(childSnap => {
            let u = childSnap.val();
            if (u && u.email !== adminEmail) currentUsers.push(u);
        });
        currentUsers.sort((a, b) => (a.number || a.no || 999) - (b.number || b.no || 999));

        // [좌석 설정 및 명단 헤더]
        let h = `
            <div style="background:#fff; padding:25px; border-radius:15px; margin-bottom:30px; border:2px solid var(--primary);">
                <h3 style="margin-top:0;">🪑 좌석 배치 관리</h3>
                <button onclick="openSeatingSettings()" style="width:100%; padding:20px; background:var(--primary); color:white; border:none; border-radius:8px; font-weight:bold; font-size:1.4rem; cursor:pointer;">🪑 좌석 배치 설정하기</button>
            </div>
            <h3 style="margin-bottom:20px;">👥 학생 명단 관리</h3>
        `;

        currentUsers.forEach(u => {
            if (u.name === "총사령관") return;
            let currentRole = u.role || (u.isHelper ? '상점' : '일반');
            let roleColor = (currentRole === '상점') ? '#3498db' : (currentRole === '청소' ? '#27ae60' : '#95a5a6');

            h += `
                <div class="list-item" style="display:flex; align-items:center; gap:15px; padding:15px; background:white; border-bottom:1px solid #eee; border-radius:10px; margin-bottom:10px;">
                    <input type="number" value="${u.number || u.no || ''}" onchange="updateNo('${u.name}', this.value)" style="width:70px; height:60px; text-align:center; font-size:1.8rem; border:2px solid #ddd; border-radius:8px; font-weight:bold;">
                    <strong style="font-size:1.8rem; flex:1; min-width:120px;">${u.name}</strong>
                    <select onchange="updateUserRole('${u.name}', this.value)" style="width:160px; height:60px; padding:0 10px; font-size:1.4rem; background:${roleColor}; color:white; border-radius:8px; font-weight:bold; cursor:pointer;">
                        <option value="일반" ${currentRole === '일반' ? 'selected' : ''}>👤 일반</option>
                        <option value="상점" ${currentRole === '상점' ? 'selected' : ''}>🛍️ 상점</option>
                        <option value="청소" ${currentRole === '청소' ? 'selected' : ''}>🧹 청소</option>
                    </select>
                    <button onclick="if(confirm('${u.name} 제명?')) { db.ref('users').orderByChild('name').equalTo('${u.name}').once('value').then(s => { s.forEach(cs => cs.ref.remove()); renderStudentAdminList(); }); }" 
                            style="width:50px; height:50px; background:#ff4d4d; color:white; border:none; border-radius:50%; font-size:1.2rem; cursor:pointer;">×</button>
                </div>`;
        });
        adminListEl.innerHTML = h;
    });
};

// 2. 좌석 배치 팝업 열기
window.openSeatingSettings = function() {
    let content = `
        <h3 style="margin-top:0;">🪑 좌석 배치 (이름을 엔터로 구분)</h3>
        <textarea id="input-seating" style="width:100%; height:250px; font-size:1.4rem; padding:10px; box-sizing:border-box; border-radius:8px;"></textarea>
        <button onclick="saveSeatingLayout()" style="width:100%; padding:18px; margin-top:15px; background:var(--primary); color:white; border:none; border-radius:8px; font-weight:bold; font-size:1.4rem; cursor:pointer;">좌석 배치 저장</button>
    `;
    openPopup("좌석 배치 설정", content);
};

// 3. 좌석 배치 저장
window.saveSeatingLayout = function() {
    const rawData = document.getElementById('input-seating').value;
    const names = rawData.split('\n').filter(n => n.trim());
    const seatArray = names.map((name, index) => ({ seatNo: index + 1, name: name.trim() }));
    
    db.ref('classManagement/seatingLayout').set(seatArray).then(() => {
        alert("✅ 좌석 배치가 저장되었습니다!");
        closePopup();
    });
};

// 학생 관리 관련 로직 (updateUserRole, updateNo)은 그대로 유지...
