// js/settings.js - 설정 탭 및 관리자 시스템 전체 통합 코드

window.initSettings = function() {
    loadSystemSettings();
    loadStudentAdminList();
    loadGiftsSetting();
    loadSeatSettings();
};

// js/settings.js - 좌석 배치 설정, 시스템 설정 및 학생 명단 관리 통합 모듈

// --- [A] 좌석 배치 설정 ---
window.generateSeatInputs = function() {
    const colsEl = document.getElementById('seat-cols');
    const rowsEl = document.getElementById('seat-rows');
    
    if (!colsEl || !rowsEl) return;

    const cols = parseInt(colsEl.value);
    const rows = parseInt(rowsEl.value);

    if (!cols || !rows || cols <= 0 || rows <= 0) {
        alert("올바른 가로, 세로 칸 수를 입력해주세요!");
        return;
    }

    const container = document.getElementById('seat-input-container');
    if (!container) return;

    db.ref('seatLayoutData/layout').once('value', snap => {
        const currentLayout = snap.val() || {};

        let html = `<div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:10px; margin-top:15px;">`;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const seatKey = `${r}_${c}`;
                const posId = `${r}-${c}`;
                const savedName = currentLayout[posId] || currentLayout[seatKey] || "";
                
                html += `
                    <div style="background:#f8f9fa; border:1px solid #ccc; padding:8px; border-radius:8px; text-align:center;">
                        <small style="color:#666; display:block; margin-bottom:4px;">${r+1}행 ${c+1}열</small>
                        <input type="text" id="seat-input-${seatKey}" value="${savedName}" placeholder="이름 입력" style="width:100%; padding:8px; text-align:center; font-size:1.1rem; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
                    </div>
                `;
            }
        }
        html += `</div>`;
        container.innerHTML = html;
    });
};

window.saveSeatSettings = async function() {
    const colsEl = document.getElementById('seat-cols');
    const rowsEl = document.getElementById('seat-rows');
    
    if (!colsEl || !rowsEl) return;

    const cols = parseInt(colsEl.value);
    const rows = parseInt(rowsEl.value);

    if (!cols || !rows) {
        alert("가로와 세로 칸 수를 올바르게 입력해주세요!");
        return;
    }

    let newLayout = {};
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const seatKey = `${r}_${c}`;
            const posId = `${r}-${c}`;
            const input = document.getElementById(`seat-input-${seatKey}`);
            if (input && input.value.trim()) {
                newLayout[posId] = input.value.trim();
            }
        }
    }

    await db.ref('seatLayoutData').set({
        config: { cols: cols, rows: rows },
        layout: newLayout
    });

    alert("🪑 좌석 배치 설정과 이름들이 영구 저장되었습니다! ✨");
    if (typeof generateNewLayout === 'function') generateNewLayout();
};

window.loadSeatSettings = async function() {
    const snap = await db.ref('seatLayoutData').once('value');
    const colsEl = document.getElementById('seat-cols');
    const rowsEl = document.getElementById('seat-rows');
    const container = document.getElementById('seat-input-container');

    if (snap.exists()) {
        const data = snap.val();
        const config = data.config || {};
        if (colsEl) colsEl.value = config.cols || '';
        if (rowsEl) rowsEl.value = config.rows || '';
        if (config.cols && config.rows) generateSeatInputs();
    } else {
        if (colsEl) colsEl.value = '5';
        if (rowsEl) rowsEl.value = '6';
        if (container) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: #888; font-size: 1.2rem; background: #f8f9fa; border-radius: 8px; margin-top: 15px;">설정된 좌석 배치가 없습니다. 크기 입력 후 '표 만들기'를 눌러주세요.</div>`;
        }
    }
};

// --- [B] 학생(용사들) 명단 및 역할 관리 ---
window.loadStudentAdminList = function() {
    db.ref('users').on('value', snap => {
        const listEl = document.getElementById('student-admin-list');
        if (!listEl) return;

        if (!snap.exists()) {
            listEl.innerHTML = `<div style="text-align:center; padding:30px; color:#888; font-size:1.2rem;">등록된 용사가 없습니다.</div>`;
            return;
        }

        let usersArr = [];
        snap.forEach(c => { usersArr.push({ name: c.key, ...c.val() }); });
        
        usersArr.sort((a, b) => parseInt(a.no || 0) - parseInt(b.no || 0));
        
        // 전역 배열 동기화 (다른 함수에서 currentUsers를 참조할 때를 대비)
        if (typeof currentUsers !== 'undefined') {
            currentUsers = usersArr;
        }

        window.renderAdminList();
    });
};

// 관리자용 학생 명단 렌더링 함수
window.renderAdminList = function() {
    const listEl = document.getElementById('student-admin-list');
    if (!listEl) return;

    let h = ""; 
    const targetArr = (typeof currentUsers !== 'undefined' && currentUsers.length > 0) ? currentUsers : [];
    
    targetArr.forEach(u => { 
        if (u.name === "총사령관") return; 
        
        let currentRole = u.role || (u.isHelper ? '상점' : '일반');
        let roleColor = '#95a5a6'; // 일반 (회색)
        if (currentRole === '상점') roleColor = '#3498db'; // 상점 (파란색)
        else if (currentRole === '청소') roleColor = '#27ae60'; // 청소 (초록색)

        h += `<div class="list-item" style="padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:10px; flex-wrap:nowrap;">
                <input type="number" value="${u.no || ''}" onchange="updateNo('${u.name}', this.value)" style="width:80px; height:55px; text-align:center; font-size:1.8rem; padding:0; border:2px solid var(--primary, #3498db); border-radius:8px; font-weight:bold; flex-shrink:0;">
                
                <strong style="font-size:1.6rem; flex:1; min-width:50px; white-space:nowrap; text-align:left;">${u.name}</strong>
                
                <select onchange="updateUserRole('${u.name}', this.value)" style="width:105px; height:55px; padding:0 5px; font-size:1.1rem; border-radius:8px; border:2px solid ${roleColor}; background:${roleColor}; color:white; font-weight:bold; cursor:pointer; flex-shrink:0;">
                    <option value="일반" ${currentRole === '일반' ? 'selected' : ''}>👤 일반</option>
                    <option value="상점" ${currentRole === '상점' ? 'selected' : ''}>🛍️ 상점</option>
                    <option value="청소" ${currentRole === '청소' ? 'selected' : ''}>🧹 청소</option>
                </select>

                <button onclick="confirmDeleteStudent('${u.name}')" style="width:60px; height:55px; background:var(--red, #e74c3c); color:white; border-radius:8px; font-weight:bold; border:none; cursor:pointer; flex-shrink:0;">제거</button>
              </div>`; 
    }); 
    
    listEl.innerHTML = h || "<div style='text-align:center; padding:20px;'>용사가 없습니다.</div>"; 
};

// 학생 번호 수정
window.updateNo = function(n, v) { 
    db.ref('users/' + n).update({ no: parseInt(v) || 0 }); 
};

// 학생 역할(Role) 업데이트 함수
window.updateUserRole = function(userName, newRole) {
    db.ref(`users/${userName}`).update({
        role: newRole,
        isHelper: newRole === '상점' // 상점 역할일 때만 helper 활성화
    }).then(() => {
        const roleIcon = newRole === '상점' ? '🛍️' : (newRole === '청소' ? '🧹' : '👤');
        alert(`${userName} 학생의 역할이 [ ${roleIcon} ${newRole} ](으)로 변경되었습니다!`);
    });
};

window.confirmDeleteStudent = function(userName) {
    const firstCheck = confirm(`⚠️ 경고: [${userName}] 용사를 정말 제명하시겠습니까?`);
    if (!firstCheck) return;
    
    const secondCheck = confirm(`🚨 최종 확인: 삭제된 데이터는 복구할 수 없습니다. 정말로 [${userName}] 용사를 삭제하시겠습니까?`);
    if (secondCheck) {
        db.ref(`users/${userName}`).remove().then(() => {
            alert(`🗑️ [${userName}] 용사가 제명되었습니다.`);
        });
    }
};

// --- [C] 시스템 설정 ---
window.saveSettings = async function() {
    const password = document.getElementById('conf-pass').value;
    const lateTime = document.getElementById('conf-late').value;
    const closeTime = document.getElementById('conf-close').value;

    await db.ref('settings/system').set({ password, lateTime, closeTime });
    alert("💾 시스템 설정이 영구 저장되었습니다!");
};

window.loadSystemSettings = async function() {
    const snap = await db.ref('settings/system').once('value');
    if (snap.exists()) {
        const data = snap.val();
        if (document.getElementById('conf-pass')) document.getElementById('conf-pass').value = data.password || '';
        if (document.getElementById('conf-late')) document.getElementById('conf-late').value = data.lateTime || '';
        if (document.getElementById('conf-close')) document.getElementById('conf-close').value = data.closeTime || '';
    }
};

window.generateRandomPassword = function() {
    const randomPw = Math.floor(1000 + Math.random() * 9000).toString();
    const passInput = document.getElementById('conf-pass');
    if (passInput) {
        passInput.value = randomPw;
        alert(`🎲 새로운 난수 암호 생성됨: ${randomPw}\n'시스템 저장'을 눌러야 적용됩니다.`);
    }
};

// --- [D] 레벨업 보상 설정 ---
window.saveGifts = async function() {
    const giftsText = document.getElementById('conf-gifts').value;
    await db.ref('settings/gifts').set({ listText: giftsText });
    alert("🎁 레벨업 보상 목록이 저장되었습니다!");
};

window.loadGiftsSetting = async function() {
    const snap = await db.ref('settings/gifts').once('value');
    if (snap.exists()) {
        const data = snap.val();
        if (document.getElementById('conf-gifts')) document.getElementById('conf-gifts').value = data.listText || '';
    }
};

// 학생 일괄 등록 (이름과 이메일을 함께 저장)
window.bulkReg = function() {
    const rawText = document.getElementById('bulk-in').value.trim();
    if (!rawText) {
        alert("⚠️ 등록할 학생 명단을 입력해주세요.");
        return;
    }

    const lines = rawText.split('\n');
    let updates = {};
    let count = 0;

    lines.forEach(line => {
        const parts = line.split(',');
        const name = parts[0] ? parts[0].trim() : "";
        const email = parts[1] ? parts[1].trim() : "";

        if (name) {
            updates[name] = {
                name: name,
                email: email || "미등록",
                points: 0,
                exp: 0,
                lv: 1,
                no: count + 1
            };
            count++;
        }
    });

    if (count > 0) {
        db.ref('users').update(updates).then(() => {
            alert(`✅ 총 ${count명의 학생 명단(이메일 포함)이 성공적으로 주입되었습니다!`);
            document.getElementById('bulk-in').value = "";
            if (typeof renderAdminList === 'function') renderAdminList();
        });
    } else {
        alert("⚠️ 올바른 형식(이름,이메일)으로 입력해주세요.");
    }
};