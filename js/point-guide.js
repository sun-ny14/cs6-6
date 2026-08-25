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

// 중복 리스너 방지 잠금장치 변수
window.isPointsListenerAttached = false;
window.isPointGuideListenerAttached = false;

// ----------------------------------------------------
// 1. 인벤토리 및 승인, 포인트 연대기(pointLogs) 실시간 감지
// ----------------------------------------------------
window.initPointsTabListeners = function() {
    if (window.isPointsListenerAttached) return; 
    window.isPointsListenerAttached = true;
    
    // 주문 및 인벤토리 리스너
    db.ref('orders').on('value', snap => {
        let uHtml = "", wHtml = "", adminOrderHtml = "";
        
        snap.forEach(c => {
            const o = c.val(), key = c.key;
            const isMyItem = (typeof myName !== 'undefined' && o.user === myName);
            
            if (isMyItem && (o.status === '대기' || o.status === '요청' || o.status === '환불')) {
                const refundTag = o.status === '환불' ? '<span style="color:#e74c3c; font-size:0.9rem; font-weight:bold; margin-left:10px;">(환불/반려됨)</span>' : '';
                uHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 20px; border-bottom:1px solid #eee; background:#ffffff;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.4rem;">📦</span>
                            <b style="font-size:1.2rem; color:#2c3e50;">${o.item}</b>
                            ${refundTag}
                        </div>
                        <button onclick="requestUseItem('${key}', '${o.item}')" style="background:#3498db; color:white; padding:10px 20px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1.1rem; flex-shrink:0;">사용하기</button>
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
        if (uEl && uEl.querySelector('.list')) {
            const listContainer = uEl.querySelector('.list');
            listContainer.style.display = 'block';
            listContainer.style.background = '#ffffff';
            listContainer.style.borderRadius = '10px';
            listContainer.style.overflow = 'hidden';
            listContainer.innerHTML = uHtml || "<p style='color:#999; padding:15px; font-size:1.1rem;'>보관함이 비어있습니다.</p>";
        }
        const wEl = document.getElementById('inv-waiting');
        if (wEl && wEl.querySelector('.list')) wEl.querySelector('.list').innerHTML = wHtml || "<p style='color:#999; padding:10px;'>대기 중인 항목이 없습니다.</p>";
        
        const adminOrderEl = document.getElementById('order-list');
        if (adminOrderEl) adminOrderEl.innerHTML = adminOrderHtml || "<p style='color:#999;'>대기 중인 사용 요청이 없습니다.</p>";
    });

    // 포인트 연대기('pointLogs') 실시간 감지 및 점수 정상 출력 처리
    db.ref('pointLogs').limitToLast(50).on('value', snap => {
        let historyArr = [];
        snap.forEach(c => { 
            const val = c.val();
            const pointVal = val.pAmt !== undefined ? val.pAmt : (val.amount !== undefined ? val.amount : (val.p !== undefined ? val.p : 0));
            
            historyArr.push({
                user: val.name || val.user || "알 수 없음",
                p: parseInt(pointVal) || 0,
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
// 3. 포인트 도감(pointGuide) 및 일괄 지급 팝업 연동 로직
// ----------------------------------------------------
window.renderPointGuide = function() {
    if (window.isPointGuideListenerAttached) return; 
    window.isPointGuideListenerAttached = true;

    db.ref('pointGuide').on('value', async (snap) => {
        const guideListEl = document.getElementById('guide-list');
        if (!guideListEl) return;

        if (typeof isAdmin === 'undefined' || !isAdmin) {
            guideListEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #888; font-size: 1.2rem;">포인트 도감은 선생님만 조회할 수 있습니다.</div>`;
            return;
        }

       let guides = [];
        snap.forEach(c => { 
            const val = c.val();
            guides.push({ 
                key: c.key, 
                title: val.title || "제목 없음", 
                points: val.p !== undefined ? val.p : (val.points || 0), 
                desc: val.desc || (val.e ? `경험치 +${val.e}` : '설명 없음') 
            }); 
        });

        let html = "";
        if (typeof isAdmin !== 'undefined' && isAdmin) {
            html += `<div style="grid-column: 1 / -1; margin-bottom: 10px;"><button onclick="openPointGuideModal()" style="width:100%; padding:15px; background:var(--gold, #f1c40f); color:#2c3e50; border:none; border-radius:12px; font-weight:bold; font-size:1.2rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.05); transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">+ 새 포인트 항목 추가</button></div>`;
        }

        // 💡 수정된 부분: 무조건 3열로 배치되도록 repeat(3, 1fr) 적용!
        html += `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:15px; width:100%;">`;
        
        guides.forEach(g => {
            const adminControls = (typeof isAdmin !== 'undefined' && isAdmin) ? `
                <div style="margin-top:12px; display:flex; gap:10px;" onclick="event.stopPropagation();">
                    <button onclick="openPointGuideModal('${g.key}', '${g.title.replace(/'/g, "\\'")}', ${g.points}, '${(g.desc || '').replace(/'/g, "\\'")}')" style="flex:1; background:#f39c12; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold;">수정</button>
                    <button onclick="deletePointGuideItem('${g.key}', '${g.title.replace(/'/g, "\\'")}')" style="flex:1; background:#e74c3c; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold;">삭제</button>
                </div>` : "";

            const onClickAction = (typeof isAdmin !== 'undefined' && isAdmin) ? `onclick="openBulkPointPopup('${g.title.replace(/'/g, "\\'")}', ${g.points})"` : "";
            const hoverStyle = (typeof isAdmin !== 'undefined' && isAdmin) ? `cursor:pointer; transition:transform 0.2s;` : ``;

            html += `
                <div ${onClickAction} style="background:white; border:2px solid #3498db; padding:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:space-between; ${hoverStyle}" ${isAdmin ? `onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'"` : ""}>
                    <div>
                        <div style="font-size:1.2rem; font-weight:bold; color:#2c3e50; margin-bottom:8px;">📜 ${g.title}</div>
                        <div style="font-size:1.4rem; font-weight:bold; color:${g.points >= 0 ? '#e74c3c' : '#3498db'}; margin-bottom:8px;">${g.points >= 0 ? '+' : ''}${g.points} P</div>
                        <div style="font-size:1rem; color:#666; margin-bottom:8px;">${g.desc}</div>
                        <div style="font-size:0.85rem; color:#2980b9; font-weight:bold;">👉 클릭하여 일괄 지급하기</div>
                    </div>
                    ${adminControls}
                </div>`;
        });
        html += `</div>`;
        guideListEl.innerHTML = html;
    });
};

// 도감 항목 추가/수정 모달 팝업
window.openPointGuideModal = function(key = '', title = '', points = 100, desc = '') {
    if (typeof isAdmin === 'undefined' || !isAdmin) return;

    let overlay = document.getElementById('common-overlay');
    if (!overlay) return;

    const isEdit = !!key;
    const popTitle = isEdit ? '📜 포인트 도감 항목 수정' : '📜 새 포인트 항목 추가';

    document.getElementById('pop-title').innerText = popTitle;
    document.getElementById('pop-content').innerHTML = `
        <div style="display:flex; flex-direction:column; gap:15px; text-align:left; margin-top:15px; max-height:60vh; overflow-y:auto; padding:5px;">
            <div>
                <label style="font-size:1.1rem; font-weight:bold; display:block; margin-bottom:5px;">항목 이름:</label>
                <input type="text" id="modal-guide-title" value="${title}" placeholder="예: 숙제 완료" style="width:100%; padding:12px; font-size:1.2rem; border:2px solid #ccc; border-radius:8px; box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:1.1rem; font-weight:bold; display:block; margin-bottom:5px;">포인트 점수 (차감 시 마이너스):</label>
                <input type="number" id="modal-guide-points" value="${points}" style="width:100%; padding:12px; font-size:1.2rem; border:2px solid #3498db; border-radius:8px; box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:1.1rem; font-weight:bold; display:block; margin-bottom:5px;">항목 설명:</label>
                <input type="text" id="modal-guide-desc" value="${desc}" placeholder="예: 오늘의 숙제를 완벽하게 해왔을 때" style="width:100%; padding:12px; font-size:1.2rem; border:2px solid #ccc; border-radius:8px; box-sizing:border-box;">
            </div>
        </div>
        <div style="display:flex; gap:10px; margin-top:25px;">
            <button onclick="savePointGuideModal('${key}')" style="background:#3498db; color:white; border:none; padding:15px; border-radius:10px; font-size:1.2rem; font-weight:bold; flex:1; cursor:pointer;">저장</button>
            <button onclick="closePopup()" style="background:#e74c3c; color:white; border:none; padding:15px; border-radius:10px; font-size:1.2rem; font-weight:bold; flex:1; cursor:pointer;">취소</button>
        </div>
    `;

    const closeBtn = document.getElementById('pop-close-btn');
    if (closeBtn) closeBtn.style.display = 'none';

    overlay.style.display = 'flex';
};

window.savePointGuideModal = function(key) {
    const title = document.getElementById('modal-guide-title').value.trim();
    const points = parseInt(document.getElementById('modal-guide-points').value);
    const desc = document.getElementById('modal-guide-desc').value.trim();

    if (!title) return alert("항목 이름을 입력해주세요!");
    if (isNaN(points)) return alert("포인트 점수는 숫자만 입력해주세요!");

    if (key) {
        db.ref(`pointGuide/${key}`).update({ title, p: points, desc }).then(() => {
            alert("✅ 수정되었습니다.");
            closePopup();
        });
    } else {
        db.ref('pointGuide').push({ title, p: points, desc }).then(() => {
            alert("✅ 추가되었습니다.");
            closePopup();
        });
    }
};

window.deletePointGuideItem = function(key, title) {
    if (confirm(`정말 '${title}' 항목을 삭제하시겠습니까?`)) {
        db.ref(`pointGuide/${key}`).remove().then(() => {
            alert("🗑️ 삭제되었습니다.");
        });
    }
};

// ----------------------------------------------------
// 4. 포인트 일괄 지급 팝업 로직 (5열 그리드 및 번호/이름 배치 개선)
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
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:10px; max-height:400px; overflow-y:auto; padding:5px;">`;

    usersArr.forEach(u => {
        const studentNo = u.no ? `${u.no}번` : '번호 없음';
        bodyHtml += `
            <label style="display:flex; flex-direction:column; align-items:center; justify-content:center; background:#f8f9fa; padding:12px 8px; border-radius:10px; border:2px solid #ddd; cursor:pointer; text-align:center; position:relative; transition:all 0.2s;" onmouseover="this.style.borderColor='#3498db'" onmouseout="this.style.borderColor='#ddd'">
                <input type="checkbox" class="student-checkbox" value="${u.key}" data-name="${u.name}" style="position:absolute; top:8px; left:8px; transform:scale(1.2);" checked>
                <div style="font-size:0.9rem; color:#7f8c8d; font-weight:bold; margin-bottom:4px; margin-top:4px;">${studentNo}</div>
                <div style="font-size:1.1rem; font-weight:bold; color:#2c3e50;">${u.name}</div>
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
                    
                    const hRef = db.ref('pointLogs').push();
                    updates[`pointLogs/${hRef.key}`] = { 
                        name: sName, 
                        pAmt: points, 
                        reason: reason, 
                        time: new Date().toLocaleString('ko-KR') 
                    };
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
