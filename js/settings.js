// js/settings.js - 설정 탭 및 관리자 시스템 전체 코드

// 1. 설정 탭 초기화 및 데이터 불러오기
window.initSettings = function() {
    loadSystemSettings();
    loadStudentAdminList();
    loadGiftsSetting();
    loadSeatSettings();
};

// --- [A] 좌석 배치 설정 ---
window.generateSeatInputs = function() {
    const cols = parseInt(document.getElementById('seat-cols').value) || 5;
    const rows = parseInt(document.getElementById('seat-rows').value) || 6;
    const container = document.getElementById('seat-input-container');
    if (!container) return;

    let html = `<div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:10px; margin-top:15px;">`;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const seatKey = `${r}_${c}`;
            html += `<input type="text" id="seat-input-${seatKey}" placeholder="${r+1행, c+1열}" style="padding:10px; text-align:center; font-size:1.1rem; border:1px solid #ccc; border-radius:6px;">`;
        }
    }
    html += `</div>`;
    container.innerHTML = html;
};

window.saveSeatingLayout = async function() {
    const cols = parseInt(document.getElementById('seat-cols').value) || 5;
    const rows = parseInt(document.getElementById('seat-rows').value) || 6;
    let layoutData = { cols: cols, rows: rows, seats: {} };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const seatKey = `${r}_${c}`;
            const inputEl = document.getElementById(`seat-input-${seatKey}`);
            if (inputEl && inputEl.value.trim() !== "") {
                layoutData.seats[seatKey] = inputEl.value.trim();
            }
        }
    }

    try {
        await db.ref('settings/seatLayout').set(layoutData);
        alert("✅ 좌석 배치가 성공적으로 저장되었습니다!\n등교 로그 및 청소 탭과 연동됩니다.");
    } catch (err) {
        console.error("좌석 저장 오류:", err);
        alert("좌석 저장 중 오류가 발생했습니다.");
    }
};

window.loadSeatSettings = async function() {
    const snap = await db.ref('settings/seatLayout').once('value');
    if (!snap.exists()) return;
    const data = snap.val();
    if (document.getElementById('seat-cols')) document.getElementById('seat-cols').value = data.cols || 5;
    if (document.getElementById('seat-rows')) document.getElementById('seat-rows').value = data.rows || 6;
    
    // 입력 필드 먼저 생성 후 데이터 채우기
    window.generateSeatInputs();
    if (data.seats) {
        for (let key in data.seats) {
            const inputEl = document.getElementById(`seat-input-${key}`);
            if (inputEl) inputEl.value = data.seats[key];
        }
    }
};

// --- [B] 학생 명단 관리 (번호, 역할, 더블체크 삭제) ---
window.loadStudentAdminList = function() {
    db.ref('users').on('value', snap => {
        const listEl = document.getElementById('student-admin-list');
        if (!listEl) return;

        let html = `<table style="width:100%; border-collapse:collapse; margin-top:10px;">
            <tr style="background:#f8f9fa; border-bottom:2px solid #ddd;">
                <th style="padding:12px; text-align:center;">번호</th>
                <th style="padding:12px; text-align:left;">이름</th>
                <th style="padding:12px; text-align:left;">이메일</th>
                <th style="padding:12px; text-align:center;">역할</th>
                <th style="padding:12px; text-align:center;">관리</th>
            </tr>`;

        let usersArr = [];
        snap.forEach(c => { usersArr.push({ key: c.key, ...c.val() }); });
        // 번호순 정렬
        usersArr.sort((a, b) => (a.number || 0) - (b.number || 0));

        usersArr.forEach((u, idx) => {
            html += `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px; text-align:center;">${u.number || (idx + 1)}</td>
                <td style="padding:12px; font-weight:bold;">${u.name}</td>
                <td style="padding:12px; color:#666; font-size:1.1rem;">${u.email || ''}</td>
                <td style="padding:12px; text-align:center;">
                    <select onchange="updateUserRole('${u.key}', this.value)" style="padding:6px; font-size:1rem; border-radius:6px;">
                        <option value="학생" ${!u.role || u.role === '학생' ? 'selected' : ''}>학생</option>
                        <option value="총관리자1" ${u.role === '총관리자1' ? 'selected' : ''}>총관리자 1</option>
                        <option value="총관리자2" ${u.role === '총관리자2' ? 'selected' : ''}>총관리자 2</option>
                    </select>
                </td>
                <td style="padding:12px; text-align:center;">
                    <button onclick="confirmDeleteStudent('${u.key}', '${u.name}')" style="background:#e74c3c; color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-size:1rem;">삭제</button>
                </td>
            </tr>`;
        });
        html += `</table>`;
        listEl.innerHTML = html;
    });
};

window.updateUserRole = async function(userId, newRole) {
    await db.ref(`users/${userId}`).update({ role: newRole });
    alert(`✅ [${newRole}] (으)로 역할이 변경되었습니다.`);
};

window.confirmDeleteStudent = function(userId, userName) {
    // 더블 체크 창 구현
    const firstCheck = confirm(`⚠️ 경고: [${userName}] 학생을 정말 삭제하시겠습니까?`);
    if (!firstCheck) return;
    
    const secondCheck = confirm(`🚨 최종 확인: 삭제된 데이터는 복구할 수 없습니다. 정말로 [${userName}] 학생을 삭제 처리하시겠습니까?`);
    if (secondCheck) {
        db.ref(`users/${userId}`).remove().then(() => {
            alert(`🗑️ [${userName}] 학생이 삭제되었습니다.`);
        });
    }
};

// --- [C] 시스템 설정 (비밀번호, 지각/마감 시간 - 영구 유지) ---
window.saveSettings = async function() {
    const password = document.getElementById('conf-pass').value;
    const lateTime = document.getElementById('conf-late').value;
    const closeTime = document.getElementById('conf-close').value;

    const settingsData = { password, lateTime, closeTime };
    await db.ref('settings/system').set(settingsData);
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

// --- [D] 레벨업 보상 설정 (영구 유지) ---
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

// --- [E] 학생 일괄 등록 (학기 초 전용, 가장 하단) ---
window.bulkReg = async function() {
    const textInput = document.getElementById('bulk-in');
    if (!textInput || !textInput.value.trim()) return alert("등록할 학생 정보(이름,이메일)를 입력해주세요.");

    const lines = textInput.value.split('\n');
    let count = 0;

    for (let line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const email = parts[1].trim().toLowerCase();
            if (name && email) {
                const newRef = db.ref('users').push();
                await newRef.set({
                    name: name,
                    email: email,
                    number: count + 1,
                    points: 0,
                    role: '학생'
                });
                count++;
            }
        }
    }
    alert(`🎉 총 ${count명의 학생이 성공적으로 일괄 등록되었습니다!`);
    textInput.value = "";
};
