// js/settings.js
// 학급 운영 설정(좌석 배치) 및 학생 관리(역할/번호/제명) 통합 관리

window.initSettings = function() {
    renderStudentAdminList();
};

// 1. 학생 역할 변경 저장
window.updateUserRole = function(userName, newRole) {
    db.ref('users').orderByChild('name').equalTo(userName).once('value').then(snapshot => {
        snapshot.forEach(childSnap => {
            db.ref(`users/${childSnap.key}`).update({
                role: newRole,
                isHelper: (newRole === '상점')
            }).then(() => {
                renderStudentAdminList();
            });
        });
    });
};

// 2. 학생 번호 변경 저장
window.updateNo = function(userName, newNo) {
    const numVal = parseInt(newNo) || 0;
    db.ref('users').orderByChild('name').equalTo(userName).once('value').then(snapshot => {
        snapshot.forEach(childSnap => {
            db.ref(`users/${childSnap.key}`).update({ number: numVal, no: numVal });
        });
    });
};

// 3. 설정 탭 학생 명단 렌더링
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
                    <button onclick="if(confirm('${u.name} 제명?')) { db.ref('users').orderByChild('name').equalTo('${u.name}').once('value').then(s => { s.forEach(cs => cs.ref.remove()); renderStudentAdminList(); }); }" style="background:var(--red); color:white; border:none; padding:10px; border-radius:8px;">제거</button>
                </div>`;
        });
        adminListEl.innerHTML = h || "등록된 용사가 없습니다.";
    });
};

// 4. 좌석 설정 팝업 호출
window.openSeatingSettings = function() {
    if (!isAdmin) return alert("선생님만 가능합니다.");
    let content = `<h3>🪑 좌석 배치 설정 (이름 입력)</h3>
                   <textarea id="input-seating" style="width:100%; height:200px; box-sizing:border-box; font-size:1.2rem;"></textarea>
                   <button onclick="saveSeatingLayout()" style="width:100%; padding:15px; background:var(--primary); color:white; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; margin-top:10px;">저장</button>`;
    openPopup("좌석 배치", content);
};

window.saveSeatingLayout = function() {
    const names = document.getElementById('input-seating').value.split('\n').filter(n => n.trim());
    const seatArray = names.map((name, index) => ({ seatNo: index + 1, name: name.trim() }));
    db.ref('classManagement/seatingLayout').set(seatArray).then(() => {
        alert("✅ 좌석 배치 저장 완료!");
        closePopup();
    });
};
