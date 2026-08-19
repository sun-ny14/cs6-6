// js/admin-grades.js
// 성적 관리, 학급 운영비, 관리자 설정 및 학생 명단 관리 기능

// 성적 관리 메인 화면 렌더링
function renderGradesMain() {
    const gradesSection = document.getElementById('tab-grades');
    if (!gradesSection) return;
    
    gradesSection.innerHTML = `
        <div class="card">
            <h2>📝 성적 및 평가 관리</h2>
            <p>학생들의 성적과 수행평가 기록을 관리하는 공간입니다.</p>
            <div style="background:#f8f9fa; padding:15px; border-radius:12px; margin-top:15px;">
                <p style="margin:0; color:#666;">등록된 성적 데이터 불러오는 중...</p>
            </div>
        </div>
    `;
}

// 학급 운영비 내역 추가 팝업 열기
function openAddBudgetPopup() {
    alert("💵 학급 운영비 지출 또는 수입 내역을 추가하는 창입니다.");
}

// 시스템 설정 저장
function saveSettings() {
    const pass = document.getElementById('conf-pass').value;
    const lateTime = document.getElementById('conf-late').value;
    const closeTime = document.getElementById('conf-close').value;
    
    db.ref('settings').update({
        password: pass,
        lateTime: lateTime,
        closeTime: closeTime
    }).then(() => {
        alert("⚙️ 시스템 설정이 성공적으로 저장되었습니다!");
    });
}

// 난수 비번 자동 생성
function generateRandomPassword() {
    const randomPass = Math.floor(1000 + Math.random() * 9000).toString();
    const passInput = document.getElementById('conf-pass');
    if (passInput) {
        passInput.value = randomPass;
        alert(`🎲 새로운 등교 암호가 생성되었습니다: [${randomPass}] (시스템 저장을 눌러야 적용됩니다)`);
    }
}

// 레벨업 보상 저장
function saveGifts() {
    const giftsText = document.getElementById('conf-gifts').value;
    db.ref('settings/gifts').set(giftsText).then(() => {
        alert("🎁 레벨업 보상 목록이 저장되었습니다!");
    });
}

// 학생 일괄 등록 (주입)
function bulkReg() {
    const bulkInput = document.getElementById('bulk-in').value.trim();
    if (!bulkInput) {
        alert("등록할 학생 명단 텍스트를 입력해 주세요.");
        return;
    }
    alert("🆕 학생 명단 일괄 주입 로직을 실행합니다.");
}
