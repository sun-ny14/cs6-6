// js/blackboard-admin.js
// 교사용 관리 탭 전용 전자칠판 제어 로직 (입력 폼 기반)

// 관리 탭 진입 시 데이터 불러와서 폼 형태로 뿌려주기
function initBlackboardAdmin() {
    db.ref('blackboard/schedule').once('value').then((snapshot) => {
        const data = snapshot.val() || {};
        const container = document.getElementById('bb-schedule-form-container');
        if (!container) return;

        container.innerHTML = '';

        // 기본적으로 1교시부터 7교시 + 청소/점심시간 등을 상정하여 폼 생성
        // 데이터가 있다면 그 값을 채워넣고, 없으면 빈 칸으로 생성합니다.
        const periods = ['1교시', '2교시', '3교시', '4교시', '점심시간', '5교시', '6교시', '청소시간'];

        periods.forEach((periodName) => {
            const periodData = data[periodName] || { startTime: '', endTime: '', subject: periodName, action: '' };

            const box = document.createElement('div');
            box.style.cssText = "background: #f8f9fa; padding: 15px; border-radius: 10px; border: 1px solid #ddd; display: flex; flex-direction: column; gap: 10px;";
            
            box.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: var(--dark);">
                    <span>📌 ${periodName}</span>
                    <input type="text" class="bb-subject" data-period="${periodName}" value="${periodData.subject || periodName}" placeholder="과목명 (예: 수학)" style="padding: 5px; width: 150px; border-radius: 5px; border: 1px solid #ccc;">
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <label style="font-size: 0.9rem;">시작:</label>
                    <input type="time" class="bb-start" data-period="${periodName}" value="${periodData.startTime || ''}" style="padding: 5px; border-radius: 5px; border: 1px solid #ccc;">
                    <label style="font-size: 0.9rem;">종료:</label>
                    <input type="time" class="bb-end" data-period="${periodName}" value="${periodData.endTime || ''}" style="padding: 5px; border-radius: 5px; border: 1px solid #ccc;">
                </div>
                <div>
                    <textarea class="bb-action" data-period="${periodName}" rows="2" placeholder="이번 시간 해야 할 행동 및 안내" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid #ccc; font-family: inherit;">${periodData.action || ''}</textarea>
                </div>
            `;
            container.appendChild(box);
        });
    });
}

// 폼 입력값을 모아서 JSON 구조로 변환 후 저장하기
function saveBlackboardScheduleFromForm() {
    const container = document.getElementById('bb-schedule-form-container');
    if (!container) return;

    const newScheduleData = {};
    const periods = ['1교시', '2교시', '3교시', '4교시', '점심시간', '5교시', '6교시', '청소시간'];

    periods.forEach(periodName => {
        const subjectInput = container.querySelector(`.bb-subject[data-period="${periodName}"]`);
        const startInput = container.querySelector(`.bb-start[data-period="${periodName}"]`);
        const endInput = container.querySelector(`.bb-end[data-period="${periodName}"]`);
        const actionInput = container.querySelector(`.bb-action[data-period="${periodName}"]`);

        if (subjectInput && startInput && endInput && actionInput) {
            newScheduleData[periodName] = {
                subject: subjectInput.value,
                startTime: startInput.value,
                endTime: endInput.value,
                action: actionInput.value
            };
        }
    });

    db.ref('blackboard/schedule').set(newScheduleData).then(() => {
        alert("💾 시간표가 깔끔하게 저장되었습니다! 전자칠판 화면에 실시간 반영됩니다.");
    }).catch((error) => {
        console.error("저장 실패:", error);
        alert("❌ 저장 중 오류가 발생했습니다. 다시 시도해 주세요.");
    });
}
