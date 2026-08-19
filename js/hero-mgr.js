// js/hero-mgr.js
// 파이어베이스에서 기존 용사(학생) 데이터를 불러와 렌더링하고 관리하는 기능

// 앱 초기 구동 시 실행되는 메인 함수
function initApp() {
    showTab(currentTab);
    renderHeroes();
    if (isAdmin || isHelper) {
        renderStudentAdminList();
    }
}

// js/hero-mgr.js 내부의 renderHeroes 함수 중 카드 HTML 생성 부분을 아래처럼 수정해 주세요.

function renderHeroes() {
    const heroGrid = document.getElementById('hero-grid');
    if (!heroGrid) return;

    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let html = '';
        
        for (let key in usersData) {
            let user = usersData[key];
            if (user.email === adminEmail) continue;

            let name = user.name || '용사';
            let p = user.points || 0;
            let e = user.exp || 0;
            let lv = user.level || 1;
            let isHelper = user.isHelper || false;
            
            // 캐릭터 아바타 이미지 주소 (저장된 이미지가 없으면 기본 픽셀 아바타나 빈 공간 처리)
            let avatarImg = user.avatar || 'https://i.imgur.com/7Y6u8LN.png'; // 예시 기본 픽셀 캐릭터 주소
            
            html += `
                <div class="card" style="text-align:center; cursor:pointer; position:relative; background:white; border-radius:20px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.1);" onclick="openPointPopupForUser('${name}')">
                    <!-- 캐릭터 아바타 이미지 추가 -->
                    <div style="width: 70px; height: 70px; margin: 0 auto 10px auto; background: #f1f1f1; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                        <img src="${avatarImg}" alt="캐릭터" style="width: 100%; height: 100%; image-rendering: pixelated;">
                    </div>
                    
                    <h3 style="margin-top:0; color:var(--dark);">${name}</h3>
                    <p style="font-weight:bold; color:var(--primary); margin: 5px 0;">Lv. ${lv} | P: ${p} | E: ${e}</p>
                    <p style="font-size:0.9rem; color:#666; margin-bottom:0;">${isHelper ? '⭐ 도우미' : '용사'}</p>
                </div>
            `;
        }

        if (!html) {
            html = `<p style="text-align:center; grid-column: 1 / -1; color:#666;">등록된 용사(학생)가 없습니다.</p>`;
        }
        
        heroGrid.innerHTML = html;
    });
}

// 관리자 탭의 학생 명단 관리 리스트 렌더링
function renderStudentAdminList() {
    const adminListEl = document.getElementById('student-admin-list');
    if (!adminListEl) return;

    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let html = `
            <table style="width:100%; border-collapse:collapse; text-align:center;">
                <thead>
                    <tr style="background:#f8f9fa; border-bottom:2px solid #ddd;">
                        <th style="padding:10px;">이름</th>
                        <th style="padding:10px;">이메일</th>
                        <th style="padding:10px;">도우미 여부</th>
                        <th style="padding:10px;">권한 관리</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (let key in usersData) {
            let u = usersData[key];
            if (u.email === adminEmail) continue;
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px; font-weight:bold;">${u.name}</td>
                    <td style="padding:10px; color:#666;">${u.email}</td>
                    <td style="padding:10px;">${u.isHelper ? '⭐ 도우미' : '-'}</td>
                    <td style="padding:10px;">
                        <button onclick="toggleHelperStatus('${key}', ${!u.isHelper})" style="padding:5px 10px; font-size:0.9rem; background:var(--primary); color:white; border:none; border-radius:6px; width:auto;">${u.isHelper ? '도우미 해제' : '도우미 임명'}</button>
                    </td>
                </tr>
            `;
        }
        html += `</tbody></table>`;
        adminListEl.innerHTML = html;
    });
}

// 도우미 권한 토글 함수
function toggleHelperStatus(userKey, newStatus) {
    db.ref(`users/${userKey}/isHelper`).set(newStatus).then(() => {
        alert("도우미 권한이 성공적으로 변경되었습니다.");
        renderStudentAdminList();
    });
}

// 용사 카드 클릭 시 포인트 부여 팝업 열기
function openPointPopupForUser(userName) {
    if (!isAdmin && !isHelper) {
        alert("선생님과 도우미만 포인트를 부여할 수 있습니다!");
        return;
    }
    openPopup(`⚖️ ${userName} 포인트 관리`, `
        <p>${userName} 용사에게 포인트를 부여하거나 차감합니다.</p>
        <input type="text" id="pop-reason" placeholder="사유 입력 (예: 칭찬 포인트)" style="margin-bottom:10px;">
        <div style="display:flex; gap:10px;">
            <input type="number" id="pop-p" placeholder="포인트(P) 증감">
            <input type="number" id="pop-e" placeholder="경험치(E) 증감">
        </div>
        <button onclick="applyUserScore('${userName}')" style="background:var(--gold); color:var(--dark); margin-top:15px; font-weight:bold;">반영하기</button>
    `);
}

// 개별 점수 반영 함수
function applyUserScore(userName) {
    alert(`${userName} 용사에게 점수 반영 로직이 실행되었습니다.`);
    closePopup();
}

// 관리자 탭의 학생 명단 관리 리스트 렌더링 (삭제 기능 포함)
function renderStudentAdminList() {
    const adminListEl = document.getElementById('student-admin-list');
    if (!adminListEl) return;

    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let html = `
            <table style="width:100%; border-collapse:collapse; text-align:center;">
                <thead>
                    <tr style="background:#f8f9fa; border-bottom:2px solid #ddd;">
                        <th style="padding:10px;">이름</th>
                        <th style="padding:10px;">이메일</th>
                        <th style="padding:10px;">도우미 여부</th>
                        <th style="padding:10px;">관리</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (let key in usersData) {
            let u = usersData[key];
            if (u.email === adminEmail) continue;
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px; font-weight:bold;">${u.name}</td>
                    <td style="padding:10px; color:#666;">${u.email}</td>
                    <td style="padding:10px;">${u.isHelper ? '⭐ 도우미' : '-'}</td>
                    <td style="padding:10px; display:flex; gap:5px; justify-content:center;">
                        <button onclick="toggleHelperStatus('${key}', ${!u.isHelper})" style="padding:5px 10px; font-size:0.9rem; background:var(--primary); color:white; border:none; border-radius:6px; width:auto; cursor:pointer;">${u.isHelper ? '도우미 해제' : '도우미 임명'}</button>
                        <button onclick="deleteStudent('${key}', '${u.name}')" style="padding:5px 10px; font-size:0.9rem; background:var(--red); color:white; border:none; border-radius:6px; width:auto; cursor:pointer;">삭제</button>
                    </td>
                </tr>
            `;
        }
        html += `</tbody></table>`;
        adminListEl.innerHTML = html;
    });
}

// 학생 데이터베이스에서 완전히 삭제하는 함수
function deleteStudent(userKey, studentName) {
    if (confirm(`정말로 [${studentName}] 학생의 데이터를 본부에서 영구 삭제하시겠습니까?`)) {
        db.ref(`users/${userKey}`).remove().then(() => {
            alert(`[${studentName}] 학생의 데이터가 성공적으로 삭제되었습니다.`);
            renderStudentAdminList();
            renderHeroes(); // 메인 화면 용사 목록도 즉시 갱신
        }).catch((error) => {
            alert("삭제 중 오류가 발생했습니다: " + error.message);
        });
    }
}
// 일괄 지급 팝업 열기
function openMultiPopup() {
    const popup = document.getElementById('multi-popup');
    if (popup) popup.style.display = 'flex';
    else alert("일괄 포인트 배부 창을 준비 중입니다.");
}

// 포인트 전령(개별 포인트) 팝업 열기
function openPointBulkPopup() {
    const popup = document.getElementById('point-popup');
    if (popup) popup.style.display = 'flex';
}
