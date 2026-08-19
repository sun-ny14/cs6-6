// js/hero-mgr.js
// 용사(학생) 목록 렌더링, 포인트 부여 팝업 및 관리자 학생 명단 관리 기능

function initApp() {
    showTab(currentTab);
    renderHeroes();
    if (isAdmin || isHelper) {
        renderStudentAdminList();
    }
}

// 메인 화면에 용사(학생) 카드 그리드 렌더링
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
            
            // 캐릭터 아바타 이미지 주소
            let avatarImg = user.avatar || 'https://i.imgur.com/7Y6u8LN.png';
            
            html += `
                <div class="card" style="text-align:center; cursor:pointer; position:relative; background:white; border-radius:20px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.1);" onclick="openPointPopupForUser('${name}')">
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

// 용사 카드 클릭 시 포인트가 아니라 '학생 세부정보' 팝업이 뜨도록 수정된 함수
function openPointPopupForUser(userName) {
    // 1. 먼저 데이터베이스에서 클릭한 학생의 상세 정보를 불러옴
    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let targetUser = null;

        for (let key in usersData) {
            if (usersData[key].name === userName) {
                targetUser = usersData[key];
                break;
            }
        }

        if (!targetUser) {
            alert("학생 정보를 찾을 수 없습니다.");
            return;
        }

        let p = targetUser.points || 0;
        let e = targetUser.exp || 0;
        let lv = targetUser.level || 1;
        let helperStatus = targetUser.isHelper ? '⭐ 도우미' : '일반 용사';
        let avatarImg = targetUser.avatar || 'https://i.imgur.com/7Y6u8LN.png';

        // 2. 세부정보 팝업창 구성 (학생 정보 표시 + 선생님 전용 포인트 수정 칸)
        const popup = document.getElementById('point-popup');
        const titleEl = document.getElementById('point-pop-title');
        const bodyEl = document.getElementById('point-pop-body');
        const applyBtn = document.getElementById('point-apply-btn');

        if (titleEl) titleEl.innerHTML = `🛡️ ${userName} 용사 세부정보`;
        
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 10px auto; background: #f1f1f1; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 2px solid var(--primary);">
                        <img src="${avatarImg}" alt="캐릭터" style="width: 100%; height: 100%; image-rendering: pixelated;">
                    </div>
                    <h3 style="margin: 0; color: var(--dark);">${userName}</h3>
                    <p style="margin: 5px 0; color: #666; font-size: 0.95rem;">신분: ${helperStatus}</p>
                </div>

                <div style="background: #f8f9fa; padding: 15px; border-radius: 12px; margin-bottom: 15px; font-size: 1.1rem; text-align: center; border: 1px solid #ddd;">
                    <span style="font-weight: bold; color: var(--primary);">레벨: Lv. ${lv}</span> &nbsp;|&nbsp; 
                    <span style="font-weight: bold; color: #27ae60;">포인트: ${p} P</span> &nbsp;|&nbsp; 
                    <span style="font-weight: bold; color: #e67e22;">경험치: ${e} E</span>
                </div>

                ${(isAdmin || isHelper) ? `
                    <div style="border-top: 2px dashed #ddd; padding-top: 15px;">
                        <p style="font-weight: bold; margin-bottom: 10px; color: var(--dark);">⚖️ 선생님/도우미 포인트 관리</p>
                        <input type="text" id="pop-reason" placeholder="변동 사유 입력 (예: 칭찬 포인트)" style="width:100%; padding:10px; margin-bottom:10px; box-sizing:border-box;">
                        <div style="display:flex; gap:10px;">
                            <input type="number" id="pop-p" placeholder="포인트(P) 증감" style="width:50%; padding:10px; box-sizing:border-box;">
                            <input type="number" id="pop-e" placeholder="경험치(E) 증감" style="width:50%; padding:10px; box-sizing:border-box;">
                        </div>
                    </div>
                ` : '<p style="text-align:center; color:#666; font-size:0.9rem;">학생 계정에서는 자신의 상세 정보만 조회할 수 있습니다.</p>'}
            `;
        }

        // 3. 권한에 따른 반영 버튼 제어
        if (applyBtn) {
            if (isAdmin || isHelper) {
                applyBtn.style.display = 'block';
                applyBtn.innerText = '점수 반영하기';
                applyBtn.onclick = function() {
                    applyUserScore(userName);
                };
            } else {
                applyBtn.style.display = 'none'; // 학생은 수정 버튼 숨김
            }
        }

        if (popup) popup.style.display = 'flex';
    });
}
// 점수 반영 실제 로직 (파이어베이스 연동)
function applyUserScore(userName) {
    const reason = document.getElementById('pop-reason').value.trim();
    const addP = parseInt(document.getElementById('pop-p').value) || 0;
    const addE = parseInt(document.getElementById('pop-e').value) || 0;

    if (!reason) {
        alert("포인트 변동 사유를 입력해 주세요!");
        return;
    }

    // 데이터베이스에서 해당 이름의 학생을 찾아 점수 업데이트
    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let targetKey = null;
        let userData = null;

        for (let key in usersData) {
            if (usersData[key].name === userName) {
                targetKey = key;
                userData = usersData[key];
                break;
            }
        }

        if (!targetKey) {
            alert("해당 학생 정보를 찾을 수 없습니다.");
            return;
        }

        let currentP = userData.points || 0;
        let currentE = userData.exp || 0;
        let currentLv = userData.level || 1;

        let newP = currentP + addP;
        let newE = currentE + addE;

        db.ref(`users/${targetKey}`).update({
            points: newP,
            exp: newE,
            level: currentLv
        }).then(() => {
            alert(`[${userName}] 용사에게 점수가 성공적으로 반영되었습니다!`);
            closePointPopup();
            renderHeroes(); // 화면 갱신
        });
    });
}

// 팝업 닫기 함수
function closePointPopup() {
    const popup = document.getElementById('point-popup');
    if (popup) popup.style.display = 'none';
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

function toggleHelperStatus(userKey, newStatus) {
    db.ref(`users/${userKey}/isHelper`).set(newStatus).then(() => {
        alert("도우미 권한이 성공적으로 변경되었습니다.");
        renderStudentAdminList();
    });
}

function deleteStudent(userKey, studentName) {
    if (confirm(`정말로 [${studentName}] 학생의 데이터를 본부에서 영구 삭제하시겠습니까?`)) {
        db.ref(`users/${userKey}`).remove().then(() => {
            alert(`[${studentName}] 학생의 데이터가 삭제되었습니다.`);
            renderStudentAdminList();
            renderHeroes();
        });
    }
}
