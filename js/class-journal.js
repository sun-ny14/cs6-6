(function(){
    'use strict';

    const CATEGORIES=['교우관계','학교생활','민원','학습','보호자상담','기타'];
    const state={token:'',month:'',selectedDate:'',days:{},drafts:{},loading:false};
    const root=()=>document.getElementById('class-journal-container');
    const esc=value=>String(value==null?'':value).replace(/&/g,'&amp;')
        .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const todayKst=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',
        year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const makeId=prefix=>`${prefix}_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    const errorText=error=>String(error?.message||'처리하지 못했습니다.').replace(/^Firebase:\s*/,'');

    function ensureStyles(){
        if(document.getElementById('class-journal-style'))return;
        const style=document.createElement('style');
        style.id='class-journal-style';
        style.textContent=`
            .journal-shell{max-width:1240px;margin:auto}.journal-lock{max-width:520px;margin:7vh auto;padding:32px;border-radius:22px;background:var(--ui-surface);box-shadow:var(--ui-shadow);text-align:center}.journal-lock h2{margin:0 0 10px}.journal-lock p{color:var(--ui-muted);line-height:1.6}.journal-lock input{width:100%;padding:14px;border:1px solid var(--ui-line-strong);border-radius:10px;font:inherit;box-sizing:border-box;margin:8px 0}.journal-lock-actions{display:flex;gap:10px;margin-top:10px}.journal-lock-actions button{flex:1}.journal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.journal-head h2{margin:0 0 6px}.journal-head p{margin:0;color:var(--ui-muted)}.journal-head-actions{display:flex;gap:8px;flex-wrap:wrap}.journal-layout{display:grid;grid-template-columns:minmax(330px,.85fr) minmax(480px,1.4fr);gap:18px;align-items:start}.journal-card{padding:20px;border:1px solid var(--ui-line);border-radius:18px;background:var(--ui-surface)}.journal-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.journal-calendar-head strong{font-size:22px}.journal-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.journal-weekday{text-align:center;padding:5px;color:var(--ui-muted);font-weight:900}.journal-day{position:relative;min-height:68px;padding:9px 7px;border:1px solid var(--ui-line);border-radius:10px;background:var(--ui-surface-soft);text-align:left;font:inherit;cursor:pointer}.journal-day.is-other{opacity:.28}.journal-day.is-today{box-shadow:inset 0 0 0 2px var(--ui-good)}.journal-day.active{border-color:var(--ui-accent);background:var(--ui-accent-soft);box-shadow:inset 0 0 0 1px var(--ui-accent)}.journal-day b{display:block}.journal-day small{display:block;margin-top:5px;color:var(--ui-muted);font-size:11px}.journal-editor{display:grid;gap:18px}.journal-editor-section{padding:16px;border:1px solid var(--ui-line);border-radius:14px;background:var(--ui-surface-soft)}.journal-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.journal-section-head h3{margin:0}.journal-editor textarea,.journal-editor input,.journal-editor select{width:100%;padding:11px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface);color:var(--ui-text);font:inherit;box-sizing:border-box}.journal-editor textarea{resize:vertical}.journal-rows{display:grid;gap:10px}.journal-row{display:grid;gap:8px;padding:12px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface)}.journal-row-counsel{grid-template-columns:150px 1fr auto}.journal-row-counsel textarea{grid-column:1/-1}.journal-row-work{grid-template-columns:115px 1fr auto}.journal-row-work textarea{grid-column:1/-1}.journal-row-options{grid-column:1/-1;display:flex;gap:14px;align-items:center;flex-wrap:wrap}.journal-row-options label{display:flex;align-items:center;gap:6px;font-weight:850}.journal-row-options input{width:auto}.journal-empty{padding:18px;border:1px dashed var(--ui-line-strong);border-radius:10px;text-align:center;color:var(--ui-muted)}.journal-save{position:sticky;bottom:10px;z-index:4;width:100%;padding:15px}.journal-status{min-height:22px;margin:0;color:var(--ui-muted);font-weight:800}.journal-private-note{padding:10px 13px;border-radius:10px;background:var(--ui-warn-soft);color:var(--ui-warn);font-weight:800}
            @media(max-width:900px){.journal-layout{grid-template-columns:1fr}.journal-row-counsel,.journal-row-work{grid-template-columns:1fr}.journal-row-counsel textarea,.journal-row-work textarea,.journal-row-options{grid-column:1}.journal-head{display:grid}.journal-calendar{gap:3px}.journal-day{min-height:56px;padding:6px;font-size:13px}}
        `;
        document.head.appendChild(style);
    }

    function renderLock(message='학급일지는 관리자 전용입니다. 비밀번호를 다시 확인해 주세요.'){
        ensureStyles();
        const container=root();if(!container)return;
        container.innerHTML=`<div class="journal-lock"><h2>🔐 학급일지 잠금</h2><p>${esc(message)}</p><input id="journal-password" type="password" autocomplete="current-password" placeholder="학급일지 비밀번호"><div class="journal-lock-actions"><button class="btn btn--primary" data-journal-unlock>확인하고 들어가기</button><button class="btn btn--outline" data-journal-password-setup>비밀번호 설정·변경</button></div><p id="journal-lock-status" class="journal-status"></p></div>`;
        container.querySelector('#journal-password')?.focus();
    }

    function renderPasswordSetup(){
        const container=root();if(!container)return;
        container.innerHTML=`<div class="journal-lock"><h2>🔑 학급일지 비밀번호 설정</h2><p>처음 설정할 때는 현재 비밀번호를 비워 두세요. 변경할 때는 현재 비밀번호가 필요합니다.</p><input id="journal-current-password" type="password" autocomplete="current-password" placeholder="현재 비밀번호 (처음 설정이면 비움)"><input id="journal-new-password" type="password" autocomplete="new-password" placeholder="새 비밀번호 4자 이상"><input id="journal-confirm-password" type="password" autocomplete="new-password" placeholder="새 비밀번호 확인"><div class="journal-lock-actions"><button class="btn btn--primary" data-journal-save-password>저장</button><button class="btn btn--outline" data-journal-back-lock>취소</button></div><p id="journal-lock-status" class="journal-status"></p></div>`;
    }

    function dayValue(date){return state.drafts[date]||state.days[date]||{lessonNote:'',counseling:[],schedules:[]};}
    function captureEditor(){
        if(!state.token||!state.selectedDate||!document.getElementById('journal-day-editor'))return;
        state.drafts[state.selectedDate]=readEditor();
    }
    function readEditor(){
        const counseling=Array.from(document.querySelectorAll('[data-counsel-row]')).map(row=>({
            id:row.dataset.id,category:row.querySelector('[data-counsel-category]')?.value||'기타',
            studentName:String(row.querySelector('[data-counsel-student]')?.value||'').trim(),
            content:String(row.querySelector('[data-counsel-content]')?.value||'').trim()
        })).filter(item=>item.content);
        const schedules=Array.from(document.querySelectorAll('[data-work-row]')).map(row=>({
            id:row.dataset.id,time:String(row.querySelector('[data-work-time]')?.value||'').trim(),
            title:String(row.querySelector('[data-work-title]')?.value||'').trim(),
            details:String(row.querySelector('[data-work-details]')?.value||'').trim(),
            notify:Boolean(row.querySelector('[data-work-notify]')?.checked),
            completed:Boolean(row.querySelector('[data-work-completed]')?.checked)
        })).filter(item=>item.title);
        return {lessonNote:String(document.getElementById('journal-lesson-note')?.value||'').trim(),counseling,schedules};
    }

    function counselingRow(item={}){
        const rowId=item.id||makeId('c');
        return `<div class="journal-row journal-row-counsel" data-counsel-row data-id="${esc(rowId)}"><select data-counsel-category>${CATEGORIES.map(category=>`<option ${category===(item.category||'학교생활')?'selected':''}>${category}</option>`).join('')}</select><input data-counsel-student value="${esc(item.studentName||'')}" placeholder="학생 이름 또는 대상"><button class="btn btn--xs btn--danger" data-remove-row type="button">삭제</button><textarea data-counsel-content rows="3" placeholder="상담 내용과 후속 조치">${esc(item.content||'')}</textarea></div>`;
    }
    function workRow(item={}){
        const rowId=item.id||makeId('w');
        return `<div class="journal-row journal-row-work" data-work-row data-id="${esc(rowId)}"><input type="time" data-work-time value="${esc(item.time||'')}"><input data-work-title value="${esc(item.title||'')}" placeholder="교사 업무 일정"><button class="btn btn--xs btn--danger" data-remove-row type="button">삭제</button><textarea data-work-details rows="2" placeholder="업무 내용·준비물·메모">${esc(item.details||'')}</textarea><div class="journal-row-options"><label><input type="checkbox" data-work-notify ${item.notify?'checked':''}> 교사용 오늘의 알림에 표시</label><label><input type="checkbox" data-work-completed ${item.completed?'checked':''}> 업무 완료</label></div></div>`;
    }

    function calendarDays(){
        const [year,month]=state.month.split('-').map(Number);
        const first=new Date(Date.UTC(year,month-1,1));
        const start=new Date(first);start.setUTCDate(1-first.getUTCDay());
        return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setUTCDate(start.getUTCDate()+index);return date.toISOString().slice(0,10);});
    }
    function renderCalendar(){
        const calendar=document.getElementById('journal-calendar');if(!calendar)return;
        const today=todayKst();
        calendar.innerHTML=['일','월','화','수','목','금','토'].map(day=>`<div class="journal-weekday">${day}</div>`).join('')+
            calendarDays().map(date=>{const value=dayValue(date);const count=(value.counseling?.length||0)+(value.schedules?.length||0)+(value.lessonNote?1:0);return `<button type="button" class="journal-day${date.slice(0,7)!==state.month?' is-other':''}${date===today?' is-today':''}${date===state.selectedDate?' active':''}" data-journal-date="${date}"><b>${Number(date.slice(8))}</b>${count?`<small>기록 ${count}</small>`:''}</button>`;}).join('');
        const label=document.getElementById('journal-month-label');if(label)label.textContent=`${state.month.slice(0,4)}년 ${Number(state.month.slice(5))}월`;
    }

    function renderEditor(){
        const editor=document.getElementById('journal-day-editor');if(!editor)return;
        const value=dayValue(state.selectedDate);
        editor.innerHTML=`<div class="journal-section-head"><div><h2>${esc(state.selectedDate)} 학급일지</h2><p class="journal-status">상담 내용은 전자칠판과 학생 화면에 공개되지 않습니다.</p></div></div><div class="journal-private-note">🔒 관리자 로그인과 학급일지 비밀번호를 모두 통과해야 조회할 수 있습니다.</div><section class="journal-editor-section"><div class="journal-section-head"><h3>📅 교사 업무 일정</h3><button class="btn btn--sm" data-add-work type="button">+ 일정 추가</button></div><div id="journal-work-rows" class="journal-rows">${(value.schedules||[]).map(workRow).join('')||'<div class="journal-empty">등록된 업무 일정이 없습니다.</div>'}</div></section><section class="journal-editor-section"><div class="journal-section-head"><h3>💬 상담 기록</h3><button class="btn btn--sm" data-add-counsel type="button">+ 상담 추가</button></div><div id="journal-counsel-rows" class="journal-rows">${(value.counseling||[]).map(counselingRow).join('')||'<div class="journal-empty">등록된 상담 기록이 없습니다.</div>'}</div></section><section class="journal-editor-section"><div class="journal-section-head"><h3>📖 수업일지</h3></div><textarea id="journal-lesson-note" rows="10" placeholder="수업 내용, 학생 반응, 다음 수업 준비사항 등을 기록하세요.">${esc(value.lessonNote||'')}</textarea></section><p id="journal-save-status" class="journal-status"></p><button class="btn btn--primary journal-save" data-save-journal type="button">이 날짜 학급일지 저장</button>`;
    }

    function renderJournal(){
        const container=root();if(!container)return;
        container.innerHTML=`<div class="journal-shell"><header class="journal-head"><div><h2>📚 학급일지</h2><p>날짜를 선택해 상담·수업·교사 업무를 한곳에서 관리합니다.</p></div><div class="journal-head-actions"><button class="btn btn--outline" data-journal-change-password>비밀번호 변경</button><button class="btn btn--danger" data-journal-lock>잠그고 나가기</button></div></header><div class="journal-layout"><section class="journal-card"><div class="journal-calendar-head"><button class="btn btn--sm" data-journal-month="-1">◀</button><strong id="journal-month-label"></strong><button class="btn btn--sm" data-journal-month="1">▶</button></div><div id="journal-calendar" class="journal-calendar"></div></section><section id="journal-day-editor" class="journal-card journal-editor"></section></div></div>`;
        renderCalendar();renderEditor();
    }

    async function loadMonth(month){
        if(state.loading)return;state.loading=true;
        try{
            const result=await window.callSecure('getClassJournalMonth',{journalToken:state.token,month});
            state.month=month;state.days=result.days||{};
            if(!state.selectedDate.startsWith(month))state.selectedDate=`${month}-01`;
            renderJournal();
        }catch(error){console.error('학급일지 조회 오류:',error);window.lockClassJournal(errorText(error));}
        finally{state.loading=false;}
    }
    async function unlock(){
        const password=String(document.getElementById('journal-password')?.value||'');
        const status=document.getElementById('journal-lock-status');
        if(!password){if(status)status.textContent='비밀번호를 입력해 주세요.';return;}
        if(status)status.textContent='확인 중…';
        try{
            const result=await window.callSecure('unlockClassJournal',{password});
            state.token=result.journalToken;state.month=todayKst().slice(0,7);state.selectedDate=todayKst();
            await loadMonth(state.month);
        }catch(error){if(status)status.textContent=errorText(error);}
    }
    async function savePassword(){
        const currentPassword=String(document.getElementById('journal-current-password')?.value||'');
        const newPassword=String(document.getElementById('journal-new-password')?.value||'');
        const confirm=String(document.getElementById('journal-confirm-password')?.value||'');
        const status=document.getElementById('journal-lock-status');
        if(newPassword.length<4){status.textContent='새 비밀번호를 4자 이상 입력해 주세요.';return;}
        if(newPassword!==confirm){status.textContent='새 비밀번호 확인이 일치하지 않습니다.';return;}
        status.textContent='저장 중…';
        try{await window.callSecure('setClassJournalPassword',{currentPassword,newPassword});renderLock('비밀번호를 저장했습니다. 새 비밀번호로 다시 확인해 주세요.');}
        catch(error){status.textContent=errorText(error);}
    }
    async function saveDay(){
        const status=document.getElementById('journal-save-status');const button=document.querySelector('[data-save-journal]');
        const date=state.selectedDate;const value=readEditor();if(status)status.textContent='저장 중…';if(button)button.disabled=true;
        try{
            const result=await window.callSecure('saveClassJournalDay',{journalToken:state.token,date,...value});
            if(date.startsWith(state.month)){
                if(result.day)state.days[date]=result.day;else delete state.days[date];
            }
            delete state.drafts[date];renderCalendar();
            if(state.selectedDate===date){
                renderEditor();
                const nextStatus=document.getElementById('journal-save-status');if(nextStatus)nextStatus.textContent=`저장 완료 · 교사용 알림 ${result.alertCount||0}개`;
            }
            window.refreshTeacherAlerts?.();
        }catch(error){if(status)status.textContent=errorText(error);if(/인증|비밀번호|만료/.test(errorText(error)))window.lockClassJournal(errorText(error));}
        finally{const current=document.querySelector('[data-save-journal]');if(current)current.disabled=false;}
    }
    function changeMonth(amount){
        captureEditor();const date=new Date(`${state.month}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()+amount);
        loadMonth(date.toISOString().slice(0,7));
    }

    window.lockClassJournal=function(message){state.token='';state.days={};state.drafts={};renderLock(message);};
    window.openClassJournalEntry=function(){
        if(window.isAdmin!==true)return alert('관리자만 학급일지를 사용할 수 있습니다.');
        showTab('class-journal');window.lockClassJournal();
    };
    window.initClassJournal=function(){ensureStyles();if(!state.token)renderLock();};

    document.addEventListener('click',async event=>{
        if(!event.target.closest('#tab-class-journal'))return;
        if(event.target.closest('[data-journal-unlock]')){await unlock();return;}
        if(event.target.closest('[data-journal-password-setup],[data-journal-change-password]')){renderPasswordSetup();return;}
        if(event.target.closest('[data-journal-save-password]')){await savePassword();return;}
        if(event.target.closest('[data-journal-back-lock]')){renderLock();return;}
        if(event.target.closest('[data-journal-lock]')){showTab('main');window.lockClassJournal();return;}
        const month=event.target.closest('[data-journal-month]');if(month){changeMonth(Number(month.dataset.journalMonth));return;}
        const day=event.target.closest('[data-journal-date]');if(day){captureEditor();state.selectedDate=day.dataset.journalDate;if(!state.selectedDate.startsWith(state.month)){await loadMonth(state.selectedDate.slice(0,7));}else{renderCalendar();renderEditor();}return;}
        if(event.target.closest('[data-add-work]')){captureEditor();state.drafts[state.selectedDate].schedules.push({id:makeId('w'),time:'',title:'',details:'',notify:false,completed:false});renderEditor();return;}
        if(event.target.closest('[data-add-counsel]')){captureEditor();state.drafts[state.selectedDate].counseling.push({id:makeId('c'),category:'학교생활',studentName:'',content:''});renderEditor();return;}
        const remove=event.target.closest('[data-remove-row]');if(remove){remove.closest('[data-work-row],[data-counsel-row]')?.remove();captureEditor();renderCalendar();return;}
        if(event.target.closest('[data-save-journal]'))await saveDay();
    });
    document.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&event.target?.id==='journal-password'){event.preventDefault();unlock();}
    });
})();
