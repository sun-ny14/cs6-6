// js/attendance-gate.js
// 등교 전 잠금: 학생은 오늘 등교 기록이 생기기 전까지 등교 탭 말고는 어디로도 이동할 수 없다.
// 순서는 "오늘의 기분 고르기 → 등교 암호(QR) 입력 → 기록 생성 → 다른 메뉴 열림"이다.
// - 기준은 전자칠판 공개 출결 복사본(blackboardDisplay/data/checkins)에 오늘 날짜의 등교 기록이 있는지다.
//   학생 QR 등교, 교사 빠른 등교·출결 수정이 모두 이 복사본을 갱신하므로 선생님이 대신 처리해 주면 바로 풀린다.
// - 교사 계정은 적용하지 않는다. 설정의 "등교 전 잠금" 스위치를 끄면 풀리고, 토·일에는 적용하지 않는다.
// - 이 잠금은 화면(메뉴 이동)을 막는 것이고, 서버 기능(상점 구매 등)을 따로 막지는 않는다.
(function () {
    'use strict';

    const state = { date: '', checked: null, pendingTab: '', loading: false, timer: null };
    const todayKst = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const isWeekend = () => { const day = new Date(`${todayKst()}T12:00:00Z`).getUTCDay(); return day === 0 || day === 6; };
    // 교사 계정(관리자, '6-6 선생님' 같은 선생님 이름의 계정)은 등교 전 잠금에서 제외한다.
    const isStudent = () => window.isAdmin !== true && !!String(window.myName || '').trim() && !/선생님|관리자|총사령관/.test(String(window.myName));
    const active = () => isStudent() && window.attendanceGateEnabled !== false && !isWeekend();
    const locked = () => active() && state.checked !== true;

    function ensureStyles() {
        if (document.getElementById('attendance-gate-style')) return;
        const style = document.createElement('style');
        style.id = 'attendance-gate-style';
        style.textContent = `
            body.attendance-locked .sidebar-menu button:not(#btn-student-checkin){opacity:.38;filter:grayscale(.85)}
            body.attendance-locked .floating-fab{display:none!important}
            #attendance-gate-note{display:none;margin:0 0 12px;padding:12px 14px;border-radius:14px;background:var(--ui-warn-soft,#fff4df);border:1px solid var(--ui-warn-line,#f0b429);color:var(--ui-warn,#8a5a00);font-weight:800;line-height:1.5}
            body.attendance-locked #attendance-gate-note{display:block}
        `;
        document.head.appendChild(style);
    }

    function render() {
        ensureStyles();
        document.body.classList.toggle('attendance-locked', locked());
        if (!document.getElementById('attendance-gate-note')) {
            const anchor = document.getElementById('mood-my-chip') || document.getElementById('sub-checkin-main');
            if (anchor && anchor.parentNode) {
                const note = document.createElement('div');
                note.id = 'attendance-gate-note';
                note.innerHTML = '🔒 등교 확인을 마쳐야 다른 메뉴를 쓸 수 있어요.<br>① 오늘의 기분 고르기 → ② 등교 암호 입력';
                anchor.parentNode.insertBefore(note, anchor);
            }
        }
    }

    function stopPolling() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }
    function startPolling() {
        if (state.timer) return;
        // 선생님이 대신 등교 처리를 해 줘도 열리도록 잠겨 있는 동안 가끔 다시 확인한다.
        state.timer = setInterval(() => { if (locked()) refresh(); else stopPolling(); }, 20000);
    }

    function onUnlocked() {
        stopPolling();
        render();
        const next = state.pendingTab;
        state.pendingTab = '';
        if (typeof window.showTab === 'function') window.showTab(next && next !== 'student-checkin' ? next : 'main');
    }

    async function refresh() {
        if (!active()) { state.checked = true; state.date = todayKst(); render(); return; }
        if (state.loading) return;
        state.loading = true;
        const today = todayKst();
        const before = state.checked;
        try {
            const key = typeof window.checkinBoardKey === 'function' ? window.checkinBoardKey(window.myName) : '';
            const snapshot = await db.ref(`blackboardDisplay/data/checkins/${key}`).once('value');
            const record = snapshot.val();
            state.checked = Boolean(record && record.date === today && record.attended !== false);
        } catch (error) {
            // 조회가 안 되는 때(네트워크 등)에 학생을 영영 가두지 않는다.
            console.error('등교 기록 확인 오류:', error);
            state.checked = true;
        } finally {
            state.loading = false;
            state.date = today;
        }
        render();
        if (state.checked) { if (before !== true) onUnlocked(); } else startPolling();
    }

    // showTab()이 호출한다. 막히는 탭이면 false를 돌려주고, 풀린 뒤 가려던 탭으로 이동할 수 있게 기억해 둔다.
    function allows(tab) {
        if (!active()) return true;
        if (state.date !== todayKst()) { state.checked = null; state.date = ''; }
        if (state.checked === true) return true;
        if (state.checked === null) refresh();
        if (tab === 'student-checkin') return true;
        state.pendingTab = tab;
        render();
        return false;
    }

    // 학생 등교(QR)가 성공했을 때 checkin-seat.js가 호출한다.
    function markChecked() {
        state.checked = true;
        state.date = todayKst();
        onUnlocked();
    }

    window.AttendanceGate = { allows, refresh, markChecked, isLocked: locked };
})();
