// js/class-memo.js
// 학급 운영 > "메모" 탭: 날짜와 상관없이 참고할 내용을 적어 두는 곳.
// 저장은 서버 함수(getClassJournalMemos 등)가 학급일지 비밀번호 세션을 확인한 뒤 처리한다.
// 사진·파일은 Firebase Storage(classMemoFiles/{메모번호}/…)에 올리고, 메모에는 이름·크기·위치만 둔다.
(function () {
    'use strict';

    const MAX_FILES = 5;
    const MAX_BYTES = 10 * 1024 * 1024;
    const state = { memos: [], loaded: false, loading: false, query: '', editing: null, saving: false };
    const urlCache = new Map();
    const root = () => document.getElementById('class-memo-container');
    const esc = value => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const errorText = error => String(error?.message || '처리하지 못했습니다.').replace(/^Firebase:\s*/, '');
    const token = () => (typeof window.getClassJournalToken === 'function' ? window.getClassJournalToken() : '');
    const call = (name, data) => window.callSecure(name, { journalToken: token(), ...data });
    const isImage = file => /^image\//.test(String(file?.type || ''));
    const sizeText = bytes => bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(bytes / 1024)) + 'KB';
    const newMemoId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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
            .memo-drop{padding:10px 12px;border:1px dashed var(--ui-line-strong,var(--ui-line));border-radius:9px;color:var(--ui-muted);font-size:.9rem;text-align:center}
            .memo-drop.is-over{border-color:var(--ui-accent);background:var(--ui-accent-soft);color:var(--ui-accent-deep)}
            .memo-files{display:flex;flex-wrap:wrap;gap:8px}
            .memo-file{display:flex;align-items:center;gap:6px;max-width:100%;padding:4px 8px;border:1px solid var(--ui-line);border-radius:8px;background:var(--ui-surface);font-size:.88rem}
            .memo-file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
            .memo-file button{border:0;background:transparent;cursor:pointer;color:var(--ui-bad);font-weight:900}
            .memo-list{border-top:1px solid var(--ui-line);max-height:calc(100vh - 300px);min-height:120px;overflow-y:auto}
            .memo-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:12px 16px;border-bottom:1px solid var(--ui-line)}
            .memo-item:last-child{border-bottom:0}
            .memo-item b{display:block;margin-bottom:2px}
            .memo-item span.memo-body{display:block;color:var(--ui-muted);white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}
            .memo-pin{padding:1px 8px;border-radius:999px;background:var(--ui-accent-soft);color:var(--ui-accent-deep);font-size:11px;font-weight:900;white-space:nowrap}
            .memo-pin-slot{min-width:34px}
            .memo-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
            .memo-attach{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
            .memo-thumb{width:96px;height:72px;object-fit:cover;border:1px solid var(--ui-line);border-radius:8px;background:var(--ui-surface-soft);cursor:zoom-in}
            .memo-attach-file{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--ui-line);border-radius:8px;background:var(--ui-surface-soft);color:var(--ui-text);font:inherit;font-size:.88rem;cursor:pointer}
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
            .filter(memo => !query || `${memo.title}\n${memo.content}\n${(memo.attachments || []).map(file => file.name).join(' ')}`.toLowerCase().includes(query))
            .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
    }

    // ---- 첨부 파일 ----
    function fileUrl(path) {
        if (urlCache.has(path)) return urlCache.get(path);
        const promise = window.storage.ref(path).getDownloadURL().catch(error => {
            urlCache.delete(path);
            throw error;
        });
        urlCache.set(path, promise);
        return promise;
    }

    // 화면 크기 스크린샷이 너무 크지 않게, 큰 이미지는 가로 1600px·JPEG로 줄여서 올린다.
    async function shrinkImage(file) {
        if (!isImage(file) || file.type === 'image/gif' || file.size < 300 * 1024) return file;
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            const context = canvas.getContext('2d');
            context.fillStyle = '#fff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
            if (!blob || blob.size >= file.size) return file;
            const name = String(file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
            return new File([blob], name, { type: 'image/jpeg' });
        } catch (error) {
            return file;
        }
    }

    function attachedCount() {
        return (state.editing?.attachments?.length || 0) + (state.editing?.pending?.length || 0);
    }

    function addFiles(fileList) {
        if (!state.editing) return;
        const files = Array.from(fileList || []);
        let skipped = '';
        files.forEach((file, index) => {
            if (attachedCount() >= MAX_FILES) { skipped = `파일은 메모 하나에 ${MAX_FILES}개까지 붙일 수 있어요.`; return; }
            // 사진은 올리기 전에 줄이므로 원본이 조금 커도 받고, 그 밖의 파일은 10MB까지만.
            if (file.size > (isImage(file) ? MAX_BYTES * 3 : MAX_BYTES)) { skipped = `${file.name}: 너무 커서 붙일 수 없어요 (파일당 10MB까지).`; return; }
            const name = file.name || `스크린샷_${Date.now()}_${index}.png`;
            state.editing.pending.push(name === file.name ? file : new File([file], name, { type: file.type }));
        });
        if (skipped) alert(skipped);
        renderFiles();
    }

    function filesHtml() {
        const edit = state.editing;
        if (!edit) return '';
        const saved = edit.attachments.map((file, index) => `<span class="memo-file"><span>📎 ${esc(file.name)} (${sizeText(file.size)})</span><button type="button" data-memo-remove-saved="${index}" aria-label="첨부 제거">✕</button></span>`);
        const pending = edit.pending.map((file, index) => `<span class="memo-file"><span>🆕 ${esc(file.name)} (${sizeText(file.size)})</span><button type="button" data-memo-remove-pending="${index}" aria-label="첨부 제거">✕</button></span>`);
        return [...saved, ...pending].join('');
    }

    function renderFiles() {
        const target = document.getElementById('memo-files');
        if (target) target.innerHTML = filesHtml();
    }

    function formHtml() {
        const edit = state.editing;
        if (!edit) return '';
        return `<div class="memo-form" data-memo-form>
            <input type="text" data-memo-title maxlength="100" placeholder="제목" value="${esc(edit.title)}">
            <textarea data-memo-content maxlength="6000" placeholder="내용 (스크린샷은 여기에 Ctrl+V로 붙여넣을 수 있어요)">${esc(edit.content)}</textarea>
            <div class="memo-drop" data-memo-drop>📎 파일을 여기로 끌어다 놓거나 <button type="button" class="btn btn--xs" data-memo-pick>파일 선택</button> · 최대 ${MAX_FILES}개, 파일당 10MB</div>
            <input type="file" data-memo-file-input multiple hidden>
            <div class="memo-files" id="memo-files">${filesHtml()}</div>
            <div class="memo-form-row">
                <label><input type="checkbox" data-memo-pinned ${edit.pinned ? 'checked' : ''}> 고정 (맨 위에 두기)</label>
                <span class="sp"></span>
                <button type="button" class="btn btn--sm btn--outline" data-memo-cancel>취소</button>
                <button type="button" class="btn btn--sm btn--primary" data-memo-save>저장</button>
            </div>
        </div>`;
    }

    function attachHtml(memo) {
        const files = Array.isArray(memo.attachments) ? memo.attachments : [];
        if (!files.length) return '';
        return `<div class="memo-attach">${files.map(file => /^image\//.test(file.type)
            ? `<img class="memo-thumb" alt="${esc(file.name)}" title="${esc(file.name)}" data-memo-img="${esc(file.path)}">`
            : `<button type="button" class="memo-attach-file" data-memo-open="${esc(file.path)}">📎 ${esc(file.name)} <small>${sizeText(file.size)}</small></button>`
        ).join('')}</div>`;
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
            <div><b>${highlight(memo.title || '제목 없음', query)}</b><span class="memo-body">${highlight(memo.content, query)}</span>${attachHtml(memo)}</div>
            <div class="memo-actions">
                <button type="button" class="btn btn--xs" data-memo-pin-toggle="${esc(memo.id)}">${memo.pinned ? '고정 해제' : '고정'}</button>
                <button type="button" class="btn btn--xs" data-memo-edit="${esc(memo.id)}">수정</button>
                <button type="button" class="btn btn--xs btn--danger" data-memo-delete="${esc(memo.id)}">삭제</button>
            </div>
        </div>`).join('');
    }

    // 목록을 그린 뒤, 보이는 이미지 썸네일의 주소를 비동기로 채운다.
    function hydrateThumbs() {
        document.querySelectorAll('#memo-list img[data-memo-img]').forEach(img => {
            fileUrl(img.dataset.memoImg).then(url => { img.src = url; }).catch(() => { img.alt = '이미지를 불러오지 못했어요'; });
        });
    }

    // 검색 입력창은 다시 그리지 않고(포커스 유지) 목록만 갱신한다.
    function renderList() {
        const list = document.getElementById('memo-list');
        if (list) list.innerHTML = listHtml();
        hydrateThumbs();
    }

    function render() {
        const container = root();
        if (!container) return;
        ensureStyles();
        container.innerHTML = `<div class="memo-shell"><section class="memo-card">
            <div class="memo-bar">
                <h3>🗒️ 메모</h3>
                <input type="search" class="memo-search" id="memo-search" placeholder="메모 검색 (제목·내용·파일 이름)" value="${esc(state.query)}" autocomplete="off">
                <span class="sp"></span>
                <button type="button" class="btn btn--sm btn--primary" data-memo-add>+ 메모 추가</button>
            </div>
            <div id="memo-form-slot">${formHtml()}</div>
            <div class="memo-list" id="memo-list">${listHtml()}</div>
        </section></div>`;
        hydrateThumbs();
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
            state.memos = Array.isArray(result.memos) ? result.memos.map(memo => ({ attachments: [], ...memo })) : [];
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
            const saved = { attachments: [], ...result.memo };
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

    // 새로 붙인 파일을 Storage에 올리고, 메모에 저장할 첨부 정보를 돌려준다.
    async function uploadPending(edit) {
        const uploaded = [];
        for (const original of edit.pending) {
            const file = await shrinkImage(original);
            if (file.size > MAX_BYTES) throw new Error(`${file.name}: 10MB를 넘어서 올릴 수 없어요.`);
            const safeName = String(file.name).replace(/[\\/#?[\]]/g, '_').slice(0, 120);
            const path = `classMemoFiles/${edit.id}/${Date.now()}_${uploaded.length}_${safeName}`;
            await window.storage.ref(path).put(file, { contentType: file.type || 'application/octet-stream' });
            uploaded.push({ path, name: file.name, size: file.size, type: file.type || '' });
        }
        return uploaded;
    }

    document.addEventListener('click', async event => {
        if (!event.target.closest('#class-memo-container')) return;
        const find = id => state.memos.find(memo => memo.id === id);

        if (event.target.closest('[data-memo-add]')) {
            state.editing = { id: newMemoId(), isNew: true, title: '', content: '', pinned: false, attachments: [], pending: [] };
            renderForm();
            return;
        }
        if (event.target.closest('[data-memo-cancel]')) {
            state.editing = null;
            renderForm();
            return;
        }
        if (event.target.closest('[data-memo-pick]')) {
            document.querySelector('[data-memo-file-input]')?.click();
            return;
        }
        const removeSaved = event.target.closest('[data-memo-remove-saved]');
        if (removeSaved) {
            state.editing?.attachments.splice(Number(removeSaved.dataset.memoRemoveSaved), 1);
            renderFiles();
            return;
        }
        const removePending = event.target.closest('[data-memo-remove-pending]');
        if (removePending) {
            state.editing?.pending.splice(Number(removePending.dataset.memoRemovePending), 1);
            renderFiles();
            return;
        }
        const openFile = event.target.closest('[data-memo-open]');
        if (openFile) {
            try { window.open(await fileUrl(openFile.dataset.memoOpen), '_blank', 'noopener'); }
            catch (error) { console.error('첨부 열기 오류:', error); alert('파일을 열지 못했어요.'); }
            return;
        }
        const thumb = event.target.closest('img[data-memo-img]');
        if (thumb) {
            try { window.open(await fileUrl(thumb.dataset.memoImg), '_blank', 'noopener'); }
            catch (error) { console.error('이미지 열기 오류:', error); }
            return;
        }
        const editButton = event.target.closest('[data-memo-edit]');
        if (editButton) {
            const memo = find(editButton.dataset.memoEdit);
            if (memo) { state.editing = { ...memo, isNew: false, attachments: [...(memo.attachments || [])], pending: [] }; renderForm(); }
            return;
        }
        const saveButton = event.target.closest('[data-memo-save]');
        if (saveButton) {
            if (state.saving) return;
            const form = document.querySelector('[data-memo-form]');
            const edit = state.editing;
            const payload = {
                id: edit.id,
                title: String(form.querySelector('[data-memo-title]').value || '').trim(),
                content: String(form.querySelector('[data-memo-content]').value || '').trim(),
                pinned: form.querySelector('[data-memo-pinned]').checked
            };
            if (!payload.title && !payload.content && !edit.attachments.length && !edit.pending.length) {
                alert('제목이나 내용, 첨부 중 하나는 있어야 해요.');
                return;
            }
            state.saving = true;
            saveButton.disabled = true;
            const label = saveButton.textContent;
            saveButton.textContent = edit.pending.length ? '올리는 중…' : '저장 중…';
            try {
                const uploaded = await uploadPending(edit);
                payload.attachments = [...edit.attachments, ...uploaded];
                if (await saveMemo(payload, null)) { state.editing = null; render(); return; }
            } catch (error) {
                console.error('메모 첨부 업로드 오류:', error);
                alert(errorText(error));
            } finally {
                state.saving = false;
                if (saveButton.isConnected) { saveButton.disabled = false; saveButton.textContent = label; }
            }
            return;
        }
        const pinButton = event.target.closest('[data-memo-pin-toggle]');
        if (pinButton) {
            const memo = find(pinButton.dataset.memoPinToggle);
            if (memo && await saveMemo({ id: memo.id, title: memo.title, content: memo.content, pinned: !memo.pinned, attachments: memo.attachments || [] }, pinButton)) renderList();
            return;
        }
        const deleteButton = event.target.closest('[data-memo-delete]');
        if (deleteButton) {
            const memo = find(deleteButton.dataset.memoDelete);
            const hasFiles = (memo?.attachments || []).length > 0;
            if (!memo || !confirm(`“${memo.title || '제목 없음'}” 메모를 삭제할까요?${hasFiles ? '\n붙여 둔 파일도 함께 삭제돼요.' : ''}`)) return;
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

    document.addEventListener('change', event => {
        if (!event.target?.matches?.('[data-memo-file-input]')) return;
        addFiles(event.target.files);
        event.target.value = '';
    });

    // 작성창에서 Ctrl+V로 붙여넣은 스크린샷(클립보드 이미지)을 첨부로 받는다.
    document.addEventListener('paste', event => {
        if (!state.editing || !event.target.closest?.('[data-memo-form]')) return;
        const files = Array.from(event.clipboardData?.files || []).filter(isImage);
        if (!files.length) return;
        event.preventDefault();
        addFiles(files);
    });

    document.addEventListener('dragover', event => {
        const zone = event.target.closest?.('[data-memo-drop]');
        if (!zone) return;
        event.preventDefault();
        zone.classList.add('is-over');
    });
    document.addEventListener('dragleave', event => {
        event.target.closest?.('[data-memo-drop]')?.classList.remove('is-over');
    });
    document.addEventListener('drop', event => {
        const zone = event.target.closest?.('[data-memo-drop]');
        if (!zone) return;
        event.preventDefault();
        zone.classList.remove('is-over');
        addFiles(event.dataTransfer?.files);
    });

    // 학급일지 잠금이 다시 걸리면 메모도 비운다(다음에 열 때 서버에서 다시 받는다).
    window.resetClassMemo = function () {
        state.memos = []; state.loaded = false; state.loading = false; state.query = ''; state.editing = null; state.saving = false;
        urlCache.clear();
        const container = root();
        if (container) container.innerHTML = '';
    };
    window.renderClassMemoPane = function () { if (token()) { if (state.loaded) render(); else load(); } };
})();
