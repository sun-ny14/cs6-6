// js/blackboard.js
// 전자칠판 실시간 시계, 웹 UI 기반 시간표 관리 및 교시 자동 매칭

let blackboardTimer = null;
let cachedSchedule = [];

// 기본 기본 시간표 데이터 (데이터베이스에 없을 때 기본값)
const defaultSchedule = [
    { start: "09:00", end: "09:40", name: "1교시 (국어)", action: "1. 국어 교과서 34~35쪽 펴기<br>2. 지난 시간 배운 내용 핵심 짚어보기" },
    { start: "09:50", end: "10:30", name: "2교시 (수학)", action: "1. 수학 익힘책 채점하기<br>2. 모둠별 협력 문제 해결 활동 시작" },
    { start: "10:40", end: "11:20", name: "3교시 (사회)", action: "1. 태블릿 PC 전원 켜고 학습 플랫폼 접속하기<br>2. 모둠 자료 조사 활동 진행" },
    { start: "11:30", end: "12:10", name: "4교시 (과학)", action: "1. 실험 준비물 확인 및 안전수칙 준수하기<br>2. 실험 보고서 작성 준비" },
    { start: "12:10", end: "13:30", name: "점심시간 🍱", action: "맛있게 점심을 먹고 안전하고 즐겁게 휴식하기!" },
    { start: "13:30", end: "14:10", name: "5교시 (영어)", action: "1. 교과서와 공책 준비하기<br>2. 파트너와 함께 대화 연습하기" },
    { start: "14:20", end: "15:00", name: "6교시 (창체)", action: "1. 자율 활동 및 학급 회의 준비<br>2. 오늘 하루 정리 및 주변 청소 정돈" }
];

// 전자칠판 탭 진입 시 실행
function initBlackboard() {
    updateClockAndPeriod();
    if (blackboardTimer) clearInterval(blackboardTimer);
    blackboardTimer = setInterval(updateClockAndPeriod, 1000);
    
    loadBlackboardDataFromDB();
}

// 파이어베이스에서 시간표 데이터 불러오기
function loadBlackboardDataFromDB() {
    db.ref('blackboard/schedule').once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) {
            cachedSchedule = data;
        } else {
            cachedSchedule = defaultSchedule;
            // 최초 기본값 데이터베이스에 저장
            db.ref('blackboard/schedule').set(defaultSchedule);
        }

        // 관리자 패널 텍스트박스에 보기 좋게 JSON 형태로 채워넣기
        const textarea = document.getElementById('bb-schedule-input');
        if (textarea) {
            textarea.value = JSON.stringify(cachedSchedule, null, 4);
        }
    });

    // 관리자(선생님)인 경우에만 수정 패널 노출
    const adminPanel = document.getElementById('admin-blackboard-panel');
    if (adminPanel && isAdmin) {
        adminPanel.style.display = 'block';
    }
}

// 실시간 시계 업데이트 및 시간에 따른 교시/행동 매칭
function updateClockAndPeriod() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timeEl = document.getElementById('bb-current-time');
    if (timeEl) timeEl.innerText = `${hours}:${minutes}:${seconds}`;

    const currentMinutes = parseInt(hours) * 60 + parseInt(minutes);
    
    let currentPeriodName = "쉬는 시간 / 방과 후";
    let currentActionDesc = "다음 수업을 차분히 준비하거나 휴식을 취하세요. 교실 환기 필수!";

    // 저장된 시간표를 순회하며 현재 시간과 비교
    const scheduleToUse = cachedSchedule.length > 0 ? cachedSchedule : defaultSchedule;
    
    for (let slot of scheduleToUse) {
        const [sHour, sMin] = slot.start.split(':').map(Number);
        const [eHour, eMin] = slot.end.split(':').map(Number);
        const startMin = sHour * 60 + sMin;
        const endMin = eHour * 60 + eMin;

        if (currentMinutes >= startMin && currentMinutes < endMin) {
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

// 선생님이 웹 화면에서 시간표 수정 후 저장하기
function saveBlackboardSchedule() {
    const textareaVal = document.getElementById('bb-schedule-input').value;
    
    try {
        const parsedData = JSON.parse(textareaVal);
        db.ref('blackboard/schedule').set(parsedData).then(() => {
            cachedSchedule = parsedData;
            alert("💾 전자칠판 시간표가 웹 화면에 성공적으로 반영되었습니다!");
            updateClockAndPeriod();
        });
    } catch (error) {
        alert("❌ 입력한 형식에 오류가 있습니다. JSON 형식을 확인해 주세요. (따옴표나 괄호 누락 확인)");
        console.error(error);
    }
}
