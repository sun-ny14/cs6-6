// js/class-memo.js
// 학급 운영 > "메모" 탭: 날짜와 상관없이 참고할 내용을 적어 두는 곳.
// 저장은 서버 함수(getClassJournalMemos 등)가 학급일지 비밀번호 세션을 확인한 뒤 처리한다.
(function () {
    'use strict';

    const state = { memos: [], loaded: false, loading: false, query: '', editing: null };
    const root = () => document.getElementById('class-memo-container');
    const esc = value => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const errorText = error => String(error?.message || '처리하지 못했습니다.').replace(/^Firebase:\s*/, '');
    const token = () => (typeof window.getClassJournalToken === 'function' ? window.getClassJournalToken() : '');
    const call = (name, data) => window.callSecure(name, { journalToken: token(), ...data });

    function ensureStyles() {
        if (document.getElementById('class-memo-style')) return;
        const style = document.createElement('style');
        style.id = 'class-memo-style';
        style.textContent = `
            .memo-shell{max-width:1100px;margin:auto}
            .memo-card{border:1px solid var(--ui-line);border-radius:14px;background:var(--ui-surface);overflow:hidden}
            .memo-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px}
            .memo-bar h3{margin:0;font-size:1.05rem}
            .memo-bar .sp{flex:1}
            .memo-search{min-width:220px;flex:0 1 320px;padding:8px 12px;border:1px solid var(--ui-line);border-radius:9px;font:inherit;box-sizing:border-box;background:var(--ui-surface);color:var(--ui-text)}
            .memo-form{display:grid;gap:8px;padding:14px 16px;border-top:1px solid var(--ui-line);background:var(--ui-surface-soft)}
            .memo-form input[type=text],.memo-form textarea{width:100%;padding:10px 12px;border:1px solid var(--ui-line);border-radius:9px;font:inherit;box-sizing:border-box;background:var(--ui-surface);color:var(--ui-text)}
            .memo-form textarea{min-height:110px;max-height:320px;resize:vertical}
            .memo-form-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
            .memo-form-row label{display:flex;align-items:center;gap:6px;font-weight:700}
            .memo-form-row .sp{flex:1}
            .memo-list{border-top:1px solid var(--ui-line);max-height:calc(100vh - 300px);min-height:120px;overflow-y:auto}
            .memo-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:12px 16px;border-bottom:1px solid var(--ui-line)}
            .memo-item:last-child{border-bottom:0}
            .memo-item b{display:block;margin-bottom:2px}
            .memo-item span.memo-body{display:block;color:var(--ui-muted);white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}
            .memo-pin{padding:1px 8px;border-radius:999px;background:var(--ui-accent-soft);color:var(--ui-accent-deep);font-size:11px;font-weight:900;white-space:nowrap}
            .memo-pin-slot{min-width:34px}
            .memo-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
            .memo-empty{padding:30px 16px;text-align:center;color:var(--ui-muted);font-weight:700}
            .memo-item mark{background:var(--ui-warn-soft);color:inherit;border-radius:3px;padding:0 1px}
            @media(max-width:640px){.memo-item{grid-template-columns:minmax(0,1fr)}.memo-actions{justify-content:flex-start}}
        `;
        document.head.appendChild(style);
    }

    function highlight(text, query) {
        const safe = esc(text);
        if (!query) return safe;
        const pattern = esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return safe.replace(new RegExp(pattern, 'gi'), match => `<mark>${match}</mark>`);
    }

    function visibleMemos() {
        const query = state.query.trim().toLowerCase();
        return state.memos
            .filter(memo => !query || `${memo.title}\n${memo.content}`.toLowerCase().includes(query))
            .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
    }

    function formHtml() {
        const edit = state.editing;
        if (!edit) return '';
        return `<div class="memo-form" data-memo-form>
            <input type="text" data-memo-title maxlength="100" placeholder="제목" value="${esc(edit.title)}">
            <textarea data-memo-content maxlength="6000" placeholder="내용">${esc(edit.content)}</textarea>
            <div class="memo-form-row">
                <label><input type="checkbox" data-memo-pinned ${edit.pinned ? 'checked' : ''}> 고정 (맨 위에 두기)</label>
                <span class="sp"></span>
                <button type="button" class="btn btn--sm btn--outline" data-memo-cancel>취소</button>
                <button type="button" class="btn btn--sm btn--primary" data-memo-save>저장</button>
            </div>
        </div>`;
    }

    function listHtml() {
        const query = state.query.trim();
        if (state.loading && !state.loaded) return '<div class="memo-empty">불러오는 중…</div>';
        const memos = visibleMemos();
        if (!memos.length) {
            return `<div class="memo-empty">${query ? '검색 결과가 없어요.' : '아직 메모가 없어요. “+ 메모 추가”로 시작해 보세요.'}</div>`;
        }
        return memos.map(memo => `<div class="memo-item" data-memo-id="${esc(memo.id)}">
            <span class="memo-pin-slot">${memo.pinned ? '<span class="memo-pin">고정</span>' : ''}</span>
            <div><b>${highlight(memo.title || '제목 없음', query)}</b><span class="memo-body">${highlight(memo.content, query)}</span></div>
            <div class="memo-actions">
                <button type="button" class="btn btn--xs" data-memo-pin-toggle="${esc(memo.id)}">${memo.pinned ? '고정 해제' : '고정'}</button>
                <button type="button" class="btn btn--xs" data-memo-edit="${esc(memo.id)}">수정</button>
                <button type="button" class="btn btn--xs btn--danger" data-memo-delete="${esc(memo.id)}">삭제</button>
            </div>
        </div>`).join('');
    }

    // 검색 입력창은 다시 그리지 않고(포커스 유지) 목록만 갱신한다.
    function renderList() {
        const list = document.getElementById('memo-list');
        if (list) list.innerHTML = listHtml();
    }

    function render() {
        const container = root();
        if (!container) return;
        ensureStyles();
        container.innerHTML = `<div class="memo-shell"><section class="memo-card">
            <div class="memo-bar">
                <h3>🗒️ 메모</h3>
                <input type="search" class="memo-search" id="memo-search" placeholder="메모 검색 (제목·내용)" value="${esc(state.query)}" autocomplete="off">
                <span class="sp"></span>
                <button type="button" class="btn btn--sm btn--primary" data-memo-add>+ 메모 추가</button>
            </div>
            <div id="memo-form-slot">${formHtml()}</div>
            <div class="memo-list" id="memo-list">${listHtml()}</div>
        </section></div>`;
    }

    function renderForm() {
        const slot = document.getElementById('memo-form-slot');
        if (!slot) return;
        slot.innerHTML = formHtml();
        slot.querySelector('[data-memo-title]')?.focus();
    }

    async function load() {
        if (state.loading) return;
        state.loading = true;
        render();
        try {
            const result = await call('getClassJournalMemos', {});
            state.memos = Array.isArray(result.memos) ? result.memos : [];
            state.loaded = true;
        } catch (error) {
            console.error('메모 조회 오류:', error);
            alert(errorText(error));
        } finally {
            state.loading = false;
            render();
        }
    }

    async function saveMemo(memo, button) {
        if (button) button.disabled = true;
        try {
            const result = await call('saveClassJournalMemo', memo);
            const saved = result.memo;
            const index = state.memos.findIndex(item => item.id === saved.id);
            if (index >= 0) state.memos[index] = saved; else state.memos.push(saved);
            return true;
        } catch (error) {
            console.error('메모 저장 오류:', error);
            alert(errorText(error));
            return false;
        } finally {
            if (button) button.disabled = false;
        }
    }

    document.addEventListener('click', async event => {
        if (!event.target.closest('#class-memo-container')) return;
        const find = id => state.memos.find(memo => memo.id === id);

        if (event.target.closest('[data-memo-add]')) {
            state.editing = { id: '', title: '', content: '', pinned: false };
            renderForm();
            return;
        }
        if (event.target.closest('[data-memo-cancel]')) {
            state.editing = null;
            renderForm();
            return;
        }
        const editButton = event.target.closest('[data-memo-edit]');
        if (editButton) {
            const memo = find(editButton.dataset.memoEdit);
            if (memo) { state.editing = { ...memo }; renderForm(); }
            return;
        }
        const saveButton = event.target.closest('[data-memo-save]');
        if (saveButton) {
            const form = document.querySelector('[data-memo-form]');
            const payload = {
                id: state.editing?.id || '',
                title: String(form.querySelector('[data-memo-title]').value || '').trim(),
                content: String(form.querySelector('[data-memo-content]').value || '').trim(),
                pinned: form.querySelector('[data-memo-pinned]').checked
            };
            if (!payload.title && !payload.content) { alert('제목이나 내용을 입력해 주세요.'); return; }
            if (await saveMemo(payload, saveButton)) { state.editing = null; render(); }
            return;
        }
        const pinButton = event.target.closest('[data-memo-pin-toggle]');
        if (pinButton) {
            const memo = find(pinButton.dataset.memoPinToggle);
            if (memo && await saveMemo({ id: memo.id, title: memo.title, content: memo.content, pinned: !memo.pinned }, pinButton)) renderList();
            return;
        }
        const deleteButton = event.target.closest('[data-memo-delete]');
        if (deleteButton) {
            const memo = find(deleteButton.dataset.memoDelete);
            if (!memo || !confirm(`“${memo.title || '제목 없음'}” 메모를 삭제할까요?`)) return;
            deleteButton.disabled = true;
            try {
                await call('deleteClassJournalMemo', { id: memo.id });
                state.memos = state.memos.filter(item => item.id !== memo.id);
                renderList();
            } catch (error) {
                console.error('메모 삭제 오류:', error);
                alert(errorText(error));
                deleteButton.disabled = false;
            }
        }
    });

    document.addEventListener('input', event => {
        if (event.target?.id !== 'memo-search') return;
        state.query = String(event.target.value || '');
        renderList();
    });

    // 학급일지 잠금이 다시 걸리면 메모도 비운다(다음에 열 때 서버에서 다시 받는다).
    window.resetClassMemo = function () {
        state.memos = []; state.loaded = false; state.loading = false; state.query = ''; state.editing = null;
        const container = root();
        if (container) container.innerHTML = '';
    };
    window.renderClassMemoPane = function () { if (token()) { if (state.loaded) render(); else load(); } };
})();
