// js/cleaning.js - 1인 1역/청소 독립 확인 시스템

window.renderRoleCleaning = function() {
    const container = document.getElementById('tab-cleaning');
    if (!container) return;

    // 총관리자(1, 2) 또는 선생님 권한 확인
    const isMasterManager = (typeof isAdmin !== 'undefined' && isAdmin) || 
                            (typeof myName !== 'undefined' && (myName === "총관리자 1" || myName === "총관리자 2"));

    // DB에서 좌석 배치 정보(seats)와 현재 청소/역할 상태(status)를 가져옴
    db.ref('classManagement/seatingLayout').once('value').then(seatSnap => {
        const seats = seatSnap.val() || []; // 설정 탭에서 저장된 좌석 데이터
        db.ref('classManagement/cleaningStatus').once('value').then(statusSnap => {
            const statuses = statusSnap.val() || {}; // { "이름": { roleDone: false, cleanDone: false } }

            let html = `
                <h3 style="color:var(--dark);">🧹 1인 1역 및 청소 확인 (독립 관리)</h3>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">`;

            seats.forEach(seat => {
                const s = statuses[seat.name] || { roleDone: false, cleanDone: false };
                
                html += `
                    <div style="border:1px solid #ddd; padding:10px; border-radius:8px; background:#fff; text-align:center;">
                        <div style="font-weight:bold; margin-bottom:5px;">${seat.name}</div>
                        <div style="display:flex; flex-direction:column; gap:5px;">
                            <!-- 1인 1역 버튼 -->
                            <button onclick="${isMasterManager ? `toggleStatus('${seat.name}', 'roleDone', ${!s.roleDone})` : ''}" 
                                    style="padding:5px; background:${s.roleDone ? '#2ecc71' : '#e74c3c'}; color:white; border:none; border-radius:4px; font-size:0.8rem; cursor:${isMasterManager ? 'pointer' : 'default'};">
                                ${s.roleDone ? '✅ 1인 1역 완료' : '❌ 1인 1역 미완'}
                            </button>
                            <!-- 청소 완료 버튼 -->
                            <button onclick="${isMasterManager ? `toggleStatus('${seat.name}', 'cleanDone', ${!s.cleanDone})` : ''}" 
                                    style="padding:5px; background:${s.cleanDone ? '#2ecc71' : '#e67e22'}; color:white; border:none; border-radius:4px; font-size:0.8rem; cursor:${isMasterManager ? 'pointer' : 'default'};">
                                ${s.cleanDone ? '✅ 청소 완료' : '❌ 청소 미완'}
                            </button>
                        </div>
                    </div>`;
            });
            html += `</div>`;
            container.innerHTML = html;
        });
    });
};

// 총관리자가 클릭 시 상태 변경
window.toggleStatus = function(name, field, newStatus) {
    db.ref(`classManagement/cleaningStatus/${name}/${field}`).set(newStatus).then(() => {
        renderRoleCleaning(); // 새로고침
    });
};
