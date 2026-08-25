// js/point-guide.js
// 포인트 도감 / 인벤토리 / 승인 / 환불 / 포인트 기록 / 일괄 지급

function formatDateTime(timestamp) {
    if (!timestamp) return "";

    const d =
        new Date(timestamp);

    const y =
        d.getFullYear();

    const m =
        String(
            d.getMonth() + 1
        ).padStart(2, '0');

    const day =
        String(
            d.getDate()
        ).padStart(2, '0');

    const h =
        String(
            d.getHours()
        ).padStart(2, '0');

    const min =
        String(
            d.getMinutes()
        ).padStart(2, '0');

    return `${y}-${m}-${day} ${h}:${min}`;
}


window.isPointsListenerAttached = false;
window.isPointGuideListenerAttached = false;


/* =========================================================
   인벤토리 / 승인 / 포인트 연대기
   ========================================================= */

window.initPointsTabListeners =
function() {

    if (
        window.isPointsListenerAttached
    ) {
        return;
    }


    window.isPointsListenerAttached =
        true;


    /* 주문 */

    db.ref('orders').on(
        'value',
        snap => {

            let uHtml = "";
            let wHtml = "";
            let adminOrderHtml = "";


            snap.forEach(c => {

                const o =
                    c.val();

                const key =
                    c.key;


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
                            ? `
                                <span style="
                                    color:#e74c3c;
                                    font-size:0.9rem;
                                    font-weight:bold;
                                    margin-left:10px;
                                ">
                                    (환불/반려됨)
                                </span>
                            `
                            : '';


                    uHtml += `
                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            padding:15px 20px;
                            border-bottom:1px solid #eee;
                            background:#ffffff;
                        ">
                            <div style="
                                display:flex;
                                align-items:center;
                                gap:10px;
                            ">
                                <span style="
                                    font-size:1.4rem;
                                ">
                                    📦
                                </span>

                                <b style="
                                    font-size:1.2rem;
                                    color:#2c3e50;
                                ">
                                    ${o.item}
                                </b>

                                ${refundTag}
                            </div>

                            <button
                                onclick="requestUseItem('${key}','${o.item}')"
                                style="
                                    background:#3498db;
                                    color:white;
                                    padding:10px 20px;
                                    border:none;
                                    border-radius:8px;
                                    cursor:pointer;
                                    font-weight:bold;
                                    font-size:1.1rem;
                                    flex-shrink:0;
                                "
                            >
                                사용하기
                            </button>
                        </div>
                    `;

                } else if (
                    isMyItem &&
                    o.status === '사용요청'
                ) {

                    wHtml += `
                        <div style="
                            padding:12px;
                            border-bottom:1px solid #eee;
                            color:#7f8c8d;
                            font-size:1.1rem;
                        ">
                            ⏳
                            <b>${o.item}</b>
                            (선생님 승인 대기중...)
                        </div>
                    `;
                }


                if (
                    typeof isAdmin !== 'undefined' &&
                    isAdmin &&
                    o.status === '사용요청'
                ) {

                    adminOrderHtml += `
                        <div style="
                            background:#f8f9fa;
                            border:1px solid #ddd;
                            padding:12px;
                            border-radius:8px;
                            margin-bottom:10px;
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                        ">
                            <span style="
                                font-size:1.1rem;
                            ">
                                🧑‍🎓
                                <b>${o.user}</b>
                                용사 -
                                <b>${o.item}</b>
                                사용 요청
                            </span>

                            <div>
                                <button
                                    onclick="approveItem('${key}','${o.user}','${o.item}')"
                                    style="
                                        background:#2ecc71;
                                        color:white;
                                        padding:8px 12px;
                                        border:none;
                                        border-radius:6px;
                                        margin-right:5px;
                                        cursor:pointer;
                                        font-weight:bold;
                                    "
                                >
                                    승인
                                </button>

                                <button
                                    onclick="refundItem('${key}','${o.user}','${o.item}')"
                                    style="
                                        background:#e74c3c;
                                        color:white;
                                        padding:8px 12px;
                                        border:none;
                                        border-radius:6px;
                                        cursor:pointer;
                                        font-weight:bold;
                                    "
                                >
                                    환불(반려)
                                </button>
                            </div>
                        </div>
                    `;
                }
            });


            const uEl =
                document.getElementById(
                    'inv-unused'
                );


            if (
                uEl &&
                uEl.querySelector('.list')
            ) {

                const listContainer =
                    uEl.querySelector('.list');


                listContainer.style.display =
                    'block';

                listContainer.style.background =
                    '#ffffff';

                listContainer.style.borderRadius =
                    '10px';

                listContainer.style.overflow =
                    'hidden';


                listContainer.innerHTML =
                    uHtml ||
                    `
                        <p style="
                            color:#999;
                            padding:15px;
                            font-size:1.1rem;
                        ">
                            보관함이 비어있습니다.
                        </p>
                    `;
            }


            const wEl =
                document.getElementById(
                    'inv-waiting'
                );


            if (
                wEl &&
                wEl.querySelector('.list')
            ) {

                wEl.querySelector('.list')
                    .innerHTML =
                    wHtml ||
                    `
                        <p style="
                            color:#999;
                            padding:10px;
                        ">
                            대기 중인 항목이 없습니다.
                        </p>
                    `;
            }


            const adminOrderEl =
                document.getElementById(
                    'order-list'
                );


            if (adminOrderEl) {
                adminOrderEl.innerHTML =
                    adminOrderHtml ||
                    `
                        <p style="
                            color:#999;
                        ">
                            대기 중인 사용 요청이 없습니다.
                        </p>
                    `;
            }

        }
    );


    /* =====================================================
       pointLogs
       ===================================================== */

    db.ref('pointLogs')
        .limitToLast(50)
        .on(
            'value',
            snap => {

                let historyArr = [];


                snap.forEach(c => {

                    const val =
                        c.val();


                    const pointVal =
                        val.pAmt !== undefined
                            ? val.pAmt
                            : (
                                val.amount !== undefined
                                    ? val.amount
                                    : (
                                        val.p !== undefined
                                            ? val.p
                                            : 0
                                    )
                            );


                    historyArr.push({
                        user:
                            val.name ||
                            val.user ||
                            "알 수 없음",

                        p:
                            parseInt(
                                pointVal
                            ) || 0,

                        reason:
                            val.reason ||
                            "지급/차감",

                        timeStr:
                            val.time ||
                            formatDateTime(
                                val.timestamp
                            )
                    });
                });


                historyArr.reverse();


                let historyHtml =
                    "";


                historyArr.forEach(h => {

                    if (
                        (
                            typeof isAdmin ===
                            'undefined' ||
                            !isAdmin
                        ) &&
                        typeof myName !==
                        'undefined' &&
                        h.user !== myName
                    ) {
                        return;
                    }


                    const pColor =
                        h.p >= 0
                            ? '#e74c3c'
                            : '#3498db';


                    const sign =
                        h.p >= 0
                            ? '+'
                            : '';


                    historyHtml += `
                        <div style="
                            padding:12px;
                            border-bottom:1px solid #eee;
                            display:flex;
                            flex-direction:column;
                            gap:4px;
                        ">
                            <span style="
                                font-size:0.9rem;
                                color:#7f8c8d;
                            ">
                                🕒 ${h.timeStr}
                            </span>

                            <span style="
                                font-size:1.1rem;
                                color:#2c3e50;
                            ">
                                <b>${h.user}</b>:
                                ${h.reason}

                                <b style="
                                    color:${pColor};
                                    margin-left:8px;
                                ">
                                    (${sign}${h.p}P)
                                </b>
                            </span>
                        </div>
                    `;
                });


                const historyListEl =
                    document.getElementById(
                        'point-history-list'
                    );


                if (historyListEl) {
                    historyListEl.innerHTML =
                        historyHtml ||
                        `
                            <p style="
                                color:#999;
                                padding:10px;
                            ">
                                포인트 기록이 없습니다.
                            </p>
                        `;
                }
            }
        );
};


/* =========================================================
   인벤토리 액션
   ========================================================= */

window.requestUseItem =
function(key, itemName) {

    if (
        confirm(
            `[${itemName}] 물품을 사용하시겠습니까?\n선생님께 사용 승인 요청이 전송됩니다.`
        )
    ) {

        db.ref(
            `orders/${key}`
        ).update({
            status:'사용요청'
        });
    }
};


window.approveItem =
function(key, user, item) {

    if (
        confirm(
            `[${user}] 학생의 [${item}] 사용을 승인하시겠습니까?\n(승인 즉시 인벤토리에서 완전히 삭제됩니다)`
        )
    ) {

        db.ref(
            `orders/${key}`
        ).remove();
    }
};


window.refundItem =
function(key, user, item) {

    if (
        confirm(
            `[${user}] 학생의 [${item}] 사용을 반려(환불)하시겠습니까?\n(학생의 미사용 보관함으로 다시 돌아갑니다)`
        )
    ) {

        db.ref(
            `orders/${key}`
        ).update({
            status:'환불'
        });
    }
};


/* =========================================================
   포인트 도감
   Firebase: pointGuide
   ========================================================= */

window.renderPointGuide =
function() {

    /*
     * 중복 listener 방지.
     * 하지만 이미 listener가 붙었다면 다시 붙이지 않는다.
     */

    if (
        window.isPointGuideListenerAttached
    ) {
        return;
    }


    window.isPointGuideListenerAttached =
        true;


    db.ref('pointGuide').on(
        'value',
        snap => {

            const guideListEl =
                document.getElementById(
                    'guide-list'
                );


            if (!guideListEl) {
                return;
            }


            /*
             * 학생은 도감 조회 불가.
             */

            if (
                typeof isAdmin === 'undefined' ||
                !isAdmin
            ) {

                guideListEl.innerHTML = `
                    <div style="
                        padding:20px;
                        text-align:center;
                        color:#888;
                        font-size:1.2rem;
                    ">
                        포인트 도감은 선생님만 조회할 수 있습니다.
                    </div>
                `;

                return;
            }


            let guides = [];


            /*
             * Firebase pointGuide 데이터 그대로 읽음.
             */

            snap.forEach(c => {

                const val =
                    c.val();


                guides.push({
                    key:c.key,

                    title:
                        val.title ||
                        "제목 없음",

                    points:
                        val.p !== undefined
                            ? val.p
                            : (
                                val.points ||
                                0
                            ),

                    desc:
                        val.desc ||
                        (
                            val.e
                                ? `경험치 +${val.e}`
                                : '설명 없음'
                        )
                });
            });


            let html =
                "";


            /* 새 항목 */

            html += `
                <div style="
                    margin-bottom:10px;
                ">
                    <button
                        onclick="openPointGuideModal()"
                        style="
                            width:100%;
                            padding:15px;
                            background:var(--gold,#f1c40f);
                            color:#2c3e50;
                            border:none;
                            border-radius:12px;
                            font-weight:bold;
                            font-size:1.2rem;
                            cursor:pointer;
                            box-shadow:0 4px 6px rgba(0,0,0,0.05);
                        "
                    >
                        + 새 포인트 항목 추가
                    </button>
                </div>
            `;


            /*
             * 기존 Firebase pointGuide를 카드로 출력.
             */

            html += `
                <div style="
                    display:grid;
                    grid-template-columns:
                        repeat(auto-fit,minmax(220px,1fr));
                    gap:15px;
                    width:100%;
                ">
            `;


            guides.forEach(g => {

                const safeTitle =
                    String(g.title)
                        .replace(/\\/g,'\\\\')
                        .replace(/'/g,"\\'");


                const safeDesc =
                    String(g.desc || '')
                        .replace(/\\/g,'\\\\')
                        .replace(/'/g,"\\'");


                const point =
                    parseInt(
                        g.points
                    ) || 0;


                html += `
                    <div
                        onclick="openBulkPointPopup('${safeTitle}',${point})"
                        style="
                            background:white;
                            border:2px solid #3498db;
                            padding:20px;
                            border-radius:12px;
                            box-shadow:
                                0 4px 6px rgba(0,0,0,0.05);
                            display:flex;
                            flex-direction:column;
                            justify-content:space-between;
                            cursor:pointer;
                            transition:transform 0.2s;
                        "
                        onmouseover="
                            this.style.transform='translateY(-3px)'
                        "
                        onmouseout="
                            this.style.transform='translateY(0)'
                        "
                    >

                        <div>

                            <div style="
                                font-size:1.2rem;
                                font-weight:bold;
                                color:#2c3e50;
                                margin-bottom:8px;
                            ">
                                📜 ${g.title}
                            </div>


                            <div style="
                                font-size:1.4rem;
                                font-weight:bold;
                                color:${point >= 0 ? '#e74c3c' : '#3498db'};
                                margin-bottom:8px;
                            ">
                                ${point >= 0 ? '+' : ''}
                                ${point} P
                            </div>


                            <div style="
                                font-size:1rem;
                                color:#666;
                                margin-bottom:8px;
                            ">
                                ${g.desc}
                            </div>


                            <div style="
                                font-size:0.85rem;
                                color:#2980b9;
                                font-weight:bold;
                            ">
                                👉 클릭하여 일괄 지급하기
                            </div>

                        </div>


                        <div
                            style="
                                margin-top:12px;
                                display:flex;
                                gap:10px;
                            "
                            onclick="event.stopPropagation()"
                        >

                            <button
                                onclick="
                                    openPointGuideModal(
                                        '${safeTitle}',
                                        '${safeTitle}',
                                        ${point},
                                        '${safeDesc}'
                                    )
                                "
                                style="
                                    flex:1;
                                    background:#f39c12;
                                    color:white;
                                    border:none;
                                    padding:10px;
                                    border-radius:8px;
                                    cursor:pointer;
                                    font-weight:bold;
                                "
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
                                style="
                                    flex:1;
                                    background:#e74c3c;
                                    color:white;
                                    border:none;
                                    padding:10px;
                                    border-radius:8px;
                                    cursor:pointer;
                                    font-weight:bold;
                                "
                            >
                                삭제
                            </button>

                        </div>

                    </div>
                `;
            });


            html += `
                </div>
            `;


            guideListEl.innerHTML =
                html;
        }
    );
};


/* =========================================================
   도감 추가 / 수정
   ========================================================= */

window.openPointGuideModal =
function(
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
        document.getElementById(
            'common-overlay'
        );


    if (!overlay) {
        return;
    }


    const isEdit =
        !!key;


    const popTitle =
        isEdit
            ? '📜 포인트 도감 항목 수정'
            : '📜 새 포인트 항목 추가';


    const titleEl =
        document.getElementById(
            'pop-title'
        );


    const contentEl =
        document.getElementById(
            'pop-content'
        );


    if (!titleEl || !contentEl) {
        return;
    }


    titleEl.innerText =
        popTitle;


    contentEl.innerHTML = `
        <div style="
            display:flex;
            flex-direction:column;
            gap:15px;
            text-align:left;
            margin-top:15px;
            max-height:60vh;
            overflow-y:auto;
            padding:5px;
        ">

            <div>
                <label style="
                    font-size:1.1rem;
                    font-weight:bold;
                    display:block;
                    margin-bottom:5px;
                ">
                    항목 이름:
                </label>

                <input
                    type="text"
                    id="modal-guide-title"
                    value="${String(title).replace(/"/g,'&quot;')}"
                    placeholder="예: 숙제 완료"
                    style="
                        width:100%;
                        padding:12px;
                        font-size:1.2rem;
                        border:2px solid #ccc;
                        border-radius:8px;
                        box-sizing:border-box;
                    "
                >
            </div>


            <div>
                <label style="
                    font-size:1.1rem;
                    font-weight:bold;
                    display:block;
                    margin-bottom:5px;
                ">
                    포인트 점수 (차감 시 마이너스):
                </label>

                <input
                    type="number"
                    id="modal-guide-points"
                    value="${points}"
                    style="
                        width:100%;
                        padding:12px;
                        font-size:1.2rem;
                        border:2px solid #3498db;
                        border-radius:8px;
                        box-sizing:border-box;
                    "
                >
            </div>


            <div>
                <label style="
                    font-size:1.1rem;
                    font-weight:bold;
                    display:block;
                    margin-bottom:5px;
                ">
                    항목 설명:
                </label>

                <input
                    type="text"
                    id="modal-guide-desc"
                    value="${String(desc).replace(/"/g,'&quot;')}"
                    placeholder="예: 오늘의 숙제를 완벽하게 해왔을 때"
                    style="
                        width:100%;
                        padding:12px;
                        font-size:1.2rem;
                        border:2px solid #ccc;
                        border-radius:8px;
                        box-sizing:border-box;
                    "
                >
            </div>

        </div>


        <div style="
            display:flex;
            gap:10px;
            margin-top:25px;
        ">

            <button
                onclick="savePointGuideModal('${key}')"
                style="
                    background:#3498db;
                    color:white;
                    border:none;
                    padding:15px;
                    border-radius:10px;
                    font-size:1.2rem;
                    font-weight:bold;
                    flex:1;
                    cursor:pointer;
                "
            >
                저장
            </button>


            <button
                onclick="closePopup()"
                style="
                    background:#e74c3c;
                    color:white;
                    border:none;
                    padding:15px;
                    border-radius:10px;
                    font-size:1.2rem;
                    font-weight:bold;
                    flex:1;
                    cursor:pointer;
                "
            >
                취소
            </button>

        </div>
    `;


    const closeBtn =
        document.getElementById(
            'pop-close-btn'
        );


    if (closeBtn) {
        closeBtn.style.display =
            'none';
    }


    overlay.style.display =
        'flex';
};


/* =========================================================
   도감 저장
   ========================================================= */

window.savePointGuideModal =
function(key) {

    const titleEl =
        document.getElementById(
            'modal-guide-title'
        );


    const pointsEl =
        document.getElementById(
            'modal-guide-points'
        );


    const descEl =
        document.getElementById(
            'modal-guide-desc'
        );


    if (
        !titleEl ||
        !pointsEl ||
        !descEl
    ) {
        alert(
            '입력창을 찾을 수 없습니다.'
        );

        return;
    }


    const title =
        titleEl.value.trim();


    const points =
        parseInt(
            pointsEl.value
        );


    const desc =
        descEl.value.trim();


    if (!title) {
        alert(
            "항목 이름을 입력해주세요!"
        );

        return;
    }


    if (isNaN(points)) {
        alert(
            "포인트 점수는 숫자만 입력해주세요!"
        );

        return;
    }


    if (key) {

        /*
         * 기존 Firebase 경로 유지.
         */

        db.ref(
            `pointGuide/${key}`
        ).update({
            title:title,
            p:points,
            desc:desc
        }).then(() => {

            alert(
                "✅ 수정되었습니다."
            );

            closePopup();

        }).catch(error => {

            console.error(
                '도감 수정 오류:',
                error
            );

            alert(
                '도감 수정 중 오류가 발생했습니다.'
            );
        });

    } else {

        /*
         * 기존 Firebase pointGuide에 신규 항목 추가.
         */

        db.ref('pointGuide')
            .push({
                title:title,
                p:points,
                desc:desc
            })
            .then(() => {

                alert(
                    "✅ 추가되었습니다."
                );

                closePopup();

            }).catch(error => {

                console.error(
                    '도감 추가 오류:',
                    error
                );

                alert(
                    '도감 추가 중 오류가 발생했습니다.'
                );
            });
    }
};


/* =========================================================
   도감 삭제
   ========================================================= */

window.deletePointGuideItem =
function(key, title) {

    if (
        !confirm(
            `정말 '${title}' 항목을 삭제하시겠습니까?`
        )
    ) {
        return;
    }


    db.ref(
        `pointGuide/${key}`
    ).remove()
        .then(() => {

            alert(
                "🗑️ 삭제되었습니다."
            );

        })
        .catch(error => {

            console.error(
                '도감 삭제 오류:',
                error
            );

            alert(
                '도감 삭제 중 오류가 발생했습니다.'
            );
        });
};


/* =========================================================
   포인트 도감 → 동일 포인트 일괄 지급
   ========================================================= */

window.openBulkPointPopup =
async function(reason, points) {

    if (
        typeof isAdmin === 'undefined' ||
        !isAdmin
    ) {
        return;
    }


    const popup =
        document.getElementById(
            'point-popup'
        );


    const titleEl =
        document.getElementById(
            'point-pop-title'
        );


    const bodyEl =
        document.getElementById(
            'point-pop-body'
        );


    const applyBtn =
        document.getElementById(
            'point-apply-btn'
        );


    if (
        !popup ||
        !bodyEl
    ) {
        return;
    }


    if (titleEl) {
        titleEl.innerText =
            `⚖️ 포인트 일괄 전령 (${reason} : ${points >= 0 ? '+' : ''}${points}P)`;
    }


    const userSnap =
        await db.ref(
            'users'
        ).once('value');


    let usersArr = [];


    userSnap.forEach(c => {

        const val =
            c.val();


        if (
            val.role !== '총관리자1' &&
            val.role !== '총관리자2' &&
            val.name !== '선생님'
        ) {

            usersArr.push({
                key:c.key,
                ...val
            });
        }
    });


    usersArr.sort(
        (a, b) =>
            (
                parseInt(a.no) || 0
            ) -
            (
                parseInt(b.no) || 0
            )
    );


    let bodyHtml = `
        <div style="
            margin-bottom:15px;
            display:flex;
            justify-content:space-between;
            align-items:center;
        ">
            <label style="
                font-weight:bold;
                cursor:pointer;
            ">
                <input
                    type="checkbox"
                    onclick="toggleSelectAllStudents(this)"
                    style="
                        transform:scale(1.3);
                        margin-right:8px;
                    "
                    checked
                >
                전체 선택
            </label>
        </div>


        <div style="
            display:grid;
            grid-template-columns:repeat(5,1fr);
            gap:10px;
            max-height:400px;
            overflow-y:auto;
            padding:5px;
        ">
    `;


    usersArr.forEach(u => {

        const studentNo =
            u.no
                ? `${u.no}번`
                : '번호 없음';


        const safeName =
            String(
                u.name || ''
            )
                .replace(/"/g,'&quot;');


        bodyHtml += `
            <label style="
                display:flex;
                flex-direction:column;
                align-items:center;
                justify-content:center;
                background:#f8f9fa;
                padding:12px 8px;
                border-radius:10px;
                border:2px solid #ddd;
                cursor:pointer;
                text-align:center;
                position:relative;
            ">

                <input
                    type="checkbox"
                    class="student-checkbox"
                    value="${u.key}"
                    data-name="${safeName}"
                    style="
                        position:absolute;
                        top:8px;
                        left:8px;
                        transform:scale(1.2);
                    "
                    checked
                >

                <div style="
                    font-size:0.9rem;
                    color:#7f8c8d;
                    font-weight:bold;
                    margin-bottom:4px;
                    margin-top:4px;
                ">
                    ${studentNo}
                </div>

                <div style="
                    font-size:1.1rem;
                    font-weight:bold;
                    color:#2c3e50;
                ">
                    ${u.name}
                </div>

            </label>
        `;
    });


    bodyHtml += `
        </div>
    `;


    bodyEl.innerHTML =
        bodyHtml;


    if (applyBtn) {

        /*
         * 기존 버튼 이벤트 중복 방지.
         */

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


            if (
                checkboxes.length === 0
            ) {
                alert(
                    "학생을 한 명 이상 선택해주세요!"
                );

                return;
            }


            if (
                !confirm(
                    `${checkboxes.length}명의 학생에게 [${reason}] 사유로 ${points}P를 부여하시겠습니까?`
                )
            ) {
                return;
            }


            const updates = {};


            for (
                const cb of checkboxes
            ) {

                const sKey =
                    cb.value;


                const sName =
                    cb.getAttribute(
                        'data-name'
                    );


                const uSnap =
                    await db.ref(
                        `users/${sKey}`
                    ).once('value');


                if (!uSnap.exists()) {
                    continue;
                }


                const userData =
                    uSnap.val();


                const currentPoints =
                    parseInt(
                        userData.points
                    ) || 0;


                const newPoints =
                    currentPoints +
                    points;


                updates[
                    `users/${sKey}/points`
                ] =
                    newPoints;


                /*
                 * 기존 pointLogs 유지.
                 */

                const hRef =
                    db.ref(
                        'pointLogs'
                    ).push();


                updates[
                    `pointLogs/${hRef.key}`
                ] = {
                    name:sName,
                    pAmt:points,
                    reason:reason,
                    time:new Date()
                        .toLocaleString(
                            'ko-KR'
                        )
                };
            }


            try {

                await db.ref().update(
                    updates
                );


                alert(
                    "✨ 일괄 지급 완료!"
                );


                closePointPopup();


                if (
                    typeof renderHeroes ===
                    'function'
                ) {
                    renderHeroes();
                }

            } catch (error) {

                console.error(
                    '일괄 지급 오류:',
                    error
                );

                alert(
                    '일괄 지급 중 오류가 발생했습니다.'
                );
            }
        };
    }


    popup.style.display =
        'flex';
};


/* =========================================================
   전체 선택
   ========================================================= */

window.toggleSelectAllStudents =
function(masterCb) {

    document
        .querySelectorAll(
            '.student-checkbox'
        )
        .forEach(cb => {

            cb.checked =
                masterCb.checked;
        });
};


/* =========================================================
   포인트 팝업 닫기
   ========================================================= */

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
