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
    window.assignmentsItemCategory=itemCategory;

    function styles(){return `<style>@keyframes assignmentNudge{0%,100%{border-color:var(--ui-warn)}50%{border-color:var(--ui-warn-line)}}@keyframes assignmentUrgent{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ui-bad) 15%,transparent)}50%{box-shadow:0 0 0 10px color-mix(in srgb,var(--ui-bad) 8%,transparent)}}.assignment-page{max-width:1300px;margin:auto;font-family:var(--ui-font-body);text-align:left}.assignment-head{padding:28px;border-radius:18px;background:linear-gradient(135deg,var(--ui-accent),var(--ui-accent-deep));color:var(--ui-on-accent);margin-bottom:18px;text-align:center}.assignment-head h2{margin:0 0 8px;font-family:var(--ui-font-display)}.assignment-columns{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}.assignment-column-head{display:flex;align-items:center;gap:8px;margin:0 0 14px;padding:14px 18px;border-radius:14px;background:var(--ui-surface);font-weight:900;font-size:1.05em}.assignment-list{display:grid;gap:14px}.assignment-section{display:grid;gap:14px;margin-top:20px}.assignment-section-title{display:flex;align-items:center;justify-content:space-between;margin:0;padding:16px 20px;border-radius:14px;background:var(--ui-warn-soft);color:var(--ui-warn)}.assignment-section.completed .assignment-section-title{background:var(--ui-good-soft);color:var(--ui-good)}.assignment-count{display:inline-grid;place-items:center;min-width:34px;height:34px;padding:0 8px;border-radius:999px;background:var(--ui-surface);font-size:var(--ui-text-size)}.assignment-card{padding:22px;border-radius:16px;background:var(--ui-surface);border:2px solid var(--ui-line)}.assignment-card.completed{border-color:var(--ui-good-line);background:var(--ui-good-soft);color:#f7fff9;opacity:1}.assignment-card.completed h3{color:#fff}.assignment-card.completed .assignment-due{color:#d8f5e4}.assignment-card.completed .assignment-note{background:var(--ui-surface);color:var(--ui-text)}.assignment-card.soon{border-color:var(--ui-warn);background:var(--ui-warn-soft);animation:assignmentNudge 2.3s ease-in-out infinite}.assignment-card.urgent{border-color:var(--ui-bad);background:var(--ui-bad-soft);animation:assignmentUrgent 1.25s ease-in-out infinite}.assignment-card h3{margin:0 0 8px}.assignment-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.assignment-badge{padding:6px 10px;border-radius:999px;background:var(--ui-accent-soft);color:var(--ui-accent-deep);font-weight:900}.assignment-badge.required{background:var(--ui-bad-soft);color:var(--ui-bad)}.assignment-badge.done{background:var(--ui-good-soft);color:var(--ui-good)}.assignment-badge.targeted{background:var(--ui-info-soft);color:var(--ui-info)}.assignment-due{font-weight:900;color:var(--ui-muted)}.assignment-note{margin:12px 0 0;padding:14px;border-radius:10px;background:var(--ui-surface-soft);white-space:pre-wrap;line-height:1.55}.assignment-empty{padding:40px;border-radius:16px;background:var(--ui-surface);text-align:center;color:var(--ui-muted);font-weight:800}.assignment-admin-form{display:grid;grid-template-columns:1.2fr 1fr auto auto;gap:10px;align-items:center;padding:22px;margin-bottom:18px;border-radius:16px;background:var(--ui-surface)}.assignment-admin-form input,.assignment-admin-form textarea{padding:12px;border:1px solid var(--ui-line);border-radius:9px;font:inherit;box-sizing:border-box}.assignment-admin-form textarea{grid-column:1/-1}.assignment-required{display:flex;align-items:center;gap:7px;padding:10px;border-radius:9px;background:var(--ui-bad-soft);color:var(--ui-bad);font-weight:900;white-space:nowrap}.assignment-type-row,.assignment-target-row{grid-column:1/-1;display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-weight:800}.assignment-type-row label,.assignment-target-row label{display:flex;align-items:center;gap:6px;font-weight:800}.assignment-target-picker{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding:12px;border-radius:10px;background:var(--ui-surface-soft)}.assignment-target-picker label{display:flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;background:var(--ui-surface);font-weight:700}.assignment-admin-card{display:grid;grid-template-columns:1fr auto;gap:14px}.assignment-students{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.assignment-student{display:inline-flex;align-items:baseline;gap:6px;min-width:0}.assignment-student .an-no{font-variant-numeric:tabular-nums;opacity:.62;font-size:.86em;font-weight:700}.assignment-student .an-check{font-weight:900;color:var(--ui-good)}.assignment-student.is-done .an-name{text-decoration:line-through}.assignment-student.is-done .an-no{opacity:.85}.assignment-todo{margin:13px 0 0;padding:12px 14px;border-radius:10px;background:var(--ui-surface-soft);line-height:1.7}.assignment-todo b{display:block;margin-bottom:4px;font-size:var(--ui-text-sm,13px);color:var(--ui-muted)}.assignment-todo .an-miss{display:inline-block;margin:0 8px 0 0;white-space:nowrap}.assignment-todo .an-miss .an-no{opacity:.62;font-weight:700}.assignment-bulk{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px;padding-top:13px;border-top:1px dashed var(--ui-line)}.assignment-bulk .an-hint{margin-left:auto;align-self:center;color:var(--ui-muted);font-size:var(--ui-text-sm,13px)}@media(prefers-reduced-motion:reduce){.assignment-card.soon,.assignment-card.urgent{animation:none}}@media(max-width:960px){.assignment-columns{grid-template-columns:1fr}}@media(max-width:760px){.assignment-admin-form{grid-template-columns:1fr}.assignment-admin-form textarea{grid-column:auto}.assignment-admin-card{grid-template-columns:1fr}}</style>`;}

    function studentCards(category){
        const today=todayKst();
        const myName=String(window.myName||'').trim();
        const list=rowsByCategory(category)
            .filter(([,item])=>isTargeted(item,myName))
            .map(([id,item])=>({
                id,
                item,
                done:Boolean(state.completions[id]?.[myName])
            }));
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
        const section=(title,items,completedSection)=>`<section class="assignment-section${completedSection?' completed':''}"><h3 class="assignment-section-title">${title}<span class="assignment-count">${items.length}</span></h3><div class="assignment-list">${items.length?items.map(card).join(''):`<div class="assignment-empty">${completedSection?`아직 완료한 ${noun}가 없습니다.`:`미완료 ${noun}가 없습니다. 🎉`}</div>`}</div></section>`;
        return section('📌 미완료',incomplete,false)+section('✅ 완료',completed,true);
    }

    // 번호만 적혀 있으면 선생님이 머릿속으로 번호→이름을 옮겨야 합니다. 둘 다 적습니다.
    function studentChip(id,student,done){
        return `<button class="assignment-student chip-toggle${done?' is-done':''}" data-assignment-id="${esc(id)}" data-student-name="${esc(student.name)}" data-done="${done}" title="${esc(student.name)} ${done?'완료 취소':'완료 처리'}">${done?'<span class="an-check">✓</span>':''}<span class="an-no">${student.number}</span><span class="an-name">${esc(student.name)}</span></button>`;
    }

    function adminCards(category){
        const allStudents=roster();
        const list=rowsByCategory(category);
        const noun=category==='제출자료'?'제출자료':'과제';

        if(!list.length)return `<div class="assignment-empty">등록된 ${noun}가 없습니다.</div>`;

        return list.map(([id,item])=>{
            const targets=targetList(item);
            const students=targets?allStudents.filter(student=>targets.includes(student.name)):allStudents;
            const completed=state.completions[id]||{};
            const incomplete=students.filter(student=>!completed[student.name]);
            const doneCount=students.length-incomplete.length;
            const required=item.required!==false;

            const missing=incomplete.length
                ?incomplete.map(student=>`<span class="an-miss"><span class="an-no">${student.number}</span> ${esc(student.name)}</span>`).join('')
                :'<span class="an-miss">전원 완료했습니다 🎉</span>';

            const chips=students.length
                ?students.map(student=>studentChip(id,student,Boolean(completed[student.name]))).join('')
                :'<span class="an-hint">대상 학생이 없습니다.</span>';

            return `<article class="assignment-card assignment-admin-card"><div><h3>${esc(item.title||'제목 없음')} · ${required?'🔴 필수':'🔵 선택'}</h3><div class="assignment-meta"><span class="assignment-due">마감 ${esc(item.dueDate||'-')} · 완료 ${doneCount}/${students.length}명</span>${targets?`<span class="assignment-badge targeted">🎯 지정 학생 ${targets.length}명</span>`:''}</div><div class="assignment-note">${item.description?esc(item.description):'참고사항 없음'}</div><div class="assignment-todo"><b>아직 안 낸 학생 ${incomplete.length}명</b>${missing}</div><div class="assignment-students chip-group">${chips}</div><div class="assignment-bulk"><button class="btn btn--xs" data-bulk-id="${esc(id)}" data-bulk-done="true">전원 완료</button><button class="btn btn--xs btn--outline" data-bulk-id="${esc(id)}" data-bulk-done="false">전원 해제</button><span class="an-hint">이름을 눌러 한 명씩 바꿀 수 있습니다.</span></div></div><div class="row-actions"><button class="btn btn--xs btn--danger" data-delete-id="${esc(id)}">삭제</button></div></article>`;
        }).join('');
    }

    function targetPickerHtml(){
        const students=roster();
        if(!students.length)return '<span class="an-hint">학생 명단이 없습니다.</span>';
        return students.map(student=>`<label><input type="checkbox" class="assignment-target-student" value="${esc(student.name)}"><span class="an-no">${student.number}</span> ${esc(student.name)}</label>`).join('');
    }

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
            payload.targetStudents=targetStudents;
        }

        await db.ref('blackboard/assignments').push(payload);
    }

    async function toggleStudent(button){const id=button.dataset.assignmentId;const name=button.dataset.studentName;const done=button.dataset.done==='true';await db.ref(`blackboard/assignmentCompletions/${id}/${name}`).set(done?null:{completedAt:firebase.database.ServerValue.TIMESTAMP,completedBy:'admin'});}
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
            db.ref(window.isAdmin===true?'users':'publicProfiles').on('value',snapshot=>{state.users=snapshot.val()||{};render();});
            container.addEventListener('click',async event=>{
                if(window.isAdmin!==true)return;
                if(event.target.closest('[data-add-assignment]'))await addAssignment();
                const student=event.target.closest('[data-student-name]');
                if(student)await toggleStudent(student);
                const bulk=event.target.closest('[data-bulk-id]');
                if(bulk)await setAllStudents(bulk.dataset.bulkId,bulk.dataset.bulkDone==='true');
                const remove=event.target.closest('[data-delete-id]');
                if(remove)await deleteAssignment(remove.dataset.deleteId);
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
