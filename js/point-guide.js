// js/point-guide.js
// 포인트 도감, 인벤토리, 승인/환불, 포인트 연대기 및 일괄 지급 통합 로직

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

window.isPointsListenerAttached = false;
window.pointsListenerState = window.pointsListenerState || null;
window.isPointGuideListenerAttached = false;

function pointGuideEscapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
    })[char]);
}

function pointGuideEncoded(value) {
    return encodeURIComponent(String(value ?? '')).replace(/'/g, '%27');
}

function canManageItemUseRequests() {
    return typeof window.canManageShopRequests === 'function'
        ? window.canManageShopRequests()
        : window.isAdmin === true;
}


// ============================================================
// 1. 인벤토리 / 승인 / 포인트 연대기
// ============================================================

window.initPointsTabListeners = function() {
    const canManage=Boolean(
        window.canManageShopRequests&&window.canManageShopRequests()
    );
    const listenerKey=`${canManage?'manager':'student'}:${String(window.myName||'')}`;
    if(window.pointsListenerState?.key===listenerKey)return;

    if(window.pointsListenerState){
        const previous=window.pointsListenerState;
        previous.ordersRef?.off('value',previous.ordersHandler);
        previous.pointLogQuery?.off('value',previous.pointLogHandler);
    }

    window.isPointsListenerAttached = true;

    const ordersPath=canManage
        ?'orders':`ordersByUser/${window.myName}`;
    const ordersRef=db.ref(ordersPath);
    const ordersHandler=snap => {
        let uHtml = "";
        let wHtml = "";
        let adminOrderHtml = "";

        snap.forEach(c => {
            const o = c.val();
            const key = c.key;

            const isMyItem =
                typeof myName !== 'undefined' &&
                o.user === myName;

            if (
                isMyItem &&
                (
                    o.status === '대기' ||
                    o.status === '요청' ||
                    o.status === '환불'
                )
            ) {
                const refundTag =
                    o.status === '환불'
                        ? '<span class="list-item-sub badge badge--bad">환불/반려됨</span>'
                        : '';

                uHtml += `
                    <div class="list-item">
                        <div class="list-item-main">
                            <span class="list-item-title">📦 ${pointGuideEscapeHtml(o.item)}</span>
                            ${refundTag}
                        </div>

                        <div class="btn-row">
                            <button
                                onclick="requestUseItem(decodeURIComponent('${pointGuideEncoded(key)}'),decodeURIComponent('${pointGuideEncoded(o.item)}'))"
                                class="btn btn--primary"
                            >
                                사용하기
                            </button>
                        </div>
                    </div>
                `;
            }

            else if (
                isMyItem &&
                o.status === '사용요청'
            ) {
                wHtml += `
                    <div class="list-item">
                        <span class="muted">
                            ⏳ <b>${pointGuideEscapeHtml(o.item)}</b>
                            (선생님 승인 대기중...)
                        </span>
                    </div>
                `;
            }

            if (
                canManageItemUseRequests() &&
                o.status === '사용요청'
            ) {
                adminOrderHtml += `
                    <div class="list-item">
                        <span>
                            🧑‍🎓 <b>${pointGuideEscapeHtml(o.user)}</b> 용사 -
                            <b>${pointGuideEscapeHtml(o.item)}</b> 사용 요청
                        </span>

                        <div class="btn-row">
                            <button
                                onclick="approveItem(decodeURIComponent('${pointGuideEncoded(key)}'),decodeURIComponent('${pointGuideEncoded(o.user)}'),decodeURIComponent('${pointGuideEncoded(o.item)}'))"
                                class="btn btn--sm btn--good"
                            >
                                승인
                            </button>

                            <button
                                onclick="rejectItemUseRequest(decodeURIComponent('${pointGuideEncoded(key)}'),decodeURIComponent('${pointGuideEncoded(o.user)}'),decodeURIComponent('${pointGuideEncoded(o.item)}'))"
                                class="btn btn--sm btn--danger"
                            >
                                환불(반려)
                            </button>
                        </div>
                    </div>
                `;
            }
        });

        const uEl = document.getElementById('inv-unused');

        if (uEl && uEl.querySelector('.list')) {
            const listContainer = uEl.querySelector('.list');

            listContainer.innerHTML =
                uHtml ||
                "<div class='empty'><strong>보관함이 비어있습니다.</strong></div>";
        }

        const wEl = document.getElementById('inv-waiting');

        if (wEl && wEl.querySelector('.list')) {
            wEl.querySelector('.list').innerHTML =
                wHtml ||
                "<div class='empty'><strong>대기 중인 항목이 없습니다.</strong></div>";
        }

        const adminOrderEl =
            document.getElementById('order-list');

        if (adminOrderEl) {
            adminOrderEl.innerHTML =
                adminOrderHtml ||
                "<div class='empty'><strong>대기 중인 사용 요청이 없습니다.</strong></div>";
        }
    };
    ordersRef.on('value',ordersHandler);


    // 포인트 연대기
    const pointLogQuery = canManage
        ? db.ref('pointLogs').orderByChild('timestamp').limitToLast(50)
        : db.ref(`pointHistory/${window.myName}`).orderByChild('timestamp').limitToLast(50);

    const pointLogHandler=snap => {
        let historyArr = [];

        snap.forEach(c => {
            const val = c.val();

            const pointVal =
                val.pAmt !== undefined
                    ? val.pAmt
                    : (
                        val.amount !== undefined
                            ? val.amount
                            : (
                                val.p !== undefined
                                    ? val.p
                                    : (val.pChange !== undefined ? val.pChange : (val.change || 0))
                            )
                    );

            historyArr.push({
                user: canManage
                    ? (val.name || val.user || "알 수 없음")
                    : window.myName,
                p: parseInt(pointVal) || 0,
                reason: val.reason || "지급/차감",
                timeStr:
                    val.time ||
                    formatDateTime(val.timestamp)
            });
        });

        historyArr.reverse();

        let historyHtml = "";

        historyArr.forEach(h => {
            if (
                (typeof isAdmin === 'undefined' || !isAdmin) &&
                typeof myName !== 'undefined' &&
                h.user !== myName
            ) {
                return;
            }

            const pointClass =
                h.p >= 0
                    ? 'plus'
                    : 'minus';

            const sign =
                h.p >= 0
                    ? '+'
                    : '';

            historyHtml += `
                <div class="list-item">
                    <div class="list-item-main">
                        <span class="list-item-sub">
                            🕒 ${pointGuideEscapeHtml(h.timeStr)}
                        </span>

                        <span>
                            <b>${pointGuideEscapeHtml(h.user)}</b>:
                            ${pointGuideEscapeHtml(h.reason)}

                            <b class="point">
                                <span class="${pointClass}">(${sign}${h.p}P)</span>
                            </b>
                        </span>
                    </div>
                </div>
            `;
        });

        const historyListEl =
            document.getElementById('point-history-list');

        if (historyListEl) {
            historyListEl.innerHTML =
                historyHtml ||
                "<div class='empty'><strong>포인트 기록이 없습니다.</strong></div>";
        }
    };
    pointLogQuery.on('value',pointLogHandler);
    window.pointsListenerState={
        key:listenerKey,ordersRef,ordersHandler,pointLogQuery,pointLogHandler
    };
};


// ============================================================
// 2. 인벤토리 액션
// ============================================================

window.requestUseItem = async function(key, itemName) {
    if (
        confirm(
            `[${itemName}] 물품을 사용하시겠습니까?\n` +
            `선생님께 사용 승인 요청이 전송됩니다.`
        )
    ) {
        try {
            await window.callSecure('requestOrderUse', {orderKey:key});
            alert('사용 요청이 전송되었습니다.');
        } catch (error) {
            console.error('사용 요청 오류:', error);
            alert(error?.message || '사용 요청을 처리하지 못했습니다.');
        }
    }
};


window.approveItem = async function(key, user, item) {
    if (!canManageItemUseRequests()) {
        alert('상점 역할 학생과 선생님만 사용 요청을 승인할 수 있습니다.');
        return;
    }

    if (!confirm(`[${user}] 학생의 [${item}] 사용을 승인하시겠습니까?`)) return;

    try {
        await window.callSecure('manageShopOrder', {orderKey:key, action:'approve'});
        alert(`${user} · ${item} 사용을 승인했습니다.`);
    } catch (error) {
        console.error('사용 승인 오류:', error);
        alert(error?.message || '사용 승인을 처리하지 못했습니다.');
    }
};


window.rejectItemUseRequest = async function(key, user, item) {
    if (!canManageItemUseRequests()) {
        alert('상점 역할 학생과 선생님만 사용 요청을 반려할 수 있습니다.');
        return;
    }

    if (
        confirm(
            `[${user}] 학생의 [${item}] 사용을 반려(환불)하시겠습니까?\n` +
            `(학생의 미사용 보관함으로 다시 돌아갑니다)`
        )
    ) {
        try {
            await window.callSecure('manageShopOrder', {orderKey:key, action:'reject'});
            alert('반려 및 환불 처리가 완료되었습니다.');
        } catch (error) {
            console.error('사용 반려 오류:', error);
            alert(error?.message || '사용 반려를 처리하지 못했습니다.');
        }
    }
};


// ============================================================
// 3. 포인트 도감
// ============================================================

window.renderPointGuide = function() {
    if (window.isAdmin !== true) {
        const guideListEl = document.getElementById('guide-list');
        if (guideListEl) guideListEl.replaceChildren();
        return;
    }

    if (window.isPointGuideListenerAttached) return;

    window.isPointGuideListenerAttached = true;

    // Firebase pointGuide 연결 유지
    db.ref('pointGuide').on('value', async snap => {

        const guideListEl =
            document.getElementById('guide-list');

        if (!guideListEl) return;

        const canEditGuide = true;

        let guides = [];

        snap.forEach(c => {
            const val = c.val();

            guides.push({
                key: c.key,
                title: val.title || "제목 없음",
                points:
                    val.p !== undefined
                        ? val.p
                        : (val.points || 0),
                desc:
                    val.desc ||
                    (
                        val.e
                            ? `경험치 +${val.e}`
                            : '설명 없음'
                    )
            });
        });


        let increaseHtml = "";
        let decreaseHtml = "";

        if (!guides.length) {
            guideListEl.innerHTML = `
                <div class="empty" style="grid-column:1/-1;">
                    <strong>아직 등록된 포인트 항목이 없습니다.</strong>
                    ${canEditGuide ? '<span>아래에서 첫 항목을 추가해 보세요.</span>' : ''}
                </div>
            `;
        }


        /*
         * ========================================================
         * 도감 그리드
         *
         * 기존:
         * repeat(auto-fit,minmax(220px,1fr))
         *
         * 변경:
         * repeat(auto-fill,minmax(170px,1fr))
         *
         * 화면 폭을 최대한 활용하면서
         * 항목이 늘어나면 자동으로 다음 줄에 추가됩니다.
         * ========================================================
         */



        guides.forEach(g => {

            const safeTitle =
                String(g.title)
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "\\'");

            const safeDesc =
                String(g.desc || '')
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "\\'");


            const adminControls = !canEditGuide ? '' : `
                <div
                    class="btn-row btn-row--end"
                    onclick="event.stopPropagation();"
                >

                    <button
                        onclick="
                            openPointGuideModal(
                                '${g.key}',
                                '${safeTitle}',
                                ${g.points},
                                '${safeDesc}'
                            )
                        "
                        class="btn btn--xs"
                    >
                        수정
                    </button>

                    <button
                        onclick="
                            deletePointGuideItem(
                                '${g.key}',
                                '${safeTitle}'
                            )
                        "
                        class="btn btn--xs btn--danger"
                    >
                        삭제
                    </button>

                </div>
            `;


            const onClickAction =
                `onclick="openBulkPointPopup('${safeTitle}',${g.points})"`;


            const cardHtml = `
                <div
                    ${onClickAction}
                    class="guide-card${g.points < 0 ? ' is-minus' : ''}"
                    onmouseover="
                        this.style.transform='translateY(-2px)'
                    "
                    onmouseout="
                        this.style.transform='translateY(0)'
                    "
                >

                    <div>

                        <div class="strong nowrap">
                            📜 ${g.title}
                        </div>

                        <div class="guide-value${g.points < 0 ? ' is-minus' : ''}">
                            ${g.points >= 0 ? '+' : ''}
                            ${g.points} P
                        </div>

                        <div class="small muted">
                            ${g.desc}
                        </div>

                        <div class="tiny exp">
                            👉 일괄 지급
                        </div>

                    </div>

                    ${adminControls}

                </div>
            `;
            if(Number(g.points)<0)decreaseHtml+=cardHtml;
            else increaseHtml+=cardHtml;
        });

        const section=(title,tone,cards,emptyText)=>`
            <section class="point-guide-section ${tone}">
                <h4>${title}</h4>
                <div class="point-guide-section-grid">
                    ${cards||`<div class="empty"><strong>${emptyText}</strong></div>`}
                </div>
            </section>`;
        guideListEl.innerHTML =
            section('➕ 포인트 증가 항목','is-plus',increaseHtml,'등록된 증가 항목이 없습니다.')+
            section('➖ 포인트 차감 항목','is-minus',decreaseHtml,'등록된 차감 항목이 없습니다.');
    });
};


// ============================================================
// 4. 도감 항목 추가 / 수정
// ============================================================

window.openPointGuideModal = function(
    key = '',
    title = '',
    points = 100,
    desc = ''
) {
    if (
        typeof isAdmin === 'undefined' ||
        !isAdmin
    ) {
        return;
    }

    const overlay =
        document.getElementById('common-overlay');

    if (!overlay) return;

    const isEdit = !!key;

    const popTitle =
        isEdit
            ? '📜 포인트 도감 항목 수정'
            : '📜 새 포인트 항목 추가';

    document.getElementById('pop-title').innerText =
        popTitle;

    document.getElementById('pop-content').innerHTML = `
        <div class="stack">

            <div class="field">
                <label class="field-label">
                    항목 이름:
                </label>

                <input
                    type="text"
                    id="modal-guide-title"
                    value="${title}"
                    placeholder="예: 숙제 완료"
                >
            </div>


            <div class="field">
                <label class="field-label">
                    포인트 점수 (차감 시 마이너스):
                </label>

                <input
                    type="number"
                    id="modal-guide-points"
                    value="${points}"
                >
            </div>


            <div class="field">
                <label class="field-label">
                    항목 설명:
                </label>

                <input
                    type="text"
                    id="modal-guide-desc"
                    value="${desc}"
                    placeholder="예: 오늘의 숙제를 완벽하게 해왔을 때"
                >
            </div>

        </div>


        <div class="btn-row btn-row--fill">

            <button
                onclick="savePointGuideModal('${key}')"
                class="btn btn--primary btn--lg"
            >
                저장
            </button>

            <button
                onclick="closePopup()"
                class="btn btn--danger btn--lg"
            >
                취소
            </button>

        </div>
    `;


    const closeBtn =
        document.getElementById('pop-close-btn');

    if (closeBtn) {
        closeBtn.style.display = 'none';
    }

    overlay.style.display = 'flex';
};


window.savePointGuideModal = function(key) {

    const titleEl =
        document.getElementById('modal-guide-title');

    const pointsEl =
        document.getElementById('modal-guide-points');

    const descEl =
        document.getElementById('modal-guide-desc');

    if (!titleEl || !pointsEl || !descEl) {
        alert("입력창을 찾을 수 없습니다.");
        return;
    }

    const title =
        titleEl.value.trim();

    const points =
        parseInt(pointsEl.value);

    const desc =
        descEl.value.trim();


    if (!title) {
        alert("항목 이름을 입력해주세요!");
        return;
    }

    if (isNaN(points)) {
        alert("포인트 점수는 숫자만 입력해주세요!");
        return;
    }


    if (key) {

        db.ref(`pointGuide/${key}`)
            .update({
                title,
                p: points,
                desc
            })
            .then(() => {
                alert("✅ 수정되었습니다.");
                closePopup();
            });

    } else {

        db.ref('pointGuide')
            .push({
                title,
                p: points,
                desc
            })
            .then(() => {
                alert("✅ 추가되었습니다.");
                closePopup();
            });
    }
};


window.deletePointGuideItem = function(key, title) {

    if (
        confirm(
            `정말 '${title}' 항목을 삭제하시겠습니까?`
        )
    ) {
        db.ref(`pointGuide/${key}`)
            .remove()
            .then(() => {
                alert("🗑️ 삭제되었습니다.");
            });
    }
};


// ============================================================
// 5. 포인트 일괄 지급 팝업
// ============================================================

window.openBulkPointPopup = async function(
    reason,
    points
) {
    if (
        typeof isAdmin === 'undefined' ||
        !isAdmin
    ) {
        return;
    }

    const pointValue=Number(points);
    if(!Number.isSafeInteger(pointValue)){
        alert('도감의 포인트 값이 올바르지 않습니다.');
        return;
    }

    const popup =
        document.getElementById('point-popup');

    const titleEl =
        document.getElementById('point-pop-title');

    const bodyEl =
        document.getElementById('point-pop-body');

    const applyBtn =
        document.getElementById('point-apply-btn');


    if (!popup || !bodyEl) return;


    if (titleEl) {
        titleEl.innerText =
            `⚖️ 포인트 일괄 지급 (${reason} : ${pointValue >= 0 ? '+' : ''}${pointValue}P)`;
    }


    const userSnap =
        await db.ref('users').once('value');

    let usersArr = [];


    userSnap.forEach(c => {

        const val = c.val();

        if (
            c.key !== '총사령관' &&
            val.name !== '총사령관' &&
            val.role !== '총관리자1' &&
            val.role !== '총관리자2' &&
            (val.name !== '선생님' || val.name === '6-6 선생님')
        ) {
            usersArr.push({
                key:c.key,
                ...val
            });
        }
    });


    usersArr.sort(
        (a,b) =>
            (parseInt(a.no) || 0) -
            (parseInt(b.no) || 0)
    );


    // 점수가 음수면 전원 미선택 상태로 엽니다. 양수는 전원 선택입니다.
    const isPenalty = pointValue < 0;
    const defaultChecked = isPenalty ? '' : 'checked';

    let bodyHtml = `
        <div class="stack">
            ${
                isPenalty
                    ? `<div class="card card--bad">
                           <b>감점 항목입니다.</b>
                           <span class="muted">받을 학생을 직접 골라 주세요. 처음에는 아무도 선택돼 있지 않습니다.</span>
                       </div>`
                    : ''
            }

            <label class="check-row">
                <input
                    type="checkbox"
                    onclick="toggleSelectAllStudents(this)"
                    ${defaultChecked}
                >
                전체 선택
            </label>


            <div class="point-bulk-student-grid">
    `;


    usersArr.forEach(u => {

        const studentNo =
            u.no
                ? `${u.no}번`
                : '번호 없음';


        bodyHtml += `
            <label class="well stack stack--sm center">

                <input
                    type="checkbox"
                    class="student-checkbox"
                    value="${pointGuideEscapeHtml(u.key)}"
                    data-name="${pointGuideEscapeHtml(u.name)}"
                    ${defaultChecked}
                >

                <div class="tiny muted">
                    ${pointGuideEscapeHtml(studentNo)}
                </div>

                <div class="strong">
                    ${pointGuideEscapeHtml(u.name)}
                </div>

            </label>
        `;
    });


    bodyHtml += `</div></div>`;

    bodyEl.innerHTML =
        bodyHtml;


    if (applyBtn) {

        const newApplyBtn =
            applyBtn.cloneNode(true);

        applyBtn.parentNode.replaceChild(
            newApplyBtn,
            applyBtn
        );


        newApplyBtn.onclick =
            async function() {

                const checkboxes =
                    document.querySelectorAll(
                        '.student-checkbox:checked'
                    );


                if (checkboxes.length === 0) {
                    alert(
                        "학생을 한 명 이상 선택해주세요!"
                    );
                    return;
                }


                if (
                    !confirm(
                        `${checkboxes.length}명에게 ` +
                        `[${reason}] ${pointValue}P 를 반영합니다. 계속할까요?`
                    )
                ) {
                    return;
                }


                const requestId=`score_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
                const targets=Array.from(checkboxes).map(cb=>({
                    userKey:cb.value,
                    name:cb.getAttribute('data-name')||cb.value,
                    points:pointValue,exp:0
                }));
                newApplyBtn.disabled=true;
                newApplyBtn.textContent='반영 중…';
                try{
                    await window.callSecure('adjustStudentScores',{requestId,reason,targets});
                    closePointPopup();
                    alert(
                        `${checkboxes.length}명 · ${reason} `+
                        `${pointValue >= 0 ? '+' : ''}${pointValue}P 반영했습니다.`
                    );
                }catch(error){
                    console.error('포인트 도감 지급 오류:',error);
                    alert(error?.message||'포인트를 반영하지 못했습니다.');
                }finally{
                    newApplyBtn.disabled=false;
                    newApplyBtn.textContent='선택한 학생에게 반영';
                }
            };
    }


    popup.style.display =
        'flex';
};


window.toggleSelectAllStudents =
    function(masterCb) {

        document
            .querySelectorAll(
                '.student-checkbox'
            )
            .forEach(
                cb =>
                    cb.checked =
                        masterCb.checked
            );
    };


window.closePointPopup =
    function() {

        const popup =
            document.getElementById(
                'point-popup'
            );

        if (popup) {
            popup.style.display =
                'none';
        }
    };
