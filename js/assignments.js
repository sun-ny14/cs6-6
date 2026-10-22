(function(){
    'use strict';
    const state={assignments:{},completions:{},users:{},listening:false};

    function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
    function todayKst(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
    function dayDistance(dateString,today){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString||'')))return 999;return Math.round((new Date(`${dateString}T00:00:00Z`)-new Date(`${today}T00:00:00Z`))/86400000);}
    function dueLabel(days,dueDate){if(days<0)return `⚠️ 마감 지남 · ${dueDate}`;if(days===0)return `🔥 오늘 마감 · ${dueDate}`;if(days===1)return `⏰ 내일 마감 · ${dueDate}`;return `마감 ${dueDate} · D-${days}`;}
    // 번호가 없는 학생도 명단에 포함합니다. 번호는 "–" 로 표기하고 목록 끝에 배치합니다.
    function roster(){return Object.entries(state.users||{}).map(([key,user])=>{const number=Number(user?.number||user?.no||user?.studentNo);return{name:String(user?.name||key||'').trim(),number:Number.isFinite(number)&&number>0?number:null};}).filter(student=>student.name&&student.name!=='총사령관'&&!student.name.includes('선생님')).sort((a,b)=>(a.number??999)-(b.number??999)||a.name.localeCompare(b.name,'ko')).map(student=>({...student,number:student.number??'–'}));}
    function rows(){return Object.entries(state.assignments||{}).filter(([,item])=>item&&item.active!==false).sort((a,b)=>String(a[1].dueDate||'').localeCompare(String(b[1].dueDate||'')));}

    // 종류: 과제 / 제출자료. 예전 데이터는 category가 없어서 기본은 '과제'로 취급한다.
    function itemCategory(item){return String(item?.category||'')==='제출자료'?'제출자료':'과제';}
    function rowsByCategory(category){return rows().filter(([,item])=>itemCategory(item)===category);}

    // targetStudents가 없거나 비어 있으면 전체 학생 대상, 있으면 그 명단만.
    function targetList(item){return Array.isArray(item?.targetStudents)?item.targetStudents.filter(Boolean):null;}
    function isTargeted(item,name){const targets=targetList(item);return !targets||targets.length===0||targets.includes(name);}

    window.assignmentsIsTargeted=isTargeted;

    // 대상 학생(지정 안 했으면 전체)이 전부 완료했는지. 대상에서 제외된 학생은 보지 않는다.
    // 홈 화면·아 맞다 같은 다른 화면이 "전원 완료면 목록에서 뺀다"를 같은 기준으로 쓰게 공유한다.
    window.assignmentsIsAllDone=function(item,completed){
        // 완료함에 보관한 과제/제출자료는 학생 수가 바뀌어도 끝난 것으로 본다(선생님이 다시 불러들일 때까지).
        if(item&&item.archived===true)return true;
        const explicit=targetList(item);
        const names=explicit&&explicit.length
            ?explicit
            :(Array.isArray(window.currentUsers)?window.currentUsers:[])
                .map(user=>String(user?.name||'').trim())
                .filter(name=>name&&name!=='총사령관'&&!name.includes('선생님'));
        if(!names.length)return false;
        return names.every(name=>completed&&completed[name]);
    };
    window.assignmentsItemCategory=itemCategory;

    function styles(){return `<style>@keyframes assignmentNudge{0%,100%{border-color:var(--ui-warn)}50%{border-color:var(--ui-warn-line)}}@keyframes assignmentUrgent{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ui-bad) 15%,transparent)}50%{box-shadow:0 0 0 10px color-mix(in srgb,var(--ui-bad) 8%,transparent)}}.assignment-page{max-width:1300px;margin:auto;font-family:var(--ui-font-body);text-align:left}.assignment-head{padding:28px;border-radius:18px;background:linear-gradient(135deg,var(--ui-accent),var(--ui-accent-deep));color:var(--ui-on-accent);margin-bottom:18px;text-align:center}.assignment-head h2{margin:0 0 8px;font-family:var(--ui-font-display)}.assignment-columns{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}.assignment-column-head{display:flex;align-items:center;gap:8px;margin:0 0 14px;padding:14px 18px;border-radius:14px;background:var(--ui-surface);font-weight:900;font-size:1.05em}.assignment-list{display:grid;gap:14px}.assignment-section{display:grid;gap:14px;margin-top:20px}.assignment-section-title{display:flex;align-items:center;justify-content:space-between;margin:0;padding:16px 20px;border-radius:14px;background:var(--ui-warn-soft);color:var(--ui-warn)}.assignment-section.completed .assignment-section-title{background:var(--ui-good-soft);color:var(--ui-good)}.assignment-count{display:inline-grid;place-items:center;min-width:34px;height:34px;padding:0 8px;border-radius:999px;background:var(--ui-surface);font-size:var(--ui-text-size)}.assignment-card{padding:22px;border-radius:16px;background:var(--ui-surface);border:2px solid var(--ui-line)}.assignment-card.completed{border-color:var(--ui-good-line);background:var(--ui-good-soft);color:var(--ui-text);opacity:1}.assignment-card.completed h3{color:var(--ui-text)}.assignment-card.completed .assignment-due{color:var(--ui-muted)}.assignment-card.completed .assignment-note{background:var(--ui-surface);color:var(--ui-text)}.assignment-card.soon{border-color:var(--ui-warn);background:var(--ui-warn-soft);animation:assignmentNudge 2.3s ease-in-out infinite}.assignment-card.urgent{border-color:var(--ui-bad);background:var(--ui-bad-soft);animation:assignmentUrgent 1.25s ease-in-out infinite}.assignment-card h3{margin:0 0 8px}.assignment-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.assignment-badge{padding:6px 10px;border-radius:999px;background:var(--ui-accent-soft);color:var(--ui-accent-deep);font-weight:900}.assignment-badge.required{background:var(--ui-bad-soft);color:var(--ui-bad)}.assignment-badge.done{background:var(--ui-good-soft);color:var(--ui-good)}.assignment-badge.targeted{background:var(--ui-info-soft);color:var(--ui-info)}.assignment-due{font-weight:900;color:var(--ui-muted)}.assignment-note{margin:12px 0 0;padding:14px;border-radius:10px;background:var(--ui-surface-soft);white-space:pre-wrap;line-height:1.55}.assignment-empty{padding:40px;border-radius:16px;background:var(--ui-surface);text-align:center;color:var(--ui-muted);font-weight:800}.assignment-admin-form{display:grid;grid-template-columns:1.2fr 1fr auto auto;gap:10px;align-items:center;padding:22px;margin-bottom:18px;border-radius:16px;background:var(--ui-surface)}.assignment-admin-form input,.assignment-admin-form textarea{padding:12px;border:1px solid var(--ui-line);border-radius:9px;font:inherit;box-sizing:border-box}.assignment-admin-form textarea{grid-column:1/-1}.assignment-required{display:flex;align-items:center;gap:7px;padding:10px;border-radius:9px;background:var(--ui-bad-soft);color:var(--ui-bad);font-weight:900;white-space:nowrap}.assignment-type-row,.assignment-target-row{grid-column:1/-1;display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-weight:800}.assignment-type-row label,.assignment-target-row label{display:flex;align-items:center;gap:6px;font-weight:800}.assignment-target-picker{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding:12px;border-radius:10px;background:var(--ui-surface-soft)}.assignment-target-picker label{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;background:var(--ui-surface);font-weight:700}.assignment-admin-card{display:grid;grid-template-columns:1fr auto;gap:14px}.assignment-students{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.assignment-student{display:inline-flex;align-items:baseline;gap:6px;min-width:0}.assignment-student .an-no{font-variant-numeric:tabular-nums;opacity:.62;font-size:.86em;font-weight:700}.assignment-student .an-check{font-weight:900;color:var(--ui-good)}.assignment-student.is-done .an-name{text-decoration:line-through}.assignment-student.is-done .an-no{opacity:.85}.assignment-todo{margin:13px 0 0;padding:12px 14px;border-radius:10px;background:var(--ui-surface-soft);line-height:1.7}.assignment-todo b{display:block;margin-bottom:4px;font-size:var(--ui-text-sm,13px);color:var(--ui-muted)}.assignment-todo .an-miss{display:inline-block;margin:0 8px 0 0;white-space:nowrap}.assignment-todo .an-miss .an-no{opacity:.62;font-weight:700}.assignment-bulk{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px;padding-top:13px;border-top:1px dashed var(--ui-line)}.assignment-bulk .an-hint{margin-left:auto;align-self:center;color:var(--ui-muted);font-size:var(--ui-text-sm,13px)}.assignment-archive{margin-top:18px;border-radius:14px;background:var(--ui-surface-soft);overflow:hidden}.assignment-archive summary{list-style:none;cursor:pointer;padding:16px 20px;font-weight:900;color:var(--ui-muted);display:flex;align-items:center;gap:8px;user-select:none}.assignment-archive summary::-webkit-details-marker{display:none}.assignment-archive summary::before{content:'▶';font-size:.75em;transition:transform .15s}.assignment-archive[open] summary::before{transform:rotate(90deg)}.assignment-archive summary:hover{color:var(--ui-accent-deep)}.assignment-archive .assignment-list{padding:0 16px 16px}.assignment-target-all{flex-basis:100%;border-bottom:1px dashed var(--ui-line);padding-bottom:8px;margin-bottom:2px}@media(prefers-reduced-motion:reduce){.assignment-card.soon,.assignment-card.urgent{animation:none}}@media(max-width:960px){.assignment-columns{grid-template-columns:1fr}}@media(max-width:760px){.assignment-admin-form{grid-template-columns:1fr}.assignment-admin-form textarea{grid-column:auto}.assignment-admin-card{grid-template-columns:1fr}}</style>`;}

    function studentCards(category){
        const today=todayKst();
        const myName=String(window.myName||'').trim();
        const list=rowsByCategory(category)
            .filter(([,item])=>isTargeted(item,myName))
            .map(([id,item])=>({
                id,
                item,
                done:Boolean(state.completions[id]?.[myName])
            }))
            .filter(entry=>!(entry.item.archived===true&&!entry.done));
        const card=({item,done})=>{
            const days=dayDistance(item.dueDate,today);
            const urgency=done?'':days<=0?' urgent':days<=3?' soon':'';
            const required=item.required!==false;
            const targeted=Boolean(targetList(item));
            return `<article class="assignment-card${done?' completed':''}${urgency}"><h3>${done?'✅ ':''}${esc(item.title||'제목 없음')}</h3><div class="assignment-meta"><span class="assignment-badge${required?' required':''}">${required?'필수':'선택'}</span>${done?'<span class="assignment-badge done">완료</span>':''}${targeted?'<span class="assignment-badge targeted">🎯 지정 대상</span>':''}<span class="assignment-due">${esc(dueLabel(days,item.dueDate||'-'))}</span></div><div class="assignment-note">${item.description?esc(item.description):'참고사항 없음'}</div></article>`;
        };
        const incomplete=list.filter(entry=>!entry.done);
        const completed=list.filter(entry=>entry.done);
        const noun=category==='제출자료'?'제출자료':'과제';
        const section=(title,items)=>`<section class="assignment-section"><h3 class="assignment-section-title">${title}<span class="assignment-count">${items.length}</span></h3><div class="assignment-list">${items.length?items.map(card).join(''):`<div class="assignment-empty">미완료 ${noun}가 없습니다. 🎉</div>`}</div></section>`;
        // 완료한 항목은 교사 화면의 "완료함"처럼 접어 둔다. 계속 열려 있으면 매번 탭을 열 때마다
        // 이미 끝난 과제가 다시 눈에 띄어서("완료된 과제도 애들한테 자꾸뜨네") 거슬린다.
        const archivedHtml=completed.length
            ?`<details class="assignment-archive"><summary>📦 완료함 (${completed.length}) · 완료한 ${noun}</summary><div class="assignment-list">${completed.map(card).join('')}</div></details>`
            :'';
        return section('📌 미완료',incomplete)+archivedHtml;
    }

    // 번호만 적혀 있으면 선생님이 머릿속으로 번호→이름을 옮겨야 합니다. 둘 다 적습니다.
    function studentChip(id,student,done){
        return `<button class="assignment-student chip-toggle${done?' is-done':''}" data-assignment-id="${esc(id)}" data-student-name="${esc(student.name)}" data-done="${done}" title="${esc(student.name)} ${done?'완료 취소':'완료 처리'}">${done?'<span class="an-check">✓</span>':''}<span class="an-no">${student.number}</span><span class="an-name">${esc(student.name)}</span></button>`;
    }

    function adminCard(id,item,allStudents){
        const targets=targetList(item);
        const students=targets?allStudents.filter(student=>targets.includes(student.name)):allStudents;
        const completed=state.completions[id]||{};
        const incomplete=students.filter(student=>!completed[student.name]);
        const doneCount=students.length-incomplete.length;
        const required=item.required!==false;
        const allDone=students.length>0&&incomplete.length===0;

        const missing=incomplete.length
            ?incomplete.map(student=>`<span class="an-miss"><span class="an-no">${student.number}</span> ${esc(student.name)}</span>`).join('')
            :'<span class="an-miss">전원 완료했습니다 🎉</span>';

        const chips=students.length
            ?students.map(student=>studentChip(id,student,Boolean(completed[student.name]))).join('')
            :'<span class="an-hint">대상 학생이 없습니다.</span>';

        const archivedFlag=item.archived===true;
        return{allDone,archived:archivedFlag,archivedUnset:item.archived===undefined,html:`<article class="assignment-card assignment-admin-card${allDone||archivedFlag?' completed':''}"><div><h3>${allDone?'✅ ':''}${esc(item.title||'제목 없음')} · ${required?'🔴 필수':'🔵 선택'}</h3><div class="assignment-meta"><span class="assignment-due">마감 ${esc(item.dueDate||'-')} · 완료 ${doneCount}/${students.length}명</span>${targets?`<span class="assignment-badge targeted">🎯 지정 학생 ${targets.length}명</span>`:''}</div><div class="assignment-note">${item.description?esc(item.description):'참고사항 없음'}</div><div class="assignment-todo"><b>아직 안 낸 학생 ${incomplete.length}명</b>${missing}</div><div class="assignment-students chip-group">${chips}</div><div class="assignment-bulk"><button class="btn btn--xs" data-bulk-id="${esc(id)}" data-bulk-done="true">전원 완료</button><button class="btn btn--xs btn--outline" data-bulk-id="${esc(id)}" data-bulk-done="false">전원 해제</button><span class="an-hint">이름을 눌러 한 명씩 바꿀 수 있습니다.</span></div></div><div class="row-actions">${archivedFlag?`<button class="btn btn--xs btn--primary" data-unarchive-id="${esc(id)}">📤 다시 불러들이기</button>`:`<button class="btn btn--xs" data-archive-id="${esc(id)}">📦 완료함으로</button>`}<button class="btn btn--xs" data-edit-target-id="${esc(id)}">✏️ 마감일·대상 수정</button><button class="btn btn--xs btn--danger" data-delete-id="${esc(id)}">삭제</button></div></article>`};
    }

    // 대상 학생 전원이 완료한 항목은 화면에 계속 떠 있지 않도록 "완료함"으로 접어서 모아둔다.
    // (교사 화면만 해당. 학생 화면은 이미 완료/미완료로 나뉘어 있어서 따로 손대지 않는다.)
    const autoArchiveQueued=new Set();
    function queueAutoArchive(ids){
        const fresh=ids.filter(id=>!autoArchiveQueued.has(id));
        if(!fresh.length)return;
        fresh.forEach(id=>autoArchiveQueued.add(id));
        const updates={};
        fresh.forEach(id=>{updates[`blackboard/assignments/${id}/archived`]=true;});
        db.ref().update(updates).catch(error=>{
            console.error('완료함 보관 표시 저장 오류:',error);
            fresh.forEach(id=>autoArchiveQueued.delete(id));
        });
    }

    async function setArchived(id,value){
        await db.ref(`blackboard/assignments/${id}/archived`).set(value);
    }

    function adminCards(category){
        const allStudents=roster();
        const list=rowsByCategory(category);
        const noun=category==='제출자료'?'제출자료':'과제';

        if(!list.length)return `<div class="assignment-empty">등록된 ${noun}가 없습니다.</div>`;

        const cards=list.map(([id,item])=>adminCard(id,item,allStudents));
        // 전원 완료가 되는 순간 한 번 '보관' 표시를 저장한다. 그 뒤에는 전학생이 오거나 학생이 빠져도
        // 완료함에 그대로 있고, 선생님이 "다시 불러들이기"를 누를 때만 진행 중으로 돌아온다.
        // (archived가 false로 저장돼 있으면 선생님이 일부러 꺼낸 것이라 자동으로 다시 넣지 않는다.)
        const autoIds=list.filter(([id,item],index)=>cards[index].allDone&&item.archived===undefined).map(([id])=>id);
        if(autoIds.length&&window.isAdmin===true)queueAutoArchive(autoIds);
        const active=cards.filter(c=>!c.archived&&!(c.allDone&&c.archivedUnset));
        const archived=cards.filter(c=>c.archived||(c.allDone&&c.archivedUnset));

        const activeHtml=active.length
            ?active.map(c=>c.html).join('')
            :`<div class="assignment-empty">진행 중인 ${noun}가 없습니다.</div>`;

        const archivedHtml=archived.length
            ?`<details class="assignment-archive"><summary>📦 완료함 (${archived.length}) · 전원 제출을 마친 ${noun}</summary><div class="assignment-list">${archived.map(c=>c.html).join('')}</div></details>`
            :'';

        return activeHtml+archivedHtml;
    }

    function targetPickerHtml(checkedNames){
        const students=roster();
        if(!students.length)return '<span class="an-hint">학생 명단이 없습니다.</span>';
        // 대부분 "전체에서 몇 명만 빼는" 경우라 기본은 전원 체크. 이미 대상이 정해진 과제를 열 때만 그 명단대로 체크한다.
        const checked=checkedNames instanceof Set?checkedNames:null;
        const isOn=student=>!checked||checked.has(student.name);
        const onCount=students.filter(isOn).length;
        const all=`<label class="assignment-target-all"><input type="checkbox" class="assignment-target-all-box"${onCount===students.length?' checked':''}> <b>전체 선택</b> <span class="an-hint" data-target-count>${onCount}/${students.length}명</span></label>`;
        return all+students.map(student=>`<label><input type="checkbox" class="assignment-target-student" value="${esc(student.name)}"${isOn(student)?' checked':''}><span class="an-no">${student.number}</span> ${esc(student.name)}</label>`).join('');
    }

    // 전체 선택 체크박스 ↔ 학생별 체크박스를 서로 맞춘다(등록 팝업·수정 팝업 공통).
    function syncTargetAll(picker){
        const boxes=Array.from(picker.querySelectorAll('.assignment-target-student'));
        const allBox=picker.querySelector('.assignment-target-all-box');
        if(!allBox)return;
        const on=boxes.filter(box=>box.checked).length;
        allBox.checked=boxes.length>0&&on===boxes.length;
        allBox.indeterminate=on>0&&on<boxes.length;
        const count=picker.querySelector('[data-target-count]');
        if(count)count.textContent=`${on}/${boxes.length}명`;
    }
    document.addEventListener('change',event=>{
        const picker=event.target.closest?.('.assignment-target-picker');
        if(!picker)return;
        if(event.target.classList.contains('assignment-target-all-box')){
            picker.querySelectorAll('.assignment-target-student').forEach(box=>{box.checked=event.target.checked;});
            event.target.indeterminate=false;
        }
        syncTargetAll(picker);
    });

    // 등록할 때 전체/특정 학생 중 하나로 정했어도, 나중에 "이 학생은 이미
    // 100점이라 안 해도 된다" 같은 이유로 대상을 바꾸고 싶을 수 있다.
    // 완료 기록은 건드리지 않는다 — 대상에서 빠지면 isTargeted()가 알아서
    // 걸러주므로 "미완료"로 더 이상 안 뜬다.
    // 마감일도 같은 팝업에서 고친다 — 부여한 뒤 마감일이 바뀌는 일(연장, 날짜 오타 등)이
    // 잦아서, 삭제 후 다시 등록하지 않고 그대로 고칠 수 있어야 한다.
    window.openEditTargetPopup=function(id){
        const item=state.assignments[id];
        if(!item)return;
        const targets=targetList(item);
        const mode=targets?'custom':'all';
        const h=`<div class="stack">
            <h3>✏️ "${esc(item.title||'제목 없음')}" 수정</h3>
            <label class="an-hint">마감일<br><input id="edit-assignment-due" type="date" value="${esc(item.dueDate||todayKst())}"></label>
            <div class="assignment-target-row">
                <label><input type="radio" name="edit-target-mode" value="all" ${mode==='all'?'checked':''}> 전체 학생</label>
                <label><input type="radio" name="edit-target-mode" value="custom" ${mode==='custom'?'checked':''}> 특정 학생</label>
            </div>
            <div id="edit-target-picker" class="assignment-target-picker" ${mode==='custom'?'':'hidden'}>${targetPickerHtml(targets?new Set(targets):null)}</div>
            <button onclick="saveEditTarget('${esc(id)}')" class="btn btn--primary btn--block">저장</button>
        </div>`;
        if(typeof openPopup==='function')openPopup('과제 수정',h);

        document.querySelectorAll('input[name="edit-target-mode"]').forEach(radio=>{
            radio.addEventListener('change',()=>{
                const picker=document.getElementById('edit-target-picker');
                if(picker)picker.hidden=radio.value!=='custom'||!radio.checked;
            });
        });
    };

    window.saveEditTarget=async function(id){
        const mode=document.querySelector('input[name="edit-target-mode"]:checked')?.value||'all';
        const dueDate=String(document.getElementById('edit-assignment-due')?.value||'').trim();
        if(!dueDate)return alert('마감일을 입력해 주세요.');
        const updates={[`blackboard/assignments/${id}/dueDate`]:dueDate};
        if(mode==='custom'){
            const targetStudents=Array.from(document.querySelectorAll('#edit-target-picker .assignment-target-student:checked')).map(el=>el.value);
            if(!targetStudents.length)return alert('특정 학생을 한 명 이상 선택해 주세요.');
            // 전원을 체크했다면 '전체 학생'과 같으므로 명단을 따로 저장하지 않는다(나중에 들어온 학생도 포함되도록).
            updates[`blackboard/assignments/${id}/targetStudents`]=targetStudents.length===roster().length?null:targetStudents;
        }else{
            updates[`blackboard/assignments/${id}/targetStudents`]=null;
        }
        await db.ref().update(updates);
        window.evaluateClassGoal?.();
        if(typeof closePopup==='function')closePopup();
    };

    function adminForm(){
        return `<div class="assignment-admin-form">`+
            `<input id="assignment-title" placeholder="이름 (예: 독서록 3주차 / 현장학습 동의서)">`+
            `<input id="assignment-due" type="date" value="${todayKst()}">`+
            `<label class="assignment-required"><input id="assignment-required" type="checkbox" checked> 필수</label>`+
            `<button class="btn btn--primary" data-add-assignment>부여</button>`+
            `<div class="assignment-type-row">`+
                `종류: `+
                `<label><input type="radio" name="assignment-category" value="과제" checked> 📝 과제</label>`+
                `<label><input type="radio" name="assignment-category" value="제출자료"> 📎 제출자료</label>`+
            `</div>`+
            `<div class="assignment-target-row">`+
                `대상: `+
                `<label><input type="radio" name="assignment-target-mode" value="all" checked> 전체 학생</label>`+
                `<label><input type="radio" name="assignment-target-mode" value="custom"> 특정 학생</label>`+
            `</div>`+
            `<div id="assignment-target-picker" class="assignment-target-picker" hidden>${targetPickerHtml()}</div>`+
            `<textarea id="assignment-note" rows="2" placeholder="참고사항(선택)"></textarea>`+
        `</div>`;
    }

    function render(){
        const container=document.getElementById('assignments-tab-container');
        if(!container)return;
        const admin=window.isAdmin===true;
        const columns=admin
            ?`<div class="assignment-columns"><div><div class="assignment-column-head">📝 과제</div>${adminCards('과제')}</div><div><div class="assignment-column-head">📎 제출자료</div>${adminCards('제출자료')}</div></div>`
            :`<div class="assignment-columns"><div><div class="assignment-column-head">📝 과제</div>${studentCards('과제')}</div><div><div class="assignment-column-head">📎 제출자료</div>${studentCards('제출자료')}</div></div>`;
        container.innerHTML=`${styles()}<div class="assignment-page"><header class="assignment-head"><h2>📝 과제 ${admin?'관리':'안내'}</h2><div>${admin?'과제·제출자료를 등록하고 학생 이름을 눌러 완료·취소하세요. 특정 학생만 대상으로 지정할 수도 있습니다.':'과제명, 마감일과 참고사항을 확인하세요.'}</div></header>${admin?adminForm():''}${columns}</div>`;
    }

    async function addAssignment(){
        const title=String(document.getElementById('assignment-title')?.value||'').trim();
        const dueDate=String(document.getElementById('assignment-due')?.value||'').trim();
        const description=String(document.getElementById('assignment-note')?.value||'').trim();
        const required=Boolean(document.getElementById('assignment-required')?.checked);
        if(!title||!dueDate)return alert('이름과 마감일을 입력해 주세요.');

        const category=document.querySelector('input[name="assignment-category"]:checked')?.value==='제출자료'?'제출자료':'과제';
        const targetMode=document.querySelector('input[name="assignment-target-mode"]:checked')?.value||'all';

        const payload={title,dueDate,description,required,active:true,category,createdAt:firebase.database.ServerValue.TIMESTAMP};

        if(targetMode==='custom'){
            const targetStudents=Array.from(document.querySelectorAll('.assignment-target-student:checked')).map(el=>el.value);
            if(!targetStudents.length)return alert('특정 학생을 한 명 이상 선택해 주세요.');
            if(targetStudents.length!==roster().length)payload.targetStudents=targetStudents;
        }

        await db.ref('blackboard/assignments').push(payload);
    }

    async function toggleStudent(button){const id=button.dataset.assignmentId;const name=button.dataset.studentName;const done=button.dataset.done==='true';await db.ref(`blackboard/assignmentCompletions/${id}/${name}`).set(done?null:{completedAt:firebase.database.ServerValue.TIMESTAMP,completedBy:'admin'});window.evaluateClassGoal?.();}
    // 25명을 하나씩 누르는 대신 한 번에. 한 번의 update 로 쓰고 되돌리기를 답니다.
    async function setAllStudents(id,done){
        const targets=targetList(state.assignments[id]);
        const students=targets?roster().filter(student=>targets.includes(student.name)):roster();
        if(!students.length)return;

        const before=JSON.parse(JSON.stringify(state.completions[id]||{}));
        const stamp={completedAt:firebase.database.ServerValue.TIMESTAMP,completedBy:'admin'};
        const updates={};

        students.forEach(student=>{
            updates[`${id}/${student.name}`]=done?stamp:null;
        });

        await db.ref('blackboard/assignmentCompletions').update(updates);
        window.evaluateClassGoal?.();

        const title=String(state.assignments[id]?.title||'과제');
        window.showUndoBar?.(
            `${title} · ${students.length}명 ${done?'전원 완료 처리했습니다.':'전원 해제했습니다.'}`,
            async()=>{
                await db.ref(`blackboard/assignmentCompletions/${id}`)
                    .set(Object.keys(before).length?before:null);
            }
        );
    }

    async function deleteAssignment(id){
        const item=state.assignments[id];
        if(!item)return;

        const beforeItem=JSON.parse(JSON.stringify(item));
        const beforeDone=JSON.parse(JSON.stringify(state.completions[id]||{}));

        await db.ref('blackboard').update({
            [`assignments/${id}`]:null,
            [`assignmentCompletions/${id}`]:null
        });

        window.showUndoBar?.(
            `${String(item.title||'과제')} 을(를) 삭제했습니다.`,
            async()=>{
                await db.ref('blackboard').update({
                    [`assignments/${id}`]:beforeItem,
                    [`assignmentCompletions/${id}`]:Object.keys(beforeDone).length?beforeDone:null
                });
            },
            10
        );
    }

    window.initAssignmentsTab=function(){
        const container=document.getElementById('assignments-tab-container');
        if(!container)return;
        if(!state.listening){
            state.listening=true;
            db.ref('blackboard/assignments').on('value',snapshot=>{state.assignments=snapshot.val()||{};render();});
            db.ref('blackboard/assignmentCompletions').on('value',snapshot=>{state.completions=snapshot.val()||{};render();});
            // 명단은 global.js의 공유 구독을 같이 쓴다(따로 구독하면 전송량이 구독 수만큼 늘어난다).
            window.userDirectory.subscribe(snapshot=>{state.users=snapshot.val()||{};render();});
            container.addEventListener('click',async event=>{
                if(window.isAdmin!==true)return;
                if(event.target.closest('[data-add-assignment]'))await addAssignment();
                const student=event.target.closest('[data-student-name]');
                if(student)await toggleStudent(student);
                const bulk=event.target.closest('[data-bulk-id]');
                if(bulk)await setAllStudents(bulk.dataset.bulkId,bulk.dataset.bulkDone==='true');
                const archiveBtn=event.target.closest('[data-archive-id]');
                if(archiveBtn){await setArchived(archiveBtn.dataset.archiveId,true);return;}
                const unarchiveBtn=event.target.closest('[data-unarchive-id]');
                if(unarchiveBtn){
                    if(!confirm('이 항목을 완료함에서 꺼내 진행 중으로 다시 불러들일까요?'))return;
                    await setArchived(unarchiveBtn.dataset.unarchiveId,false);
                    return;
                }
                const remove=event.target.closest('[data-delete-id]');
                if(remove)await deleteAssignment(remove.dataset.deleteId);
                const editTarget=event.target.closest('[data-edit-target-id]');
                if(editTarget)window.openEditTargetPopup(editTarget.dataset.editTargetId);
            });
            container.addEventListener('change',event=>{
                if(window.isAdmin!==true)return;
                if(event.target.name==='assignment-target-mode'){
                    const picker=document.getElementById('assignment-target-picker');
                    if(picker)picker.hidden=event.target.value!=='custom';
                }
            });
        }
        render();
    };
})();
