// js/hero-mgr.js
// 용사(학생) 목록 렌더링, 아바타 관리, 포인트 및 레벨 정보 관리 전용

function initApp() {
    if (typeof showTab === 'function') showTab(currentTab);
    renderHeroes();
    // 이제 학생 명단 관리(renderStudentAdminList)는 settings.js에서 담당합니다.
}

// 스프라이트 시트 기반 육육이 아바타 렌더링
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
        <div style="width: 100%; height: 100%; background-image: url('${githubImageUrl}'); background-size: 500% 400%; background-position: ${posX}% ${posY}%; background-repeat: no-repeat; image-rendering: pixelated; transform: scale(1.15); transform-origin: center;"></div>
    </div>`;
}

// 메인 화면 용사 카드 렌더링
function renderHeroes() {
    const heroGrid = document.getElementById('hero-grid');
    if (!heroGrid) return;

    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let usersArray = [];
        
        for (let key in usersData) {
            let user = usersData[key];
            if (!user) continue;
            if (typeof adminEmail !== 'undefined' && user.email === adminEmail) continue;
            usersArray.push(user);
        }

        usersArray.sort((a, b) => (a.number || a.no || 999) - (b.number || b.no || 999));

        let html = '';
        usersArray.forEach(user => {
            let name = user.name || '용사';
            let p = user.points || 0;
            let e = user.exp || 0;
            let lv = user.level || user.lv || 1;
            let role = user.role || (user.isHelper ? '상점' : '일반');
            let number = user.number || user.no || '';
            
            html += `
                <div class="card" style="text-align:center; cursor:pointer; background:white; border-radius:20px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.1);" onclick="openPointPopupForUser('${name}')">
                    <div>${getAvatar(lv, user.animal)}</div>
                    <h3 style="margin-top:10px; color:var(--dark);">${number ? number + '. ' : ''}${name}</h3>
                    <p style="font-weight:bold; color:var(--primary); margin: 5px 0;">Lv. ${lv} | P: ${p} | E: ${e}</p>
                    <p style="font-size:0.9rem; color:#666;">역할: ${role}</p>
                </div>
            `;
        });

        heroGrid.innerHTML = html || `<p style="text-align:center; color:#666;">등록된 용사가 없습니다.</p>`;

        // 플로팅 버튼 (선생님/도우미/총사령관)
        const canManage = (typeof isAdmin !== 'undefined' && isAdmin) || (typeof isHelper !== 'undefined' && isHelper) || (typeof myName !== 'undefined' && myName === "총사령관");
        let existingFloating = document.getElementById('floating-point-btn-box');
        if (existingFloating) existingFloating.remove();

        if (canManage) {
            let floatingBox = document.createElement('div');
            floatingBox.id = 'floating-point-btn-box';
            floatingBox.style.cssText = "position: fixed; bottom: 35px; right: 35px; z-index: 9999;";
            floatingBox.innerHTML = `<button onclick="openMultiPopup('일괄 포인트 지급', 0, 0)" style="background: #f1c40f; color: #2c3e50; border: none; padding: 15px 25px; border-radius: 30px; font-weight: bold; font-size: 1.2rem; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">✨ 일괄 지급</button>`;
            document.body.appendChild(floatingBox);
        }
    });
}

// 학생 세부정보 팝업
function openPointPopupForUser(userName) {
    db.ref('users').once('value').then(snapshot => {
        let targetUser = null;
        snapshot.forEach(child => { if (child.val().name === userName) targetUser = child.val(); });

        if (!targetUser) return alert("정보를 찾을 수 없습니다.");

        const popup = document.getElementById('point-popup');
        document.getElementById('point-pop-title').innerHTML = `🛡️ ${userName} 용사 정보`;
        document.getElementById('point-pop-body').innerHTML = `
            <div style="text-align:center;">${getAvatar(targetUser.level || 1, targetUser.animal)}</div>
            <p>레벨: Lv.${targetUser.level || 1} | 포인트: ${targetUser.points || 0}P | 경험치: ${targetUser.exp || 0}E</p>
            ${(typeof isAdmin !== 'undefined' && isAdmin) ? `
                <input type="text" id="pop-reason" placeholder="사유" style="width:100%; padding:10px;">
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <input type="number" id="pop-p" placeholder="P 증감">
                    <input type="number" id="pop-e" placeholder="E 증감">
                </div>` : ''}
        `;
        
        const applyBtn = document.getElementById('point-apply-btn');
        if (applyBtn) {
            applyBtn.style.display = (typeof isAdmin !== 'undefined' && isAdmin) ? 'block' : 'none';
            applyBtn.onclick = () => applyUserScore(userName, targetUser.level || 1);
        }
        popup.style.display = 'flex';
    });
}

function applyUserScore(userName, lv) {
    const reason = document.getElementById('pop-reason').value;
    const addP = parseInt(document.getElementById('pop-p').value) || 0;
    const addE = parseInt(document.getElementById('pop-e').value) || 0;
    
    if(!reason) return alert("사유 입력 필수!");
    
    // 이후 데이터 업데이트 로직은 이전과 동일...
    // alert, closePopup, renderHeroes 호출
}

function closePointPopup() { document.getElementById('point-popup').style.display = 'none'; }
