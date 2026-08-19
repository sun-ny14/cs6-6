// js/checkin-seat.js
// 등교 확인, 암호 체크, 좌석 배치 및 등교 로그/엑셀 다운로드 관리

// 등교 확인 화면 초기화 및 가이드 표시
function renderCheckinBoard() {
    const guideEl = document.getElementById('checkin-guide');
    if (guideEl) {
        guideEl.innerText = `오늘(${getTodayKST()})의 등교 본부를 확인하고 암호를 입력하세요.`;
    }
    
    // 기본 날짜 필터 값이 비어있다면 오늘 날짜로 초기화
    const dateFilter = document.getElementById('checkin-date-filter');
    if (dateFilter && !dateFilter.value) {
        dateFilter.value = getTodayKST();
    }
    
    generateNewLayout();
}

// 등교 암호 제출 및 체크인 실행
function submitCheckIn() {
    const passInput = document.getElementById('checkin-pass');
    if (!passInput) return;
    
    const inputPass = passInput.value.trim();
    if (!inputPass) {
        alert("등교 암호 4자리를 입력해 주세요.");
        return;
    }
    
    // 파이어베이스에서 설정된 오늘의 암호 확인 후 출석 처리 로직
    db.ref('settings/password').once('value').then((snapshot) => {
        const correctPass = snapshot.val() || "1234";
        
        if (inputPass === correctPass) {
            const today = getTodayKST();
            db.ref(`checkins/${today}/${myName}`).set({
                time: new Date().toLocaleTimeString(),
                status: "출석완료"
            }).then(() => {
                alert("🎉 성공적으로 등교(본부 소환)되었습니다!");
                passInput.value = "";
                generateNewLayout(); // 등교 즉시 좌석 배치판 갱신
            });
        } else {
            alert("❌ 등교 암호가 틀렸습니다. 다시 확인해 주세요.");
        }
    });
}

// 좌석 배치도 생성 및 렌더링 (선택된 날짜의 등교 기록 연동)
function generateNewLayout() {
    const mapContainer = document.getElementById('seat-map-container');
    if (!mapContainer) return;
    
    // 선택된 조회 날짜 가져오기 (없으면 오늘 날짜 사용)
    const dateInput = document.getElementById('checkin-date-filter');
    const selectedDate = dateInput && dateInput.value ? dateInput.value : getTodayKST();

    // 좌석 배치 정보와 해당 날짜의 등교 출석 기록을 동시에 불러옴
    Promise.all([
        db.ref('seatLayout').once('value'),
        db.ref(`checkins/${selectedDate}`).once('value')
    ]).then(([layoutSnapshot, checkinSnapshot]) => {
        currentLayout = layoutSnapshot.val() || { cols: 5, rows: 6 };
        const checkins = checkinSnapshot.val() || {};
        
        let cols = currentLayout.cols || 5;
        let rows = currentLayout.rows || 6;
        
        mapContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(60px, 1fr))`;
        
        let html = '';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let seatKey = `${r}_${c}`;
                let studentName = currentLayout.seats && currentLayout.seats[seatKey] ? currentLayout.seats[seatKey] : "";
                
                // 해당 학생이 선택한 날짜에 등교 완료했는지 확인
                let isCheckedIn = studentName && checkins[studentName];
                let bgColor = isCheckedIn ? '#d4edda' : '#ffffff'; // 출석 완료 시 연한 초록색 배경
                let statusBadge = isCheckedIn ? '<span style="font-size:0.7rem; color:#28a745; margin-top:2px;">출석완료</span>' : '';

                html += `
                    <div class="room-tile" style="aspect-ratio: 1; display:flex; flex-direction:column; justify-content:center; align-items:center; border-radius:10px; font-weight:bold; font-size:1rem; background:${bgColor}; border:1px solid #ddd; cursor:pointer;" onclick="handleSeatClick('${seatKey}')">
                        <span>${studentName || `${r+1}-${c+1}`}</span>
                        ${studentName ? statusBadge : ''}
                    </div>
                `;
            }
        }
        mapContainer.innerHTML = html;
    });
}

// 좌석 클릭 이벤트 처리 (배치 수정 모드 연동)
function handleSeatClick(seatKey) {
    if (!isEditMode) {
        if (currentLayout.seats && currentLayout.seats[seatKey]) {
            alert(`선택한 좌석 학생: ${currentLayout.seats[seatKey]}`);
        } else {
            alert(`선택한 빈 좌석 위치: ${seatKey}`);
        }
        return;
    }
    
    if (selectedStudentForMove) {
        if (!currentLayout.seats) currentLayout.seats = {};
        currentLayout.seats[seatKey] = selectedStudentForMove;
        selectedStudentForMove = null;
        generateNewLayout();
        alert("좌석 배치가 변경되었습니다. '배치 저장'을 눌러주세요.");
    } else {
        alert("이동할 학생을 먼저 선택하거나 지정해 주세요.");
    }
}

// 좌석 배치 수정 모드 토글
function toggleSeatEditMode() {
    isEditMode = !isEditMode;
    const panel = document.getElementById('seat-edit-panel');
    const btn = document.getElementById('edit-mode-btn');
    
    if (isEditMode) {
        if (panel) panel.style.display = 'block';
        if (btn) { btn.style.background = 'var(--red)'; btn.innerText = '🪑 수정 완료'; }
        alert("좌석 배치 수정 모드가 켜졌습니다.");
    } else {
        if (panel) panel.style.display = 'none';
        if (btn) { btn.style.background = 'var(--dark)'; btn.innerText = '🪑 좌석 배치 수정'; }
        generateNewLayout();
    }
}

// 좌석 배치 저장
function saveSeatLayout() {
    const cols = parseInt(document.getElementById('seat-cols').value) || 5;
    const rows = parseInt(document.getElementById('seat-rows').value) || 6;
    
    currentLayout.cols = cols;
    currentLayout.rows = rows;
    
    db.ref('seatLayout').set(currentLayout).then(() => {
        alert("💾 좌석 배치가 데이터베이스에 안전하게 저장되었습니다!");
        toggleSeatEditMode();
    });
}

// 고정 등교 제외 설정 팝업 열기
function openExclusionPopup() {
    alert("고정 등교 제외 설정 기능 창입니다.");
}

// 월별 출석 엑셀 다운로드
function downloadMonthlyExcel() {
    if (typeof XLSX === 'undefined') {
        alert("엑셀 라이브러리가 로드되지 않았습니다.");
        return;
    }
    alert("📊 이번 달 등교 기록을 엑셀 파일로 변환합니다.");
}
