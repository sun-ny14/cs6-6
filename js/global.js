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
    // 💡 1. 관리자(총사령관) 및 선생님 계정은 메인 화면에서 숨김 처리
    if (u.name === "총사령관" || u.name.includes("선생님")) return; 
    
    const isMe = (u.name === myName);
    const title = u.selectedAnimal ? `${u.selectedAnimal} ` : "";
    const level = u.lv || 1;
    
    // 💡 2. 클릭 시 프로필로 이동하는 함수(openUserHistory 또는 showStudentProfile 등 선생님 앱에 맞춰 수정) 적용
    h += `<div class="hero-card" onclick="openStudentProfile('${u.name}')" 
            style="background: #ffffff; border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; text-align: center; cursor: pointer; position: relative; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            
            <div style="position: absolute; top: 0; left: 0; background: #95a5a6; color: white; padding: 4px 10px; border-radius: 10px 0 10px 0; font-weight: bold;">
                Lv.${level}
            </div>

            <div style="font-size: 3rem; margin: 10px 0;">
                ${u.selectedAnimal || '🐹'}
            </div>
            
            <!-- 💡 3. 노안 방지! 학생 이름 글자 크기를 1.6rem으로 큼직하게 키우고 진하게 처리 -->
            <b style="font-size: 1.6rem; font-weight: 900; color: #2c3e50; display: block; margin-bottom: 8px;">
                ${isMe ? '⭐ ' : ''}${title}${u.name}
            </b>
            
            <div style="background: #f1c40f; color: #8e44ad; border-radius: 20px; padding: 5px 15px; display: inline-block; font-weight: 900; font-size: 1.1rem;">
                💰 ${u.points || 0} P
            </div>
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
