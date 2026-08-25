// js/global.js
// 공통 유틸리티 및 앱 초기화

function getTodayKST() {
    const now = new Date();
    const krTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    return (
        krTime.getUTCFullYear() +
        "-" +
        String(krTime.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(krTime.getUTCDate()).padStart(2, "0")
    );
}


/* =========================================================
   화면 표시
   ========================================================= */

function forceScreenDisplay(status) {
    const load = document.getElementById("loading-screen");
    const login = document.getElementById("login-screen");
    const app = document.getElementById("main-app");

    if (load) load.style.display = "none";

    if (status === "app") {
        if (login) login.style.display = "none";
        if (app) app.style.display = "flex";
    } else {
        if (login) login.style.display = "flex";
        if (app) app.style.display = "none";
    }
}


/* =========================================================
   탭 전환
   ========================================================= */

function showTab(t) {
    window.currentTab = t;

    try {
        sessionStorage.setItem("activeTab", t);
    } catch (e) {
        console.warn("activeTab 저장 실패:", e);
    }

    document.querySelectorAll(".tab-content").forEach(s => {
        s.classList.remove("active");
        s.style.display = "none";
    });

    document.querySelectorAll(".sidebar-menu button").forEach(b => {
        b.classList.remove("active");
    });

    const targetTab = document.getElementById("tab-" + t);

    if (targetTab) {
        targetTab.classList.add("active");
        targetTab.style.display = "block";
    }

    const targetBtn = document.getElementById("btn-" + t);

    if (targetBtn) {
        targetBtn.classList.add("active");
    }


    /* -------------------------
       용사 목록
       ------------------------- */

    if (t === "heroes") {
        if (typeof renderHeroes === "function") {
            renderHeroes();
        }
    }


    /* -------------------------
       등교
       ------------------------- */

    if (t === "checkin") {
        if (typeof switchCheckinSub === "function") {
            switchCheckinSub("checkin-main");
        }

        const adminCheckinBtn =
            document.getElementById("sub-btn-checkin-logs");

        if (adminCheckinBtn) {
            const adminStatus =
                (typeof isAdmin !== "undefined" && isAdmin) ||
                (typeof isHelper !== "undefined" && isHelper) ||
                (typeof myName !== "undefined" && myName === "총사령관");

            adminCheckinBtn.style.display =
                adminStatus ? "block" : "none";
        }
    }


    /* -------------------------
       상점
       ------------------------- */

    if (t === "shop") {
        if (typeof renderShop === "function") {
            renderShop();
        }

        if (typeof loadOrderRecords === "function") {
            loadOrderRecords();
        }
    }


    /* -------------------------
       포인트
       ------------------------- */

    if (t === "points") {
        if (typeof renderPointGuide === "function") {
            renderPointGuide();
        }

        if (typeof initPointsTabListeners === "function") {
            initPointsTabListeners();
        }
    }


    /* -------------------------
       학급관리
       ------------------------- */

    if (t === "management") {
        if (typeof renderManagementSub === "function") {
            renderManagementSub("grades");
        }
    }


    /* -------------------------
       등교 로그
       ------------------------- */

    if (t === "checkin") {
        const logArea =
            document.getElementById("sub-checkin-logs");

        if (
            logArea &&
            logArea.style.display !== "none" &&
            typeof refreshCheckinManagement === "function"
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
        document.getElementById("pop-content").innerText =
            `[루틴 ${rIdx + 1}단계]\n${routineItems[rIdx]}`;
    } else {
        const overlay =
            document.getElementById("common-overlay");

        if (overlay) {
            overlay.style.display = "none";
        }

        rIdx = 0;
    }
}


/* =========================================================
   등교 서브탭
   ========================================================= */

function switchCheckinSub(subId) {
    const subMain =
        document.getElementById("sub-checkin-main");

    const subLogs =
        document.getElementById("sub-checkin-logs");

    const btnMain =
        document.getElementById("sub-btn-checkin-main");

    const btnLogs =
        document.getElementById("sub-btn-checkin-logs");


    if (subMain) {
        subMain.style.display =
            subId === "checkin-main" ? "block" : "none";
    }

    if (subLogs) {
        subLogs.style.display =
            subId === "checkin-logs" ? "block" : "none";
    }

    if (btnMain) {
        btnMain.style.background =
            subId === "checkin-main"
                ? "var(--dark, #2c3e50)"
                : "#ddd";

        btnMain.style.color =
            subId === "checkin-main"
                ? "white"
                : "#333";
    }

    if (btnLogs) {
        btnLogs.style.background =
            subId === "checkin-logs"
                ? "var(--dark, #2c3e50)"
                : "#ddd";

        btnLogs.style.color =
            subId === "checkin-logs"
                ? "white"
                : "#333";
    }

    if (subId === "checkin-logs") {
        if (typeof refreshCheckinManagement === "function") {
            refreshCheckinManagement();
        } else if (typeof generateNewLayout === "function") {
            generateNewLayout();
        }
    }
}


/* =========================================================
   학급관리 서브탭
   ========================================================= */

function renderManagementSub(type) {
    const container =
        document.getElementById("management-sub-container");

    const btnGrades =
        document.getElementById("sub-btn-grades");

    const btnBudget =
        document.getElementById("sub-btn-budget");


    if (type === "grades") {
        if (btnGrades) {
            btnGrades.style.background = "var(--primary)";
            btnGrades.style.color = "white";
        }

        if (btnBudget) {
            btnBudget.style.background = "#ddd";
            btnBudget.style.color = "#333";
        }

        if (typeof renderGradesMain === "function") {
            renderGradesMain();
        } else if (container) {
            container.innerHTML = `
                <div class="card">
                    <h2>📝 성적 및 평가 관리</h2>
                    <p>학생들의 성적과 수행평가 기록을 관리하는 공간입니다.</p>
                </div>
            `;
        }

    } else if (type === "budget") {
        if (btnBudget) {
            btnBudget.style.background = "var(--primary)";
            btnBudget.style.color = "white";
        }

        if (btnGrades) {
            btnGrades.style.background = "#ddd";
            btnGrades.style.color = "#333";
        }

        if (typeof initBudgetManager === "function") {
            initBudgetManager();
        }
    }
}


/* =========================================================
   앱 시작
   ========================================================= */

function startApp() {
    const adminStatus =
        typeof isAdmin !== "undefined" && isAdmin;

    const helperStatus =
        typeof isHelper !== "undefined" && isHelper;

    const commanderStatus =
        typeof myName !== "undefined" &&
        myName === "총사령관";


    /* -------------------------
       관리자 메뉴
       ------------------------- */

    if (
        adminStatus ||
        helperStatus ||
        commanderStatus
    ) {
        const orderMgr =
            document.getElementById("admin-order-mgr");

        if (orderMgr) {
            orderMgr.style.display = "block";
        }

        const bbAdminBtn =
            document.getElementById("btn-blackboard-admin");

        if (bbAdminBtn) {
            bbAdminBtn.style.display = "block";
        }

        const adminBtn =
            document.getElementById("btn-admin");

        if (adminBtn) {
            adminBtn.style.display = "block";
        }

    } else {
        const adminBtn =
            document.getElementById("btn-admin");

        if (adminBtn) {
            adminBtn.style.display = "none";
        }
    }


    /* -------------------------
       등교 버튼
       ------------------------- */

    const checkinTabBtn =
        document.getElementById("btn-checkin");

    if (checkinTabBtn) {
        checkinTabBtn.style.display = "block";
    }


    /* -------------------------
       등교 로그 관리자 버튼
       ------------------------- */

    const checkinLogBtn =
        document.getElementById("sub-btn-checkin-logs");

    if (checkinLogBtn) {
        checkinLogBtn.style.display =
            (
                adminStatus ||
                helperStatus ||
                commanderStatus
            )
                ? "block"
                : "none";
    }


    /* -------------------------
       청소
       ------------------------- */

    if (commanderStatus) {
        const cleaningTabBtn =
            document.getElementById("btn-cleaning");

        if (cleaningTabBtn) {
            cleaningTabBtn.style.display = "inline-block";
        }

    } else if (
        typeof currentUser !== "undefined" &&
        currentUser &&
        currentUser.role === "청소"
    ) {
        const cleaningTabBtn =
            document.getElementById("btn-cleaning");

        if (cleaningTabBtn) {
            cleaningTabBtn.style.display = "inline-block";
        }
    }


    window.isHousingEnabled = true;


    /* =====================================================
       Firebase settings
       ===================================================== */

    db.ref("settings").on("value", snap => {
        const s = snap.val() || {};

        giftList =
            s.giftList || [];

        routineItems =
            s.routineText
                ?.split("\n")
                .filter(t => t.trim()) || [];


        if (adminStatus) {
            const passEl =
                document.getElementById("conf-pass");

            const lateEl =
                document.getElementById("conf-late");

            const closeEl =
                document.getElementById("conf-close");

            const routineEl =
                document.getElementById("conf-routine");

            const giftsEl =
                document.getElementById("conf-gifts");


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
                    s.giftList?.join("\n") || "";
            }
        }


        const guide =
            document.getElementById("checkin-guide");

        if (guide) {
            guide.innerText =
                `✅ 정상: ~${s.lateTime || "08:40"} | ⚠️ 지각: ${s.closeTime || "09:00"} 마감`;
        }


        window.currentDefaultBg =
            s.defaultBg || "";
    });


    /* =====================================================
       좌석
       ===================================================== */

    if (typeof generateNewLayout === "function") {
        generateNewLayout();
    }


    /* =====================================================
       포인트
       ===================================================== */

    if (typeof renderPointGuide === "function") {
        renderPointGuide();
    }

    if (typeof initPointsTabListeners === "function") {
        initPointsTabListeners();
    }


    /* =====================================================
       주문
       ===================================================== */

    if (typeof loadOrderRecords === "function") {
        loadOrderRecords();
    }


    /* =====================================================
       users 데이터
       
       중요:
       여기서는 더 이상 hero-grid를 직접 그리지 않는다.
       용사 목록은 hero-mgr.js가 유일하게 담당한다.
       ===================================================== */

    db.ref("users").on("value", snap => {
        const users = [];

        snap.forEach(c => {
            const u = c.val() || {};

            /*
             * Firebase key가 학생 이름인 기존 구조를 유지
             */
            u.name = c.key;

            users.push(u);
        });


        currentUsers = users.sort((a, b) => {
            if (a.name === myName) return -1;
            if (b.name === myName) return 1;

            return (
                (parseInt(a.no) || 99) -
                (parseInt(b.no) || 99)
            );
        });


        /*
         * 관리자 목록은 기존 기능 유지
         */
        if (
            adminStatus &&
            typeof renderAdminList === "function"
        ) {
            renderAdminList();
        }


        /*
         * 좌석도 기존 기능 유지
         */
        if (typeof generateNewLayout === "function") {
            generateNewLayout();
        }


        /*
         * 용사 목록은 hero-mgr.js에서만 그림
         */
        if (typeof renderHeroes === "function") {
            renderHeroes(users);
        }
    });


    /* =====================================================
       로그인 직후 용사 목록 강제 표시
       ===================================================== */

    if (typeof renderHeroes === "function") {
        renderHeroes();
    }
}


/* =========================================================
   초기화
   ========================================================= */

function initApp() {
    if (typeof renderHeroes === "function") {
        renderHeroes();
    }

    if (typeof showTab === "function") {
        const savedTab =
            sessionStorage.getItem("activeTab");

        showTab(savedTab || "heroes");
    }
}
