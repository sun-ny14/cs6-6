// js/checkin-seat.js - 좌석 맵 렌더링, 출결 관리, 월간 출석부(인쇄 지원), 상세 기록 수정 및 요일별 제외 설정 통합 관리

// 1. 좌석 지도 렌더링 및 출석 상태별 색상/뱃지 부여
window.renderSeatMap = function(rows, cols) {
    const container = document.getElementById('seat-map-container');
    if (!container) return;
    
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.innerHTML = "";
    
    const dateFilterInput = document.getElementById('checkin-date-filter');
    const targetDate = dateFilterInput && dateFilterInput.value ? dateFilterInput.value : getTodayKST();
    
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const selectedDay = weekDays[new Date(targetDate).getDay()];

    Promise.all([
        db.ref('checkinLogs').once('value'),
        db.ref('settings/fixedExclusions').once('value')
    ]).then(snaps => {
        const logs = {};
        snaps[0].forEach(l => { 
            if (l.val().date === targetDate) logs[l.val().name] = l.val(); 
        });
        
        const exclusionData = snaps[1].val() || {};
        const todayExclusions = exclusionData[selectedDay] || [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const posId = `${r}-${c}`;
                const name = (typeof currentLayout !== 'undefined' && currentLayout[posId]) ? currentLayout[posId] : "";
                const cell = document.createElement('div');
                
                let bgColor = "#eee"; 
                let statusText = "미등교";
                let textColor = "black";

                if (name) {
                    const log = logs[name]; 
                    const isFixedExcluded = todayExclusions.includes(name); 

                    if (log) {
                        statusText = log.result;
                        if (log.result.includes('정상')) bgColor = "#ccffcc"; // 연한 초록
                        else if (log.result.includes('지각')) bgColor = "#ffcccc"; // 연한 빨강
                        else {
                            bgColor = "#f39c12"; // 주황
                            statusText = log.result;
                        }
                    } 
                    else if (isFixedExcluded) {
                        bgColor = "#3498db"; // 파랑
                        statusText = "고정 제외";
                        textColor = "white";
                    } 
                    else {
                        bgColor = "#ffff00"; // 노랑 (미등교 상태)
                        statusText = "미등교";
                    }
                }

                cell.style = `background:${bgColor}; border:1px solid #bbb; min-height:120px; border-radius:12px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:5px; cursor:pointer; color: ${textColor}; user-select:none; box-sizing:border-box;`;

                if (name) {
                    cell.innerHTML = `
                        <div style="font-weight:900; font-size:1.6rem; margin-bottom:5px;">${name}</div>
                        <div style="font-weight:bold; font-size:1.2rem;">${statusText}</div>
                        <div style="font-size:1.1rem; margin-top:3px;">${logs[name]?.time && logs[name].time !== '-' ? '[' + logs[name].time + ']' : ''}</div>
                    `;
                } else {
                    cell.innerHTML = `<div style="color:#aaa; font-size:0.9rem;">${r+1}-${c+1}</div>`;
                }
                
                cell.dataset.lastClick = 0;
                cell.onclick = () => {
                    if (typeof isEditMode !== 'undefined' && isEditMode) {
                        openStudentPicker(posId, rows, cols);
                        return;
                    }
                    if (!name) return;

                    const now = Date.now();
                    const lastClick = parseInt(cell.dataset.lastClick) || 0;
                    if (now - lastClick < 50) return; 
                    cell.dataset.lastClick = now;

                    if (cell.clickTimer) {
                        clearTimeout(cell.clickTimer);
                        cell.clickTimer = null;
                        openLogEditPopup(name, targetDate); 
                    } else {
                        cell.clickTimer = setTimeout(() => {
                            cell.clickTimer = null;
                            if (typeof handleCheckinClick === 'function') {
                                handleCheckinClick(name);
                            }
                        }, 200); 
                    }
                };
                container.appendChild(cell);
            }
        }
    });
};

// 2. 좌석 수정 모드에서 특정 칸을 클릭했을 때 학생을 선택하는 팝업 창
window.openStudentPicker = function(posId, rows, cols) {
    if (typeof currentLayout === 'undefined') window.currentLayout = {};
    const assignedNames = Object.values(currentLayout);
    
    let h = `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; padding:10px; max-height:400px; overflow-y:auto;">`;
    
    h += `<button onclick="assignStudentToSeat('${posId}', '', ${rows}, ${cols})" style="background:#e74c3c; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">❌ 비우기</button>`;
    
    if (typeof currentUsers !== 'undefined') {
        currentUsers.forEach(u => {
            if (u.name === "총사령관") return;
            const isAssigned = assignedNames.includes(u.name);
            h += `<button onclick="assignStudentToSeat('${posId}', '${u.name}', ${rows}, ${cols})" 
                    style="background:${isAssigned ? '#95a5a6' : 'var(--primary, #3498db)'}; color:white; font-size:1.1rem; padding:12px 5px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
                    ${u.name}${isAssigned ? ' (배치됨)' : ''}
                  </button>`;
        });
    }
    h += `</div>`;
    
    if (typeof openPopup === 'function') {
        openPopup("🧑‍🎓 학생 배치", h);
    }
};

window.assignStudentToSeat = function(posId, name, rows, cols) {
    if (typeof currentLayout === 'undefined') window.currentLayout = {};
    
    if (name === "") {
        delete currentLayout[posId];
    } else {
        for (let key in currentLayout) {
            if (currentLayout[key] === name) {
                delete currentLayout[key];
            }
        }
        currentLayout[posId] = name;
    }
    
    if (typeof closePopup === 'function') closePopup();
    if (typeof renderSeatMap === 'function') {
        renderSeatMap(rows, cols);
    }
};

// 3. 출결 원클릭 / 더블클릭 제어 시스템
window.attendanceClickTimer = null;
window.handleCheckinClick = function(user) {
    if (window.attendanceClickTimer) {
        clearTimeout(window.attendanceClickTimer);
        window.attendanceClickTimer = null;
        openDetailedCheckin(user);
    } else {
        window.attendanceClickTimer = setTimeout(() => {
            window.attendanceClickTimer = null;
            submitCheckin(user, '정상 등교');
        }, 250); 
    }
};

window.openDetailedCheckin = function(user) {
    let h = `
        <div style="text-align:center;">
            <h3 style="margin-top:0;">${user} 출결 상태 변경</h3>
            <select id="checkin-reason" style="width:100%; padding:15px; font-size:1.1rem; border-radius:10px; margin-bottom:20px;">
                <option value="정상 등교">✅ 정상 등교</option>
                <option value="결석">❌ 결석 (질병/미인정 등)</option>
                <option value="교외체험학습">🎒 교외체험학습</option>
                <option value="지각">⏰ 지각</option>
                <option value="조퇴">🏃 조퇴</option>
            </select>
            <button onclick="submitCheckin('${user}', document.getElementById('checkin-reason').value)" style="width:100%; padding:15px; background:var(--gold, #f1c40f); font-weight:bold; font-size:1.2rem; border:none; border-radius:10px; cursor:pointer;">출결 기록 저장</button>
        </div>
    `;
    if (typeof openPopup === 'function') openPopup("출석 관리", h);
};

// 4. 출석 기록 저장 함수 (시간 및 날짜 처리 완벽 정돈)
window.submitCheckin = function(user, reason) {
    const todayStr = (typeof getTodayKST === 'function') ? getTodayKST() : new Date().toISOString().split('T')[0];
    const timeStr = reason.includes('정상') ? "" : new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    db.ref('checkins').push({
        user: user, 
        reason: reason, 
        date: todayStr,
        time: timeStr, 
        docSubmitted: false
    }).then(() => {
        alert(`[${user}] ${reason} 처리 완료! ✨`);
        
        if (typeof closePopup === 'function') closePopup();
        if (typeof appendExtraLogsUI === 'function') appendExtraLogsUI();
        
        const rowsEl = document.getElementById('seat-rows');
        const colsEl = document.getElementById('seat-cols');
        if (rowsEl && colsEl && typeof renderSeatMap === 'function') {
            renderSeatMap(parseInt(rowsEl.value), parseInt(colsEl.value));
        }
    });
};

// 5. 등교 기록 상세 수정 팝업 열기 (더블클릭 시 작동)
window.openLogEditPopup = function(name, date) {
    db.ref('checkinLogs').once('value', snap => {
        let logKey = null;
        let logData = {};
        snap.forEach(c => {
            if (c.val().name === name && c.val().date === date) {
                logKey = c.key;
                logData = c.val();
            }
        });

        const h = `
            <div style="text-align:left; padding:10px;">
                <h3 style="text-align:center;">${name} 등교 상세 기록</h3>
                <label style="display:block; margin-top:10px; font-weight:bold;">🚩 등교 상태 (대항목)</label>
                <select id="edit-cat" style="width:100%; padding:8px; margin-top:5px; border-radius:6px; border:1px solid #ccc;">
                    <option value="정상" ${logData.result === '정상 등교' ? 'selected' : ''}>정상 등교</option>
                    <option value="지각" ${logData.result === '지각 등교' ? 'selected' : ''}>지각</option>
                    <option value="결석" ${logData.category === '결석' ? 'selected' : ''}>결석</option>
                    <option value="조퇴" ${logData.category === '조퇴' ? 'selected' : ''}>조퇴</option>
                    <option value="제외" ${logData.category === '제외' ? 'selected' : ''}>기록 제외(방과후 등)</option>
                </select>

                <label style="display:block; margin-top:10px; font-weight:bold;">🔍 사유 구분 (소항목)</label>
                <select id="edit-sub" style="width:100%; padding:8px; margin-top:5px; border-radius:6px; border:1px solid #ccc;">
                    <option value="해당없음" ${logData.subCategory === '해당없음' ? 'selected' : ''}>-</option>
                    <option value="질병" ${logData.subCategory === '질병' ? 'selected' : ''}>질병</option>
                    <option value="인정" ${logData.subCategory === '인정' ? 'selected' : ''}>인정</option>
                    <option value="미인정" ${logData.subCategory === '미인정' ? 'selected' : ''}>미인정</option>
                    <option value="기타" ${logData.subCategory === '기타' ? 'selected' : ''}>기타</option>
                </select>

                <label style="display:block; margin-top:10px; font-weight:bold;">📝 구체적 사유 기록</label>
                <textarea id="edit-desc" rows="3" placeholder="예: 아침 방과후 농구팀, 독감으로 인한 결석 등" style="width:100%; padding:8px; margin-top:5px; border-radius:6px; border:1px solid #ccc; box-sizing:border-box;">${logData.reason || ''}</textarea>
                
                <button onclick="saveDetailLog('${name}', '${date}', '${logKey}')" style="width:100%; background:var(--primary, #3498db); color:white; font-weight:bold; margin-top:15px; padding:12px; border:none; border-radius:8px; cursor:pointer;">상태 및 사유 저장</button>
            </div>
        `;
        if (typeof openPopup === 'function') {
            openPopup("📊 등교 기록 수정", h);
        }
    });
};

window.saveDetailLog = function(name, date, key) {
    const category = document.getElementById('edit-cat').value;
    const subCategory = document.getElementById('edit-sub').value;
    const reason = document.getElementById('edit-desc').value;
    
    let resultText = category;
    if (category === '정상' || category === '지각') resultText = category + ' 등교';

    const updateData = {
        name: name,
        date: date,
        category: category,
        subCategory: subCategory,
        reason: reason,
        result: resultText,
        time: "-" 
    };

    if (key && key !== 'null') {
        db.ref('checkinLogs/' + key).update(updateData).then(afterSave);
    } else {
        db.ref('checkinLogs').push(updateData).then(afterSave);
    }

    function afterSave() {
        alert("✅ 변동 사유가 반영되었습니다.");
        if (typeof closePopup === 'function') closePopup();
        if (typeof generateNewLayout === 'function') {
            generateNewLayout(); 
        }
    }
};

// 6. 요일별 고정 등교 제외 설정 시스템
window.openExclusionPopup = function() {
    db.ref('settings/fixedExclusions').once('value', snap => {
        const data = snap.val() || {}; 
        const days = ['월', '화', '수', '목', '금'];
        
        let h = `<div style="text-align:left;">
                    <p style="font-size:1rem; color:var(--red, #e74c3c); font-weight:bold; margin-bottom:10px;">* 요일별로 등교 체크에서 제외할 학생을 선택하세요.</p>
                    <div style="display:flex; gap:5px; margin-bottom:15px;">`;
        
        days.forEach(d => {
            h += `<button onclick="showExclusionDay('${d}')" class="day-tab" id="tab-${d}" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:8px; font-weight:bold; cursor:pointer;">${d}</button>`;
        });
        h += `</div>`;

        days.forEach(d => {
            const excludedList = data[d] || [];
            h += `<div id="day-cont-${d}" class="day-content" style="display:none; grid-template-columns:repeat(3, 1fr); gap:10px; max-height:300px; overflow-y:auto;">`;
            if (typeof currentUsers !== 'undefined') {
                currentUsers.forEach(u => {
                    if (u.name === "총사령관") return;
                    const isChecked = excludedList.includes(u.name);
                    h += `
                        <label style="background:#f8f9fa; padding:10px; border-radius:10px; text-align:center; border:2px solid ${isChecked ? 'var(--purple, #9b59b6)' : '#eee'}; cursor:pointer;">
                            <input type="checkbox" class="ex-check-${d}" value="${u.name}" ${isChecked ? 'checked' : ''} style="margin-bottom:5px;">
                            <div style="font-weight:bold; font-size:1.1rem;">${u.name}</div>
                        </label>`;
                });
            }
            h += `</div>`;
        });
        
        h += `<button onclick="saveExclusionsByDay()" style="width:100%; margin-top:20px; background:var(--purple, #9b59b6); color:white; padding:15px; border-radius:12px; font-weight:bold; cursor:pointer;">설정 저장하기</button></div>`;
        
        if (typeof openPopup === 'function') {
            openPopup("🚫 요일별 등교제외 설정", h);
        }
        showExclusionDay('월'); 
    });
};

window.showExclusionDay = function(day) {
    document.querySelectorAll('.day-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.day-tab').forEach(el => el.style.background = 'white');
    const targetCont = document.getElementById('day-cont-' + day);
    const targetTab = document.getElementById('tab-' + day);
    if (targetCont) targetCont.style.display = 'grid';
    if (targetTab) targetTab.style.background = '#e9ecef';
};

window.saveExclusionsByDay = function() {
    const data = {};
    ['월', '화', '수', '목', '금'].forEach(d => {
        const selected = [];
        document.querySelectorAll('.ex-check-' + d + ':checked').forEach(el => selected.push(el.value));
        data[d] = selected;
    });
    
    db.ref('settings/fixedExclusions').set(data).then(() => {
        alert("✨ 요일별 제외 명단이 저장되었습니다.");
        if (typeof closePopup === 'function') closePopup();
        if (typeof generateNewLayout === 'function') {
            generateNewLayout(); 
        }
    });
};

// 7. 월간 출석부 및 인쇄 기능 연동
window.openMonthlyCalendar = function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let weekdays = [];
    for(let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(year, month, d).getDay();
        if(dayOfWeek !== 0 && dayOfWeek !== 6) weekdays.push(d);
    }

    db.ref('checkins').once('value', checkinSnap => {
        let usersSet = new Set();
        
        if (typeof currentUsers !== 'undefined') {
            currentUsers.forEach(u => {
                if (u.name !== "총사령관") usersSet.add(u.name);
            });
        }

        checkinSnap.forEach(child => {
            const c = child.val();
            if (c.user && c.user !== "총사령관") {
                usersSet.add(c.user);
            }
        });

        const users = Array.from(usersSet).sort();
        let attendanceData = {}; 
        users.forEach(u => attendanceData[u] = {});
        
        const targetMonthStr = year + "-" + String(month + 1).padStart(2, '0');

        checkinSnap.forEach(child => {
            const c = child.val();
            if(c.user && users.includes(c.user)) {
                let d = null;
                if (c.date && c.date.startsWith(targetMonthStr)) {
                    d = parseInt(c.date.split('-')[2]);
                } 
                else if (c.time && c.time !== "-") {
                    try {
                       const parts = c.time.split('. ');
                       if (parts.length >= 3) {
                           const y = parseInt(parts[0]);
                           const m = parseInt(parts[1]);
                           if (y === year && m === (month + 1)) {
                               d = parseInt(parts[2]);
                           }
                       }
                    } catch(e) {}
                }

                if (d && !isNaN(d)) {
                    attendanceData[c.user][d] = {
                        status: c.reason,
                        remark: c.remark || c.note || "" 
                    };
                }
            }
        });

        let tableHtml = `
            <style>
                #popup-modal-content { max-width: 95% !important; width: 1200px !important; }
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
            </style>
            
            <div id="print-area" style="padding: 10px;">
                <h2 class="print-title" style="text-align:center; margin-bottom:20px; font-size:1.8rem; display:none;">${month + 1}월 학급 출석부 (${year}년)</h2>
                
                <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div style="font-size:1rem; color:#495057; font-weight: 500;">
                        📌 범례: <span style="color:#2b8a3e; font-weight:bold;">O</span> (정상등교) / 
                        <span style="color:#e03131; font-weight:bold;">결</span> (결석) / 
                        <span style="color:#f59f00; font-weight:bold;">지</span> (지각) / 
                        <span style="color:#1c7ed6; font-weight:bold;">조</span> (조퇴)
                    </div>
                    <button onclick="window.printAttendanceBook()" style="background:#228be6; color:white; border:none; padding:10px 18px; font-size:1rem; font-weight:bold; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        🖨️ 출석부 인쇄하기
                    </button>
                </div>

                <div style="overflow-x:auto; background: #fff; border-radius: 8px; border: 1px solid #dee2e6;">
                    <table style="width:100%; border-collapse:collapse; text-align:center; min-width:1000px; font-size:1.05rem; font-family: sans-serif;">
                        <thead>
                            <tr style="background:#f8f9fa;">
                                <th style="border:1px solid #ced4da; padding:12px 8px; font-weight:bold; background:#f8f9fa; width:90px; position:sticky; left:0; z-index:2;">이름</th>
        `;
        
        weekdays.forEach(d => { 
            tableHtml += `<th style="border:1px solid #ced4da; padding:12px 4px; font-weight:bold; min-width:35px;">${d}</th>`; 
        });
        
        tableHtml += `      </tr>
                        </thead>
                        <tbody>`;

        users.forEach(u => {
            tableHtml += `<tr>
                <td style="border:1px solid #ced4da; padding:12px 8px; font-weight:bold; position:sticky; left:0; background:#ffffff; z-index:1; box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1);">${u}</td>`;
            
            weekdays.forEach(d => {
                let record = attendanceData[u][d];
                let mark = '', color = 'transparent', remarkHtml = '';
                
                if(record) {
                    let status = record.status;
                    if (record.remark && record.remark.trim() !== '') {
                        remarkHtml = `<div style="font-size:0.75rem; color:#495057; margin-top:3px; line-height:1;">(${record.remark})</div>`;
                    }

                    if(status.includes('정상') || status === '등교') { 
                        mark = 'O'; color = '#ebfbee'; 
                    }
                    else if(status.includes('결석')) { 
                        mark = '결'; color = '#fff5f5'; 
                    }
                    else if(status.includes('지각')) { 
                        mark = '지'; color = '#fff9db'; 
                    }
                    else if(status.includes('조퇴')) {
                        mark = '조'; color = '#e7f5ff'; 
                    }
                    else { 
                        mark = status.substring(0,1); color = '#f3e5f5'; 
                    } 
                }
                
                tableHtml += `<td style="border:1px solid #ced4da; padding:8px 4px; background:${color}; font-weight: 500;">
                    ${mark}
                    ${remarkHtml}
                </td>`;
            });
            tableHtml += `</tr>`;
        });
        
        tableHtml += `  </tbody>
                    </table>
                </div>
            </div>`;
        
        if (typeof openPopup === 'function') openPopup(`${month + 1}월 학급 출석부`, tableHtml);
    });
};

window.printAttendanceBook = function() {
    const title = document.querySelector('.print-title');
    if(title) title.style.display = 'block';
    window.print();
    if(title) title.style.display = 'none';
};

// 8. 하단 로그 확장 UI (달력 보기 버튼 및 미제출 서류 관리)
window.appendExtraLogsUI = function() {
    const board = document.getElementById('tab-logs');
    if(!board) return;
    
    let extraDiv = document.getElementById('extra-logs-div');
    if(!extraDiv) {
        extraDiv = document.createElement('div');
        extraDiv.id = 'extra-logs-div';
        board.appendChild(extraDiv);
    }

    db.ref('checkins').once('value', snap => {
        let checkins = [];
        snap.forEach(child => { checkins.push({ key: child.key, ...child.val() }); });
        checkins.reverse();

        let html = `
            <hr style="margin: 30px 0; border: 1px dashed #ccc;">
            <div style="text-align:center; margin-bottom:20px;">
                <button onclick="openMonthlyCalendar()" style="padding:12px 20px; background:var(--purple, #9b59b6); color:white; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                    📊 이번 달 출석부(달력) 보기
                </button>
            </div>
        `;

        let missingDocs = checkins.filter(c => 
            (c.reason && (c.reason.includes('결석') || c.reason.includes('체험학습'))) && !c.docSubmitted
        );

        if (isAdmin && missingDocs.length > 0) {
            html += `
            <div style="background:#ffebee; border:2px solid #ef5350; border-radius:10px; padding:15px; margin-bottom:20px; text-align:left;">
                <h4 style="margin:0 0 10px 0; color:#c62828;">⚠️ 서류 미제출자 명단 (클릭 시 확인 완료)</h4>
                <div style="display:flex; flex-wrap:wrap; gap:10px;">
            `;
            missingDocs.forEach(c => {
                let shortReason = c.reason.replace('교외체험학습', '체험').replace('결석', '결석');
                html += `<button onclick="completeDoc('${c.key}')" style="padding:8px 12px; background:white; border:2px solid #ef5350; color:#c62828; border-radius:8px; font-weight:bold; cursor:pointer;">${c.user} (${shortReason})</button>`;
            });
            html += `</div></div>`;
        }

        html += `<h3 style="margin-bottom:10px; border-bottom:2px solid #eee; padding-bottom:10px;">📜 전체 출결 로그</h3>`;
        html += `<div class="list-container" style="max-height:300px; overflow-y:auto; padding-right:5px;">`;
        let hasData = false;
        
        checkins.slice(0, 50).forEach(c => {
            hasData = true;
            let docTag = (c.docSubmitted) ? `<span style="color:#2e7d32; font-size:0.8rem; font-weight:bold; background:#e8f5e9; padding:3px 6px; border-radius:4px; margin-left:5px;">서류 완료</span>` : '';
            html += `
                <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                    <span><b>${c.user}</b> - ${c.reason || '정상 등교'} ${docTag}</span>
                    <small style="color:#666;">${c.time || ''}</small>
                </div>
            `;
        });

        if(!hasData) html += `<p style="text-align:center; color:#999; padding:20px;">출결 기록이 없습니다.</p>`;
        html += `</div>`;

        extraDiv.innerHTML = html;
    });
};

window.completeDoc = function(key) {
    if(!confirm("이 학생의 서류를 제출 완료 처리하시겠습니까?")) return;
    db.ref(`checkins/${key}`).update({ docSubmitted: true }).then(() => { appendExtraLogsUI(); });
}; 