// js/checkin-seat.js
// 좌석 맵 렌더링, 출결 관리, 월간 출석부,
// 상세 기록 수정, 요일별 제외 설정,
// 학생 본인 등교 기능 통합 관리

/* =========================================================
   공통 유틸리티
   ========================================================= */

function checkinGetTodayKST() {
    if (typeof getTodayKST === 'function') {
        return getTodayKST();
    }
    const now = new Date();
    const krTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return (
        krTime.getUTCFullYear() + "-" +
        String(krTime.getUTCMonth() + 1).padStart(2, '0') + "-" +
        String(krTime.getUTCDate()).padStart(2, '0')
    );
}

function checkinGetNowKSTTime() {
    const now = new Date();
    const krTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return (
        String(krTime.getUTCHours()).padStart(2, '0') + ":" +
        String(krTime.getUTCMinutes()).padStart(2, '0')
    );
}

function checkinTimeToMinutes(timeString) {
    if (!timeString) return null;
    const match = String(timeString).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function checkinEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* =========================================================
   1. 학생 본인 등교 (포인트 감점/보상 로직 완벽 통합)
   ========================================================= */

window.submitCheckIn = function() {
    const passInput = document.getElementById('checkin-pass');
    const button = document.getElementById('checkin-btn');

    if (!passInput) {
        alert("등교 암호 입력창을 찾을 수 없습니다.");
        return;
    }

    const enteredPassword = String(passInput.value || '').trim();

    if (!/^\d{4}$/.test(enteredPassword)) {
        alert("등교 암호는 숫자 4자리로 입력해주세요.");
        passInput.focus();
        return;
    }

    const studentName = (typeof myName !== 'undefined' ? myName : '');

    if (!studentName) {
        alert("로그인 정보를 확인할 수 없습니다.");
        return;
    }

    if (button) {
        button.disabled = true;
        button.innerText = "등교 확인 중...";
    }

    db.ref('settings').once('value')
        .then(settingsSnap => {
            const settings = settingsSnap.val() || {};
            const correctPassword = String(settings.password ?? '').trim();

            if (!correctPassword || enteredPassword !== correctPassword) {
                throw new Error("❌ 등교 암호가 올바르지 않습니다.");
            }

            const today = checkinGetTodayKST();
            const nowTime = checkinGetNowKSTTime();
            const nowMinutes = checkinTimeToMinutes(nowTime);

            const lateTime = settings.lateTime || "08:40";
            const closeTime = settings.closeTime || "09:00";

            const lateMinutes = checkinTimeToMinutes(lateTime);
            const closeMinutes = checkinTimeToMinutes(closeTime);

            let result = "정상 등교";
            let pointsChange = 10; // 정상 등교 시 기본 보상 포인트 (필요시 0 등으로 수정 가능)

            if (closeMinutes !== null && nowMinutes !== null && nowMinutes >= closeMinutes) {
                throw new Error(`⚠️ 오늘의 등교가 마감되었습니다. (${closeTime})`);
            }

            // 💡 늦은 분수 계산 로직 (수정: >= 에서 > 로 변경하여 정각은 정상 처리)
            if (lateMinutes !== null && nowMinutes !== null && nowMinutes > lateMinutes) {
                result = "지각 등교";
                const lateDiff = nowMinutes - lateMinutes; // 지각한 분 수
                pointsChange = Math.max(-9, lateDiff * -1); // 1분당 -1점, 최대 -9점 감점
            }

            // 💡 DB에서 중복 체크 및 현재 유저의 포인트 데이터 동시 조회
            return Promise.all([
                db.ref('checkinLogs').once('value'),
                db.ref('checkins').once('value'),
                db.ref(`users/${studentName}`).once('value')
            ]).then(snaps => {
                const logsSnap = snaps[0];
                const checkinsSnap = snaps[1];
                const userSnap = snaps[2];

                let alreadyChecked = false;

                logsSnap.forEach(child => {
                    const data = child.val() || {};
                    if (data.name === studentName && data.date === today) {
                        alreadyChecked = true;
                    }
                });

                checkinsSnap.forEach(child => {
                    const data = child.val() || {};
                    if (data.user === studentName && data.date === today) {
                        alreadyChecked = true;
                    }
                });

                if (alreadyChecked) {
                    throw new Error("✅ 오늘은 이미 등교 처리가 완료되었습니다.");
                }

                const timeForLog = checkinGetNowKSTTime();

                // 1. checkinLogs 데이터
                const logData = {
                    name: studentName,
                    date: today,
                    category: result === '지각 등교' ? '지각' : '정상',
                    subCategory: '해당없음',
                    reason: '',
                    result: result,
                    time: timeForLog
                };

                // 2. checkins 데이터
                const checkinData = {
                    user: studentName,
                    reason: result,
                    date: today,
                    time: timeForLog,
                    docSubmitted: false
                };

                // 3. 포인트 업데이트 계산
                const currentPoints = userSnap.val()?.points || 0;
                const newPoints = currentPoints + pointsChange;

                const historyRefKey = db.ref(`pointHistory/${studentName}`).push().key;
                const historyData = {
                    date: today,
                    time: timeForLog,
                    reason: `본부 소환 (${result})`,
                    change: pointsChange,
                    result: newPoints
                };

                // 💡 안전한 한 번에(Atomic) 데이터베이스 업데이트
                const updates = {};
                updates[`users/${studentName}/points`] = newPoints;
                updates[`pointHistory/${studentName}/${historyRefKey}`] = historyData;
                
                const newLogKey = db.ref('checkinLogs').push().key;
                const newCheckinKey = db.ref('checkins').push().key;
                updates[`checkinLogs/${newLogKey}`] = logData;
                updates[`checkins/${newCheckinKey}`] = checkinData;

                return db.ref().update(updates).then(() => {
                    return {
                        result: result,
                        time: timeForLog,
                        pointsChange: pointsChange
                    };
                });
            });
        })
        .then(record => {
            passInput.value = '';

            let successMsg = `🎉 ${record.result} 처리되었습니다!\n⏰ 등교 시간: ${record.time}`;
            if (record.pointsChange < 0) {
                successMsg += `\n⚠️ 지각 패널티로 ${record.pointsChange} 포인트가 깎였습니다.`;
            } else {
                successMsg += `\n🎁 출석 보상: +${record.pointsChange} 포인트 획득!`;
            }
            alert(successMsg);

            if (button) {
                button.disabled = false;
                button.innerText = "본부 소환!";
            }

            if (typeof refreshCheckinManagement === 'function') {
                refreshCheckinManagement();
            }
        })
        .catch(error => {
            console.error("등교 처리 오류:", error);
            alert(error.message || "등교 처리 중 오류가 발생했습니다.");

            if (button) {
                button.disabled = false;
                button.innerText = "본부 소환!";
            }
        });
};


/* =========================================================
   2. 좌석 지도 렌더링
   ========================================================= */

window.renderSeatMap = function(rows, cols) {
    const container = document.getElementById('seat-map-container');
    if (!container) return;

    rows = parseInt(rows) || 6;
    cols = parseInt(cols) || 5;

    container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    container.innerHTML = "";

    const dateFilterInput = document.getElementById('checkin-date-filter');
    const targetDate = dateFilterInput && dateFilterInput.value ? dateFilterInput.value : checkinGetTodayKST();

    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    const selectedDay = weekDays[new Date(targetDate + 'T00:00:00').getDay()];

    Promise.all([
        db.ref('checkinLogs').once('value'),
        db.ref('settings/fixedExclusions').once('value')
    ]).then(snaps => {
        const logs = {};

        snaps[0].forEach(child => {
            const data = child.val() || {};
            if (data.date === targetDate) {
                logs[data.name] = data;
            }
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
                        statusText = log.result || log.category || log.reason || "기록";
                        if (statusText.includes('정상')) bgColor = "#ccffcc";
                        else if (statusText.includes('지각')) bgColor = "#ffcccc";
                        else bgColor = "#f39c12";
                    } else if (isFixedExcluded) {
                        bgColor = "#3498db";
                        statusText = "고정 제외";
                        textColor = "white";
                    } else {
                        bgColor = "#ffff00";
                        statusText = "미등교";
                    }
                }

                cell.style.cssText = `
                    background:${bgColor}; border:1px solid #bbb; min-height:120px;
                    border-radius:12px; display:flex; flex-direction:column;
                    justify-content:center; align-items:center; text-align:center;
                    padding:5px; cursor:pointer; color:${textColor}; user-select:none; box-sizing:border-box;
                `;

                if (name) {
                    const timeText = logs[name]?.time && logs[name].time !== '-' ? `[${logs[name].time}]` : '';
                    cell.innerHTML = `
                        <div style="font-weight:900; font-size:1.3rem; margin-bottom:5px;">${checkinEscapeHtml(name)}</div>
                        <div style="font-weight:bold; font-size:1rem;">${checkinEscapeHtml(statusText)}</div>
                        <div style="font-size:0.9rem; margin-top:3px;">${checkinEscapeHtml(timeText)}</div>
                    `;
                } else {
                    cell.innerHTML = `<div style="color:#aaa; font-size:0.9rem;">${r + 1}-${c + 1}</div>`;
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
                            if (typeof handleCheckinClick === 'function') handleCheckinClick(name);
                        }, 250);
                    }
                };

                container.appendChild(cell);
            }
        }
    }).catch(error => {
        console.error("좌석 지도 로딩 오류:", error);
        container.innerHTML = `<div style="grid-column:1/-1; padding:30px; text-align:center; color:#c0392b;">좌석 정보를 불러오지 못했습니다.</div>`;
    });
};


/* =========================================================
   3. 등교 관리 전체 새로고침
   ========================================================= */

window.refreshCheckinManagement = function() {
    const dateInput = document.getElementById('checkin-date-filter');
    if (dateInput && !dateInput.value) dateInput.value = checkinGetTodayKST();

    const rowsInput = document.getElementById('checkin-seat-rows');
    const colsInput = document.getElementById('checkin-seat-cols');

    const rows = rowsInput ? parseInt(rowsInput.value) || 6 : 6;
    const cols = colsInput ? parseInt(colsInput.value) || 5 : 5;

    renderSeatMap(rows, cols);
    renderCheckinSummary();
    renderCheckinLogList();
};


/* =========================================================
   4. 등교 통계
   ========================================================= */

window.renderCheckinSummary = function() {
    const container = document.getElementById('checkin-summary');
    if (!container) return;

    const dateInput = document.getElementById('checkin-date-filter');
    const targetDate = dateInput && dateInput.value ? dateInput.value : checkinGetTodayKST();

    Promise.all([
        db.ref('checkinLogs').once('value'),
        db.ref('users').once('value'),
        db.ref('settings/fixedExclusions').once('value')
    ]).then(snaps => {
        let normal = 0, late = 0, other = 0, absent = 0, excluded = 0;
        const checkedNames = new Set();

        snaps[0].forEach(child => {
            const data = child.val() || {};
            if (data.date !== targetDate || !data.name) return;

            checkedNames.add(data.name);
            const result = data.result || data.category || data.reason || "";

            if (result.includes('정상')) normal++;
            else if (result.includes('지각')) late++;
            else if (result.includes('제외')) excluded++;
            else other++;
        });

        let studentCount = 0;
        snaps[1].forEach(child => {
            if (child.key !== "총사령관") studentCount++;
        });

        const fixedExclusions = snaps[2].val() || {};
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        const selectedDay = weekDays[new Date(targetDate + 'T00:00:00').getDay()];
        const exclusionList = fixedExclusions[selectedDay] || [];

        excluded = Math.max(excluded, exclusionList.length);
        absent = Math.max(0, studentCount - checkedNames.size - excluded);

        container.innerHTML = `
            <div class="checkin-summary-card">👥 전체 학생 <strong>${studentCount}</strong></div>
            <div class="checkin-summary-card">🟢 정상 등교 <strong>${normal}</strong></div>
            <div class="checkin-summary-card">🔴 지각 <strong>${late}</strong></div>
            <div class="checkin-summary-card">🟡 기타 <strong>${other}</strong></div>
            <div class="checkin-summary-card">⚪ 미등교 <strong>${absent}</strong></div>
            <div class="checkin-summary-card">🔵 제외 <strong>${excluded}</strong></div>
        `;
    }).catch(error => console.error("등교 통계 오류:", error));
};


/* =========================================================
   5. 등교 로그 목록
   ========================================================= */

window.renderCheckinLogList = function() {
    const container = document.getElementById('checkin-log-list');
    if (!container) return;

    const dateInput = document.getElementById('checkin-date-filter');
    const targetDate = dateInput && dateInput.value ? dateInput.value : checkinGetTodayKST();

    db.ref('checkinLogs').once('value').then(snap => {
        const records = [];
        snap.forEach(child => {
            const data = child.val() || {};
            if (data.date === targetDate && data.name) {
                records.push({ key: child.key, ...data });
            }
        });

        records.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
        let html = "";

        if (!records.length) {
            html = `<div style="padding:30px; text-align:center; color:#999;">해당 날짜의 등교 기록이 없습니다.</div>`;
        } else {
            html = `
                <div class="checkin-log-table-wrap">
                    <table class="checkin-log-table">
                        <thead>
                            <tr>
                                <th>이름</th><th>상태</th><th>시간</th><th>사유</th><th>관리</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            records.forEach(record => {
                const result = record.result || record.category || '기록';
                html += `
                    <tr>
                        <td><strong>${checkinEscapeHtml(record.name)}</strong></td>
                        <td>${checkinEscapeHtml(result)}</td>
                        <td>${checkinEscapeHtml(record.time || '-')}</td>
                        <td>${checkinEscapeHtml(record.reason || '-')}</td>
                        <td>
                            <button onclick="openLogEditPopup('${checkinEscapeHtml(record.name)}', '${checkinEscapeHtml(targetDate)}')" style="background:#3498db; color:white; border:none; border-radius:7px; padding:8px 12px; cursor:pointer;">✏️ 수정</button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
        }
        container.innerHTML = html;
    }).catch(error => {
        console.error("등교 로그 오류:", error);
        container.innerHTML = `<div style="padding:30px; text-align:center; color:#c0392b;">등교 로그를 불러오지 못했습니다.</div>`;
    });
};


/* =========================================================
   6. 학생 배치 팝업
   ========================================================= */

window.openStudentPicker = function(posId, rows, cols) {
    if (typeof currentLayout === 'undefined') window.currentLayout = {};
    const assignedNames = Object.values(currentLayout);

    let h = `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:10px; max-height:400px; overflow-y:auto;">`;
    h += `<button onclick="assignStudentToSeat('${posId}', '', ${rows}, ${cols})" style="background:#e74c3c; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">❌ 비우기</button>`;

    if (typeof currentUsers !== 'undefined') {
        currentUsers.forEach(u => {
            if (u.name === "총사령관") return;
            const isAssigned = assignedNames.includes(u.name);
            h += `
                <button onclick="assignStudentToSeat('${checkinEscapeHtml(u.name)}', '${checkinEscapeHtml(u.name)}', ${rows}, ${cols})" style="background:${isAssigned ? '#95a5a6' : 'var(--primary,#3498db)'}; color:white; font-size:1.1rem; padding:12px 5px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
                    ${checkinEscapeHtml(u.name)} ${isAssigned ? ' (배치됨)' : ''}
                </button>
            `;
        });
    }
    h += `</div>`;
    if (typeof openPopup === 'function') openPopup("🧑‍🎓 학생 배치", h);
};


/* =========================================================
   7. 좌석 배치
   ========================================================= */

window.assignStudentToSeat = function(posId, name, rows, cols) {
    if (typeof currentLayout === 'undefined') window.currentLayout = {};
    
    if (name === "") {
        delete currentLayout[posId];
    } else {
        for (let key in currentLayout) {
            if (currentLayout[key] === name) delete currentLayout[key];
        }
        currentLayout[posId] = name;
    }
    
    if (typeof closePopup === 'function') closePopup();
    renderSeatMap(rows, cols);
};


/* =========================================================
   8. 관리자 출결 클릭
   ========================================================= */

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


/* =========================================================
   9. 관리자 상세 출결
   ========================================================= */

window.openDetailedCheckin = function(user) {
    const safeUser = checkinEscapeHtml(user);
    let h = `
        <div style="text-align:center;">
            <h3 style="margin-top:0;">${safeUser} 출결 상태 변경</h3>
            <select id="checkin-reason" style="width:100%; padding:15px; font-size:1.1rem; border-radius:10px; margin-bottom:20px;">
                <option value="정상 등교">✅ 정상 등교</option>
                <option value="결석">❌ 결석</option>
                <option value="교외체험학습">🎒 교외체험학습</option>
                <option value="지각">⏰ 지각</option>
                <option value="조퇴">🏃 조퇴</option>
            </select>
            <button onclick="submitCheckin('${safeUser}', document.getElementById('checkin-reason').value)" style="width:100%; padding:15px; background:var(--gold,#f1c40f); font-weight:bold; font-size:1.2rem; border:none; border-radius:10px; cursor:pointer;">
                출결 기록 저장
            </button>
        </div>
    `;
    if (typeof openPopup === 'function') openPopup("출석 관리", h);
};


/* =========================================================
   10. 관리자 출결 저장
   ========================================================= */

window.submitCheckin = function(user, reason) {
    const todayStr = checkinGetTodayKST();
    const timeStr = checkinGetNowKSTTime();

    let resultText = reason;
    if (reason === '정상 등교') resultText = '정상 등교';
    else if (reason === '지각') resultText = '지각 등교';

    const checkinData = { user: user, reason: reason, date: todayStr, time: timeStr, docSubmitted: false };
    const logData = {
        name: user, date: todayStr,
        category: resultText.includes('지각') ? '지각' : resultText.includes('정상') ? '정상' : resultText,
        subCategory: '해당없음', reason: reason, result: resultText, time: timeStr
    };

    Promise.all([
        db.ref('checkins').push(checkinData),
        db.ref('checkinLogs').push(logData)
    ]).then(() => {
        alert(`[${user}] ${reason} 처리 완료! ✨`);
        if (typeof closePopup === 'function') closePopup();
        refreshCheckinManagement();
    }).catch(error => {
        console.error("관리자 출결 저장 오류:", error);
        alert("출결 저장 중 오류가 발생했습니다.");
    });
};


/* =========================================================
   11. 등교 상세 기록 수정
   ========================================================= */

window.openLogEditPopup = function(name, date) {
    db.ref('checkinLogs').once('value', snap => {
        let logKey = null;
        let logData = {};

        snap.forEach(c => {
            const data = c.val() || {};
            if (data.name === name && data.date === date) {
                logKey = c.key;
                logData = data;
            }
        });

        const safeName = checkinEscapeHtml(name);
        const safeDate = checkinEscapeHtml(date);

        const h = `
            <div style="text-align:left; padding:10px;">
                <h3 style="text-align:center;">${safeName} 등교 상세 기록</h3>
                <label style="display:block; margin-top:10px; font-weight:bold;">🚩 등교 상태</label>
                <select id="edit-cat" style="width:100%; padding:8px; margin-top:5px; border-radius:6px; border:1px solid #ccc;">
                    <option value="정상" ${logData.result === '정상 등교' ? 'selected' : ''}>정상 등교</option>
                    <option value="지각" ${logData.result === '지각 등교' ? 'selected' : ''}>지각</option>
                    <option value="결석" ${logData.category === '결석' ? 'selected' : ''}>결석</option>
                    <option value="조퇴" ${logData.category === '조퇴' ? 'selected' : ''}>조퇴</option>
                    <option value="제외" ${logData.category === '제외' ? 'selected' : ''}>기록 제외</option>
                </select>

                <label style="display:block; margin-top:10px; font-weight:bold;">🔍 사유 구분</label>
                <select id="edit-sub" style="width:100%; padding:8px; margin-top:5px; border-radius:6px; border:1px solid #ccc;">
                    <option value="해당없음" ${logData.subCategory === '해당없음' ? 'selected' : ''}>-</option>
                    <option value="질병" ${logData.subCategory === '질병' ? 'selected' : ''}>질병</option>
                    <option value="인정" ${logData.subCategory === '인정' ? 'selected' : ''}>인정</option>
                    <option value="미인정" ${logData.subCategory === '미인정' ? 'selected' : ''}>미인정</option>
                    <option value="기타" ${logData.subCategory === '기타' ? 'selected' : ''}>기타</option>
                </select>

                <label style="display:block; margin-top:10px; font-weight:bold;">📝 구체적 사유 기록</label>
                <textarea id="edit-desc" rows="3" placeholder="예: 아침 방과후 농구팀, 독감으로 인한 결석 등" style="width:100%; padding:8px; margin-top:5px; border-radius:6px; border:1px solid #ccc; box-sizing:border-box;">${checkinEscapeHtml(logData.reason || '')}</textarea>

                <button onclick="saveDetailLog('${safeName}', '${safeDate}', '${logKey || ''}')" style="width:100%; background:var(--primary,#3498db); color:white; font-weight:bold; margin-top:15px; padding:12px; border:none; border-radius:8px; cursor:pointer;">
                    상태 및 사유 저장
                </button>
            </div>
        `;
        if (typeof openPopup === 'function') openPopup("📊 등교 기록 수정", h);
    });
};


/* =========================================================
   12. 상세 기록 저장
   ========================================================= */

window.saveDetailLog = function(name, date, key) {
    const catEl = document.getElementById('edit-cat');
    const subEl = document.getElementById('edit-sub');
    const descEl = document.getElementById('edit-desc');

    if (!catEl || !subEl || !descEl) {
        alert("출결 수정 정보를 찾을 수 없습니다.");
        return;
    }

    const category = catEl.value;
    const subCategory = subEl.value;
    const reason = descEl.value;
    let resultText = category;

    if (category === '정상' || category === '지각') {
        resultText = category + ' 등교';
    }

    const updateData = {
        name: name, date: date, category: category, subCategory: subCategory, reason: reason, result: resultText, time: checkinGetNowKSTTime()
    };

    let promise;
    if (key && key !== 'null') {
        promise = db.ref('checkinLogs/' + key).update(updateData);
    } else {
        promise = db.ref('checkinLogs').push(updateData);
    }

    promise.then(() => {
        alert("✅ 변동 사유가 반영되었습니다.");
        if (typeof closePopup === 'function') closePopup();
        refreshCheckinManagement();
    }).catch(error => {
        console.error("출결 수정 오류:", error);
        alert("출결 수정 중 오류가 발생했습니다.");
    });
};


/* =========================================================
   13. 요일별 고정 등교 제외
   ========================================================= */

window.openExclusionPopup = function() {
    db.ref('settings/fixedExclusions').once('value', snap => {
        const data = snap.val() || {};
        const days = ['월', '화', '수', '목', '금'];

        let h = `
            <div style="text-align:left;">
                <p style="font-size:1rem; color:var(--red,#e74c3c); font-weight:bold; margin-bottom:10px;">
                    * 요일별로 등교 체크에서 제외할 학생을 선택하세요.
                </p>
                <div style="display:flex; gap:5px; margin-bottom:15px;">
        `;

        days.forEach(d => {
            h += `<button onclick="showExclusionDay('${d}')" class="day-tab" id="tab-${d}" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:8px; font-weight:bold; cursor:pointer;">${d}</button>`;
        });
        h += `</div>`;

        days.forEach(d => {
            const excludedList = data[d] || [];
            h += `<div id="day-cont-${d}" class="day-content" style="display:none; grid-template-columns:repeat(3,1fr); gap:10px; max-height:300px; overflow-y:auto;">`;

            if (typeof currentUsers !== 'undefined') {
                currentUsers.forEach(u => {
                    if (u.name === "총사령관") return;
                    const isChecked = excludedList.includes(u.name);
                    h += `
                        <label style="background:#f8f9fa; padding:10px; border-radius:10px; text-align:center; border:2px solid ${isChecked ? 'var(--purple,#9b59b6)' : '#eee'}; cursor:pointer;">
                            <input type="checkbox" class="ex-check-${d}" value="${checkinEscapeHtml(u.name)}" ${isChecked ? 'checked' : ''} style="margin-bottom:5px;">
                            <div style="font-weight:bold; font-size:1.1rem;">${checkinEscapeHtml(u.name)}</div>
                        </label>
                    `;
                });
            }
            h += `</div>`;
        });

        h += `
            <button onclick="saveExclusionsByDay()" style="width:100%; margin-top:20px; background:var(--purple,#9b59b6); color:white; padding:15px; border-radius:12px; font-weight:bold; cursor:pointer; border:none;">
                설정 저장하기
            </button>
            </div>
        `;
        if (typeof openPopup === 'function') openPopup("🚫 요일별 등교제외 설정", h);
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
        refreshCheckinManagement();
    }).catch(error => {
        console.error("등교 제외 저장 오류:", error);
        alert("등교 제외 명단 저장에 실패했습니다.");
    });
};


/* =========================================================
   14. 월간 출석부
   ========================================================= */

window.openMonthlyCalendar = function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let weekdays = [];

    for (let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(year, month, d).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) weekdays.push(d);
    }

    db.ref('checkins').once('value', checkinSnap => {
        let usersSet = new Set();
        if (typeof currentUsers !== 'undefined') {
            currentUsers.forEach(u => {
                if (u.name !== "총사령관") usersSet.add(u.name);
            });
        }
        checkinSnap.forEach(child => {
            const c = child.val() || {};
            if (c.user && c.user !== "총사령관") usersSet.add(c.user);
        });
        const users = Array.from(usersSet).sort();
        let attendanceData = {};
        users.forEach(u => attendanceData[u] = {});

        const targetMonthStr = year + "-" + String(month + 1).padStart(2, '0');

        checkinSnap.forEach(child => {
            const c = child.val() || {};
            if (c.user && users.includes(c.user)) {
                let d = null;
                if (c.date && c.date.startsWith(targetMonthStr)) {
                    d = parseInt(c.date.split('-')[2]);
                } else if (c.time && c.time !== "-") {
                    try {
                        const parts = c.time.split('. ');
                        if (parts.length >= 3) {
                            const y = parseInt(parts[0]);
                            const m = parseInt(parts[1]);
                            if (y === year && m === month + 1) d = parseInt(parts[2]);
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
                #popup-modal-content { max-width:95% !important; width:1200px !important; }
                @media print {
                    body * { visibility:hidden; }
                    #print-area, #print-area * { visibility:visible; }
                    #print-area { position:absolute; left:0; top:0; width:100%; }
                    .no-print { display:none !important; }
                    table { page-break-inside:auto; }
                    tr { page-break-inside:avoid; page-break-after:auto; }
                }
            </style>
            <div id="print-area" style="padding:10px;">
                <h2 class="print-title" style="text-align:center; margin-bottom:20px; font-size:1.8rem; display:none;">${month + 1}월 학급 출석부 (${year}년)</h2>
                <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <div style="font-size:1rem; color:#495057; font-weight:500;">
                        📌 범례: <span style="color:#2b8a3e;font-weight:bold;">O</span> 정상등교 / <span style="color:#e03131;font-weight:bold;">결</span> 결석 / <span style="color:#f59f00;font-weight:bold;">지</span> 지각 / <span style="color:#1c7ed6;font-weight:bold;">조</span> 조퇴
                    </div>
                    <button onclick="window.printAttendanceBook()" style="background:#228be6; color:white; border:none; padding:10px 18px; font-size:1rem; font-weight:bold; border-radius:6px; cursor:pointer;">
                        🖨️ 출석부 인쇄하기
                    </button>
                </div>
                <div style="overflow-x:auto; background:#fff; border-radius:8px; border:1px solid #dee2e6;">
                    <table style="width:100%; border-collapse:collapse; text-align:center; min-width:1000px; font-size:1.05rem; font-family:sans-serif;">
                        <thead>
                            <tr style="background:#f8f9fa;">
                                <th style="border:1px solid #ced4da; padding:12px 8px; font-weight:bold; background:#f8f9fa; width:90px; position:sticky; left:0; z-index:2;">이름</th>
        `;

        weekdays.forEach(d => {
            tableHtml += `<th style="border:1px solid #ced4da; padding:12px 4px; font-weight:bold; min-width:35px;">${d}</th>`;
        });

        tableHtml += `</tr></thead><tbody>`;

        users.forEach(u => {
            tableHtml += `
                <tr>
                    <td style="border:1px solid #ced4da; padding:12px 8px; font-weight:bold; position:sticky; left:0; background:#fff; z-index:1;">${checkinEscapeHtml(u)}</td>
            `;
            weekdays.forEach(d => {
                const record = attendanceData[u][d];
                let mark = '', color = 'transparent', remarkHtml = '';
                if (record) {
                    const status = record.status || '';
                    if (record.remark && record.remark.trim() !== '') {
                        remarkHtml = `<div style="font-size:0.75rem; color:#495057; margin-top:3px; line-height:1;">(${checkinEscapeHtml(record.remark)})</div>`;
                    }
                    if (status.includes('정상') || status === '등교') { mark = 'O'; color = '#ebfbee'; }
                    else if (status.includes('결석')) { mark = '결'; color = '#fff5f5'; }
                    else if (status.includes('지각')) { mark = '지'; color = '#fff9db'; }
                    else if (status.includes('조퇴')) { mark = '조'; color = '#e7f5ff'; }
                    else { mark = status.substring(0,1); color = '#f3e5f5'; }
                }
                tableHtml += `<td style="border:1px solid #ced4da; padding:8px 4px; background:${color}; font-weight:500;">${mark}${remarkHtml}</td>`;
            });
            tableHtml += `</tr>`;
        });
        tableHtml += `</tbody></table></div></div>`;
        if (typeof openPopup === 'function') openPopup(`${month + 1}월 학급 출석부`, tableHtml);
    });
};

window.printAttendanceBook = function() {
    const title = document.querySelector('.print-title');
    if (title) title.style.display = 'block';
    window.print();
    if (title) title.style.display = 'none';
};


/* =========================================================
   15. 기존 하단 로그 UI 호환
   ========================================================= */

window.appendExtraLogsUI = function() {
    if (typeof refreshCheckinManagement === 'function') {
        refreshCheckinManagement();
    }
};


/* =========================================================
   16. 서류 제출 완료
   ========================================================= */

window.completeDoc = function(key) {
    if (!confirm("이 학생의 서류를 제출 완료 처리하시겠습니까?")) return;
    db.ref(`checkins/${key}`).update({ docSubmitted: true }).then(() => {
        refreshCheckinManagement();
    }).catch(error => {
        console.error("서류 상태 변경 오류:", error);
        alert("서류 상태 변경에 실패했습니다.");
    });
};


/* =========================================================
   17. 페이지 로딩 후 등교 날짜 초기화
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('checkin-date-filter');
    if (dateInput && !dateInput.value) {
        dateInput.value = checkinGetTodayKST();
    }
});
