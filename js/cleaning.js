// js/cleaning.js
// 1인 1역 및 모둠 청소 현황, 총관리자 확인 체크, 그리고 마감 시간 및 미완료자 알림 통합 시스템

// 1. 메인 렌더링 함수
window.renderRoleCleaning = function() {
    const cleaningTab = document.getElementById('tab-cleaning');
    if (!cleaningTab) return;

    // 권한 체크: 선생님(isAdmin) 또는 총관리자 1, 총관리자 2 인지 확인
    const isMasterManager = (typeof isAdmin !== 'undefined' && isAdmin) || 
                            (typeof myName !== 'undefined' && (myName === "총관리자 1" || myName === "총관리자 2"));

    const adminSetter = document.getElementById('admin-role-cleaning-setter');
    if (adminSetter) {
        adminSetter.style.display = (typeof isAdmin !== 'undefined' && isAdmin) ? 'block' : 'none';
    }

    // 마감 시간 및 미완료자 체크 실행
    checkCleaningDeadlineAndDisplay();

    db.ref('classManagement/roleCleaning').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        const roles = data.roles || {};
        const groupCleaning = data.groupCleaning || {};

        // 1인 1역 현황 HTML 생성
        let roleHtml = `<ul style="list-style: none; padding: 0; font-size: 1.2rem;">`;
        for (let roleName in roles) {
            let item = roles[roleName];
            let studentName = (typeof item === 'object') ? item.student : item;
            let isDone = (typeof item === 'object') ? item.isDone : false;

            let actionBtn = "";
            if (isMasterManager) {
                actionBtn = `<button onclick="toggleRoleDone('${roleName}', ${!isDone})" style="padding: 6px 14px; background: ${isDone ? '#95a5a6' : '#2ecc71'}; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">${isDone ? '체크 취소' : '✔️ 확인 완료'}</button>`;
            }

            let statusBadge = isDone ? `<span style="background: #2ecc71; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.9rem; font-weight: bold;">확인 완료 ✨</span>` : `<span style="background: #e74c3c; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.9rem;">미완료</span>`;

            roleHtml += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed #eee;">
                    <div><b>${roleName}</b>: ${studentName} &nbsp; ${statusBadge}</div>
                    <div>${actionBtn}</div>
                </li>`;
        }
        roleHtml += `</ul>`;
        const roleContainer = document.getElementById('role-status-container');
        if (roleContainer) roleContainer.innerHTML = roleHtml || "<p>배정된 역할이 없습니다.</p>";

        // 모둠별 청소 현황 HTML 생성
        let groupHtml = `<ul style="list-style: none; padding: 0; font-size: 1.2rem;">`;
        for (let groupName in groupCleaning) {
            let item = groupCleaning[groupName];
            let zoneName = (typeof item === 'object') ? item.zone : item;
            let isDone = (typeof item === 'object') ? item.isDone : false;

            let actionBtn = "";
            if (isMasterManager) {
                actionBtn = `<button onclick="toggleGroupDone('${groupName}', ${!isDone})" style="padding: 6px 14px; background: ${isDone ? '#95a5a6' : '#e67e22'}; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">${isDone ? '체크 취소' : '✔️ 청소 완료'}</button>`;
            }

            let statusBadge = isDone ? `<span style="background: #2ecc71; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.9rem; font-weight: bold;">확인 완료 ✨</span>` : `<span style="background: #e74c3c; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.9rem;">미완료</span>`;

            groupHtml += `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed #eee;">
                    <div><b>${groupName}</b> (${zoneName}) &nbsp; ${statusBadge}</div>
                    <div>${actionBtn}</div>
                </li>`;
        }
        groupHtml += `</ul>`;
        const groupContainer = document.getElementById('group-cleaning-container');
        if (groupContainer) groupContainer.innerHTML = groupHtml || "<p>배정된 모둠 청소가 없습니다.</p>";
    });
};

// 2. 총관리자 및 선생님용 체크 토글 함수 (1인 1역)
window.toggleRoleDone = function(roleName, newStatus) {
    db.ref(`classManagement/roleCleaning/roles/${roleName}`).once('value').then(snap => {
        let val = snap.val();
        let studentName = (typeof val === 'object') ? val.student : val;

        db.ref(`classManagement/roleCleaning/roles/${roleName}`).set({
            student: studentName,
            isDone: newStatus
        }).then(() => {
            renderRoleCleaning();
        });
    });
};

// 3. 총관리자 및 선생님용 체크 토글 함수 (모둠 청소)
window.toggleGroupDone = function(groupName, newStatus) {
    db.ref(`classManagement/roleCleaning/groupCleaning/${groupName}`).once('value').then(snap => {
        let val = snap.val();
        let zoneName = (typeof val === 'object') ? val.zone : val;

        db.ref(`classManagement/roleCleaning/groupCleaning/${groupName}`).set({
            zone: zoneName,
            isDone: newStatus
        }).then(() => {
            renderRoleCleaning();
        });
    });
};

// 4. 청소 마감 시간 검사 및 상단 배너 표시 함수
function checkCleaningDeadlineAndDisplay() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    db.ref('classManagement/settings').once('value').then(snap => {
        const settings = snap.val() || { cleaningDeadline: "12:45" };
        
        if (currentTime > settings.cleaningDeadline) {
            displayUnfinishedCleaners(settings.cleaningDeadline);
        }
    });
}

// 5. 미완료 인원 상단 배너 렌더링
function displayUnfinishedCleaners(deadline) {
    db.ref('classManagement/roleCleaning/groupCleaning').once('value').then(snap => {
        let unfinishedList = [];
        snap.forEach(child => {
            const data = child.val();
            let isDone = (typeof data === 'object') ? data.isDone : false;
            let zoneName = (typeof data === 'object') ? data.zone : data;
            if (!isDone) {
                unfinishedList.push(`${child.key} (${zoneName})`);
            }
        });
        
        if (unfinishedList.length === 0) return;

        let alertHtml = `
            <div style="background:#ffe3e3; border:2px solid #ff6b6b; padding:20px; border-radius:12px; margin-bottom:25px; color:#c92a2a;">
                <h3 style="margin:0 0 10px 0;">🚨 [청소 미완료 경고] 마감 시간(${deadline}) 초과!</h3>
                <p style="font-size:1.2rem; font-weight:bold; margin:0;">남아서 청소해야 하는 모둠/사람: 
        `;
        
        unfinishedList.forEach(item => {
            alertHtml += `<span style="background:white; padding:4px 8px; border-radius:6px; margin-right:5px; border:1px solid #ff6b6b;">${item}</span>`;
        });
        
        alertHtml += `</p></div>`;
        
        const container = document.getElementById('tab-cleaning');
        if (container) {
            let existingBanner = document.getElementById('cleaning-warning-banner');
            if (!existingBanner) {
                let banner = document.createElement('div');
                banner.id = 'cleaning-warning-banner';
                banner.innerHTML = alertHtml;
                container.prepend(banner);
            }
        }
    });
}

// 6. 1인 1역 배정 팝업 열기 (선생님 전용)
window.openRoleSettingPopup = function() {
    if (typeof isAdmin === 'undefined' || !isAdmin) {
        return alert("⚠️ 1인 1역 역할 배정은 선생님만 할 수 있습니다!");
    }
    
    let content = `
        <h3 style="margin-top:0;">📝 1인 1역 역할 설정</h3>
        역할명 (예: 칠판 지우개): <input type="text" id="input-role-name" style="width:100%; padding:10px; margin-bottom:10px; box-sizing:border-box;"><br>
        담당 학생 이름: <input type="text" id="input-role-student" style="width:100%; padding:10px; margin-bottom:15px; box-sizing:border-box;"><br>
        <button onclick="saveRoleAssignment()" style="background:#2ecc71; color:white; width:100%; padding:15px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">저장하기</button>
    `;
    openPopup("1인 1역 관리", content);
};

window.saveRoleAssignment = function() {
    const roleName = document.getElementById('input-role-name').value.trim();
    const studentName = document.getElementById('input-role-student').value.trim();

    if (!roleName || !studentName) {
        alert("역할명과 담당 학생을 모두 입력해 주세요!");
        return;
    }

    db.ref(`classManagement/roleCleaning/roles/${roleName}`).set({
        student: studentName,
        isDone: false
    }).then(() => {
        alert("✅ 1인 1역이 성공적으로 등록되었습니다!");
        closePopup();
        renderRoleCleaning();
    });
};

// 7. 모둠별 청소 구역 지정 팝업 열기 (선생님 전용)
window.openGroupCleaningPopup = function() {
    if (typeof isAdmin === 'undefined' || !isAdmin) {
        return alert("⚠️ 모둠 청소 구역 지정은 선생님만 할 수 있습니다!");
    }

    let content = `
        <h3 style="margin-top:0;">🧹 모둠별 청소 구역 지정</h3>
        모둠 이름 (예: 1모둠): <input type="text" id="input-group-name" style="width:100%; padding:10px; margin-bottom:10px; box-sizing:border-box;"><br>
        청소 구역 (예: 앞 복도 및 창틀): <input type="text" id="input-group-zone" style="width:100%; padding:10px; margin-bottom:15px; box-sizing:border-box;"><br>
        <button onclick="saveGroupCleaning()" style="background:#e67e22; color:white; width:100%; padding:15px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">저장하기</button>
    `;
    openPopup("모둠 청소 관리", content);
};

window.saveGroupCleaning = function() {
    const groupName = document.getElementById('input-group-name').value.trim();
    const zoneName = document.getElementById('input-group-zone').value.trim();

    if (!groupName || !zoneName) {
        alert("모둠 이름과 청소 구역을 모두 입력해 주세요!");
        return;
    }

    db.ref(`classManagement/roleCleaning/groupCleaning/${groupName}`).set({
        zone: zoneName,
        isDone: false
    }).then(() => {
        alert("✅ 모둠 청소 구역이 성공적으로 지정되었습니다!");
        closePopup();
        renderRoleCleaning();
    });
};
