// js/daily-briefing.js
// 홈(용사들) 탭에 들어갈 때 뜨는 "아 맞다!" 브리핑 팝업.
// - 학생: 본인이 대상인 미완료 과제·제출자료를 매번(탭 재진입마다) 안내.
// - 교사: 오늘의 공지 + 일정 + 과제/제출자료 진행 현황을 하루 1번만 안내.
//
// 학생/교사 분기는 window.isAdmin(서버 세션 검증 값)으로만 갈라서 섞이지
// 않는다. 교사 전용 데이터(teacherAlerts)는 교사 분기 안에서만 읽고,
// 그마저도 database.rules.json에서 교사 이메일만 읽을 수 있게 막혀 있어
// 학생 쪽 경로로는 애초에 도달·조회가 불가능하다.
(function(){
    'use strict';

    const state={assignments:{},completions:{},listening:false};

    function esc(value){
        return String(value==null?'':value)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function todayKst(){
        return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    }

    function ensureListening(){
        if(state.listening)return;
        state.listening=true;
        db.ref('blackboard/assignments').on('value',snapshot=>{state.assignments=snapshot.val()||{};});
        db.ref('blackboard/assignmentCompletions').on('value',snapshot=>{state.completions=snapshot.val()||{};});
    }

    function activeRows(){
        return Object.entries(state.assignments||{}).filter(([,item])=>item&&item.active!==false);
    }

    function popupStyle(){
        return `<style>.briefing-list{display:grid;gap:10px;text-align:left;margin-top:10px}.briefing-item{display:flex;align-items:baseline;gap:8px;padding:12px 14px;border-radius:10px;background:var(--ui-surface-soft)}.briefing-item b{flex:1}.briefing-item small{color:var(--ui-muted);white-space:nowrap}.briefing-section{margin-top:16px;text-align:left}.briefing-section h4{margin:0 0 8px}.briefing-empty{color:var(--ui-muted);text-align:left;margin-top:10px}.briefing-more{color:var(--ui-muted);text-align:left;margin-top:6px;font-size:.92em}.briefing-checkable{cursor:pointer;align-items:center}.briefing-checkable input{width:18px;height:18px;flex:none;cursor:pointer}.briefing-checkable:has(input:checked){background:var(--ui-good-soft);opacity:.7}</style>`;
    }

    window.briefingPopupStyle=popupStyle;

    // 교사가 다 읽지도 않고 그냥 닫아버리는 경우가 있어서, 체크박스를 전부
    // 체크해야만 "확인 (닫기)" 버튼이 눌리게 막는다. 이 버튼은 앱 전체가 같이
    // 쓰는 공용 버튼이라, 다른 팝업이 열릴 때는 반드시 원래 상태로 되돌려야 한다.
    const CLOSE_BTN_DEFAULT_TEXT='확인 (닫기)';
    function gateCloseUntilAllChecked(popupTitle){
        const closeBtn=document.getElementById('pop-close-btn');
        const checkboxes=Array.from(document.querySelectorAll('#pop-content .briefing-check'));
        if(!closeBtn||!checkboxes.length)return;

        function update(){
            const remaining=checkboxes.filter(cb=>!cb.checked).length;
            closeBtn.disabled=remaining>0;
            closeBtn.textContent=remaining>0
                ?`모두 확인하면 닫을 수 있어요 (${remaining}개 남음)`
                :'확인했어요';
        }
        checkboxes.forEach(cb=>cb.addEventListener('change',update));
        update();
    }

    // 공용 닫기 버튼은 모든 팝업이 같이 쓴다. 팝업이 새로 열릴 때마다 원래 상태로
    // 되돌려 두고, 이 파일/absence-docs.js의 팝업만 열린 직후에 자기 문구로 바꾼다.
    function installCloseReset(){
        if(window.__briefingCloseResetInstalled)return;
        window.__briefingCloseResetInstalled=true;
        const baseOpenPopup=window.openPopup;
        window.openPopup=function(){
            const btn=document.getElementById('pop-close-btn');
            if(btn){btn.disabled=false;btn.textContent=CLOSE_BTN_DEFAULT_TEXT;}
            return baseOpenPopup.apply(this,arguments);
        };
    }
    installCloseReset();

    window.briefingPopupLabel=function(label){
        const btn=document.getElementById('pop-close-btn');
        if(btn)btn.textContent=label;
    };

    /* =========================================================
       학생용: 홈 탭 들어갈 때마다
       ========================================================= */
    function studentIncompleteItems(){
        const myName=String(window.myName||'').trim();
        if(!myName)return [];
        const isTargeted=window.assignmentsIsTargeted||(()=>true);
        const itemCategory=window.assignmentsItemCategory||(()=>'과제');

        return activeRows()
            .filter(([,item])=>isTargeted(item,myName))
            .filter(([id])=>!state.completions[id]?.[myName])
            .map(([id,item])=>({id,item,category:itemCategory(item)}))
            .sort((a,b)=>String(a.item.dueDate||'9999').localeCompare(String(b.item.dueDate||'9999')));
    }

    // 레벨업 보상(orders의 [레벨업] 항목)을 아직 안 본 것만 모은다. 본 것은 이 기기에 기록한다.
    function seenLevelUpKey(){return `levelUpSeen:${String(window.myName||'')}`;}
    function readSeenLevelUps(){
        try{return new Set(JSON.parse(localStorage.getItem(seenLevelUpKey())||'[]'));}
        catch(error){return new Set();}
    }
    async function loadNewLevelUpRewards(){
        const name=String(window.myName||'').trim();
        if(!name)return [];
        try{
            const snapshot=await db.ref(`ordersByUser/${name}`).once('value');
            const seen=readSeenLevelUps();
            const rows=[];
            snapshot.forEach(child=>{
                const order=child.val()||{};
                if(Number(order.levelUp)>0&&!seen.has(child.key))rows.push({key:child.key,level:Number(order.levelUp),item:String(order.item||'').replace(/^[레벨업]s*/,'')});
            });
            return rows.sort((a,b)=>a.level-b.level);
        }catch(error){
            console.error('레벨업 보상 조회 오류:',error);
            return [];
        }
    }
    function markLevelUpsSeen(rows){
        try{
            const seen=readSeenLevelUps();
            rows.forEach(row=>seen.add(row.key));
            localStorage.setItem(seenLevelUpKey(),JSON.stringify([...seen].slice(-200)));
        }catch(error){/* 기록 실패해도 팝업은 이미 떴다 */}
    }

    async function showStudentBriefing(){
        const items=studentIncompleteItems();
        const levelUps=await loadNewLevelUpRewards();

        // 결석신고서는 하루 한 번만 안내한다(교사가 제출 확인을 하면 목록에서 사라짐).
        let absenceRows=[];
        if(window.AbsenceDocs&&!window.AbsenceDocs.wasShownToday('student')){
            try{absenceRows=await window.AbsenceDocs.loadMine();}
            catch(error){console.error('결석신고서 조회 오류:',error);}
        }

        if(!items.length&&!absenceRows.length&&!levelUps.length)return;

        const icon=category=>category==='제출자료'?'📎':'📝';
        const shown=items.slice(0,6);
        const rest=items.length-shown.length;

        const rows=shown.map(({item,category})=>
            `<div class="briefing-item"><span>${icon(category)}</span><b>${esc(item.title||'제목 없음')}</b><small>마감 ${esc(item.dueDate||'-')}</small></div>`
        ).join('');

        const more=rest>0?`<div class="briefing-more">외 ${rest}개 더 — 과제 탭에서 확인하세요.</div>`:'';

        const todoHtml=items.length
            ?`<div>아직 안 한 게 있어요</div><div class="briefing-list">${rows}</div>${more}`
            :'';
        const absenceHtml=absenceRows.length
            ?`<div class="briefing-section"><h4>📄 결석신고서를 내야 해요</h4><div class="briefing-list">${window.AbsenceDocs.studentRowsHtml(absenceRows)}</div></div>`
            :'';

        const levelUpHtml=levelUps.length
            ?`<div class="briefing-section"><h4>🎉 레벨업 보상</h4><div class="briefing-list">${levelUps.map(row=>`<div class="briefing-item"><span>🎁</span><b>Lv.${row.level} 달성</b><small>${esc(row.item)}</small></div>`).join('')}</div><div class="briefing-more">선생님께 말씀드리면 받을 수 있어요.</div></div>`
            :'';

        window.openPopup(
            levelUps.length&&!items.length&&!absenceRows.length?'LEVEL UP! 🎉':'아 맞다! 📝',
            `${popupStyle()}${window.AbsenceDocs?window.AbsenceDocs.styleHtml():''}${levelUpHtml}${todoHtml}${absenceHtml}`
        );
        window.briefingPopupLabel('알겠어요');
        if(levelUps.length)markLevelUpsSeen(levelUps);
        if(absenceRows.length)window.AbsenceDocs.markShownToday('student');
    }

    /* =========================================================
       교사용: 하루 1번, 로그인/홈 탭 첫 진입 시
       ========================================================= */
    function teacherBriefingKey(){
        return `dailyBriefingShown:${String(window.myName||'teacher')}:${todayKst()}`;
    }

    // 페이지를 연 동안 한 번만(메모리). 새로고침/재로그인 때는 다시 뜬다.
    const briefingShown=new Set();
    try{if(window.auth&&auth.onAuthStateChanged)auth.onAuthStateChanged(user=>{if(!user)briefingShown.clear();});}catch(error){}
    function alreadyShownToday(){return briefingShown.has(teacherBriefingKey());}
    function markShownToday(){briefingShown.add(teacherBriefingKey());}

    // 홈 대시보드가 이미 구독 중인 공지 데이터를 그대로 읽는다(추가 조회 없음).
    function todayNoticeLines(){
        const data=typeof window.getHomeDashboardData==='function'?window.getHomeDashboardData():{};
        const today=todayKst();
        const noticeValue=data?.notices?.[today];
        if(noticeValue&&typeof noticeValue==='object'&&Array.isArray(noticeValue.items)){
            return noticeValue.items.filter(item=>item?.showOnHome).map(item=>String(item.text||'').trim()).filter(Boolean);
        }
        return String(noticeValue||data?.legacyNotice||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    }

    // teacherAlerts는 교사 이메일만 읽을 수 있는 경로(database.rules.json)라
    // 이 분기(교사 확정 상태)에서만 호출한다.
    async function todaySchedule(){
        try{
            const snapshot=await db.ref(`teacherAlerts/${todayKst()}`).once('value');
            const value=snapshot.val()||{};
            return Object.values(value).filter(Boolean)
                .sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99')))
                .map(item=>`${item.time?item.time+' · ':''}${String(item.title||'')}`.trim())
                .filter(Boolean);
        }catch(error){
            console.error('오늘 일정 조회 오류:',error);
            return [];
        }
    }

    // assignments.js의 roster()와 같은 기준으로 걸러야 대상 인원 수가 일치한다.
    // "6-6 선생님"처럼 이름에 "선생님"이 들어간 계정은 currentUsers엔 남아있지만
    // 과제 대상자는 아니라서, 여기서 안 빼면 그 학생들이 실제로 다 완료해도
    // 인원수가 영원히 1명 모자라 보여서 "아 맞다"에서 안 사라졌다.
    function classRosterNames(){
        return (Array.isArray(window.currentUsers)?window.currentUsers:[])
            .map(user=>String(user?.name||'').trim())
            .filter(name=>name&&name!=='총사령관'&&!name.includes('선생님'));
    }

    function progressSummary(){
        const itemCategory=window.assignmentsItemCategory||(()=>'과제');
        const roster=classRosterNames();

        return activeRows()
            .map(([id,item])=>{
                const category=itemCategory(item);
                const targets=Array.isArray(item.targetStudents)&&item.targetStudents.length
                    ?item.targetStudents
                    :roster;
                const completed=state.completions[id]||{};
                const doneCount=targets.filter(name=>completed[name]).length;
                return {id,item,category,doneCount,total:targets.length};
            })
            .filter(({doneCount,total})=>doneCount<total)
            .sort((a,b)=>String(a.item.dueDate||'9999').localeCompare(String(b.item.dueDate||'9999')))
            .slice(0,6);
    }

    // 로그인 직후엔 홈 대시보드가 전자칠판 공개 자료를 아직 못 받았을 수 있다.
    // 그대로 읽으면 공지가 비어 보여 결석신고서만 뜨므로, 자료가 올 때까지 잠깐 기다린다.
    async function waitForHomeData(maxMs=4000){
        const loaded=()=>{
            const data=typeof window.getHomeDashboardData==='function'?window.getHomeDashboardData():null;
            return !!data&&Object.keys(data).length>0;
        };
        for(let waited=0;!loaded()&&waited<maxMs;waited+=150){
            await new Promise(resolve=>setTimeout(resolve,150));
        }
    }

    async function showTeacherBriefing(){
        if(alreadyShownToday())return;
        await waitForHomeData();

        const [notices,schedule]=await Promise.all([
            Promise.resolve(todayNoticeLines()),
            todaySchedule()
        ]);
        const progress=progressSummary();

        let absenceRows=[];
        if(window.AbsenceDocs){
            try{absenceRows=await window.AbsenceDocs.loadAll();}
            catch(error){console.error('결석신고서 조회 오류:',error);}
        }

        if(!notices.length&&!schedule.length&&!progress.length&&!absenceRows.length)return;

        const icon=category=>category==='제출자료'?'📎':'📝';
        const checkable=innerHtml=>`<label class="briefing-item briefing-checkable"><input type="checkbox" class="briefing-check"><span class="briefing-item-body">${innerHtml}</span></label>`;

        const noticeHtml=notices.length
            ?`<div class="briefing-section"><h4>📣 오늘의 공지</h4><div class="briefing-list">${notices.map(line=>checkable(esc(line))).join('')}</div></div>`
            :'';

        const scheduleHtml=schedule.length
            ?`<div class="briefing-section"><h4>📅 오늘 일정</h4><div class="briefing-list">${schedule.map(line=>checkable(esc(line))).join('')}</div></div>`
            :'';

        const progressHtml=progress.length
            ?`<div class="briefing-section"><h4>📋 과제·제출자료 진행 현황</h4><div class="briefing-list">${progress.map(({item,category,doneCount,total})=>
                checkable(`<span>${icon(category)}</span><b>${esc(item.title||'제목 없음')}</b><small>완료 ${doneCount}/${total}명</small>`)
            ).join('')}</div></div>`
            :'';

        // 결석신고서는 못 받은 학생이 있을 수 있어서 체크 안 해도 닫을 수 있고(닫기 게이트 대상 아님),
        // 체크 안 한 학생은 목록(absenceDocs)에 계속 남는다.
        const absenceHtml=absenceRows.length
            ?`<div class="briefing-section"><h4>📄 결석신고서 미제출 <small class="muted">(제출받았으면 체크)</small></h4><div class="briefing-list">${window.AbsenceDocs.teacherRowsHtml(absenceRows)}</div></div>`
            :'';

        const hasGatedItems=Boolean(notices.length||schedule.length||progress.length);
        const title='아 맞다! 📋';
        window.openPopup(
            title,
            `${popupStyle()}${window.AbsenceDocs?window.AbsenceDocs.styleHtml():''}<div>${hasGatedItems?'모든 항목을 체크해야 닫을 수 있어요':'오늘 하루 시작 전에 확인하세요'}</div>${noticeHtml}${scheduleHtml}${progressHtml}${absenceHtml}`
        );
        gateCloseUntilAllChecked(title);
        // 체크가 필요한 항목이 하나도 없으면(결석신고서만 있을 때) 게이트가 문구를 안 바꾸므로 직접 맞춘다.
        if(!hasGatedItems)window.briefingPopupLabel('확인했어요');
        // 체크 확인용 버튼(onChange)을 꼭 넘겨야, 여기서 체크해도 등교로그 탭의
        // 미제출 배지 숫자가 닫기 전에 바로 줄어든다(이전엔 저장은 되지만 화면
        // 표시만 안 바뀌어서 "반영이 안 된다"고 느껴졌다).
        if(absenceRows.length)window.AbsenceDocs.bindCheckboxes(()=>window.AbsenceDocs.refreshBadge());

        markShownToday();
    }

    window.onEnterMainTab=function(){
        if(!window.myName)return;
        ensureListening();

        // 학생/교사 분기 — window.isAdmin은 서버가 검증한 세션 값(js/auth.js)
        // 이라 클라이언트에서 조작해도 실제 데이터 접근 권한은 안 늘어난다.
        if(window.isAdmin===true){
            showTeacherBriefing();
        }else{
            showStudentBriefing();
        }
    };
})();
