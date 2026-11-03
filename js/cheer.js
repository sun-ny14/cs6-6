// js/cheer.js
// 이모지 응원 남기기 창 + 프로필 업적 배지.
// - 응원: 친구마다 하루 한 번, 선생님이 정한 이모지 8개 중 하나. 창 맨 위에 "오늘 ○○이가 받은 응원은 N개",
//   아래에는 오늘 남긴 친구들이 "○○님이 (이모지)를 남겼어요."로 방명록처럼 나온다.
// - 저장·검증은 서버 함수(getCheers / sendCheer / getBadges)가 한다.
(function () {
    'use strict';

    const Core = window.CheerCore;
    if (!Core) return;

    const esc = value => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const errorText = error => String(error?.message || '처리하지 못했어요.').replace(/^Firebase:\s*/, '');
    const todayKst = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    // "하준이가", 받침 없는 이름은 "서아가"
    function withSubject(name) {
        const last = String(name || '').trim().slice(-1);
        const code = last.charCodeAt(0);
        const hasFinal = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
        return name + (hasFinal ? '이가' : '가');
    }
    const timeText = ms => ms ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms)) : '';

    function ensureStyles() {
        if (document.getElementById('cheer-style')) return;
        const style = document.createElement('style');
        style.id = 'cheer-style';
        style.textContent = `
            .cheer-overlay{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.6)}
            .cheer-dialog{position:relative;width:min(420px,100%);max-height:92vh;overflow-y:auto;padding:20px;border-radius:20px;background:var(--ui-surface,#fff);color:var(--ui-text,#1c2433);box-shadow:0 24px 70px rgba(0,0,0,.3)}
            .cheer-close{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:1.3rem;cursor:pointer;color:var(--ui-muted,#6c778a)}
            .cheer-head{margin:6px 0 12px;padding:12px;border-radius:14px;background:#fff6e0;color:#4a3a12;font-weight:900;text-align:center}
            .cheer-head b{color:#d9480f;font-size:1.35rem;margin:0 2px}
            .cheer-sub{margin:4px 0 8px;text-align:center;color:var(--ui-muted,#6c778a);font-size:.88rem;font-weight:700}
            .cheer-picks{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
            .cheer-pick{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;border:1px solid var(--ui-line,#d5dce6);border-radius:12px;background:var(--ui-surface-soft,#f4f7fb);color:inherit;font:inherit;cursor:pointer}
            .cheer-pick .e{font-size:1.6rem;line-height:1.1}.cheer-pick small{font-size:.7rem;color:var(--ui-muted,#6c778a)}
            .cheer-pick.is-on{background:var(--ui-accent-soft,#e6f1fb);border-color:var(--ui-accent,#378add);box-shadow:0 0 0 2px var(--ui-accent-soft,#e6f1fb)}
            .cheer-pick:disabled{opacity:.4;cursor:default}
            .cheer-send{width:100%;margin-top:12px}
            .cheer-error{margin-top:8px;color:var(--ui-bad,#b4392d);font-weight:800;font-size:.88rem;text-align:center}
            .cheer-logtitle{margin:16px 0 6px;font-size:.85rem;font-weight:900;color:var(--ui-muted,#6c778a)}
            .cheer-log{display:flex;flex-direction:column;gap:6px;max-height:230px;overflow-y:auto}
            .cheer-entry{display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:12px;background:var(--ui-surface-soft,#f4f7fb);font-weight:700;font-size:.92rem}
            .cheer-entry .e{font-size:1.3rem}.cheer-entry time{margin-left:auto;font-size:.72rem;color:var(--ui-muted,#6c778a);font-weight:600}
            .cheer-empty{padding:14px 0;text-align:center;color:var(--ui-muted,#6c778a);font-size:.88rem}
            .cheer-date{display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:8px;font-size:.88rem;font-weight:800}
            .badge-title{margin:14px 0 6px;font-size:.8rem;font-weight:900;color:var(--ui-muted,#6c778a)}
            .badge-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
            .badge-item{text-align:center;font-size:.64rem;line-height:1.25;color:var(--ui-text,#1c2433);font-weight:700}
            .badge-item i{display:grid;place-items:center;width:42px;height:42px;margin:0 auto 3px;border-radius:50%;font-style:normal;font-size:1.3rem;background:linear-gradient(160deg,#f6d77a,#d99a1e);box-shadow:0 0 0 2px rgba(255,224,138,.4)}
            .badge-item.is-off{opacity:.55;color:var(--ui-muted,#6c778a)}.badge-item.is-off i{background:#d5dce6;filter:grayscale(1);opacity:.55;box-shadow:none}
        `;
        document.head.appendChild(style);
    }

    function entriesHtml(data) {
        if (!data.entries.length) return '<div class="cheer-empty">아직 응원이 없어요. 첫 응원을 남겨 볼까요?</div>';
        return data.entries.map(entry => `<div class="cheer-entry"><span>${esc(entry.from)}님이</span><span class="e" title="${esc(entry.label)}">${esc(entry.emoji)}</span><span>를 남겼어요.</span><time>${esc(timeText(entry.at))}</time></div>`).join('');
    }

    // opts: { self: 내 창(받은 응원만 보기), teacher: 날짜를 골라 지난 응원 보기 }
    async function open(name, opts = {}) {
        ensureStyles();
        document.getElementById('cheer-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'cheer-overlay';
        overlay.className = 'cheer-overlay';
        document.body.appendChild(overlay);
        let date = todayKst();
        let selected = '';
        let busy = false;
        let data = null;
        let errorMessage = '';

        const render = () => {
            const isSelf = opts.self === true;
            const subject = isSelf ? '내가' : withSubject(name);
            const todayLabel = opts.teacher && date !== todayKst() ? date : '오늘';
            const picker = data && data.canCheer ? `
                <div class="cheer-sub">${esc(name)}에게 남길 응원을 골라요 (하루 한 번)</div>
                <div class="cheer-picks">${Core.CHEER_EMOJIS.map(item => `<button type="button" class="cheer-pick${item.emoji === selected ? ' is-on' : ''}" data-cheer-pick="${esc(item.emoji)}"><span class="e">${item.emoji}</span><small>${esc(item.label)}</small></button>`).join('')}</div>
                <button type="button" class="btn btn--primary cheer-send" data-cheer-send ${selected ? '' : 'disabled'}>${selected ? selected + ' ' : ''}응원 남기기</button>`
                : (data && data.mine ? `<div class="cheer-sub">오늘은 이미 ${esc(name)}에게 ${esc(data.mine.emoji)}를 남겼어요 💌 (내일 다시 남길 수 있어요)</div>` : '');
            overlay.innerHTML = `<div class="cheer-dialog" role="dialog" aria-label="응원 남기기">
                <button type="button" class="cheer-close" data-cheer-close aria-label="닫기">✕</button>
                <div class="cheer-head">${data ? `${esc(todayLabel)} ${esc(subject)} 받은 응원은 <b>${data.count}개</b>` : '불러오는 중…'}</div>
                ${opts.teacher ? `<div class="cheer-date"><input type="date" value="${esc(date)}" data-cheer-date max="${esc(todayKst())}"> 날짜별 응원</div>` : ''}
                ${picker}
                ${errorMessage ? `<div class="cheer-error">${esc(errorMessage)}</div>` : ''}
                <div class="cheer-logtitle">${esc(todayLabel)}의 응원 방명록</div>
                <div class="cheer-log">${data ? entriesHtml(data) : ''}</div></div>`;
        };

        const load = async () => {
            try {
                data = await window.callSecure('getCheers', { to: name, date: opts.teacher ? date : undefined });
                errorMessage = '';
            } catch (error) {
                console.error('응원 조회 오류:', error);
                errorMessage = errorText(error);
            }
            render();
        };

        overlay.addEventListener('click', async event => {
            if (event.target === overlay || event.target.closest('[data-cheer-close]')) { overlay.remove(); return; }
            const pick = event.target.closest('[data-cheer-pick]');
            if (pick) { selected = pick.dataset.cheerPick; render(); return; }
            if (event.target.closest('[data-cheer-send]')) {
                if (busy || !selected) return;
                busy = true;
                try {
                    data = await window.callSecure('sendCheer', { to: name, emoji: selected });
                    errorMessage = '';
                    selected = '';
                } catch (error) {
                    console.error('응원 보내기 오류:', error);
                    errorMessage = errorText(error);
                } finally {
                    busy = false;
                }
                render();
            }
        });
        overlay.addEventListener('change', event => {
            if (event.target.matches('[data-cheer-date]') && event.target.value) { date = event.target.value; data = null; render(); load(); }
        });
        render();
        await load();
    }

    // 프로필 창 안에 업적 배지를 채운다.
    async function fillBadges(container, name) {
        ensureStyles();
        try {
            const result = await window.callSecure('getBadges', { to: name });
            container.innerHTML = `<div class="badge-title">업적 배지 ${result.earnedCount} / ${result.total}</div>
                <div class="badge-grid">${result.badges.map(badge => `<div class="badge-item${badge.earned ? '' : ' is-off'}"><i>${esc(badge.icon)}</i>${esc(badge.name)}</div>`).join('')}</div>`;
        } catch (error) {
            console.error('배지 조회 오류:', error);
            container.innerHTML = '';
        }
    }

    window.Cheer = { open, fillBadges };
})();
