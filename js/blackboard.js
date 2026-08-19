// js/blackboard.js
let blackboardTimer = null;
let cachedSchedule = [];

const defaultSchedule = [
    { start: "09:00", end: "09:40", name: "1교시 (국어)", action: "1. 국어 교과서 34~35쪽 펴기<br>2. 지난 시간 배운 내용 핵심 짚어보기" },
    { start: "09:50", end: "10:30", name: "2교시 (수학)", action: "1. 수학 익힘책 채점하기<br>2. 모둠별 협력 문제 해결 활동 시작" },
    { start: "10:40", end: "11:20", name: "3교시 (사회)", action: "1. 태블릿 PC 전원 켜고 학습 플랫폼 접속하기<br>2. 모둠 자료 조사 활동 진행" },
    { start: "11:30", end: "12:10", name: "4교시 (과학)", action: "1. 실험 준비물 확인 및 안전수칙 준수하기<br>2. 실험 보고서 작성 준비" },
    { start: "12:10", end: "13:30", name: "점심시간 🍱", action: "맛있게 점심을 먹고 안전하고 즐겁게 휴식하기!" },
    { start: "13:30", end: "14:10", name: "5교시 (영어)", action: "1. 교과서와 공책 준비하기<br>2. 파트너와 함께 대화 연습하기" },
    { start: "14:20", end: "15:00", name: "6교시 (창체)", action: "1. 자율 활동 및 학급 회의 준비<br>2. 오늘 하루 정리 및 주변 청소 정돈" }
];

// 전자칠판 전용 화면(새창) 구동 함수
function initBlackboardForDisplay() {
    updateClockAndPeriod();
    if (blackboardTimer) clearInterval(blackboardTimer);
    blackboardTimer = setInterval(updateClockAndPeriod, 1000);
    
    db.ref('blackboard/schedule').on('value', (snapshot) => {
        const data = snapshot.val();
        cachedSchedule = data ? data : defaultSchedule;
        updateClockAndPeriod();
    });
}

// 본부 앱(관리자 화면) 내에서 관리 탭 열 때 실행
function initBlackboardAdmin() {
    db.ref('blackboard/schedule').once('value').then((snapshot) => {
        const data = snapshot.val() || defaultSchedule;
        const textarea = document.getElementById('bb-schedule-input');
        if (textarea) {
            textarea.value = JSON.stringify(data, null, 4);
        }
    });
    
    const adminPanel = document.getElementById('admin-blackboard-panel');
    if (adminPanel) adminPanel.style.display = 'block';
}

function updateClockAndPeriod() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timeEl = document.getElementById('bb-current-time');
    if (timeEl) timeEl.innerText = `${hours}:${minutes}:${seconds}`;

    const currentMinutes = parseInt(hours) * 60 + parseInt(minutes);
    let currentPeriodName = "쉬는 시간 / 방과 후";
    let currentActionDesc = "다음 수업을 차분히 준비하거나 휴식을 취하세요.";

    const scheduleToUse = cachedSchedule.length > 0 ? cachedSchedule : defaultSchedule;
    
    for (let slot of scheduleToUse) {
        const [sHour, sMin] = slot.start.split(':').map(Number);
        const [eHour, eMin] = slot.end.split(':').map(Number);
        if (currentMinutes >= (sHour * 60 + sMin) && currentMinutes < (eHour * 60 + eMin)) {
            currentPeriodName = slot.name;
            currentActionDesc = slot.action;
            break;
        }
    }

    const periodEl = document.getElementById('bb-current-period');
    const actionEl = document.getElementById('bb-current-action');
    
    if (periodEl) periodEl.innerText = `🔔 현재: ${currentPeriodName}`;
    if (actionEl) actionEl.innerHTML = currentActionDesc;
}

function saveBlackboardSchedule() {
    const textareaVal = document.getElementById('bb-schedule-input').value;
    try {
        const parsedData = JSON.parse(textareaVal);
        db.ref('blackboard/schedule').set(parsedData).then(() => {
            alert("💾 시간표가 저장되었습니다! 교실 앞 전자칠판에 실시간 반영됩니다.");
        });
    } catch (error) {
        alert("❌ JSON 형식 오류입니다. 괄호와 따옴표를 확인해 주세요.");
    }
}
