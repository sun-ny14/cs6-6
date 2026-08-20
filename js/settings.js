// js/settings.js - Firebase 연결 및 학생 관리 통합
window.initSettings = function() {
    // 1. 학생 명단 관리 렌더링
    renderStudentAdminList();
    
    // 2. 다른 설정들도 여기서 초기화 가능 (좌석 등)
    renderSeatingPreview(); 
};

// 학생 명단 렌더링 (Firebase 연결)
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

        let h = "";
        currentUsers.forEach(u => {
            if (u.name === "총사령관") return;
            let currentRole = u.role || (u.isHelper ? '상점' : '일반');
            let roleColor = (currentRole === '상점') ? '#3498db' : (currentRole === '청소') ? '#27ae60' : '#95a5a6';

            h += `
                <div class="list-item" style="padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:10px;">
                    <input type="number" value="${u.number || u.no || ''}" onchange="updateNo('${u.name}', this.value)" style="width:70px; height:45px; text-align:center; font-size:1.5rem; border:2px solid var(--primary); border-radius:8px;">
                    <strong style="font-size:1.4rem; flex:1;">${u.name}</strong>
                    <select onchange="updateUserRole('${u.name}', this.value)" style="height:45px; background:${roleColor}; color:white; border-radius:8px; font-weight:bold;">
                        <option value="일반" ${currentRole === '일반' ? 'selected' : ''}>👤 일반</option>
                        <option value="상점" ${currentRole === '상점' ? 'selected' : ''}>🛍️ 상점</option>
                        <option value="청소" ${currentRole === '청소' ? 'selected' : ''}>🧹 청소</option>
                    </select>
                    <button onclick="deleteStudent('${u.name}')" style="background:var(--red); color:white; border:none; padding:10px; border-radius:8px;">제거</button>
                </div>`;
        });
        adminListEl.innerHTML = h || "등록된 용사가 없습니다.";
    });
};

// 좌석 설정 팝업 호출 (이 버튼이 설정 탭에 있어야 합니다)
window.openSeatingSettings = function() {
    if (!isAdmin) return alert("선생님만 가능합니다.");
    let content = `<h3>🪑 좌석 배치 설정 (이름 입력)</h3>
                   <textarea id="input-seating" style="width:100%; height:200px;"></textarea>
                   <button onclick="saveSeatingLayout()" style="width:100%; padding:15px; background:var(--primary); color:white; border:none; border-radius:8px;">저장</button>`;
    openPopup("좌석 배치", content);
};

window.saveSeatingLayout = function() {
    const names = document.getElementById('input-seating').value.split('\n').filter(n => n.trim());
    const seatArray = names.map((name, index) => ({ seatNo: index + 1, name: name.trim() }));
    db.ref('classManagement/seatingLayout').set(seatArray).then(() => {
        alert("✅ 좌석 배치 저장 완료!");
        closePopup();
        renderSeatingPreview(); // 저장 후 즉시 반영
    });
};

// 좌석 배치 미리보기 렌더링
window.renderSeatingPreview = function() {
    const seatContainer = document.getElementById('seating-preview'); // HTML에 이 div가 있어야 합니다!
    if (!seatContainer) return;
    db.ref('classManagement/seatingLayout').once('value').then(snap => {
        const seats = snap.val() || [];
        seatContainer.innerHTML = seats.map(s => `<div style="display:inline-block; border:1px solid #ccc; padding:10px; margin:5px;">${s.name}</div>`).join('');
    });
};
