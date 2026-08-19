// js/blackboard.js
// 선생님이 관리 탭에서 시간표를 수정하면 DB에 저장되고 새창에 반영됨

function saveBlackboardSchedule() {
    const data = document.getElementById('bb-schedule-input').value;
    try {
        db.ref('blackboard/schedule').set(JSON.parse(data));
        alert("시간표 및 설정이 전자칠판에 실시간 반영되었습니다!");
    } catch(e) {
        alert("JSON 형식이 틀렸습니다.");
    }
}

// 현재 시간 체크 및 상태 변경
function updateStatus() {
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const display = document.getElementById('status-display');
    
    // 아침 8시~9시 사이면 '미등교 학생' 모드
    if (currentMin >= 480 && currentMin < 540) {
        display.innerText = "아침 등교 시간입니다.";
    } else {
        display.innerText = "수업 시간입니다.";
    }
}
