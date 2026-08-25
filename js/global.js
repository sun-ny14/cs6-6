// js/global.js
// 공통으로 사용되는 유틸리티 함수 모음

function getTodayKST() {
    const now = new Date();

    const krTime = new Date(
        now.getTime() + (9 * 60 * 60 * 1000)
    );

    return (
        krTime.getUTCFullYear() +
        "-" +
        String(krTime.getUTCMonth() + 1).padStart(2, '0') +
        "-" +
        String(krTime.getUTCDate()).padStart(2, '0')
    );
}


/* =========================================================
   화면 표시
   ========================================================= */

function forceScreenDisplay(status) {

    const load = document.getElementById('loading-screen');
    const login = document.getElementById('login-screen');
    const app = document.getElementById('main-app');

    if (load) {
        load.style.display = 'none';
    }

    if (status === 'app') {

        if (login) {
            login.style.display = 'none';
        }

        if (app) {
            app.style.display = 'flex';
        }

    } else {

        if (login) {
            login.style.display = 'flex';
        }

        if (app) {
            app.style.display = 'none';
        }
    }
}


/* =========================================================
   탭 전환
   ========================================================= */

function showTab(t) {

    // [수정]
    // currentTab 미정의 오류를 방지한다.
    window.currentTab = t;

    try {
        sessionStorage.setItem('activeTab', t);
    } catch (e) {
        console.warn('activeTab 저장 실패:', e);
    }


    document.querySelectorAll('.tab-content').forEach(s => {

        s.classList.remove('active');

        s.style.display = 'none';
    });


    document.querySelectorAll('.sidebar-menu button').forEach(b => {

        b.classList.remove('active');
    });


    const targetTab =
        document.getElementById('tab-' + t);

    if (targetTab) {

        targetTab.classList.add('active');

        targetTab.style.display = 'block';
    }


    const targetBtn =
        document.getElementById('btn-' + t);

    if (targetBtn) {

        targetBtn.classList.add('active');
    }


    /* -------------------------
       등교
       ------------------------- */

    if (t === 'checkin') {

        if (typeof switchCheckinSub === 'function') {

            switchCheckinSub('checkin-main');
        }

        // 관리자 / 총사령관이면 로그 버튼 표시
        const adminCheckinBtn =
            document.getElementById('sub-btn-checkin-logs');

        if (adminCheckinBtn) {

            const adminStatus =
                (typeof isAdmin !== 'undefined' && isAdmin) ||
                (typeof isHelper !== 'undefined' && isHelper) ||
                (typeof myName !== 'undefined' && myName === '총사령관');

            adminCheckinBtn.style.display =
                adminStatus ? 'block' : 'none';
        }
    }


    /* -------------------------
       상점
       ------------------------- */

    if (t === 'shop') {

        if (typeof renderShop === 'function') {
            renderShop();
        }

        if (typeof loadOrderRecords === 'function') {
            loadOrderRecords();
        }
    }


    /* -------------------------
       포인트
       ------------------------- */

    if (t === 'points') {

        if (typeof renderPointGuide === 'function') {
            renderPointGuide();
        }

        if (typeof initPointsTabListeners === 'function') {
            initPointsTabListeners();
        }
    }


    /* -------------------------
       학급관리
       ------------------------- */

    if (t === 'management') {

        if (typeof renderManagementSub === 'function') {
            renderManagementSub('grades');
        }
    }


    /* -------------------------
       등교로그 새로고침
       ------------------------- */

    if (t === 'checkin') {

        const logArea =
            document.getElementById('sub-checkin-logs');

        if (
            logArea &&
            logArea.style.display !== 'none' &&
            typeof refreshCheckinManagement === 'function'
        ) {
            refreshCheckinManagement();
        }
    }
}


/* =========================================================
   공통 팝업 닫기
   ========================================================= */

function closePopup() {

    if (
        window.routineActive &&
        ++rIdx < routineItems.length
    ) {

        document.getElementById('pop-content').innerText =
            `[루틴 ${rIdx + 1}단계]\n${routineItems[rIdx]}`;

    } else {

        const overlay =
            document.getElementById('common-overlay');

        if (overlay) {
            overlay.style.display = 'none';
        }

        rIdx = 0;
    }
}


/* =========================================================
   아바타
   ========================================================= */

function getAvatar(lv, selectedAnimal) {

    return "";
}


/* =========================================================
   등교 서브탭
   ========================================================= */

function switchCheckinSub(subId) {

    const subMain =
        document.getElementById('sub-checkin-main');

    const subLogs =
        document.getElementById('sub-checkin-logs');

    const btnMain =
        document.getElementById('sub-btn-checkin-main');

    const btnLogs =
        document.getElementById('sub-btn-checkin-logs');


    if (subMain) {

        subMain.style.display =
            (subId === 'checkin-main')
                ? 'block'
                : 'none';
    }


    if (subLogs) {

        subLogs.style.display =
            (subId === 'checkin-logs')
                ? 'block'
                : 'none';
    }


    if (btnMain) {

        btnMain.style.background =
            (subId === 'checkin-main')
                ? 'var(--dark, #2c3e50)'
                : '#ddd';

        btnMain.style.color =
            (subId === 'checkin-main')
                ? 'white'
                : '#333';
    }


    if (btnLogs) {

        btnLogs.style.background =
            (subId === 'checkin-logs')
                ? 'var(--dark, #2c3e50)'
                : '#ddd';

        btnLogs.style.color =
            (subId === 'checkin-logs')
                ? 'white'
                : '#333';
    }


    if (subId === 'checkin-logs') {

        if (typeof refreshCheckinManagement === 'function') {

            refreshCheckinManagement();

        } else if (
            typeof generateNewLayout === 'function'
        ) {

            generateNewLayout();
        }
    }
}


/* =========================================================
   학급관리 서브탭
   ========================================================= */

function renderManagementSub(type) {

    const container =
        document.getElementById('management-sub-container');

    const btnGrades =
        document.getElementById('sub-btn-grades');

    const btnBudget =
        document.getElementById('sub-btn-budget');


    if (type === 'grades') {

        if (btnGrades) {

            btnGrades.style.background =
                'var(--primary)';

            btnGrades.style.color = 'white';
        }

        if (btnBudget) {

            btnBudget.style.background = '#ddd';

            btnBudget.style.color = '#333';
        }


        if (
            typeof renderGradesMain === 'function'
        ) {

            renderGradesMain();

        } else if (container) {

            container.innerHTML = `
                <div class="card">
                    <h2>📝 성적 및 평가 관리</h2>
                    <p>
                        학생들의 성적과 수행평가 기록을 관리하는 공간입니다.
                    </p>
                </div>
            `;
        }

    } else if (type === 'budget') {

        if (btnBudget) {

            btnBudget.style.background =
                'var(--primary)';

            btnBudget.style.color = 'white';
        }

        if (btnGrades) {

            btnGrades.style.background = '#ddd';

            btnGrades.style.color = '#333';
        }


        if (
            typeof initBudgetManager === 'function'
        ) {

            initBudgetManager();
        }
    }
}


/* =========================================================
   앱 시작
   ========================================================= */

function startApp() {

    const adminStatus =
        (typeof isAdmin !== 'undefined' && isAdmin);

    const helperStatus =
        (typeof isHelper !== 'undefined' && isHelper);

    const commanderStatus =
        (typeof myName !== 'undefined' && myName === "총사령관");


    /* -------------------------
       관리자 메뉴
       ------------------------- */

    if (
        adminStatus ||
        helperStatus ||
        commanderStatus
    ) {

        const orderMgr =
            document.getElementById('admin-order-mgr');

        if (orderMgr) {
            orderMgr.style.display = 'block';
        }


        const bbAdminBtn =
            document.getElementById('btn-blackboard-admin');

        if (bbAdminBtn) {
            bbAdminBtn.style.display = 'block';
        }


        const adminBtn =
            document.getElementById('btn-admin');

        if (adminBtn) {
            adminBtn.style.display = 'block';
        }

    } else {

        const adminBtn =
            document.getElementById('btn-admin');

        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
    }


    /* =====================================================
       [수정]
       총사령관의 등교 버튼을 숨기지 않는다.
       ===================================================== */

    const checkinTabBtn =
        document.getElementById('btn-checkin');

    if (checkinTabBtn) {

        checkinTabBtn.style.display = 'block';
    }


    /* =====================================================
       등교로그 관리자 버튼
       ===================================================== */

    const checkinLogBtn =
        document.getElementById('sub-btn-checkin-logs');

    if (checkinLogBtn) {

        checkinLogBtn.style.display =
            (
                adminStatus ||
                helperStatus ||
                commanderStatus
            )
                ? 'block'
                : 'none';
    }


    /* =====================================================
       청소
       ===================================================== */

    if (commanderStatus) {

        const cleaningTabBtn =
            document.getElementById('btn-cleaning');

        if (cleaningTabBtn) {

            cleaningTabBtn.style.display =
                'inline-block';
        }

    } else {

        if (
            typeof currentUser !== 'undefined' &&
            currentUser &&
            currentUser.role === '청소'
        ) {

            const cleaningTabBtn =
                document.getElementById('btn-cleaning');

            if (cleaningTabBtn) {

                cleaningTabBtn.style.display =
                    'inline-block';
            }
        }
    }


    window.isHousingEnabled = true;


    /* =====================================================
       Firebase settings listener
       기존 settings 경로 유지
       ===================================================== */

    db.ref('settings').on('value', snap => {

        const s = snap.val() || {};


        giftList =
            s.giftList || [];


        routineItems =
            s.routineText
                ?.split('\n')
                .filter(t => t.trim()) || [];


        if (adminStatus) {

            const passEl =
                document.getElementById('conf-pass');

            const lateEl =
                document.getElementById('conf-late');

            const closeEl =
                document.getElementById('conf-close');

            const routineEl =
                document.getElementById('conf-routine');

            const giftsEl =
                document.getElementById('conf-gifts');


            if (passEl) {
                passEl.value =
                    s.password || "";
            }

            if (lateEl) {
                lateEl.value =
                    s.lateTime || "08:40";
            }

            if (closeEl) {
                closeEl.value =
                    s.closeTime || "09:00";
            }

            if (routineEl) {
                routineEl.value =
                    s.routineText || "";
            }

            if (giftsEl) {
                giftsEl.value =
                    s.giftList?.join('\n') || "";
            }
        }


        const guide =
            document.getElementById('checkin-guide');

        if (guide) {

            guide.innerText =
                `✅ 정상: ~${s.lateTime || '08:40'} | ⚠️ 지각: ${s.closeTime || '09:00'} 마감`;
        }


        window.currentDefaultBg =
            s.defaultBg || "";
    });


    /* =====================================================
       좌석
       ===================================================== */

    if (
        typeof generateNewLayout === 'function'
    ) {

        generateNewLayout();
    }


    /* =====================================================
       포인트
       ===================================================== */

    if (
        typeof renderPointGuide === 'function'
    ) {

        renderPointGuide();
    }


    if (
        typeof initPointsTabListeners === 'function'
    ) {

        initPointsTabListeners();
    }


    /* =====================================================
       주문
       ===================================================== */

    if (
        typeof loadOrderRecords === 'function'
    ) {

        loadOrderRecords();
    }


    /* =====================================================
       Firebase users listener
       기존 users 경로 유지
       ===================================================== */

    db.ref('users').on('value', snap => {

        let users = [];


        snap.forEach(c => {

            let u = c.val();

            u.name = c.key;

            users.push(u);
        });


        currentUsers =
            users.sort((a, b) =>
                (
                    a.name === myName
                        ? -1
                        : b.name === myName
                            ? 1
                            : (a.no || 99) - (b.no || 99)
                )
            );


       let h = ""; 
        currentUsers.forEach(u => { 
            if(u.name === "총사령관") return; 
            const isMe = (u.name === myName);
            const title = u.selectedAnimal ? `${u.selectedAnimal} ` : "";
            
            // RPG 게임 재화창 느낌의 포인트 디자인
            const pointDisplay = (isMe || isAdmin) ? `<div style="background: rgba(0,0,0,0.6); color: #ffdf00; border-radius: 8px; padding: 4px 10px; display: inline-block; font-size: 0.95rem; font-weight: bold; margin-top: 10px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.2);">💰 ${u.points || 0} P</div>` : '';

            // 💡 메이플스토리 스타일: 레벨별 카드 등급 색상 및 배경 결정
            const level = u.lv || 1;
            let cardBg = "linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)"; // 기본(초보자) - 흰색/회색
            let borderColor = "#bdc3c7";

            if (level >= 30) {
                cardBg = "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)"; // 에픽 - 오렌지/골드
                borderColor = "#e67e22";
            } else if (level >= 20) {
                cardBg = "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)"; // 유니크 - 연보라/하늘
                borderColor = "#9b59b6";
            } else if (level >= 10) {
                cardBg = "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)"; // 레어 - 연두/초록
                borderColor = "#2ecc71";
            }

            // 내 카드일 경우 황금빛 글로우 이펙트 추가
            const myHighlight = isMe ? "box-shadow: 0 0 15px rgba(241, 196, 15, 0.8), inset 0 0 10px rgba(255,255,255,0.5);" : "box-shadow: 3px 5px 10px rgba(0,0,0,0.15);";

            h += `<div class="hero-card" onclick="openUserHistory('${u.name}')" 
                    style="background: ${cardBg}; border: 3px solid ${borderColor}; border-radius: 15px; padding: 25px 10px 15px 10px; text-align: center; cursor: pointer; transition: transform 0.2s; ${myHighlight} position: relative; overflow: hidden;">
                    
                    <!-- 모서리 레벨 뱃지 -->
                    <div style="position: absolute; top: 0; left: 0; background: ${borderColor}; color: white; padding: 4px 12px; border-radius: 0 0 12px 0; font-weight: 900; font-size: 1.1rem; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); box-shadow: 2px 2px 5px rgba(0,0,0,0.2);">
                        Lv.${level}
                    </div>

                    <div style="font-size: 3.5rem; margin-bottom: 10px; filter: drop-shadow(2px 4px 4px rgba(0,0,0,0.2));">
                        ${getAvatar(level, u.selectedAnimal) || '🐣'}
                    </div>
                    
                    <b style="font-size: 1.25rem; display: block; color: #2c3e50; text-shadow: 1px 1px 2px rgba(255,255,255,0.9); background: rgba(255,255,255,0.55); padding: 6px; border-radius: 8px; margin: 0 10px;">
                        ${isMe ? '⭐ ' : ''}${title}${u.name}
                    </b>
                    
                    ${pointDisplay}
                </div>`; 
        }); 
        
        const heroGrid = document.getElementById('hero-grid');
        if(heroGrid) heroGrid.innerHTML = h;
        if (
            adminStatus &&
            typeof renderAdminList === 'function'
        ) {

            renderAdminList();
        }


        if (
            typeof generateNewLayout === 'function'
        ) {

            generateNewLayout();
        }
    });
}


/* =========================================================
   일괄 포인트 팝업
   ========================================================= */

window.openMultiPopup =
    function(title, points, reason) {

        if (
            typeof openBulkPointPopup === 'function'
        ) {

            openBulkPointPopup(
                reason || title,
                points
            );

        } else {

            alert(
                "일괄 지급 팝업 함수를 찾을 수 없습니다."
            );
        }
    };
