// js/settings.js - 설정 탭 및 명단 관리 (이메일 확인 기능 추가)

window.initSettings = function() {
    renderStudentAdminList();
};

// 1. 학생 명단 및 역할/번호 관리 렌더링 (이메일 표시 추가)
window.renderStudentAdminList = function() {
    const el = document.getElementById('student-admin-list');
    if (!el) return;
    
    db.ref('users').once('value').then(snap => {
        let users = []; 
        snap.forEach(c => {
            let u = c.val();
            if(u) users.push(u);
        });
        
        users.sort((a, b) => (a.number || a.no || 999) - (b.number || b.no || 999));
        
        let h = "";
        users.forEach(u => {
            if (u.name === "총사령관" || (typeof adminEmail !== 'undefined' && u.email === adminEmail)) return;
            
            let currentRole = u.role || (u.isHelper ? '상점' : '일반');
            let roleColor = (currentRole === '상점') ? '#3498db' : (currentRole === '청소' ? '#27ae60' : '#95a5a6');
            let userEmail = u.email || '이메일 없음';

            h += `
                <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; background:white; border-bottom:1px solid #eee; border-radius:10px; margin-bottom:8px;">
                    <!-- 번호 입력창 -->
                    <input type="number" value="${u.number || u.no || ''}" onchange="updateNo('${u.name}', this.value)" 
                           style="width:80px; height:55px; text-align:center; font-size:1.5rem; border:2px solid #3498db; border-radius:8px; font-weight:bold; box-sizing:border-box;">
                    
                    <!-- 이름 및 이메일 표시 영역 -->
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                        <strong style="font-size:1.5rem; color:#333;">${u.name}</strong>
                        <span style="font-size:1rem; color:#666; margin-top:2px;">📧 ${userEmail}</span>
                    </div>
                    
                    <!-- 역할 선택 버튼 -->
                    <select onchange="updateUserRole('${u.name}', this.value)" 
                            style="width:130px; height:55px; padding:0 10px; font-size:1.3rem; background:${roleColor}; color:white; border-radius:8px; font-weight:bold; border:none; cursor:pointer; box-sizing:border-box;">
                        <option value="일반" ${currentRole === '일반' ? 'selected' : ''} style="color:black; background:white;">일반</option>
                        <option value="상점" ${currentRole === '상점' ? 'selected' : ''} style="color:black; background:white;">상점</option>
                        <option value="청소" ${currentRole === '청소' ? 'selected' : ''} style="color:black; background:white;">청소</option>
                    </select>
                    
                    <!-- 제거 버튼 -->
                    <button onclick="deleteStudent('${u.name}')" 
                            style="width:45px; height:55px; background:#e74c3c; color:white; border:none; border-radius:8px; font-size:1.2rem; font-weight:bold; cursor:pointer;">×</button>
                </div>`;
        });
        el.innerHTML = h || "등록된 학생이 없습니다.";
    }).catch(err => {
        console.error("명단 로드 실패:", err);
    });
};

window.updateUserRole = function(name, role) {
    db.ref('users').orderByChild('name').equalTo(name).once('value').then(snapshot => {
        snapshot.forEach(childSnap => {
            childSnap.ref.update({ role: role, isHelper: (role === '상점') });
        });
    });
};

window.updateNo = function(name, no) {
    const numVal = parseInt(no) || 0;
    db.ref('users').orderByChild('name').equalTo(name).once('value').then(snapshot => {
        snapshot.forEach(childSnap => {
            childSnap.ref.update({ number: numVal, no: numVal });
        });
    });
};

window.deleteStudent = function(name) {
    if(!confirm(`${name} 용사를 제명하시겠습니까?`)) return;
    db.ref('users').orderByChild('name').equalTo(name).once('value').then(snapshot => {
        snapshot.forEach(childSnap => {
            childSnap.ref.remove().then(() => renderStudentAdminList());
        });
    });
};

// 2. 좌석 표 만들기 기능 (수정됨: rows 값을 정확히 반영하도록 개선)
window.generateSeatInputs = function() {
    const colsInput = document.getElementById('seat-cols');
    const rowsInput = document.getElementById('seat-rows');
    const container = document.getElementById('seat-input-container');
    
    if (!colsInput || !rowsInput || !container) {
        alert("좌석 입력 요소를 찾을 수 없습니다.");
        return;
    }

    // 입력받은 값을 정수로 정확히 가져옵니다.
    const cols = parseInt(colsInput.value);
    const rows = parseInt(rowsInput.value);
    
    // 표 초기화
    container.innerHTML = ""; 
    
    let html = `<table style="width:100%; border-collapse:collapse; margin-top:10px;">`;
    
    // 이제 rows 변수를 기준으로 정확히 반복합니다.
    for(let r = 0; r < rows; r++) {
        html += `<tr>`;
        for(let c = 0; c < cols; c++) {
            // 행(r)과 열(c)에 기반하여 1-1, 1-2와 같이 표시
            html += `<td style="padding:5px;">
                <input type="text" class="seat-name" data-r="${r}" data-c="${c}" 
                       placeholder="${r+1}-${c+1}" 
                       style="width:100%; padding:10px; font-size:1.1rem; box-sizing:border-box; border:1px solid #ccc; border-radius:6px; text-align:center;">
            </td>`;
        }
        html += `</tr>`;
    }
    html += `</table>`;
    container.innerHTML = html;
};

// 3. 좌석 배치 저장 기능
window.saveSeatingLayout = function() {
    const inputs = document.querySelectorAll('.seat-name');
    if (inputs.length === 0) {
        alert("먼저 '표 만들기' 버튼을 눌러 좌석 표를 생성해 주세요!");
        return;
    }

    let layout = [];
    inputs.forEach(input => {
        const r = parseInt(input.dataset.r);
        const c = parseInt(input.dataset.c);
        if(!layout[r]) layout[r] = [];
        layout[r][c] = { name: input.value.trim(), row: r, col: c };
    });

    const colsVal = document.getElementById('seat-cols').value;
    const rowsVal = document.getElementById('seat-rows').value;

    db.ref('classManagement/seatingLayout').set({
        rows: rowsVal,
        cols: colsVal,
        data: layout
    }).then(() => {
        alert("✅ 좌석 배치가 성공적으로 저장되었습니다!");
    }).catch(err => {
        alert("저장 중 오류 발생: " + err.message);
    });
};

// 4. 시스템 설정 저장
window.saveSettings = function() {
    db.ref('settings').update({
        password: document.getElementById('conf-pass')?.value || "",
        lateTime: document.getElementById('conf-late')?.value || "08:40",
        closeTime: document.getElementById('conf-close')?.value || "09:00",
        routineText: document.getElementById('conf-routine')?.value || ""
    }).then(() => alert("✅ 시스템 설정 저장 완료!"));
};

window.saveGifts = function() {
    const gifts = document.getElementById('conf-gifts')?.value.split('\n') || [];
    db.ref('settings').update({ giftList: gifts }).then(() => alert("✅ 보상 저장 완료!"));
};

window.bulkReg = function() {
    const data = document.getElementById('bulk-in')?.value.split('\n') || [];
    data.forEach(line => {
        const [name, email] = line.split(',');
        if(name && email) db.ref('users').push({ name: name.trim(), email: email.trim(), points: 0, level: 1 });
    });
    alert("✅ 학생 일괄 등록 완료!");
};
