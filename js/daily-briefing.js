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
        return `<style>.briefing-list{display:grid;gap:10px;text-align:left;margin-top:10px}.briefing-item{display:flex;align-items:baseline;gap:8px;padding:12px 14px;border-radius:10px;background:var(--ui-surface-soft)}.briefing-item b{flex:1}.briefing-item small{color:var(--ui-muted);white-space:nowrap}.briefing-section{margin-top:16px;text-align:left}.briefing-section h4{margin:0 0 8px}.briefing-empty{color:var(--ui-muted);text-align:left;margin-top:10px}.briefing-more{color:var(--ui-muted);text-align:left;margin-top:6px;font-size:.92em}</style>`;
    }

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

    function showStudentBriefing(){
        const items=studentIncompleteItems();
        if(!items.length)return;

        const icon=category=>category==='제출자료'?'📎':'📝';
        const shown=items.slice(0,6);
        const rest=items.length-shown.length;

        const rows=shown.map(({item,category})=>
            `<div class="briefing-item"><span>${icon(category)}</span><b>${esc(item.title||'제목 없음')}</b><small>마감 ${esc(item.dueDate||'-')}</small></div>`
        ).join('');

        const more=rest>0?`<div class="briefing-more">외 ${rest}개 더 — 과제 탭에서 확인하세요.</div>`:'';

        window.openPopup(
            '아 맞다! 📝',
            `${popupStyle()}<div>아직 안 한 게 있어요</div><div class="briefing-list">${rows}</div>${more}`
        );
    }

    /* =========================================================
       교사용: 하루 1번, 로그인/홈 탭 첫 진입 시
       ========================================================= */
    function teacherBriefingKey(){
        return `dailyBriefingShown:${String(window.myName||'teacher')}:${todayKst()}`;
    }

    function alreadyShownToday(){
        try{
            return localStorage.getItem(teacherBriefingKey())==='1';
        }catch(error){
            return false;
        }
    }

    function markShownToday(){
        try{
            localStorage.setItem(teacherBriefingKey(),'1');
        }catch(error){/* 저장 실패해도 팝업 자체는 이미 떴으니 무시 */}
    }

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

    function classRosterNames(){
        return (Array.isArray(window.currentUsers)?window.currentUsers:[])
            .map(user=>String(user?.name||'').trim())
            .filter(name=>name&&name!=='총사령관');
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

    async function showTeacherBriefing(){
        if(alreadyShownToday())return;

        const [notices,schedule]=await Promise.all([
            Promise.resolve(todayNoticeLines()),
            todaySchedule()
        ]);
        const progress=progressSummary();

        if(!notices.length&&!schedule.length&&!progress.length)return;

        const icon=category=>category==='제출자료'?'📎':'📝';

        const noticeHtml=notices.length
            ?`<div class="briefing-section"><h4>📣 오늘의 공지</h4><div class="briefing-list">${notices.map(line=>`<div class="briefing-item">${esc(line)}</div>`).join('')}</div></div>`
            :'';

        const scheduleHtml=schedule.length
            ?`<div class="briefing-section"><h4>📅 오늘 일정</h4><div class="briefing-list">${schedule.map(line=>`<div class="briefing-item">${esc(line)}</div>`).join('')}</div></div>`
            :'';

        const progressHtml=progress.length
            ?`<div class="briefing-section"><h4>📋 과제·제출자료 진행 현황</h4><div class="briefing-list">${progress.map(({item,category,doneCount,total})=>
                `<div class="briefing-item"><span>${icon(category)}</span><b>${esc(item.title||'제목 없음')}</b><small>완료 ${doneCount}/${total}명</small></div>`
            ).join('')}</div></div>`
            :'';

        window.openPopup(
            '아 맞다! 📋',
            `${popupStyle()}<div>오늘 하루 시작 전에 확인하세요</div>${noticeHtml}${scheduleHtml}${progressHtml}`
        );

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
