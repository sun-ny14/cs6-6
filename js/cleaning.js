// js/cleaning.js - 1인 1역 및 청소 독립 확인 시스템 (좌석 배치 및 설정 연동 버전)

window.renderRoleCleaning = function() {
    const container = document.getElementById('tab-cleaning');
    if (!container) return;

    // 1. 총관리자(총사령관, 관리자1, 관리자2) 또는 선생님 권한 확인
    const isMasterManager = (typeof isAdmin !== 'undefined' && isAdmin) || 
                            (typeof myName !== 'undefined' && (myName === "총사령관" || myName === "관리자1" || myName === "관리자2"));

    // 2. 설정된 행/열 크기 가져오기
    const rows = typeof currentRows !== 'undefined' ? currentRows : 6;
    const cols = typeof currentCols !== 'undefined' ? currentCols : 6;

    // 3. 데이터베이스에서 1인 1역 역할 정보와 청소/역할 완료 상태를 동시에 불러옴
    Promise.all([
        db.ref('settings/studentRoles').once('value'), // settings.js에서 저장한 1인 1역 역할 데이터
        db.ref('classManagement/cleaningStatus').once('value') // 완료 체크 상태 데이터
    ]).then(snaps => {
        const studentRoles = snaps[0].val() || {}; // 예: { "김철수": "우유당번", "이영희": "칠판당번" }
        const statuses = snaps[1].val() || {};    // 예: { "김철수": { roleDone: true, cleanDone: false } }

        // 💡 가로 배치의 답답함을 없애고, 시원한 세로형 리스트 레이아웃 적용
        let html = `
            <div style="max-width: 700px; margin: 0 auto; padding: 10px;">
                <h3 style="color:var(--dark, #333); text-align:center; margin-bottom: 20px;">🧹 1인 1역 및 청소 독립 확인 시스템</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
        `;

        let hasAssignedSeat = false;

        // 4. 좌석 배치도(currentLayout)를 기준으로 자리에 앉은 학생들만 추출하여 렌더링
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const posId = `${r}-${c}`;
                const name = typeof currentLayout !== 'undefined' ? (currentLayout[posId] || "") : "";
                
                if (!name) continue; // 빈 자리는 건너뜁니다.
                hasAssignedSeat = true;

                const roleName = studentRoles[name] || "역할 미지정"; // 1인 1역 명칭
                const s = statuses[name] || { roleDone: false, cleanDone: false };

                const roleBg = s.roleDone ? '#ebfbee' : '#f8f9fa';
                const roleBorder = s.roleDone ? '#2b8a3e' : '#ced4da';
                
                const cleanBg = s.cleanDone ? '#ebfbee' : '#f8f9fa';
                const cleanBorder = s.cleanDone ? '#2b8a3e' : '#ced4da';

                html += `
                    <div style="background:white; border:2px solid #e9ecef; border-radius:12px; padding:15px 20px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                        <!-- 좌측: 학생 이름 및 1인 1역 직책 -->
                        <div>
                            <div style="font-weight:900; font-size:1.4rem; color:#333; margin-bottom:4px;">${name}</div>
                            <div style="font-size:0.95rem; font-weight:bold; color:var(--primary, #3498db); background:rgba(52, 152, 219, 0.1); padding:3px 8px; border-radius:6px; display:inline-block;">
                                🎯 1인 1역: ${roleName}
                            </div>
                        </div>

                        <!-- 우측: 독립된 완료 체크 버튼들 -->
                        <div style="display:flex; gap:10px;">
                            <!-- 1인 1역 완료 버튼 -->
                            <button onclick="${isMasterManager ? `toggleStatus('${name}', 'roleDone', ${!s.roleDone})` : `alert('🚫 총관리자만 체크할 수 있습니다.');`}" 
                                style="padding:10px 14px; background:${roleBg}; border:2px solid ${roleBorder}; color:${s.roleDone ? '#2b8a3e' : '#495057'}; border-radius:8px; font-weight:bold; font-size:0.95rem; cursor:pointer; transition:0.2s;">
                                ${s.roleDone ? '✅ 1인 1역 완료' : '❌ 1인 1역 미완'}
                            </button>

                            <!-- 청소 완료 버튼 -->
                            <button onclick="${isMasterManager ? `toggleStatus('${name}', 'cleanDone', ${!s.cleanDone})` : `alert('🚫 총관리자만 체크할 수 있습니다.');`}" 
                                style="padding:10px 14px; background:${cleanBg}; border:2px solid ${cleanBorder}; color:${s.cleanDone ? '#2b8a3e' : '#495057'}; border-radius:8px; font-weight:bold; font-size:0.95rem; cursor:pointer; transition:0.2s;">
                                ${s.cleanDone ? '✅ 청소 완료' : '❌ 청소 미완'}
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        if (!hasAssignedSeat) {
            html += `<div style="text-align:center; padding:30px; color:#888; background:#f8f9fa; border-radius:12px;">배치된 자리 정보가 없습니다. 설정 탭에서 좌석을 먼저 배치해 주세요!</div>`;
        }

        html += `</div></div>`;
        container.innerHTML = html;
    }).catch(err => {
        console.error("청소/역할 데이터 로딩 에러:", err);
    });
};

// 5. 총관리자가 클릭 시 상태 변경 후 화면 새로고침
window.toggleStatus = function(name, field, newStatus) {
    db.ref(`classManagement/cleaningStatus/${name}/${field}`).set(newStatus).then(() => {
        renderRoleCleaning(); 
    });
};