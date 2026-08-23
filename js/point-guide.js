// js/point-guide.js - 포인트 도감, 인벤토리, 승인/환불, 포인트 연대기 및 일괄 지급 통합 로직

// 시간 포맷팅 헬퍼 함수
function formatDateTime(timestamp) {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
}

// 💡 [최적화 1] 리스너(추적기)가 여러 번 실행되는 것을 막는 잠금장치 변수
window.isPointsListenerAttached = false;
window.isPointGuideListenerAttached = false;

// ----------------------------------------------------
// 1. 인벤토리 및 승인, 연대기 실시간 감지
// ----------------------------------------------------
window.initPointsTabListeners = function() {
    // 💡 잠금장치 확인: 이미 실행되었다면 여기서 멈춤 (다운로드 중복 방지)
    if (window.isPointsListenerAttached) return; 
    window.isPointsListenerAttached = true;
    
    // [인벤토리 & 승인 대기열 리스너] - 처리되지 않은 대기열만 가볍게 가져오도록 향후 최적화 가능
    db.ref('orders').on('value', snap => {
        let uHtml = "", wHtml = "", adminOrderHtml = "";
        
        snap.forEach(c => {
            const o = c.val(), key = c.key;
            const isMyItem = (typeof myName !== 'undefined' && o.user === myName);
            
            if (isMyItem && (o.status === '대기' || o.status === '요청' || o.status === '환불')) {
                const refundTag = o.status === '환불' ? '<span style="color:#e74c3c; font-size:0.9rem; font-weight:bold;">(환불/반려됨)</span>' : '';
                uHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee;">
                        <span>📦 <b style="font-size:1.1rem;">${o.item}</b> ${refundTag}</span>
                        <button onclick="requestUseItem('${key}', '${o.item}')" style="background:#3498db; color:white; padding:8px 15px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">사용하기</button>
                    </div>`;
            }
            else if (isMyItem && o.status === '사용요청') {
                wHtml += `
                    <div style="padding:12px; border-bottom:1px solid #eee; color:#7f8c8d; font-size:1.1rem;">
                        ⏳ <b>${o.item}</b> (선생님 승인 대기중...)
                    </div>`;
            }

            if (typeof isAdmin !== 'undefined' && isAdmin && o.status === '사용요청') {
                adminOrderHtml += `
                    <div style="background:#f8f9fa; border:1px solid #ddd; padding:12px; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:1.1rem;">🧑‍🎓 <b>${o.user}</b> 용사 - <b>${o.item}</b> 사용 요청</span>
                        <div>
                            <button onclick="approveItem('${key}', '${o.user}', '${o.item}')" style="background:#2ecc71; color:white; padding:8px 12px; border:none; border-radius:6px; margin-right:5px; cursor:pointer; font-weight:bold;">승인</button>
                            <button onclick="refundItem('${key}', '${o.user}', '${o.item}')" style="background:#e74c3c; color:white; padding:8px 12px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">환불(반려)</button>
                        </div>
                    </div>`;
            }
        });

        const uEl = document.getElementById('inv-unused');
        if (uEl && uEl.querySelector('.list')) uEl.querySelector('.list').innerHTML = uHtml || "<p style='color:#999; padding:10px;'>보관함이 비어있습니다.</p>";
        
        const wEl = document.getElementById('inv-waiting');
        if (wEl && wEl.querySelector('.list')) wEl.querySelector('.list').innerHTML = wHtml || "<p style='color:#999; padding:10px;'>대기 중인 항목이 없습니다.</p>";
        
        const adminOrderEl = document.getElementById('order-list');
        if (adminOrderEl) adminOrderEl.innerHTML = adminOrderHtml || "<p style='color:#999;'>대기 중인 사용 요청이 없습니다.</p>";
    });

    // 💡 [최적화 2] limitToLast(50)을 사용하여 최근 50개의 데이터만 다운로드하도록 제한!
    db.ref('history').limitToLast(50).on('value', snap => {
        let historyArr = [];
        snap.forEach(c => { 
            const val = c.val();
            historyArr.push({
                user: val.user || val.name || "알 수 없음",
                p: val.p !== undefined ? val.p : (val.pAmt || 0),
                e: val.e !== undefined ? val.e : (val.eAmt || 0),
                reason: val.reason || "지급/차감",
                timeStr: val.time || formatDateTime(val.timestamp)
            });
        });
        historyArr.reverse(); // 최신순 정렬

        let historyHtml = "";
        historyArr.forEach(h => {
            if ((typeof isAdmin === 'undefined' || !isAdmin) && typeof myName !== 'undefined' && h.user !== myName) return;

            const pColor = h.p >= 0 ? '#e74c3c' : '#3498db';
            const sign = h.p >= 0 ? '+' : '';

            historyHtml += `
                <div style="padding:12px; border-bottom:1px solid #eee; display:flex; flex-direction:column; gap:4px;">
                    <span style="font-size:0.9rem; color:#7f8c8d;">🕒 ${h.timeStr}</span>
                    <span style="font-size:1.1rem; color:#2c3e50;">
                        <b>${h.user}</b>: ${h.reason} 
                        <b style="color:${pColor}; margin-left:8px;">(${sign}${h.p}P)</b>
                        ${h.e ? `<b style="color:#27ae60; margin-left:4px;">(+${h.e}EXP)</b>` : ''}
                    </span>
                </div>`;
        });

        const historyListEl = document.getElementById('point-history-list');
        if (historyListEl) historyListEl.innerHTML = historyHtml || "<p style='color:#999; padding:10px;'>포인트 기록이 없습니다.</p>";
    });
};

// ----------------------------------------------------
// 2. 인벤토리 액션 함수들
// ----------------------------------------------------
window.requestUseItem = function(key, itemName) {
    if (confirm(`[${itemName}] 물품을 사용하시겠습니까?\n선생님께 사용 승인 요청이 전송됩니다.`)) {
        db.ref(`orders/${key}`).update({ status: '사용요청' });
    }
};

window.approveItem = function(key, user, item) {
    if (confirm(`[${user}] 학생의 [${item}] 사용을 승인하시겠습니까?\n(승인 즉시 인벤토리에서 완전히 삭제됩니다)`)) {
        db.ref(`orders/${key}`).remove();
    }
};

window.refundItem = function(key, user, item) {
    if (confirm(`[${user}] 학생의 [${item}] 사용을 반려(환불)하시겠습니까?\n(학생의 미사용 보관함으로 다시 돌아갑니다)`)) {
        db.ref(`orders/${key}`).update({ status: '환불' });
    }
};

// ----------------------------------------------------
// 3. 포인트 도감 및 플로팅 팝업 일괄 지급 로직
// ----------------------------------------------------
window.renderPointGuide = function() {
    // 💡 잠금장치 확인
    if (window.isPointGuideListenerAttached) return; 
    window.isPointGuideListenerAttached = true;

    db.ref('settings/pointGuides').on('value', async (snap) => {
        const guideListEl = document.getElementById('guide-list');
        if (!guideListEl) return;

        if (!snap.exists()) {
            const defaultGuides = [
                { title: "칭찬 받기", points: 100, desc: "선생님이나 친구에게 칭찬을 받았을 때" },
                { title: "숙제 완료", points: 200, desc: "오늘의 숙제를 완벽하게 해왔을 때" },
                { title: "청소 도우미", points: 150, desc: "맡은 청소 구역을 깨끗하게 정리했을 때" },
                { title: "바른 태도", points: 50, desc: "수업에 집중하고 바른 자세로 참여했을 때" }
            ];
            for (let g of defaultGuides) {
                await db.ref('settings/pointGuides').push(g);
            }
            return;
        }

        let guides = [];
        snap.forEach(c => { guides.push({ key: c.key, ...c.val() }); });

        let html = "";
        if (typeof isAdmin !== 'undefined' && isAdmin) {
            html += `<button onclick="addPointGuideItem()" style="width:100%; padding:15px; background:var(--gold, #f1c40f); border:none; border-radius:10px; font-weight:bold; font-size:1.2rem; cursor:pointer; margin-bottom:15px;">+ 새 포인트 항목 추가</button>`;
        }

        html += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:15px;">`;
        
        guides.forEach(g => {
            const adminControls = (typeof isAdmin !== 'undefined' && isAdmin) ? `
                <div style="margin-top:10px; display:flex; gap:10px;" onclick="event.stopPropagation();">
                    <button onclick="editPointGuideItem('${g.key}', '${g.title}', ${g.points}, '${g.desc}')" style="flex:1; background:#f39c12; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">수정</button>
                    <button onclick="deletePointGuideItem('${g.key}', '${g.title}')" style="flex:1; background:#e74c3c; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">삭제</button>
                </div>` : "";

            const onClickAction = (typeof isAdmin !== 'undefined' && isAdmin) ? `onclick="openBulkPointPopup('${g.title}', ${g.points})"` : "";
            const hoverStyle = (typeof isAdmin !== 'undefined' && isAdmin) ? `cursor:pointer; transition:transform 0.2s;` : ``;

            html += `
                <div ${onClickAction} style="background:white; border:2px solid #3498db; padding:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); ${hoverStyle}" ${isAdmin ? `onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'"` : ""}>
                    <div style="font-size:1.2rem; font-weight:bold; color:#2c3e50; margin-bottom:8px;">📜 ${g.title}</div>
                    <div style="font-size:1.4rem; font-weight:bold; color:${g.points >= 0 ? '#e74c3c' : '#3498db'}; margin-bottom:8px;">${g.points >= 0 ? '+' : ''}${g.points} P</div>
                    <div style="font-size:1rem; color:#666;">${g.desc || '설명 없음'}</div>
                    ${adminControls}
                </div>`;
        });
        html += `</div>`;
        guideListEl.innerHTML = html;
    });
};

window.addPointGuideItem = function() {
    const title = prompt("추가할 포인트 항목 이름 (예: 숙제 완료):");
    if (!title) return;
    const points = parseInt(prompt("지급할 포인트 점수 (차감 시 마이너스 입력):", "100"));
    if (isNaN(points)) return alert("숫자만 입력해주세요.");
    const desc = prompt("항목 설명:");

    db.ref('settings/pointGuides').push({ title, points, desc }).then(() => alert("✅ 추가되었습니다."));
};

window.editPointGuideItem = function(key, oldTitle, oldPoints, oldDesc) {
    const title = prompt("항목 이름 수정:", oldTitle) || oldTitle;
    const pointsStr = prompt("포인트 점수 수정:", oldPoints);
    const points = isNaN(parseInt(pointsStr)) ? oldPoints : parseInt(pointsStr);
    const desc = prompt("설명 수정:", oldDesc) || oldDesc;

    db.ref(`settings/pointGuides/${key}`).update({ title, points, desc }).then(() => alert("✅ 수정되었습니다."));
};

window.deletePointGuideItem = function(key, title) {
    if (confirm(`정말 '${title}' 항목을 삭제하시겠습니까?`)) {
        db.ref(`settings/pointGuides/${key}`).remove();
    }
};

// ----------------------------------------------------
// 4. 플로팅 팝업 일괄 지급 로직
// ----------------------------------------------------
window.openBulkPointPopup = async function(reason, points) {
    if (typeof isAdmin === 'undefined' || !isAdmin) return;
    const popup = document.getElementById('point-popup');
    const titleEl = document.getElementById('point-pop-title');
    const bodyEl = document.getElementById('point-pop-body');
    const applyBtn = document.getElementById('point-apply-btn');

    if (!popup || !bodyEl) return;

    if (titleEl) {
        titleEl.innerText = `⚖️ 포인트 일괄 전령 (${reason} : ${points >= 0 ? '+' : ''}${points}P)`;
    }

    const userSnap = await db.ref('users').once('value');
    let usersArr = [];
    userSnap.forEach(c => { 
        const val = c.val();
        if(val.role !== '총관리자1' && val.role !== '총관리자2' && val.name !== '선생님') {
            usersArr.push({ key: c.key, ...val }); 
        }
    });
    usersArr.sort((a, b) => (parseInt(a.no) || 0) - (parseInt(b.no) || 0));

    let bodyHtml = `
        <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <label style="font-weight:bold; cursor:pointer;"><input type="checkbox" onclick="toggleSelectAllStudents(this)" style="transform:scale(1.3); margin-right:8px;" checked> 전체 선택</label>
        </div>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; max-height:350px; overflow-y:auto; padding:5px;">`;

    usersArr.forEach(u => {
        bodyHtml += `
            <label style="display:flex; align-items:center; background:#f8f9fa; padding:10px; border-radius:8px; border:1px solid #ddd; cursor:pointer;">
                <input type="checkbox" class="student-checkbox" value="${u.key}" data-name="${u.name}" style="transform:scale(1.2); margin-right:10px;" checked>
                <span style="font-size:1.1rem; font-weight:bold;">${u.no ? u.no + '. ' : ''}${u.name}</span>
            </label>`;
    });
    bodyHtml += `</div>`;
    bodyEl.innerHTML = bodyHtml;

    if (applyBtn) {
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);

        newApplyBtn.onclick = async function() {
            const checkboxes = document.querySelectorAll('.student-checkbox:checked');
            if (checkboxes.length === 0) return alert("학생을 한 명 이상 선택해주세요!");
            if (!confirm(`${checkboxes.length}명의 학생에게 [${reason}] 사유로 ${points}P를 부여하시겠습니까?`)) return;

            const updates = {};
            const timestamp = new Date().getTime(); 

            for (let cb of checkboxes) {
                const sKey = cb.value;
                const sName = cb.getAttribute('data-name');
                const uSnap = await db.ref(`users/${sKey}`).once('value');
                if (uSnap.exists()) {
                    const currentPoints = uSnap.val().points || 0;
                    updates[`users/${sKey}/points`] = currentPoints + points;
                    
                    const hRef = db.ref('history').push();
                    updates[`history/${hRef.key}`] = { user: sName, p: points, reason: reason, timestamp: timestamp };
                }
            }
            await db.ref().update(updates);
            alert("✨ 일괄 지급 완료!");
            closePointPopup();
        };
    }
    popup.style.display = 'flex';
};

window.toggleSelectAllStudents = function(masterCb) {
    document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = masterCb.checked);
};

window.closePointPopup = function() {
    const popup = document.getElementById('point-popup');
    if (popup) popup.style.display = 'none';
};