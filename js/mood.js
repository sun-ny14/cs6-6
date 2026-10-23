// js/mood.js
// 오늘의 기분
// - 학생: 등교 탭에 들어가기 전에 그날 기분을 골라야 한다(하루 한 번, 같은 날 바꿀 수 있음).
//   "칠판에 비공개"를 켜면 전자칠판에는 😶만 보이고, 진짜 기분은 선생님만 본다(한 주 2번까지).
// - 교사: 등교로그에 오늘의 기분 목록과 월간 엑셀 내보내기. 학생들끼리 서로 보는 화면은 만들지 않는다.
// 기분은 감정 이름으로 저장하며(이모지 아님) 등교 기록과 다른 경로(moodRecords)에 둔다.
(function () {
    'use strict';

    const Core = window.MoodCore;
    if (!Core) return;

    const state = { date: '', status: null, busy: false };
    const esc = value => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const todayKst = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const errorText = error => String(error?.message || '처리하지 못했어요.').replace(/^Firebase:\s*/, '');
    const GROUPS = [['좋음', '기분 좋아요'], ['보통', '보통이에요'], ['힘듦', '마음이 힘들어요']];

    function ensureStyles() {
        if (document.getElementById('mood-style')) return;
        const style = document.createElement('style');
        style.id = 'mood-style';
        style.textContent = `
            .mood-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.6)}
            .mood-dialog{width:min(560px,100%);max-height:92vh;overflow-y:auto;padding:22px;border-radius:20px;background:var(--ui-surface,#fff);color:var(--ui-text,#1c2433);box-shadow:0 24px 70px rgba(0,0,0,.3)}
            .mood-dialog h2{margin:0 0 4px;font-size:1.25rem}
            .mood-dialog p.lead{margin:0 0 12px;color:var(--ui-muted,#6c778a);font-size:.92rem}
            .mood-group{margin:12px 0 6px;font-size:.8rem;font-weight:900;color:var(--ui-muted,#6c778a)}
            .mood-chips{display:flex;flex-wrap:wrap;gap:8px}
            .mood-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--ui-line,#d5dce6);border-radius:999px;background:var(--ui-surface-soft,#f4f7fb);color:inherit;font:inherit;font-weight:700;cursor:pointer}
            .mood-chip .e{font-size:1.25rem}
            .mood-chip.is-on{background:var(--ui-accent-soft,#e6f1fb);border-color:var(--ui-accent,#378add);color:var(--ui-accent-deep,#185fa5);font-weight:900}
            .mood-hide{margin-top:14px;padding:10px 12px;border:1px dashed var(--ui-line,#d5dce6);border-radius:12px;display:flex;gap:10px;align-items:flex-start}
            .mood-hide label{display:flex;gap:8px;align-items:flex-start;font-weight:800;cursor:pointer}
            .mood-hide small{display:block;margin-top:2px;color:var(--ui-muted,#6c778a);font-weight:600}
            .mood-hide.is-off{opacity:.55}
            .mood-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
            .mood-error{margin-top:10px;color:var(--ui-bad,#b4392d);font-weight:800;font-size:.9rem}
            .mood-my{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;padding:10px 14px;border-radius:14px;background:var(--ui-surface,#fff);border:1px solid var(--ui-line,#d5dce6);font-weight:800}
            .mood-my .e{font-size:1.5rem}
            .mood-panel{margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid var(--ui-line,#d5dce6);background:var(--ui-surface,#fff)}
            .mood-panel h4{margin:0 0 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
            .mood-panel .tone-count{font-size:.8rem;font-weight:700;color:var(--ui-muted,#6c778a)}
            .mood-tag{display:inline-flex;gap:6px;align-items:center;padding:3px 10px;border-radius:999px;border:1px solid var(--ui-line,#d5dce6);background:var(--ui-surface-soft,#f4f7fb);font-size:.88rem;font-weight:700}
            .mood-tag.t-힘듦{background:var(--ui-bad-soft,#fdecea);border-color:var(--ui-bad-line,#f1b4ac);color:var(--ui-bad,#b4392d)}
            .mood-tag.t-좋음{background:var(--ui-good-soft,#e8f7ee);border-color:var(--ui-good-line,#9bd8b4)}
            .mood-tag.none{opacity:.6}
            .mood-tag small{font-weight:600;color:var(--ui-muted,#6c778a)}
        `;
        document.head.appendChild(style);
    }

    // ---- 학생: 기분 고르기 ----
    function pickerHtml(selected, hide, status) {
        const left = status ? status.hiddenLeft : Core.HIDDEN_PER_WEEK;
        const limit = status ? status.hiddenLimit : Core.HIDDEN_PER_WEEK;
        const canHide = left > 0 || (status && status.hidden);
        const groups = GROUPS.map(([tone, label]) => `<div class="mood-group">${label}</div><div class="mood-chips">${
            Core.EMOTIONS.filter(item => item.tone === tone).map(item =>
                `<button type="button" class="mood-chip${item.name === selected ? ' is-on' : ''}" data-mood-pick="${esc(item.name)}"><span class="e">${item.emoji}</span>${esc(item.name)}</button>`
            ).join('')}</div>`).join('');
        return `${groups}
            <div class="mood-hide${canHide ? '' : ' is-off'}"><label><input type="checkbox" data-mood-hide ${hide ? 'checked' : ''} ${canHide ? '' : 'disabled'}>
                <span>😶 칠판에는 비공개로 할래요<small>${canHide
                    ? `내 진짜 기분은 선생님만 볼 수 있어요 · 이번 주 남은 횟수 ${left}/${limit}`
                    : '이번 주 비공개를 모두 썼어요. 다음 주 월요일에 다시 쓸 수 있어요.'}</small></span></label></div>`;
    }

    function openPicker({ required }) {
        ensureStyles();
        document.getElementById('mood-overlay')?.remove();
        let selected = state.status?.emotion || '';
        let hide = state.status?.hidden === true;
        const overlay = document.createElement('div');
        overlay.id = 'mood-overlay';
        overlay.className = 'mood-overlay';
        const render = () => {
            overlay.innerHTML = `<div class="mood-dialog" role="dialog" aria-label="오늘의 기분">
                <h2>오늘 내 기분은?</h2>
                <p class="lead">${required ? '기분을 고르면 등교 확인으로 넘어가요.' : '하루 중에 다시 바꿀 수 있어요.'} 전자칠판에는 이모지로 보여요.</p>
                ${pickerHtml(selected, hide, state.status)}
                <div class="mood-error" id="mood-error" hidden></div>
                <div class="mood-actions">
                    ${required ? '' : '<button type="button" class="btn btn--outline" data-mood-cancel>닫기</button>'}
                    <button type="button" class="btn btn--primary" data-mood-save ${selected ? '' : 'disabled'}>저장하고 계속</button>
                </div></div>`;
        };
        render();
        overlay.addEventListener('click', async event => {
            const pick = event.target.closest('[data-mood-pick]');
            if (pick) { selected = pick.dataset.moodPick; render(); return; }
            if (event.target.closest('[data-mood-cancel]')) { overlay.remove(); return; }
            if (event.target.closest('[data-mood-save]')) {
                if (state.busy || !selected) return;
                state.busy = true;
                const button = overlay.querySelector('[data-mood-save]');
                button.disabled = true;
                button.textContent = '저장 중…';
                try {
                    state.status = await window.callSecure('setTodayMood', { emotion: selected, hideOnBoard: hide });
                    state.date = todayKst();
                    overlay.remove();
                    renderChip();
                } catch (error) {
                    console.error('오늘의 기분 저장 오류:', error);
                    const box = overlay.querySelector('#mood-error');
                    if (box) { box.textContent = errorText(error); box.hidden = false; }
                    if (error?.code === 'functions/resource-exhausted' || /비공개를 모두/.test(String(error?.message))) { hide = false; }
                    button.disabled = false;
                    button.textContent = '저장하고 계속';
                    // 등교 암호 제출도 서버에서 오늘의 기분 기록을 확인하므로, 여기서 건너뛰게
                    // 해 주면 결국 등교 단계에서 막혀 학생만 혼란스럽다. 저장될 때까지 다시
                    // 시도하게 한다(닫기/건너뛰기 버튼 없음).
                } finally {
                    state.busy = false;
                }
            }
        });
        overlay.addEventListener('change', event => {
            if (event.target.matches('[data-mood-hide]')) hide = event.target.checked;
        });
        document.body.appendChild(overlay);
    }

    function renderChip() {
        const target = document.getElementById('mood-my-chip');
        if (!target) return;
        const status = state.status;
        const info = status?.emotion ? Core.byName(status.emotion) : null;
        ensureStyles();
        target.innerHTML = info
            ? `<div class="mood-my"><span class="e">${info.emoji}</span><span>오늘 내 기분: ${esc(info.name)}${status.hidden ? ' (칠판엔 비공개)' : ''}</span><button type="button" class="btn btn--xs btn--outline" data-mood-change>바꾸기</button></div>`
            : `<div class="mood-my"><span class="e">😶</span><span>오늘 기분을 아직 안 골랐어요</span><button type="button" class="btn btn--xs btn--primary" data-mood-change>기분 고르기</button></div>`;
    }

    // 등교 탭에 들어올 때마다 호출된다(교사는 호출하지 않는다).
    // 서버(submitStudentCheckin)도 오늘의 기분 기록이 있는지 확인하므로, 여기서
    // 조회가 실패해도 조용히 넘어가지 않는다 — 오늘 기록이 없다고 보고 그대로
    // 선택 화면을 띄운다. 그래야 등교 단계에서야 막히는 일이 없다.
    async function onEnterCheckin() {
        if (window.isAdmin === true) return;
        const today = todayKst();
        if (state.date !== today || !state.status) {
            try {
                state.status = await window.callSecure('getMyMood', {});
                state.date = today;
            } catch (error) {
                console.error('오늘의 기분 조회 오류:', error);
                state.status = null;
            }
        }
        renderChip();
        if (!state.status?.emotion) openPicker({ required: true });
    }

    document.addEventListener('click', event => {
        if (event.target.closest('[data-mood-change]')) openPicker({ required: false });
    });

    // ---- 교사: 등교로그의 오늘의 기분 + 월간 엑셀 ----
    function students() {
        const list = Array.isArray(window.currentUsers) ? window.currentUsers : [];
        return list.filter(user => {
            const name = String(user?.name || '').trim();
            return name && name !== '총사령관' && !name.includes('선생님') && !name.includes('관리자');
        }).map(user => ({ name: String(user.name).trim(), number: Number(user.no || user.number) || 999 }))
            .sort((a, b) => a.number - b.number);
    }

    async function renderAdminPanel(date) {
        const target = document.getElementById('checkin-mood-panel');
        if (!target || window.isAdmin !== true) return;
        ensureStyles();
        let records = {};
        try { records = (await db.ref(`moodRecords/${date}`).once('value')).val() || {}; }
        catch (error) { console.error('기분 기록 조회 오류:', error); target.innerHTML = ''; return; }
        const list = students();
        const chosen = list.filter(student => records[student.name]);
        const tones = { 좋음: 0, 보통: 0, 힘듦: 0 };
        chosen.forEach(student => { const t = records[student.name].tone; if (t in tones) tones[t] += 1; });
        const tag = student => {
            const record = records[student.name];
            if (!record) return `<span class="mood-tag none"><b>${student.number === 999 ? '–' : student.number}</b> ${esc(student.name)} <small>아직 안 골랐어요</small></span>`;
            return `<span class="mood-tag t-${esc(record.tone)}"><b>${student.number === 999 ? '–' : student.number}</b> ${esc(student.name)} <small>${esc(record.emotion)}${record.hidden ? ' · 칠판 비공개' : ''}</small></span>`;
        };
        const ordered = [...list.filter(s => records[s.name] && records[s.name].tone === '힘듦'), ...list.filter(s => records[s.name] && records[s.name].tone !== '힘듦'), ...list.filter(s => !records[s.name])];
        target.innerHTML = `<div class="mood-panel"><h4>🙂 ${esc(date)} 오늘의 기분 <span class="tone-count">고른 학생 ${chosen.length}/${list.length}명 · 좋음 ${tones.좋음} · 보통 ${tones.보통} · 힘듦 ${tones.힘듦}</span>
            <button type="button" class="btn btn--xs btn--outline" data-mood-excel>📥 월간 엑셀</button></h4>
            <div class="mood-chips">${ordered.map(tag).join('') || '<span class="mood-tag none">학생 명단이 없어요</span>'}</div></div>`;
    }

    async function exportMonthExcel(date) {
        if (typeof XLSX === 'undefined') { alert('엑셀 도구를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.'); return; }
        const month = String(date || todayKst()).slice(0, 7);
        let byDate = {};
        try {
            const snapshot = await db.ref('moodRecords').orderByKey().startAt(`${month}-01`).endAt(`${month}-31`).once('value');
            byDate = snapshot.val() || {};
        } catch (error) { console.error('월간 기분 조회 오류:', error); alert('기분 기록을 불러오지 못했어요.'); return; }
        const dates = Object.keys(byDate).sort();
        if (!dates.length) { alert(`${month}에는 저장된 기분 기록이 없어요.`); return; }
        const list = students();
        const header = ['번호', '이름', ...dates.map(day => Number(day.slice(8)) + '일')];
        const table = [header, ...list.map(student => [student.number === 999 ? '' : student.number, student.name,
            ...dates.map(day => { const record = byDate[day]?.[student.name]; return record ? record.emotion : ''; })])];
        const rows = [['날짜', '번호', '이름', '감정', '분위기', '칠판 비공개']];
        dates.forEach(day => list.forEach(student => {
            const record = byDate[day]?.[student.name];
            if (record) rows.push([day, student.number === 999 ? '' : student.number, student.name, record.emotion, record.tone, record.hidden ? '예' : '']);
        }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(table), '월간 표');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '목록');
        XLSX.writeFile(workbook, `기분기록_${month}.xlsx`);
    }

    document.addEventListener('click', event => {
        if (event.target.closest('[data-mood-excel]')) {
            const input = document.getElementById('checkin-date-filter');
            exportMonthExcel(input && input.value ? input.value : todayKst());
        }
    });

    window.Mood = { onEnterCheckin, renderAdminPanel, exportMonthExcel, openPicker };
})();
