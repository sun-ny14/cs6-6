// js/blackboard-admin.js
// 교사용 관리 탭 전용 전자칠판 제어 로직

// 관리 탭 진입 시 데이터 불러오기
function initBlackboardAdmin() {
    db.ref('blackboard/schedule').once('value').then((snapshot) => {
        const data = snapshot.val();
        const textarea = document.getElementById('bb-schedule-input');
        if (textarea) {
            textarea.value = JSON.stringify(data, null, 4);
        }
    });
}

// 시간표 저장하기
function saveBlackboardSchedule() {
    const textareaVal = document.getElementById('bb-schedule-input').value;
    try {
        const parsedData = JSON.parse(textareaVal);
        db.ref('blackboard/schedule').set(parsedData).then(() => {
            alert("💾 시간표가 저장되었습니다. 전자칠판 화면에 실시간 반영됩니다!");
        });
    } catch (error) {
        alert("❌ JSON 형식이 올바르지 않습니다. 따옴표와 괄호를 확인해 주세요.");
    }
}
