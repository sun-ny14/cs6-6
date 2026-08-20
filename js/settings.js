// js/settings.js (학급 운영 모든 설정 통합)
window.initSettings = function() {
    renderStudentAdminList();
    // 기존 시스템 설정 불러오기 (이미 global.js나 다른 곳에서 처리 중이라면 생략 가능)
};

// --- [학생 명단 및 좌석 관리] ---
window.updateUserRole = function(name, role) {
    db.ref('users').orderByChild('name').equalTo(name).once('value').then(s => {
        s.forEach(cs => cs.ref.update({role: role, isHelper: (role === '상점')}));
    });
};

window.updateNo = function(name, no) {
    db.ref('users').orderByChild('name').equalTo(name).once('value').then(s => {
        s.forEach(cs => cs.ref.update({number: parseInt(no), no: parseInt(no)}));
    });
};

// js/settings.js - 학생 명단 렌더링 (가독성 및 크기 대폭 개선)
window.renderStudentAdminList = function() {
    const el = document.getElementById('student-admin-list');
    if(!el) return;
    
    db.ref('users').once('value').then(snap => {
        let users = []; 
        snap.forEach(c => users.push(c.val()));
        users.sort((a, b) => (a.number || 999) - (b.number || 999));
        
        let h = "";
        users.forEach(u => {
            if(u.name === "총사령관" || u.email === adminEmail) return;
            
            let currentRole = u.role || (u.isHelper ? '상점' : '일반');
            let roleColor = (currentRole === '상점') ? '#3498db' : (currentRole === '청소' ? '#27ae60' : '#95a5a6');

            h += `
                <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; background:white; border-bottom:1px solid #eee; border-radius:10px; margin-bottom:8px;">
                    <!-- 번호 입력창 (두 자리 숫자가 잘리지 않도록 널찍하게 수정) -->
                    <input type="number" value="${u.number || u.no || ''}" onchange="updateNo('${u.name}', this.value)" 
                           style="width:80px; height:55px; text-align:center; font-size:1.5rem; border:2px solid #3498db; border-radius:8px; font-weight:bold; box-sizing:border-box;">
                    
                    <!-- 이름 (시원한 크기) -->
                    <strong style="flex:1; font-size:1.5rem; color:#333;">${u.name}</strong>
                    
                    <!-- 역할 선택 버튼 (세로 답답함 해소 및 글씨 잘림 방지) -->
                    <select onchange="updateUserRole('${u.name}', this.value)" 
                            style="width:130px; height:55px; padding:0 10px; font-size:1.3rem; background:${roleColor}; color:white; border-radius:8px; font-weight:bold; border:none; cursor:pointer; box-sizing:border-box;">
                        <option value="일반" ${currentRole === '일반' ? 'selected' : ''} style="color:black; background:white;">일반</option>
                        <option value="상점" ${currentRole === '상점' ? 'selected' : ''} style="color:black; background:white;">상점</option>
                        <option value="청소" ${currentRole === '청소' ? 'selected' : ''} style="color:black; background:white;">청소</option>
                    </select>
                    
                    <!-- 제거 버튼 -->
                    <button onclick="if(confirm('${u.name} 용사를 제명하시겠습니까?')) { db.ref('users').orderByChild('name').equalTo('${u.name}').once('value').then(s=>s.forEach(c=>c.ref.remove())); renderStudentAdminList(); }" 
                            style="width:45px; height:55px; background:#e74c3c; color:white; border:none; border-radius:8px; font-size:1.2rem; font-weight:bold; cursor:pointer;">×</button>
                </div>`;
        });
        el.innerHTML = h;
    });
};

window.generateSeatInputs = function() {
    const cols = parseInt(document.getElementById('seat-cols').value) || 5;
    const rows = parseInt(document.getElementById('seat-rows').value) || 6;
    let html = `<table style="width:100%; border-collapse:collapse; margin-top:10px;">`;
    for(let r=0; r<rows; r++) {
        html += `<tr>`;
        for(let c=0; c<cols; c++) {
            html += `<td style="padding:5px;"><input type="text" class="seat-name" data-r="${r}" data-c="${c}" style="width:100%; padding:8px; box-sizing:border-box;"></td>`;
        }
        html += `</tr>`;
    }
    html += `</table>`;
    document.getElementById('seat-input-container').innerHTML = html;
};

window.saveSeatingLayout = function() {
    const inputs = document.querySelectorAll('.seat-name');
    let layout = [];
    inputs.forEach(input => {
        const r = parseInt(input.dataset.r); const c = parseInt(input.dataset.c);
        if(!layout[r]) layout[r] = [];
        layout[r][c] = { name: input.value.trim(), row: r, col: c };
    });
    db.ref('classManagement/seatingLayout').set({ rows: document.getElementById('seat-rows').value, cols: document.getElementById('seat-cols').value, data: layout })
    .then(() => alert("✅ 좌석 배치가 저장되었습니다!"));
};

// --- [기존 시스템 설정 유지] ---
window.saveSettings = function() {
    db.ref('settings').update({
        password: document.getElementById('conf-pass').value,
        lateTime: document.getElementById('conf-late').value,
        closeTime: document.getElementById('conf-close').value,
        routineText: document.getElementById('conf-routine').value
    }).then(() => alert("✅ 시스템 설정 저장 완료!"));
};

window.saveGifts = function() {
    const gifts = document.getElementById('conf-gifts').value.split('\n');
    db.ref('settings').update({ giftList: gifts }).then(() => alert("✅ 보상 저장 완료!"));
};

window.bulkReg = function() {
    const data = document.getElementById('bulk-in').value.split('\n');
    data.forEach(line => {
        const [name, email] = line.split(',');
        if(name && email) db.ref('users').push({ name: name.trim(), email: email.trim(), points: 0, level: 1 });
    });
    alert("✅ 학생 일괄 등록 완료!");
};
