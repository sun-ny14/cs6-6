(function(){
    'use strict';
    const CATEGORIES=['교우관계','학교생활','민원','학습','보호자상담','기타'];
    const PERIODS=['1교시','2교시','3교시','4교시','5교시','6교시'];
    const TYPE_META={
        notice:{label:'공지',icon:'📢'},
        schedule:{label:'일정',icon:'📅'},
        counsel:{label:'상담',icon:'💬'},
        lesson:{label:'수업일지',icon:'📖'}
    };
    const state={token:'',month:'',selectedDate:'',days:{},notices:{},drafts:{},loading:false,unlocking:false,filter:'all',entryMode:'all'};
    const root=()=>document.getElementById('class-journal-container');
    const lockRoot=()=>document.getElementById('class-ops-lock-area');
    function showLockArea(){
        const lock=document.getElementById('class-ops-lock-area'),shell=document.getElementById('class-ops-shell');
        if(lock)lock.hidden=false;if(shell)shell.hidden=true;
    }
    function showShellArea(){
        const lock=document.getElementById('class-ops-lock-area'),shell=document.getElementById('class-ops-shell');
        if(lock)lock.hidden=true;if(shell)shell.hidden=false;
    }
    const esc=value=>String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const todayKst=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const makeId=prefix=>`${prefix}_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    const errorText=error=>String(error?.message||'처리하지 못했습니다.').replace(/^Firebase:\s*/, '');
    const emptyDay=()=>({lessonNote:'',periodNotes:{},counseling:[],schedules:[]});

    function ensureStyles(){
        if(document.getElementById('class-journal-style'))return;
        const style=document.createElement('style');style.id='class-journal-style';
        style.textContent=`
            .journal-shell{max-width:1460px;margin:auto}.journal-lock{max-width:390px;margin:5vh auto;padding:30px;border-radius:26px;background:var(--ui-surface);box-shadow:var(--ui-shadow);text-align:center}.journal-lock h2{margin:0 0 10px}.journal-lock p{color:var(--ui-muted);line-height:1.6}.journal-pin-dots{display:flex;justify-content:center;gap:15px;margin:20px 0}.journal-pin-dot{width:18px;height:18px;border:2px solid var(--ui-line-strong);border-radius:50%;background:transparent}.journal-pin-dot.is-filled{border-color:var(--ui-accent);background:var(--ui-accent)}.journal-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.journal-key{min-height:58px;border:1px solid var(--ui-line);border-radius:16px;background:var(--ui-surface-soft);color:var(--ui-text);font-size:23px;font-weight:900;cursor:pointer}.journal-key:active{transform:scale(.96);background:var(--ui-accent-soft)}.journal-lock-actions{display:flex;gap:10px;margin-top:16px}.journal-lock-actions button{flex:1}.journal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.journal-head h2{margin:0 0 6px}.journal-head p{margin:0;color:var(--ui-muted)}.journal-head-actions{display:flex;gap:8px;flex-wrap:wrap}.journal-card{padding:24px;border:1px solid var(--ui-line);border-radius:20px;background:var(--ui-surface)}.journal-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.journal-calendar-head strong{font-size:28px}.journal-filter{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}.journal-filter button.active{background:var(--ui-accent);color:#fff;border-color:var(--ui-accent)}.journal-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px}.journal-weekday{text-align:center;padding:7px;color:var(--ui-muted);font-weight:900}.journal-day{position:relative;min-height:125px;border:1px solid var(--ui-line);border-radius:14px;background:var(--ui-surface-soft);overflow:hidden}.journal-day.is-other{opacity:.34}.journal-day.is-today{box-shadow:inset 0 0 0 2px var(--ui-good)}.journal-day.active{border-color:var(--ui-accent);background:var(--ui-accent-soft)}.journal-day-open{width:100%;min-height:125px;padding:12px 11px 38px;border:0;background:transparent;text-align:left;color:var(--ui-text);font:inherit;cursor:pointer}.journal-day-open b{display:block;font-size:19px}.journal-day-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:9px}.journal-day-tag{font-size:9.5px;font-weight:850;padding:2px 6px;border-radius:6px;white-space:nowrap}.journal-day-tag.type-notice{background:var(--ui-info-soft);color:var(--ui-info)}.journal-day-tag.type-schedule{background:var(--ui-accent-soft);color:var(--ui-accent-deep)}.journal-day-tag.type-counsel{background:var(--ui-warn-soft);color:var(--ui-warn)}.journal-day-tag.type-lesson{background:var(--ui-good-soft);color:var(--ui-good)}.journal-day-add{position:absolute;right:9px;bottom:9px;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:var(--ui-accent);color:white;font-size:22px;line-height:30px;cursor:pointer}.journal-loading{text-align:center;padding:12px;color:var(--ui-muted);font-weight:850}.journal-type-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:22px}.journal-type-picker button{min-height:100px;border:1px solid var(--ui-line);border-radius:16px;background:var(--ui-surface-soft);color:var(--ui-text);font-size:18px;font-weight:900;cursor:pointer}.journal-type-picker button:hover{border-color:var(--ui-accent);background:var(--ui-accent-soft)}
            .journal-acc{border:1px solid var(--ui-line);border-radius:14px;overflow:hidden;background:var(--ui-surface)}.journal-acc+.journal-acc{margin-top:10px}.journal-acc-head{display:flex;align-items:center;gap:8px;padding:13px 16px}.journal-acc-title-wrap{display:flex;align-items:center;gap:8px;flex:1;min-width:0;font-weight:900;cursor:pointer}.journal-acc-dot{width:9px;height:9px;border-radius:50%;flex:none}.journal-acc.type-notice .journal-acc-dot{background:var(--ui-info)}.journal-acc.type-schedule .journal-acc-dot{background:var(--ui-accent)}.journal-acc.type-counsel .journal-acc-dot{background:var(--ui-warn)}.journal-acc.type-lesson .journal-acc-dot{background:var(--ui-good)}.journal-acc-chevron{flex:none;color:var(--ui-muted);transition:transform .15s ease}.journal-acc.open .journal-acc-chevron{transform:rotate(180deg)}.journal-acc-body{display:none;padding:0 16px 16px}.journal-acc.open .journal-acc-body{display:block}
            .journal-modal-backdrop{position:fixed;inset:0;z-index:10050;display:flex;align-items:flex-start;justify-content:center;padding:24px;background:rgba(15,23,42,.66);overflow:hidden}.journal-modal{width:min(980px,100%);max-height:calc(100vh - 48px);margin:auto;display:flex;flex-direction:column;background:var(--ui-bg);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);overflow:hidden}.journal-modal-body{flex:1;min-height:0;overflow-y:auto}.journal-modal-head,.journal-modal-actions{flex:none}.journal-modal-head{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--ui-line);background:var(--ui-surface)}.journal-modal-head h2{margin:0}.journal-modal-body{display:grid;gap:16px;padding:20px}.journal-modal textarea,.journal-modal input,.journal-modal select{width:100%;padding:11px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface);color:var(--ui-text);font:inherit;box-sizing:border-box}.journal-modal textarea{resize:vertical}.journal-rows{display:grid;gap:10px}.journal-row{display:grid;gap:8px;padding:12px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface-soft)}.journal-row-counsel{grid-template-columns:150px 1fr auto}.journal-row-counsel textarea,.journal-related{grid-column:1/-1}.journal-row-work{grid-template-columns:115px 1fr auto}.journal-row-work textarea{grid-column:1/-1}.journal-row-options{grid-column:1/-1;display:flex;gap:14px;align-items:center;flex-wrap:wrap}.journal-row-options label,.journal-notice-check label{display:flex;align-items:center;gap:6px;font-weight:850}.journal-row-options input,.journal-notice-check input{width:auto}.journal-related{display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:var(--ui-muted);font-size:13px}.journal-chip{padding:4px 8px;border-radius:999px;background:var(--ui-accent-soft);color:var(--ui-accent-deep);font-weight:900}.journal-periods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.journal-period{padding:12px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface-soft)}.journal-period strong{display:block;margin-bottom:7px}.journal-period strong span{color:var(--ui-accent-deep)}.journal-empty{padding:18px;border:1px dashed var(--ui-line-strong);border-radius:10px;text-align:center;color:var(--ui-muted)}.journal-notice-check{display:grid;gap:7px;margin-top:9px}.journal-notice-check label{padding:8px 10px;border:1px solid var(--ui-line);border-radius:8px;background:var(--ui-surface-soft)}.journal-modal-actions{position:sticky;bottom:0;z-index:5;display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--ui-line);background:var(--ui-surface)}.journal-modal-actions .btn--primary{flex:1}.journal-status{min-height:22px;margin:0;color:var(--ui-muted);font-weight:800}.journal-private-note{padding:10px 13px;border-radius:10px;background:var(--ui-warn-soft);color:var(--ui-warn);font-weight:800}
            @media(max-width:760px){.journal-modal-backdrop{padding:0}.journal-modal{min-height:100%;border-radius:0}.journal-card{padding:10px}.journal-calendar{gap:3px}.journal-day,.journal-day-open{min-height:88px}.journal-day-open{padding:7px 5px 31px}.journal-day-tag{font-size:8.5px;padding:1.5px 5px}.journal-periods{grid-template-columns:1fr}.journal-row-counsel,.journal-row-work{grid-template-columns:1fr}.journal-row-counsel textarea,.journal-related,.journal-row-work textarea,.journal-row-options{grid-column:1}.journal-head{display:grid}.journal-calendar-head strong{font-size:21px}.journal-filter{display:grid;grid-template-columns:repeat(4,1fr)}.journal-filter button{padding:9px 4px;font-size:12px}}
        `;document.head.appendChild(style);
    }

    function normalizeNotice(value){
        if(value&&typeof value==='object'&&Array.isArray(value.items)){
            const items=value.items.map(item=>({text:String(item?.text||'').trim(),showOnHome:item?.showOnHome===true})).filter(item=>item.text);
            return {text:String(value.text||items.map(item=>item.text).join('\n')),items};
        }
        const text=String(value||'').trim();
        return {text,items:text.split(/\r?\n/).map(line=>({text:line.trim(),showOnHome:true})).filter(item=>item.text)};
    }

    function renderLock(message='학급일지·성적·운영비는 관리자 전용입니다. 비밀번호를 다시 확인해 주세요.'){
        ensureStyles();showLockArea();const container=lockRoot();if(!container)return;
        container.innerHTML=`<div class="journal-lock"><h2>🔐 학급 운영</h2><p>${esc(message)}</p><p class="tiny muted">학급일지 · 성적 관리 · 운영비를 하나의 비밀번호로 엽니다</p><input id="journal-password" type="hidden" value=""><div class="journal-pin-dots" aria-label="비밀번호 네 자리">${[0,1,2,3].map(i=>`<span class="journal-pin-dot" data-pin-dot="${i}"></span>`).join('')}</div><div class="journal-keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="journal-key" type="button" data-pin-key="${n}">${n}</button>`).join('')}<button class="journal-key" type="button" data-pin-clear>전체삭제</button><button class="journal-key" type="button" data-pin-key="0">0</button><button class="journal-key" type="button" data-pin-back>⌫</button></div><label class="check-row well--line"><input type="checkbox" id="journal-keep-today"> 이 기기에서 오늘 하루 계속 열어두기</label><div class="journal-lock-actions"><button class="btn btn--outline" data-journal-password-setup>비밀번호 설정·변경</button></div><p id="journal-lock-status" class="journal-status"></p></div>`;
    }
    function renderPasswordSetup(){
        showLockArea();const container=lockRoot();if(!container)return;
        container.innerHTML=`<div class="journal-lock"><h2>🔑 학급 운영 비밀번호 설정</h2><p>처음 설정할 때는 현재 비밀번호를 비워 두세요. 변경할 때는 현재 비밀번호가 필요합니다.</p><input id="journal-current-password" type="password" inputmode="numeric" maxlength="4" placeholder="현재 숫자 4자리 (처음 설정이면 비움)"><input id="journal-new-password" type="password" inputmode="numeric" maxlength="4" placeholder="새 숫자 4자리"><input id="journal-confirm-password" type="password" inputmode="numeric" maxlength="4" placeholder="새 비밀번호 확인"><div class="journal-lock-actions"><button class="btn btn--primary" data-journal-save-password>저장</button><button class="btn btn--outline" data-journal-back-lock>취소</button></div><p id="journal-lock-status" class="journal-status"></p></div>`;
    }
    function mondayOf(dateString){const date=new Date(`${dateString}T00:00:00Z`),day=date.getUTCDay();date.setUTCDate(date.getUTCDate()+(day===0?-6:1-day));return date.toISOString().slice(0,10);}
    function timetableFor(date,value){
        const board=window.getHomeDashboardData?.()||{},day=String(new Date(`${date}T00:00:00Z`).getUTCDay());
        const base=board.baseSchedule?.[day]||{},weekly=board.weeklySchedules?.[mondayOf(date)]?.[date]||{};
        return Object.fromEntries(PERIODS.map(period=>{const saved=value?.periodNotes?.[period]||{};return [period,{subject:String(weekly?.[period]?.subject||base?.[period]?.subject||saved.subject||'').trim(),note:String(saved.note||'')}];}));
    }
    function rosterNames(){return [...new Set((Array.isArray(window.currentUsers)?window.currentUsers:[]).map(user=>String(user?.name||'').trim()).filter(name=>name&&name!=='총사령관'))].sort((a,b)=>b.length-a.length);}
    function relatedStudents(item){const haystack=`${item.studentName||''} ${item.content||''}`.replace(/\s+/g,' '),roster=rosterNames();if(roster.length)return roster.filter(name=>haystack.includes(name));return [...new Set([...(item.relatedStudents||[]),String(item.studentName||'').trim()].filter(Boolean))];}
    function dayValue(date){return state.drafts[date]||state.days[date]||emptyDay();}
    function noticeFor(date){return state.drafts[date]?.notice||normalizeNotice(state.notices[date]);}
    function recordTypes(date){
        const value=dayValue(date),types=[],lessons=Object.values(value.periodNotes||{}).filter(item=>String(item?.note||'').trim()).length+(value.lessonNote?1:0);
        if(state.filter==='all'&&noticeFor(date).text.trim())types.push('notice');
        if((state.filter==='all'||state.filter==='schedule')&&(value.schedules||[]).length)types.push('schedule');
        if((state.filter==='all'||state.filter==='counsel')&&(value.counseling||[]).length)types.push('counsel');
        if((state.filter==='all'||state.filter==='lesson')&&lessons)types.push('lesson');
        return types;
    }
    function calendarDays(){const [year,month]=state.month.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),start=new Date(first);start.setUTCDate(1-first.getUTCDay());return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setUTCDate(start.getUTCDate()+index);return date.toISOString().slice(0,10);});}
    function renderCalendar(){
        const calendar=document.getElementById('journal-calendar');if(!calendar)return;const today=todayKst();
        calendar.innerHTML=['일','월','화','수','목','금','토'].map(day=>`<div class="journal-weekday">${day}</div>`).join('')+calendarDays().map(date=>{
            const types=recordTypes(date),other=date.slice(0,7)!==state.month;
            const tags=types.map(type=>`<span class="journal-day-tag type-${type}">${TYPE_META[type].label}</span>`).join('');
            return `<div class="journal-day${other?' is-other':''}${date===today?' is-today':''}${date===state.selectedDate?' active':''}"><button type="button" class="journal-day-open" data-journal-date="${date}"><b>${Number(date.slice(8))}</b>${tags?`<span class="journal-day-tags">${tags}</span>`:''}</button><button type="button" class="journal-day-add" data-journal-add="${date}" aria-label="${date} 기록 추가">+</button></div>`;
        }).join('');
        document.getElementById('journal-month-label').textContent=`${state.month.slice(0,4)}년 ${Number(state.month.slice(5))}월`;
    }
    function renderJournal(){const container=root();if(!container)return;container.innerHTML=`<div class="journal-shell"><section class="journal-card"><div class="journal-calendar-head"><button class="btn btn--sm" data-journal-month="-1">◀</button><strong id="journal-month-label"></strong><button class="btn btn--sm" data-journal-month="1">▶</button></div><div class="journal-filter" aria-label="학급일지 종류 필터">${[['all','전체'],['schedule','일정'],['counsel','상담'],['lesson','수업일지']].map(([key,label])=>`<button type="button" class="btn btn--outline ${state.filter===key?'active':''}" data-journal-filter="${key}">${label}</button>`).join('')}</div><div id="journal-calendar" class="journal-calendar"></div><div id="journal-loading" class="journal-loading" hidden>불러오는 중…</div></section></div>`;renderCalendar();}

    function counselingRow(item={}){const id=item.id||makeId('c'),related=relatedStudents(item);return `<div class="journal-row journal-row-counsel" data-counsel-row data-id="${esc(id)}"><select data-counsel-category>${CATEGORIES.map(category=>`<option ${category===(item.category||'학교생활')?'selected':''}>${category}</option>`).join('')}</select><input data-counsel-student value="${esc(item.studentName||'')}" placeholder="상담 대상(선택 입력)"><button class="btn btn--xs btn--danger" data-remove-row type="button">삭제</button><textarea data-counsel-content rows="4" placeholder="상담 내용을 작성하면 본문에 등장한 학생 이름을 자동으로 연결합니다.">${esc(item.content||'')}</textarea><div class="journal-related" data-related-students>${related.length?`<span>관련 학생</span>${related.map(name=>`<b class="journal-chip">${esc(name)}</b>`).join('')}`:'<span>본문에서 학생 이름을 찾으면 여기에 표시됩니다.</span>'}</div></div>`;}
    function workRow(item={}){const id=item.id||makeId('w');return `<div class="journal-row journal-row-work" data-work-row data-id="${esc(id)}"><input type="time" data-work-time value="${esc(item.time||'')}"><input data-work-title value="${esc(item.title||'')}" placeholder="교사 업무 일정"><button class="btn btn--xs btn--danger" data-remove-row type="button">삭제</button><textarea data-work-details rows="2" placeholder="업무 내용·준비물·메모">${esc(item.details||'')}</textarea><div class="journal-row-options"><label><input type="checkbox" data-work-notify ${item.notify?'checked':''}> 교사용 오늘의 알림에 표시</label><label><input type="checkbox" data-work-completed ${item.completed?'checked':''}> 업무 완료</label></div></div>`;}
    function renderNoticeChecks(){
        const target=document.getElementById('journal-notice-checks'),input=document.getElementById('journal-notice-text');if(!target||!input)return;
        const old=Array.from(target.querySelectorAll('[data-notice-home]')).map(box=>box.checked),stored=noticeFor(state.selectedDate).items,lines=String(input.value||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
        target.innerHTML=lines.length?lines.map((line,index)=>`<label><input type="checkbox" data-notice-home="${index}" ${(old[index]??stored[index]?.showOnHome??false)?'checked':''}> 오늘의 알림 <strong>${index+1}. ${esc(line)}</strong></label>`).join(''):'<div class="journal-empty">엔터로 항목을 나누면 알림 체크칸이 생깁니다.</div>';
    }
    function renderModal(date,mode=state.entryMode||'all'){
        state.selectedDate=date;state.entryMode=mode;document.getElementById('journal-modal-backdrop')?.remove();const value=dayValue(date),notice=noticeFor(date),periods=timetableFor(date,value),modal=document.createElement('div');modal.id='journal-modal-backdrop';modal.className='journal-modal-backdrop';
        const lessonHasContent=Object.values(periods).some(period=>String(period.note||'').trim())||Boolean(String(value.lessonNote||'').trim());
        const acc=(type,dataSection,title,extraHead,bodyHtml,hasContent)=>`<section class="journal-acc type-${type}${hasContent?' open':''}" data-entry-section="${dataSection}"><div class="journal-acc-head"><span class="journal-acc-title-wrap" data-acc-toggle><span class="journal-acc-dot"></span><span>${title}</span></span>${extraHead||''}<span class="journal-acc-chevron" data-acc-toggle>⌄</span></div><div class="journal-acc-body">${bodyHtml}</div></section>`;
        const noticeSection=acc('notice','all','📢 공지','',`<textarea id="journal-notice-text" rows="4" placeholder="엔터로 공지 항목을 나누세요.">${esc(notice.text)}</textarea><div id="journal-notice-checks" class="journal-notice-check"></div>`,Boolean(notice.text.trim()));
        const scheduleSection=acc('schedule','schedule','📅 교사 업무 일정','<button class="btn btn--sm" data-add-work type="button">+ 일정</button>',`<div class="journal-rows">${(value.schedules||[]).map(workRow).join('')||'<div class="journal-empty">등록된 업무 일정이 없습니다.</div>'}</div>`,(value.schedules||[]).length>0);
        const counselSection=acc('counsel','counsel','💬 상담 기록','<button class="btn btn--sm" data-add-counsel type="button">+ 상담</button>',`<div class="journal-rows">${(value.counseling||[]).map(counselingRow).join('')||'<div class="journal-empty">등록된 상담 기록이 없습니다.</div>'}</div>`,(value.counseling||[]).length>0);
        const lessonSection=acc('lesson','lesson','📖 교시별 수업일지','',`<div class="journal-periods">${PERIODS.map(period=>`<div class="journal-period" data-period="${period}" data-subject="${esc(periods[period].subject)}"><strong>${period} · <span>${esc(periods[period].subject||'과목 미등록')}</span></strong><textarea rows="3" data-period-note placeholder="${period} 수업 기록">${esc(periods[period].note)}</textarea></div>`).join('')}</div><textarea id="journal-extra-note" rows="6" style="margin-top:12px" placeholder="생활지도, 학급 운영, 다음 날 준비 등 교시 외 기록을 작성하세요.">${esc(value.lessonNote||'')}</textarea>`,lessonHasContent);
        modal.innerHTML=`<div class="journal-modal" role="dialog" aria-modal="true" aria-label="${esc(date)} 학급 기록"><header class="journal-modal-head"><div><h2>📝 ${esc(date)} 기록</h2><p class="journal-status">${mode==='all'?'전체 기록':mode==='schedule'?'일정':mode==='counsel'?'상담':'수업일지'} 입력</p></div><button class="btn btn--outline" data-journal-close type="button">닫기</button></header><div class="journal-modal-body"><div class="journal-private-note">🔒 관리자와 학급일지 비밀번호를 통과해야만 볼 수 있습니다.</div>${noticeSection}${scheduleSection}${counselSection}${lessonSection}<p id="journal-save-status" class="journal-status"></p></div><footer class="journal-modal-actions"><button class="btn btn--outline" data-journal-close type="button">취소</button><button class="btn btn--primary" data-save-journal type="button">저장</button></footer></div>`;
        if(mode!=='all'){modal.querySelectorAll('[data-entry-section]').forEach(section=>{if(section.dataset.entrySection!==mode)section.remove();});modal.querySelector('.journal-acc')?.classList.add('open');}
        root()?.appendChild(modal);renderNoticeChecks();
    }
    function readModal(){
        const base=dayValue(state.selectedDate),mode=state.entryMode;
        const counseling=(mode==='all'||mode==='counsel')?Array.from(document.querySelectorAll('[data-counsel-row]')).map(row=>{const item={id:row.dataset.id,category:row.querySelector('[data-counsel-category]')?.value||'기타',studentName:String(row.querySelector('[data-counsel-student]')?.value||'').trim(),content:String(row.querySelector('[data-counsel-content]')?.value||'').trim()};return {...item,relatedStudents:relatedStudents(item)};}).filter(item=>item.content):(base.counseling||[]);
        const schedules=(mode==='all'||mode==='schedule')?Array.from(document.querySelectorAll('[data-work-row]')).map(row=>({id:row.dataset.id,time:String(row.querySelector('[data-work-time]')?.value||'').trim(),title:String(row.querySelector('[data-work-title]')?.value||'').trim(),details:String(row.querySelector('[data-work-details]')?.value||'').trim(),notify:Boolean(row.querySelector('[data-work-notify]')?.checked),completed:Boolean(row.querySelector('[data-work-completed]')?.checked)})).filter(item=>item.title):(base.schedules||[]);
        const periodNotes=(mode==='all'||mode==='lesson')?Object.fromEntries(Array.from(document.querySelectorAll('[data-period]')).map(row=>[row.dataset.period,{subject:row.dataset.subject||'',note:String(row.querySelector('[data-period-note]')?.value||'').trim()}]).filter(([,item])=>item.note)):(base.periodNotes||{});
        const savedNotice=noticeFor(state.selectedDate),noticeText=mode==='all'?String(document.getElementById('journal-notice-text')?.value||'').trim():savedNotice.text,checks=Array.from(document.querySelectorAll('[data-notice-home]')).map(box=>box.checked),noticeItems=mode==='all'?noticeText.split(/\r?\n/).map((line,index)=>({text:line.trim(),showOnHome:checks[index]===true})).filter(item=>item.text):savedNotice.items;
        const lessonNote=(mode==='all'||mode==='lesson')?String(document.getElementById('journal-extra-note')?.value||'').trim():String(base.lessonNote||'');
        return {lessonNote,periodNotes,counseling,schedules,notice:{text:noticeText,items:noticeItems}};
    }
    function captureModal(){if(state.token&&state.selectedDate&&document.querySelector('#journal-modal-backdrop [data-save-journal]'))state.drafts[state.selectedDate]=readModal();}
    function closeModal(){captureModal();document.getElementById('journal-modal-backdrop')?.remove();renderCalendar();}
    async function loadMonth(month,openDate=''){
        if(state.loading)return;state.loading=true;const loading=document.getElementById('journal-loading');if(loading)loading.hidden=false;
        try{const result=await window.callSecure('getClassJournalMonth',{journalToken:state.token,month});state.month=month;state.days=result.days||{};state.notices=result.notices||{};state.selectedDate=openDate||`${month}-01`;renderJournal();if(openDate)renderModal(openDate);}
        catch(error){console.error('학급일지 조회 오류:',error);window.lockClassJournal(errorText(error));}finally{state.loading=false;}
    }
    async function unlock(){
        if(state.unlocking)return;
        const password=String(document.getElementById('journal-password')?.value||''),status=document.getElementById('journal-lock-status');if(!/^\d{4}$/.test(password)){if(status)status.textContent='숫자 4자리를 입력해 주세요.';return;}if(status)status.textContent='확인 중…';
        state.unlocking=true;
        const keepToday=document.getElementById('journal-keep-today')?.checked===true;
        try{const month=todayKst().slice(0,7),result=await window.callSecure('unlockClassJournal',{password,month,keepToday});state.token=result.journalToken;state.month=result.month||month;state.selectedDate=todayKst();state.days=result.days||{};state.notices=result.notices||{};state.drafts={};renderJournal();showShellArea();window.classOpsOnUnlock?.();}catch(error){if(status)status.textContent=errorText(error);updatePin('');}finally{state.unlocking=false;}
    }
    async function savePassword(){
        const currentPassword=String(document.getElementById('journal-current-password')?.value||''),newPassword=String(document.getElementById('journal-new-password')?.value||''),confirm=String(document.getElementById('journal-confirm-password')?.value||''),status=document.getElementById('journal-lock-status');if(!/^\d{4}$/.test(newPassword)){status.textContent='숫자 4자리를 입력해 주세요.';return;}if(newPassword!==confirm){status.textContent='새 비밀번호 확인이 일치하지 않습니다.';return;}status.textContent='저장 중…';
        try{await window.callSecure('setClassJournalPassword',{currentPassword,newPassword});state.token='';renderLock('비밀번호를 저장했습니다. 새 비밀번호로 다시 확인해 주세요.');}catch(error){status.textContent=errorText(error);}
    }
    async function saveDay(){
        const date=state.selectedDate,value=readModal(),button=document.querySelector('[data-save-journal]'),status=document.getElementById('journal-save-status');if(button)button.disabled=true;if(status)status.textContent='저장 중…';
        try{const result=await window.callSecure('saveClassJournalDay',{journalToken:state.token,date,...value});if(result.day)state.days[date]=result.day;else delete state.days[date];if(result.notice)state.notices[date]=result.notice;else delete state.notices[date];delete state.drafts[date];renderCalendar();const next=document.getElementById('journal-save-status');if(next)next.textContent=`저장 완료 · 교사용 알림 ${result.alertCount||0}개`;window.refreshTeacherAlerts?.();}
        catch(error){if(status)status.textContent=errorText(error);if(/인증|비밀번호|만료/.test(errorText(error)))window.lockClassJournal(errorText(error));}finally{const current=document.querySelector('[data-save-journal]');if(current)current.disabled=false;}
    }
    function openTypePicker(date){
        state.selectedDate=date;document.getElementById('journal-modal-backdrop')?.remove();
        const modal=document.createElement('div');modal.id='journal-modal-backdrop';modal.className='journal-modal-backdrop';
        modal.innerHTML=`<div class="journal-modal" role="dialog" aria-modal="true"><header class="journal-modal-head"><h2>➕ ${esc(date)} 기록 추가</h2><button class="btn btn--outline" data-journal-close type="button">닫기</button></header><div class="journal-type-picker">${[['all','📚 전체'],['schedule','📅 일정'],['counsel','💬 상담'],['lesson','📖 수업일지']].map(([key,label])=>`<button type="button" data-journal-entry="${key}">${label}</button>`).join('')}</div></div>`;
        root()?.appendChild(modal);
    }
    async function openDate(date,mode='all'){closeModal();if(date.slice(0,7)!==state.month){await loadMonth(date.slice(0,7));state.selectedDate=date;}renderCalendar();if(mode==='picker')openTypePicker(date);else renderModal(date,mode);}
    function changeMonth(amount){closeModal();const date=new Date(`${state.month}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()+amount);loadMonth(date.toISOString().slice(0,7));}
    function updateRelated(row){const target=row.querySelector('[data-related-students]');if(!target)return;const related=relatedStudents({studentName:row.querySelector('[data-counsel-student]')?.value||'',content:row.querySelector('[data-counsel-content]')?.value||''});target.innerHTML=related.length?`<span>관련 학생</span>${related.map(name=>`<b class="journal-chip">${esc(name)}</b>`).join('')}`:'<span>본문에서 학생 이름을 찾으면 여기에 표시됩니다.</span>';}

    function updatePin(value){
        const input=document.getElementById('journal-password');if(!input)return;
        const previousLength=input.value.length;
        input.value=String(value||'').replace(/\D/g,'').slice(0,4);
        document.querySelectorAll('[data-pin-dot]').forEach((dot,index)=>dot.classList.toggle('is-filled',index<input.value.length));
        if(input.value.length===4&&previousLength<4)unlock();
    }

    window.lockClassJournal=function(message){
        state.token='';state.days={};state.notices={};state.drafts={};
        renderLock(message);
        window.classOpsOnLock?.();
    };
    window.isClassOpsUnlocked=()=>Boolean(state.token);
    window.renderClassJournalPane=function(){if(state.token)renderJournal();};
    window.classOpsChangePassword=function(){renderPasswordSetup();};
    document.addEventListener('click',async event=>{
        if(!event.target.closest('#tab-class-ops'))return;
        if(event.target.closest('[data-journal-unlock]')){await unlock();return;}if(event.target.closest('[data-journal-password-setup],[data-journal-change-password]')){renderPasswordSetup();return;}if(event.target.closest('[data-journal-save-password]')){await savePassword();return;}if(event.target.closest('[data-journal-back-lock]')){if(state.token){showShellArea();window.classOpsOnUnlock?.();}else renderLock();return;}if(event.target.closest('[data-journal-lock]')){showTab('main');window.lockClassJournal();return;}
        const pin=event.target.closest('[data-pin-key]');if(pin){updatePin((document.getElementById('journal-password')?.value||'')+pin.dataset.pinKey);return;}if(event.target.closest('[data-pin-back]')){updatePin((document.getElementById('journal-password')?.value||'').slice(0,-1));return;}if(event.target.closest('[data-pin-clear]')){updatePin('');return;}
        const filter=event.target.closest('[data-journal-filter]');if(filter){state.filter=filter.dataset.journalFilter;renderJournal();return;}
        const month=event.target.closest('[data-journal-month]');if(month){changeMonth(Number(month.dataset.journalMonth));return;}const addButton=event.target.closest('[data-journal-add]');if(addButton){await openDate(addButton.dataset.journalAdd,'picker');return;}const dateButton=event.target.closest('[data-journal-date]');if(dateButton){await openDate(dateButton.dataset.journalDate,'all');return;}const entry=event.target.closest('[data-journal-entry]');if(entry){renderModal(state.selectedDate,entry.dataset.journalEntry);return;}if(event.target.closest('[data-journal-close]')){closeModal();return;}
        const accToggle=event.target.closest('[data-acc-toggle]');if(accToggle){accToggle.closest('.journal-acc')?.classList.toggle('open');return;}
        if(event.target.closest('[data-add-work]')){captureModal();state.drafts[state.selectedDate].schedules.push({id:makeId('w'),time:'',title:'',details:'',notify:false,completed:false});renderModal(state.selectedDate);return;}if(event.target.closest('[data-add-counsel]')){captureModal();state.drafts[state.selectedDate].counseling.push({id:makeId('c'),category:'학교생활',studentName:'',content:'',relatedStudents:[]});renderModal(state.selectedDate);return;}
        const remove=event.target.closest('[data-remove-row]');if(remove){remove.closest('[data-work-row],[data-counsel-row]')?.remove();captureModal();renderCalendar();return;}if(event.target.closest('[data-save-journal]'))await saveDay();
    });
    document.addEventListener('input',event=>{if(event.target?.id==='journal-notice-text'){renderNoticeChecks();return;}const row=event.target.closest?.('[data-counsel-row]');if(row)updateRelated(row);});
    document.addEventListener('keydown',event=>{
        const input=document.getElementById('journal-password');
        const journalTab=document.getElementById('tab-class-ops');
        const lockIsActive=input&&(window.currentTab==='class-ops'||journalTab?.classList.contains('active'))&&lockRoot()&&!lockRoot().hidden;
        if(lockIsActive&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
            if(/^\d$/.test(event.key)){
                event.preventDefault();
                updatePin(input.value+event.key);
                return;
            }
            if(event.key==='Backspace'){
                event.preventDefault();
                updatePin(input.value.slice(0,-1));
                return;
            }
            if(event.key==='Delete'){
                event.preventDefault();
                updatePin('');
                return;
            }
            if(event.key==='Enter'){
                event.preventDefault();
                unlock();
                return;
            }
        }
        if(event.key==='Escape'&&document.getElementById('journal-modal-backdrop'))closeModal();
    });
})();
