// js/settings.js
// 학급 운영 설정(좌석 배치, 시간 등) 관리 전용

// 좌석 배치 팝업 (선생님 전용)
window.openSeatingSettings = function() {
    if (!isAdmin) return alert("선생님만 좌석을 배치할 수 있습니다.");
    
    let content = `
        <h3>🪑 좌석 배치 설정 (학생이름을 쉼표로 구분)</h3>
        <textarea id="input-seating" style="width:100%; height:200px;"></textarea>
        <button onclick="saveSeatingLayout()" style="background:var(--primary); color:white; width:100%; padding:15px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">배치 저장</button>
    `;
    openPopup("좌석 배치 관리", content);
};

// 좌석 배치 저장
window.saveSeatingLayout = function() {
    const rawData = document.getElementById('input-seating').value;
    const names = rawData.split('\n').filter(n => n.trim());
    
    const seatArray = names.map((name, index) => ({
        seatNo: index + 1,
        name: name.trim()
    }));

    db.ref('classManagement/seatingLayout').set(seatArray).then(() => {
        alert("✅ 좌석 배치가 저장되었습니다!");
        closePopup();
        // 필요 시 등교 탭이나 청소 탭의 렌더링 함수를 호출하여 화면 갱신
    });
};

// 마감 시간 설정 팝업
window.openTimeSettings = function() {
    let content = `
        <h3>⏰ 마감 시간 설정</h3>
        청소 마감 시간: <input type="time" id="input-clean-time"><br>
        1인1역 마감 시간: <input type="time" id="input-role-time"><br>
        <button onclick="saveTimeSettings()" style="background:var(--primary); color:white; width:100%; padding:10px; margin-top:10px;">저장</button>
    `;
    openPopup("시간 설정", content);
};

window.saveTimeSettings = function() {
    const clean = document.getElementById('input-clean-time').value;
    const role = document.getElementById('input-role-time').value;
    db.ref('classManagement/settings').set({ cleaningDeadline: clean, roleDeadline: role }).then(() => {
        alert("✅ 시간이 저장되었습니다.");
        closePopup();
    });
};
