// js/hero-mgr.js (학생 명단 및 역할 관리 영역)

// 1. 학생 역할 변경 저장 함수
window.updateUserRole = function(userName, newRole) {
    db.ref('users').once('value').then(snapshot => {
        let targetKey = null;
        snapshot.forEach(childSnap => {
            const u = childSnap.val();
            if (u && u.name === userName) {
                targetKey = childSnap.key;
            }
        });

        if (!targetKey) {
            alert("해당 학생을 찾을 수 없습니다.");
            return;
        }

        db.ref(`users/${targetKey}`).update({
            role: newRole,
            isHelper: (newRole === '상점') // 기존 도우미 권한 호환 유지
        }).then(() => {
            alert(`✅ [${userName}] 용사의 역할이 [${newRole}]로 변경되었습니다!`);
            renderStudentAdminList();
            renderHeroes();
        });
    });
};

// 2. 학생 번호 변경 저장 함수
window.updateNo = function(userName, newNo) {
    const numVal = parseInt(newNo) || 0;
    db.ref('users').once('value').then(snapshot => {
        let targetKey = null;
        snapshot.forEach(childSnap => {
            const u = childSnap.val();
            if (u && u.name === userName) {
                targetKey = childSnap.key;
            }
        });

        if (!targetKey) return;

        db.ref(`users/${targetKey}`).update({
            number: numVal,
            no: numVal
        }).then(() => {
            renderHeroes();
        });
    });
};

// 3. 관리자 탭 학생 명단 및 역할 선택 렌더링 함수
function renderStudentAdminList() {
    const adminListEl = document.getElementById('student-admin-list');
    if (!adminListEl) return;

    db.ref('users').once('value').then((snapshot) => {
        const usersData = snapshot.val() || {};
        let currentUsers = [];

        for (let key in usersData) {
            let u = usersData[key];
            if (!u || u.email === adminEmail) continue;
            currentUsers.push(u);
        }

        // 번호 순서대로 정렬
        currentUsers.sort((a, b) => {
            let numA = parseInt(a.number || a.no || 999);
            let numB = parseInt(b.number || b.no || 999);
            return numA - numB;
        });

        let h = "";
        currentUsers.forEach(u => {
            if (u.name === "총사령관") return;
            
            let currentRole = u.role || (u.isHelper ? '상점' : '일반');
            let roleColor = '#95a5a6'; // 일반 (회색)
            if (currentRole === '상점') roleColor = '#3498db'; // 상점 (파란색)
            else if (currentRole === '청소') roleColor = '#27ae60'; // 청소 (초록색)

            h += `
                <div class="list-item" style="padding:10px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:10px; flex-wrap:nowrap;">
                    <input type="number" value="${u.number || u.no || ''}" onchange="updateNo('${u.name}', this.value)" style="width:80px; height:55px; text-align:center; font-size:1.8rem; padding:0; border:2px solid var(--primary); border-radius:8px; font-weight:bold; flex-shrink:0;">
                    
                    <strong style="font-size:1.6rem; flex:1; min-width:50px; white-space:nowrap; text-align:left;">${u.name}</strong>
                    
                    <select onchange="updateUserRole('${u.name}', this.value)" style="width:125px; height:55px; padding:0 5px; font-size:1.1rem; border-radius:8px; border:2px solid ${roleColor}; background:${roleColor}; color:white; font-weight:bold; cursor:pointer; flex-shrink:0;">
                        <option value="일반" ${currentRole === '일반' ? 'selected' : ''} style="color:black; background:white;">👤 일반</option>
                        <option value="상점" ${currentRole === '상점' ? 'selected' : ''} style="color:black; background:white;">🛍️ 상점</option>
                        <option value="청소" ${currentRole === '청소' ? 'selected' : ''} style="color:black; background:white;">🧹 청소</option>
                    </select>

                    <button onclick="if(confirm('${u.name} 용사를 정말 제명하시겠습니까?')) { db.ref('users').orderByChild('name').equalTo('${u.name}').once('value').then(s => { s.forEach(cs => cs.ref.remove()); renderStudentAdminList(); renderHeroes(); }); }" style="width:60px; height:55px; background:var(--red); color:white; border-radius:8px; font-weight:bold; border:none; cursor:pointer; flex-shrink:0;">제거</button>
                </div>
            `;
        });

        adminListEl.innerHTML = h || "등록된 용사가 없습니다.";
    });
}
