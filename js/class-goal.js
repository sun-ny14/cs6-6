// js/class-goal.js - 학급 공동 목표: 조건 자동/수동 판정, 진행도 계산, 홈 위젯, 축하 연출
(function(){
    'use strict';
    const GOAL_PATH = 'classGoal';

    function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
    function isAdmin(){return window.isAdmin===true;}
    // 서버가 아니라 브라우저 로컬 시각 기준이므로, 자정 근처 오차는 무시할 만큼만 쓴다
    // (조건 판정은 매번 다시 계산되므로 하루 이틀 뒤에도 스스로 맞춰진다).
    function kstDateOffset(days){return new Date(Date.now()+9*3600000+days*86400000).toISOString().slice(0,10);}

    function roster(usersObj){
        return Object.entries(usersObj||{})
            .map(([key,user])=>String(user?.name||key||'').trim())
            .filter(name=>name && name!=='총사령관' && !name.includes('선생님'));
    }

    function goalProgress(goal){
        const conditions=goal&&goal.conditions||{};
        return Object.values(conditions).reduce((sum,c)=>sum+(c&&c.achieved===true?(Number(c.points)||0):0),0);
    }
    window.classGoalProgress=goalProgress;

    // ---------------------------------------------------------
    // 관리자: 자동 조건 판정 (과제/청소 데이터로 achieved 갱신)
    // 과제 완료 처리, 청소 완료 처리 직후 호출된다. 실패해도 화면 흐름을
    // 막지 않도록 내부에서 오류를 모두 잡는다.
    // ---------------------------------------------------------
    window.evaluateClassGoal = async function(){
        if(!isAdmin())return;
        try{
            const goalSnap=await db.ref(GOAL_PATH).once('value');
            const goal=goalSnap.val();
            if(!goal||goal.active===false)return;
            const conditionEntries=Object.entries(goal.conditions||{});
            if(!conditionEntries.length){await refreshCelebration();return;}

            const needsAssignments=conditionEntries.some(([,c])=>c&&(c.type==='assignment_full'||c.type==='assignment_partial'));
            const needsCleaning=conditionEntries.some(([,c])=>c&&c.type==='cleaning_streak');
            const updates={};

            if(needsAssignments){
                const [usersSnap,assignmentsSnap,completionsSnap]=await Promise.all([
                    db.ref('users').once('value'),
                    db.ref('blackboard/assignments').once('value'),
                    db.ref('blackboard/assignmentCompletions').once('value')
                ]);
                const students=roster(usersSnap.val());
                const assignments=assignmentsSnap.val()||{};
                const completions=completionsSnap.val()||{};

                conditionEntries.forEach(([key,cond])=>{
                    if(!cond||(cond.type!=='assignment_full'&&cond.type!=='assignment_partial'))return;
                    const assignment=assignments[cond.assignmentId];
                    if(!assignment)return;
                    const targets=Array.isArray(assignment.targetStudents)&&assignment.targetStudents.length
                        ?assignment.targetStudents.filter(Boolean)
                        :students;
                    if(!targets.length)return;
                    const dueEndMs=Date.parse(`${assignment.dueDate}T23:59:59+09:00`);
                    const perAssignment=completions[cond.assignmentId]||{};
                    const missing=targets.filter(name=>{
                        const completedAt=Number(perAssignment[name]?.completedAt);
                        return !Number.isFinite(completedAt)||completedAt>dueEndMs;
                    }).length;
                    const achieved=cond.type==='assignment_full'
                        ?missing===0
                        :missing<=(Number(cond.allowedMiss)||0);
                    if(achieved!==(cond.achieved===true)){
                        updates[`${GOAL_PATH}/conditions/${key}/achieved`]=achieved;
                    }
                });
            }

            if(needsCleaning){
                const settingsSnap=await db.ref('cleaningSettings').once('value');
                const assignmentsMap=(settingsSnap.val()||{}).cleaningAssignments||{};
                const cleaners=Object.keys(assignmentsMap).filter(name=>assignmentsMap[name]===true);
                const streakEntries=conditionEntries.filter(([,c])=>c&&c.type==='cleaning_streak');
                if(cleaners.length&&streakEntries.length){
                    const maxDays=Math.max(...streakEntries.map(([,c])=>Number(c.days)||7));
                    const dates=[];
                    for(let i=0;i<maxDays;i++)dates.push(kstDateOffset(-i));
                    const statusSnaps=await Promise.all(dates.map(date=>db.ref(`classManagement/cleaningStatus/${date}`).once('value')));
                    const statusByDate={};
                    dates.forEach((date,i)=>{statusByDate[date]=statusSnaps[i].val()||{};});

                    streakEntries.forEach(([key,cond])=>{
                        const days=Number(cond.days)||7;
                        const relevantDates=dates.slice(0,days);
                        const achieved=relevantDates.every(date=>
                            cleaners.every(name=>statusByDate[date]?.[name]?.cleanDone===true)
                        );
                        if(achieved!==(cond.achieved===true)){
                            updates[`${GOAL_PATH}/conditions/${key}/achieved`]=achieved;
                        }
                    });
                }
            }

            if(Object.keys(updates).length)await db.ref().update(updates);
            await refreshCelebration();
        }catch(error){
            console.error('공동 목표 자동 판정 오류:',error);
        }
    };

    async function refreshCelebration(){
        const snap=await db.ref(GOAL_PATH).once('value');
        const goal=snap.val();
        if(!goal)return;
        const current=goalProgress(goal);
        const target=Number(goal.target)||0;
        if(target>0&&current>=target&&goal.celebrated!==true){
            await db.ref(`${GOAL_PATH}/celebrated`).set(true);
        }
    }

    // ---------------------------------------------------------
    // 관리자: 목표/조건 CRUD. RTDB 규칙이 classGoal 쓰기를 교사 계정으로만
    // 제한하므로 shop/blackboard 관리 기능과 같은 방식으로 클라이언트에서 직접 쓴다.
    // ---------------------------------------------------------
    window.saveClassGoalBasics=async function(){
        if(!isAdmin())return;
        const title=String(document.getElementById('goal-admin-title')?.value||'').trim();
        const target=parseInt(document.getElementById('goal-admin-target')?.value,10);
        if(!title||!Number.isFinite(target)||target<=0){
            alert('목표 이름과 1 이상의 목표 달성도를 입력해 주세요.');
            return;
        }
        const snap=await db.ref(GOAL_PATH).once('value');
        const existing=snap.val();
        await db.ref(GOAL_PATH).update({
            title,target,active:true,
            conditions:existing?.conditions||{},
            celebrated:existing?.celebrated===true
        });
        alert('✅ 공동 목표를 저장했습니다.');
    };

    window.resetClassGoal=async function(){
        if(!isAdmin())return;
        if(!confirm('공동 목표와 모든 조건을 삭제하고 처음부터 다시 만드시겠습니까?'))return;
        await db.ref(GOAL_PATH).remove();
    };

    window.openClassGoalConditionPopup=async function(key){
        if(!isAdmin())return;
        const goal=window.classGoalData||{};
        const cond=key?(goal.conditions||{})[key]:null;
        const assignmentsSnap=await db.ref('blackboard/assignments').once('value');
        const assignments=assignmentsSnap.val()||{};
        const assignmentOptions=Object.entries(assignments)
            .filter(([,item])=>item&&item.active!==false)
            .map(([id,item])=>`<option value="${esc(id)}" ${cond&&cond.assignmentId===id?'selected':''}>${esc(item.title||'(제목 없음)')}</option>`)
            .join('');

        const type=cond?.type||'assignment_full';
        const h=`<div class="stack">
            <h3>${key?'조건 수정':'조건 추가'}</h3>
            <div class="field">
                <label class="field-label">조건 유형</label>
                <select id="goal-cond-type" ${key?'disabled':''}>
                    <option value="assignment_full" ${type==='assignment_full'?'selected':''}>과제 기한 내 전원 제출</option>
                    <option value="assignment_partial" ${type==='assignment_partial'?'selected':''}>과제 기한 내 제출 (일부 예외 허용)</option>
                    <option value="cleaning_streak" ${type==='cleaning_streak'?'selected':''}>기간 내 청소 무결석</option>
                    <option value="manual" ${type==='manual'?'selected':''}>직접 입력 (수동 체크)</option>
                </select>
            </div>
            <div class="field" data-goal-field="assignmentId" style="${type==='assignment_full'||type==='assignment_partial'?'':'display:none'}">
                <label class="field-label">대상 과제</label>
                <select id="goal-cond-assignment">${assignmentOptions||'<option value="">등록된 과제가 없습니다</option>'}</select>
            </div>
            <div class="field" data-goal-field="allowedMiss" style="${type==='assignment_partial'?'':'display:none'}">
                <label class="field-label">허용 미제출 인원</label>
                <input type="number" id="goal-cond-allowed-miss" value="${cond?.allowedMiss??2}">
            </div>
            <div class="field" data-goal-field="days" style="${type==='cleaning_streak'?'':'display:none'}">
                <label class="field-label">기간 (일)</label>
                <input type="number" id="goal-cond-days" value="${cond?.days??7}">
            </div>
            <div class="field" data-goal-field="desc" style="${type==='manual'?'':'display:none'}">
                <label class="field-label">조건 설명</label>
                <input type="text" id="goal-cond-desc" value="${esc(cond?.desc||'')}">
            </div>
            <div class="field">
                <label class="field-label">부여 달성도</label>
                <input type="number" id="goal-cond-points" value="${cond?.points??1}">
            </div>
            <button onclick="saveClassGoalCondition(${key?`'${esc(key)}'`:'null'})" class="btn btn--primary btn--block">저장</button>
        </div>`;
        if(typeof openPopup==='function')openPopup(key?'조건 수정':'조건 추가',h);

        const typeSelect=document.getElementById('goal-cond-type');
        typeSelect?.addEventListener('change',()=>{
            const value=typeSelect.value;
            document.querySelectorAll('[data-goal-field]').forEach(field=>{
                const name=field.dataset.goalField;
                const show=(name==='assignmentId'&&(value==='assignment_full'||value==='assignment_partial'))
                    ||(name==='allowedMiss'&&value==='assignment_partial')
                    ||(name==='days'&&value==='cleaning_streak')
                    ||(name==='desc'&&value==='manual');
                field.style.display=show?'':'none';
            });
        });
    };

    window.saveClassGoalCondition=async function(key){
        if(!isAdmin())return;
        const type=document.getElementById('goal-cond-type')?.value;
        const points=parseInt(document.getElementById('goal-cond-points')?.value,10);
        if(!Number.isFinite(points)||points<=0){alert('부여 달성도는 1 이상이어야 합니다.');return;}

        const cond={type,points,achieved:false};
        if(type==='assignment_full'||type==='assignment_partial'){
            const select=document.getElementById('goal-cond-assignment');
            const assignmentId=select?.value;
            if(!assignmentId){alert('대상 과제를 선택해 주세요.');return;}
            const assignmentTitle=select.options[select.selectedIndex]?.textContent||'';
            cond.assignmentId=assignmentId;
            if(type==='assignment_partial'){
                cond.allowedMiss=parseInt(document.getElementById('goal-cond-allowed-miss')?.value,10)||0;
                cond.desc=`${assignmentTitle} · 기한 내 제출 (최대 ${cond.allowedMiss}명 예외)`;
            }else{
                cond.desc=`${assignmentTitle} · 기한 내 전체 제출`;
            }
        }else if(type==='cleaning_streak'){
            cond.days=parseInt(document.getElementById('goal-cond-days')?.value,10)||7;
            cond.desc=`${cond.days}일간 청소 무결석`;
        }else if(type==='manual'){
            const desc=String(document.getElementById('goal-cond-desc')?.value||'').trim();
            if(!desc){alert('조건 설명을 입력해 주세요.');return;}
            cond.desc=desc;
        }

        const existing=key?(window.classGoalData?.conditions||{})[key]:null;
        const finalKey=key||db.ref(`${GOAL_PATH}/conditions`).push().key;
        if(existing)cond.achieved=existing.achieved===true;

        await db.ref(`${GOAL_PATH}/conditions/${finalKey}`).set(cond);
        if(typeof closePopup==='function')closePopup();
        if(type!=='manual')window.evaluateClassGoal();
    };

    window.deleteClassGoalCondition=async function(key){
        if(!isAdmin())return;
        if(!confirm('이 조건을 삭제하시겠습니까? 이미 달성한 조건이면 진행도에서도 빠집니다.'))return;
        await db.ref(`${GOAL_PATH}/conditions/${key}`).remove();
        await refreshCelebration();
    };

    window.toggleManualClassGoalCondition=async function(key){
        if(!isAdmin())return;
        const cond=(window.classGoalData?.conditions||{})[key];
        if(!cond||cond.type!=='manual')return;
        await db.ref(`${GOAL_PATH}/conditions/${key}/achieved`).set(cond.achieved!==true);
        await refreshCelebration();
    };

    // ---------------------------------------------------------
    // 관리자용 패널 렌더 (설정 탭)
    // ---------------------------------------------------------
    function renderAdminPanel(){
        const container=document.getElementById('class-goal-admin-panel');
        if(!container||!isAdmin())return;
        const goal=window.classGoalData;

        if(!goal){
            container.innerHTML=`<div class="stack">
                <p class="tiny muted">아직 공동 목표가 없어요. 만들어보세요!</p>
                <div class="field"><label class="field-label">목표 이름 (보상)</label><input type="text" id="goal-admin-title" placeholder="예: 🍪 과자 파티"></div>
                <div class="field"><label class="field-label">목표 달성도</label><input type="number" id="goal-admin-target" value="10"></div>
                <button onclick="saveClassGoalBasics()" class="btn btn--primary btn--block">공동 목표 만들기</button>
            </div>`;
            return;
        }

        const conditions=Object.entries(goal.conditions||{});
        const current=goalProgress(goal);
        const rows=conditions.map(([key,cond])=>{
            const typeBadge=cond.type==='manual'?'<span class="badge badge--bad">수동</span>':'<span class="badge">자동</span>';
            const statusHtml=cond.type==='manual'
                ?`<button onclick="toggleManualClassGoalCondition('${esc(key)}')" class="btn btn--xs ${cond.achieved?'btn--primary':''}">${cond.achieved?'달성 취소':'달성 처리'}</button>`
                :(cond.achieved?'<span class="badge badge--gold">달성완료</span>':'<span class="tiny muted">대기 중</span>');
            return `<div class="goal-admin-row">
                ${typeBadge}
                <span style="flex:1;">${esc(cond.desc)} → <b>+${esc(cond.points)}</b></span>
                ${statusHtml}
                <div class="goal-admin-actions">
                    <button onclick="openClassGoalConditionPopup('${esc(key)}')" class="btn btn--xs">✏️ 수정</button>
                    <button onclick="deleteClassGoalCondition('${esc(key)}')" class="btn btn--xs btn--danger">삭제</button>
                </div>
            </div>`;
        }).join('')||'<p class="tiny muted">등록된 조건이 없습니다.</p>';

        container.innerHTML=`<div class="stack">
            <p class="tiny muted">조건을 수정/삭제해도 진행도는 항상 "달성된 조건들의 합"으로 자동 재계산돼요.</p>
            <div class="field"><label class="field-label">목표 이름 (보상)</label><input type="text" id="goal-admin-title" value="${esc(goal.title||'')}"></div>
            <div class="field"><label class="field-label">목표 달성도 (현재 ${current})</label><input type="number" id="goal-admin-target" value="${esc(goal.target||0)}"></div>
            <button onclick="saveClassGoalBasics()" class="btn btn--outline btn--block">목표 정보 저장</button>
            <h4 style="margin:14px 0 4px;">달성 조건 목록</h4>
            ${rows}
            <button onclick="openClassGoalConditionPopup(null)" class="btn btn--outline btn--block">+ 조건 추가</button>
            <button onclick="resetClassGoal()" class="btn btn--danger btn--block" style="margin-top:10px;">🗑️ 공동 목표 초기화</button>
        </div>`;
    }
    // auth.js의 관리자 판정이 비동기라 이 모듈의 onAuthStateChanged 콜백이
    // window.isAdmin이 확정되기 전에 먼저 실행될 수 있다. 그래서 admin 여부가
    // 정해진 직후 auth.js에서 이 함수를 다시 호출해 패널을 그릴 수 있게 노출한다.
    window.renderClassGoalAdminPanel=renderAdminPanel;

    // ---------------------------------------------------------
    // 홈 위젯 (학생·교사 공통 표시) + 달성 축하 연출
    // ---------------------------------------------------------
    function ensureCelebrateOverlay(){
        let overlay=document.getElementById('class-goal-celebrate-overlay');
        if(overlay)return overlay;
        const style=document.createElement('style');
        style.textContent=`
            #class-goal-celebrate-overlay{position:fixed;inset:0;z-index:999998;display:flex;align-items:center;justify-content:center;background:rgba(10,16,28,.78);backdrop-filter:blur(3px);}
            #class-goal-celebrate-overlay[hidden]{display:none;}
            #class-goal-celebrate-overlay .cgc-card{position:relative;width:min(420px,90vw);padding:48px 32px 40px;text-align:center;background:linear-gradient(160deg,#1c2440,#0e1428);border:2px solid var(--ui-gold,#d4af37);border-radius:24px;box-shadow:0 0 60px rgba(212,175,55,.35),0 20px 50px rgba(0,0,0,.5);overflow:hidden;}
            #class-goal-celebrate-overlay .cgc-icon{font-size:4rem;margin-bottom:12px;animation:cgcBounce 1s ease infinite;}
            @keyframes cgcBounce{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
            #class-goal-celebrate-overlay .cgc-title{font-family:var(--ui-font-display);font-size:1.6rem;font-weight:900;color:#fff;margin:0 0 6px;}
            #class-goal-celebrate-overlay .cgc-sub{color:#d4af37;font-weight:800;font-size:1.1rem;margin:0 0 20px;}
            #class-goal-celebrate-overlay .cgc-close{padding:10px 28px;border:0;border-radius:999px;background:var(--ui-gold,#d4af37);color:#1c1400;font-weight:800;cursor:pointer;}
            .cgc-piece{position:absolute;top:-20px;width:8px;height:14px;opacity:.9;animation:cgcFall linear infinite;}
            @keyframes cgcFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1;}100%{transform:translateY(420px) rotate(540deg);opacity:0;}}
        `;
        document.head.appendChild(style);
        overlay=document.createElement('div');
        overlay.id='class-goal-celebrate-overlay';
        overlay.hidden=true;
        overlay.innerHTML=`<div class="cgc-card" id="cgc-card">
            <div class="cgc-icon">🎉</div>
            <p class="cgc-title">공동 목표 달성!</p>
            <p class="cgc-sub" id="cgc-goal-title"></p>
            <p class="tiny" style="color:#9aa4c2;margin-bottom:20px;">우리 반 모두가 힘을 합쳤어요!</p>
            <button class="cgc-close" id="cgc-close-btn">확인했어요 ✨</button>
        </div>`;
        document.body.appendChild(overlay);
        document.getElementById('cgc-close-btn').onclick=()=>{overlay.hidden=true;};
        return overlay;
    }

    function showCelebration(title){
        const overlay=ensureCelebrateOverlay();
        document.getElementById('cgc-goal-title').textContent=title||'';
        const card=document.getElementById('cgc-card');
        card.querySelectorAll('.cgc-piece').forEach(el=>el.remove());
        const colors=['#d4af37','#ff6b6b','#4dd4a0','#6b8cff','#ffb347','#ff8ed4'];
        for(let i=0;i<60;i++){
            const piece=document.createElement('div');
            piece.className='cgc-piece';
            piece.style.left=Math.random()*100+'%';
            piece.style.background=colors[i%colors.length];
            piece.style.animationDuration=(1.8+Math.random()*1.5)+'s';
            piece.style.animationDelay=(Math.random()*1.2)+'s';
            card.appendChild(piece);
        }
        overlay.hidden=false;
    }

    // 목표(제목)별로 한 번만 뜨도록 이 브라우저에 표시 여부를 남긴다.
    function maybeCelebrate(goal){
        if(!goal||goal.celebrated!==true)return;
        const seenKey=`classGoalSeen_${goal.title||''}`;
        try{
            if(localStorage.getItem(seenKey)==='1')return;
            localStorage.setItem(seenKey,'1');
        }catch(error){return;}
        showCelebration(goal.title);
    }

    function renderHomeWidget(){
        const container=document.getElementById('home-goal-widget');
        const section=document.getElementById('home-goal-card');
        if(!container||!section)return;
        const goal=window.classGoalData;
        if(!goal||goal.active===false){
            section.hidden=true;
            return;
        }
        section.hidden=false;
        const current=goalProgress(goal);
        const target=Number(goal.target)||1;
        const pct=Math.max(0,Math.min(100,Math.round(current/target*100)));
        const conditions=Object.values(goal.conditions||{});
        const rows=conditions.map(cond=>{
            const done=cond.achieved===true;
            return `<div class="goal-cond${done?' is-done':''}">
                <span class="goal-cond-check">${done?'✓':''}</span>
                <span class="goal-cond-desc">${esc(cond.desc)}</span>
                <span class="goal-cond-pts">+${esc(cond.points)}</span>
            </div>`;
        }).join('')||'<p class="tiny muted">등록된 조건이 없습니다.</p>';

        container.innerHTML=`
            <div class="goal-progress-row">
                <span class="goal-progress-title">${esc(goal.title||'')}</span>
                <span class="goal-progress-count">${current} / ${target}</span>
            </div>
            <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
            <div class="goal-cond-list">${rows}</div>
        `;
    }

    // ---------------------------------------------------------
    // 실시간 리스너
    // ---------------------------------------------------------
    let stopListener=()=>{};
    auth.onAuthStateChanged(user=>{
        stopListener();
        window.classGoalData=null;
        if(!user)return;
        const ref=db.ref(GOAL_PATH);
        const handler=snapshot=>{
            window.classGoalData=snapshot.val();
            renderHomeWidget();
            maybeCelebrate(window.classGoalData);
            renderAdminPanel();
        };
        ref.on('value',handler,error=>console.error('공동 목표 로딩 오류:',error));
        stopListener=()=>ref.off('value',handler);
    });
})();
