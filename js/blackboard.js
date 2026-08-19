// js/blackboard.js
// 전자칠판 실시간 시계, 교시 자동 매칭 및 선생님 전용 수정 관리

let blackboardTimer = null;

// 전자칠판 탭 진입 시 실행
function initBlackboard() {
    updateClockAndPeriod();
    if (blackboardTimer) clearInterval(blackboardTimer);
    blackboardTimer = setInterval(updateClockAndPeriod, 1000);
    
    loadBlackboardData();
}

// 실시간 시계 업데이트 및 시간에 따른 교시/행동 매칭
function updateClockAndPeriod() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // 시계 출력
    const timeEl = document.getElementById('bb-current-time');
    if (timeEl) timeEl.innerText = `${hours}:${minutes}:${seconds}`;

    // 분 단위로 환산하여 현재 교시 판별
    const currentTimeNum = parseInt(hours) * 60 + parseInt(minutes);
    
    let currentPeriodName = "쉬는 시간 / 방과 후";
    let currentActionDesc = "다음 수업을 차분히 준비하거나 휴식을 취하세요. 교실 환기 필수!";

    if (currentTimeNum >= 540 && currentTimeNum < 600) {
        currentPeriodName = "1교시 (국어)";
        currentActionDesc = "1. 국어 교과서 34~35쪽 펴기<br>2. 지난 시간 배운 내용 핵심 짚어보기";
    } else if (currentTimeNum >= 600 && currentTimeNum < 660) {
        currentPeriodName = "2교시 (수학)";
        currentActionDesc = "1. 수학 익힘책 채점하기<br>2. 모둠별 협력 문제 해결 활동 시작";
    } else if (currentTimeNum >= 660 && currentTimeNum < 720) {
        currentPeriodName = "3교시 (사회)";
        currentActionDesc = "1. 태블릿 PC 전원 켜고 학습 플랫폼 접속하기<br>2. 모둠 자료 조사 활동 진행";
    } else if (currentTimeNum >= 720 && currentTimeNum < 780) {
        currentPeriodName = "4교시 (과학)";
        currentActionDesc = "1. 실험 준비물 확인 및 안전수칙 준수하기<br>2. 실험 보고서 작성 준비";
    } else if (currentTimeNum >= 780 && currentTimeNum < 840) {
        currentPeriodName = "점심시간 🍱";
        currentActionDesc = "맛있게 점심을 먹고 안전하고 즐겁게 휴식하기!";
    } else if (currentTimeNum >= 840 && currentTimeNum < 900) {
        currentPeriodName = "5교시 (영어)";
        currentActionDesc = "1. 교과서와 공책 준비하기<br>2. 파트너와 함께 대화 연습하기";
    } else if (currentTimeNum >= 900 && currentTimeNum < 960) {
        currentPeriodName = "6교시 (창체)";
        currentActionDesc = "1. 자율 활동 및 학급 회의 준비<br>2. 오늘 하루 정리 및 주변 청소 정돈";
    }

    const periodEl = document.getElementById('bb-current-period');
    const actionEl = document.getElementById('bb-current-action');
    
    if (periodEl) periodEl.innerText = `🔔 현재: ${currentPeriodName}`;
    
    if (!window.bbSpecialNotice) {
        if (actionEl) actionEl.innerHTML = currentActionDesc;
    }
}

// 파이어베이스에서 선생님이 설정한 특별 공지 불러오기
function loadBlackboardData() {
    db.ref('blackboard/notice').once('value').then((snapshot) => {
        const notice = snapshot.val();
        if (notice) {
            window.bbSpecialNotice = notice;
            const actionEl = document.getElementById('bb-current-action');
            if (actionEl) actionEl.innerHTML = `<span style="color:var(--red);">[선생님 특별 공지]<br></span>${notice}`;
            
            const textarea = document.getElementById('bb-custom-notice');
            if (textarea) textarea.value = notice;
        }
    });

    const adminPanel = document.getElementById('admin-blackboard-panel');
    if (adminPanel && isAdmin) {
        adminPanel.style.display = 'block';
    }
}

// 선생님이 수정 공지 저장하기
function saveBlackboardNotice() {
    const noticeText = document.getElementById('bb-custom-notice').value.trim();
    
    db.ref('blackboard/notice').set(noticeText).then(() => {
        window.bbSpecialNotice = noticeText;
        alert("💾 전자칠판 공지 및 행동 지침이 실시간으로 반영되었습니다!");
        updateClockAndPeriod();
    });
}
