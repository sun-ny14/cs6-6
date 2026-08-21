// js/settings.js - 학생 명단 렌더링 (이메일 키 호환성 강화)

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
            
            // 이메일 필드가 다른 이름으로 저장되어 있을 경우를 대비한 호환 처리
            let userEmail = u.email || u.mail || u.userEmail || '이메일 없음';

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
