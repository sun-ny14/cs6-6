// js/hero-mgr.js
// 용사(학생) 목록 렌더링, 세부정보 팝업, 포인트 부여 및 번호 순서 정렬 반영

function initApp() {
    showTab(currentTab);
    renderHeroes();
    if (isAdmin || isHelper) {
        renderStudentAdminList();
    }
}

// 스프라이트 시트 기반 육육이 아바타 렌더링 함수
function getAvatar(lv, selectedAnimal) {
    const githubImageUrl = "https://github.com/sun-ny14/cs6-6/blob/main/%EC%9C%A1%EC%9C%A1%EC%9D%B4.png?raw=true"; 
    const animals = ["귀여운", "신사", "사랑스러운", "패셔니스타", "밥먹는", "날쌘돌이", "즐거운", "행복한", "정의로운", "천사", "닌자", "왕자", "공주", "근육맨", "마법사", "용사", "공부하는", "춤추는", "노래하는", "무지개"];
    
    const name = selectedAnimal || animals[Math.min(lv - 1, 19)];
    const index = animals.indexOf(name) === -1 ? 0 : animals.indexOf(name);
    
    const col = index % 5;
    const row = Math.floor(index / 5);
    
    const posX = col * 25; 
    const posY = row * 33.33; 

    return `
    <div style="width: 70px; height: 70px; overflow: hidden; border-radius: 50%; background: white; margin: 0 auto; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <div style="
            width: 100%; 
            height: 100%; 
            background-image: url('${githubImageUrl}'); 
            background-size: 500% 400%; 
            background-position: ${posX}% ${posY}%; 
            background-repeat: no-repeat;
            image-rendering: pixelated;
            transform: scale(1.15);
            transform-origin: center;
        "></div>
    </div>`;
}

// 1. 메인 화면에 용사(학생) 카드 그리드 렌더링 (번호 순서 정렬 적용)
function renderHeroes() {
    const heroGrid = document.getElementById('hero-grid');
    if (!heroGrid) return;

    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let usersArray = [];
        
        // 객체 데이터를 배열로 변환
        for (let key in usersData) {
            let user = usersData[key];
            if (!user || user.email === adminEmail) continue;
            usersArray.push(user);
        }

        // 📌 학생 번호(number 또는 no)를 기준으로 오름차순 정렬
        usersArray.sort((a, b) => {
            let numA = parseInt(a.number || a.no || 999);
            let numB = parseInt(b.number || b.no || 999);
            return numA - numB;
        });

        let html = '';
        
        usersArray.forEach(user => {
            let name = user.name || '용사';
            let p = user.points || 0;
            let e = user.exp || 0;
            let lv = user.level || user.lv || 1;
            let isHelper = user.isHelper || false;
            let selectedAnimal = user.animal || null;
            let number = user.number || user.no || ''; // 부여된 번호
            
            let avatarHtml = getAvatar(lv, selectedAnimal);
            
            html += `
                <div class="card" style="text-align:center; cursor:pointer; position:relative; background:white; border-radius:20px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.1);" onclick="openPointPopupForUser('${name}')">
                    <div style="margin-bottom: 10px;">
                        ${avatarHtml}
                    </div>
                    
                    <h3 style="margin-top:0; color:var(--dark);">${number ? number + '. ' : ''}${name}</h3>
                    <p style="font-weight:bold; color:var(--primary); margin: 5px 0;">Lv. ${lv} | P: ${p} | E: ${e}</p>
                    <p style="font-size:0.9rem; color:#666; margin-bottom:0;">${isHelper ? '⭐ 도우미' : '용사'}</p>
                </div>
            `;
        });

        if (!html) {
            html = `<p style="text-align:center; grid-column: 1 / -1; color:#666;">등록된 용사(학생)가 없습니다.</p>`;
        }
        
        heroGrid.innerHTML = html;
    });
}

// 2. 학생 카드 클릭 시 세부정보 팝업 열기
function openPointPopupForUser(userName) {
    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let targetUser = null;

        for (let key in usersData) {
            if (usersData[key] && usersData[key].name === userName) {
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
        let lv = targetUser.level || targetUser.lv || 1;
        let helperStatus = targetUser.isHelper ? '⭐ 도우미' : '일반 용사';
        let selectedAnimal = targetUser.animal || null;
        let number = targetUser.number || targetUser.no || '';
        
        let avatarHtml = getAvatar(lv, selectedAnimal);

        const popup = document.getElementById('point-popup');
        const titleEl = document.getElementById('point-pop-title');
        const bodyEl = document.getElementById('point-pop-body');
        const applyBtn = document.getElementById('point-apply-btn');

        if (titleEl) titleEl.innerHTML = `🛡️ ${number ? number + '. ' : ''}${userName} 용사 세부정보`;
        
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="margin: 0 auto 10px auto;">
                        ${avatarHtml}
                    </div>
                    <h3 style="margin: 0; color: var(--dark);">${number ? number + '. ' : ''}${userName}</h3>
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

        if (applyBtn) {
            if (isAdmin || isHelper) {
                applyBtn.style.display = 'block';
                applyBtn.innerText = '점수 반영하기';
                applyBtn.onclick = function() {
                    applyUserScore(userName, lv);
                };
            } else {
                applyBtn.style.display = 'none';
            }
        }

        if (popup) popup.style.display = 'flex';
    });
}

// 3. 점수 반영 및 레벨 동기화 처리 함수
function applyUserScore(userName, currentLv) {
    const reasonInput = document.getElementById('pop-reason');
    const addPInput = document.getElementById('pop-p');
    const addEInput = document.getElementById('pop-e');

    const reason = reasonInput ? reasonInput.value.trim() : '';
    const addP = addPInput ? parseInt(addPInput.value) || 0 : 0;
    const addE = addEInput ? parseInt(addEInput.value) || 0 : 0;

    if (!reason) {
        alert("포인트 변동 사유를 입력해 주세요!");
        return;
    }

    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let targetKey = null;
        let userData = null;

        for (let key in usersData) {
            if (usersData[key] && usersData[key].name === userName) {
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

        let newP = currentP + addP;
        let newE = currentE + addE;

        db.ref(`users/${targetKey}`).update({
            points: newP,
            exp: newE,
            level: currentLv
        }).then(() => {
            alert(`[${userName}] 용사에게 점수가 성공적으로 반영되었습니다!`);
            closePointPopup();
            renderHeroes();
        });
    });
}

function closePointPopup() {
    const popup = document.getElementById('point-popup');
    if (popup) popup.style.display = 'none';
}

// 관리자 탭 학생 명단 관리 및 번호 표시 복원 함수
function renderStudentAdminList() {
    const adminListEl = document.getElementById('student-admin-list');
    if (!adminListEl) return;

    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let usersArray = [];

        for (let key in usersData) {
            let u = usersData[key];
            if (!u || u.email === adminEmail) continue;
            usersArray.push({ key: key, data: u });
        }

        // 학생 번호(number 또는 no) 기준 오름차순 정렬
        usersArray.sort((a, b) => {
            let numA = parseInt(a.data.number || a.data.no || 999);
            let numB = parseInt(b.data.number || b.data.no || 999);
            return numA - numB;
        });

        let html = `
            <table style="width:100%; border-collapse:collapse; text-align:center; font-size:1.1rem;">
                <thead>
                    <tr style="background:#f8f9fa; border-bottom:2px solid #ddd;">
                        <th style="padding:12px;">번호</th>
                        <th style="padding:12px;">이름</th>
                        <th style="padding:12px;">이메일</th>
                        <th style="padding:12px;">도우미 여부</th>
                        <th style="padding:12px;">관리</th>
                    </tr>
                </thead>
                <tbody>
        `;

        usersArray.forEach(item => {
            let key = item.key;
            let u = item.data;
            let studentNum = u.number || u.no || '-';

            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:12px; font-weight:bold; color:var(--primary);">${studentNum}</td>
                    <td style="padding:12px; font-weight:bold;">${u.name || '이름 없음'}</td>
                    <td style="padding:12px; color:#666;">${u.email || '-'}</td>
                    <td style="padding:12px;">${u.isHelper ? '⭐ 도우미' : '-'}</td>
                    <td style="padding:12px; display:flex; gap:8px; justify-content:center;">
                        <button onclick="toggleHelperStatus('${key}', ${!u.isHelper})" style="padding:8px 12px; font-size:1rem; background:var(--primary); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">${u.isHelper ? '도우미 해제' : '도우미 임명'}</button>
                        <button onclick="deleteStudent('${key}', '${u.name || '학생'}')" style="padding:8px 12px; font-size:1rem; background:var(--red); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">삭제</button>
                    </td>
                </tr>
            `;
        });

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
