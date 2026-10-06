// js/absence-docs.js - 결석신고서 미제출 관리
// 결석(질병·무단)·체험학습은 결석신고서를 받아야 한다. 아직 못 받은 건만
// absenceDocs/{학생}/{날짜} = {reason} 로 남겨 두고, 교사가 제출 확인(체크)하면 지운다.
// 목록이 작아서(몇 건) 필요할 때 한 번만 읽는다(실시간 구독 안 함).
(function(){
    'use strict';
    const PATH='absenceDocs';
    const TITLE='아 맞다! 📄 결석신고서';

    function esc(value){
        return String(value==null?'':value)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function todayKst(){
        return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    }
    function shortDate(date){return String(date||'').slice(5);}

    function shownKey(scope){return `absenceDocShown:${scope}:${String(window.myName||'')}:${todayKst()}`;}
    function wasShownToday(scope){
        try{return localStorage.getItem(shownKey(scope))==='1';}catch(error){return false;}
    }
    function markShownToday(scope){
        try{localStorage.setItem(shownKey(scope),'1');}catch(error){/* 저장 실패해도 팝업은 이미 떴다 */}
    }

    // ---- 읽기 ----
    async function loadAll(){
        const snapshot=await db.ref(PATH).once('value');
        const rows=[];
        snapshot.forEach(student=>{
            student.forEach(day=>{
                rows.push({name:student.key,date:day.key,reason:String(day.val()?.reason||'결석')});
            });
        });
        return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'ko'));
    }

    async function loadMine(){
        const name=String(window.myName||'').trim();
        if(!name)return [];
        const snapshot=await db.ref(`${PATH}/${name}`).once('value');
        const rows=[];
        snapshot.forEach(day=>{rows.push({name,date:day.key,reason:String(day.val()?.reason||'결석')});});
        return rows.sort((a,b)=>a.date.localeCompare(b.date));
    }

    // ---- 쓰기: 제출 확인(체크) / 되돌리기 ----
    async function setSubmitted(name,date,reason,done){
        const updates={};
        updates[`${PATH}/${name}/${date}`]=done?null:{reason};
        // 출결 기록 쪽 표시도 같이 맞춘다(기존 docSubmitted 필드).
        updates[`attendanceRecords/${date}/${name}/docSubmitted`]=done;
        await db.ref().update(updates);
    }

    // ---- 화면 조각 ----
    function teacherRowsHtml(rows){
        return rows.map(row=>`<label class="briefing-item briefing-checkable">
            <input type="checkbox" class="absence-check" data-name="${esc(row.name)}" data-date="${esc(row.date)}" data-reason="${esc(row.reason)}">
            <span class="absence-date">${esc(shortDate(row.date))}</span><b>${esc(row.name)}</b><small>${esc(row.reason)}</small>
        </label>`).join('');
    }

    function studentRowsHtml(rows){
        return rows.map(row=>`<div class="briefing-item"><span class="absence-date">${esc(shortDate(row.date))}</span><b>${esc(row.reason)}</b><small>선생님께 내 주세요</small></div>`).join('');
    }

    function styleHtml(){
        // 목록/한 줄 모양은 아 맞다 팝업(daily-briefing.js)과 같은 스타일을 쓴다.
        return (window.briefingPopupStyle?window.briefingPopupStyle():'')+'<style>.absence-date{color:var(--ui-muted);font-size:.8rem;white-space:nowrap}.briefing-item.is-absence-done{opacity:.55}.briefing-item.is-absence-done b,.briefing-item.is-absence-done small{text-decoration:line-through}.absence-actions{margin-top:14px}.absence-actions .btn{width:100%}</style>';
    }

    // 팝업 안 체크박스: 체크하면 제출 확인으로 저장하고, 다시 풀면 목록에 되돌린다.
    // 출결 관련 문구(결석 등)가 들어간 팝업은 js/global.js의 "독립 팝업" 패치가
    // #pop-content가 아니라 #checkin-popup-content에 그려버릴 수 있어서, 특정
    // 컨테이너 id에 기대지 않고 document 전체에 위임해서 바인딩한다.
    let boundContent=null,boundHandler=null;
    function bindCheckboxes(onChange){
        const content=document;
        if(boundContent&&boundHandler)boundContent.removeEventListener('change',boundHandler);
        boundHandler=async event=>{
            const box=event.target.closest?.('.absence-check');
            if(!box)return;
            const row=box.closest('.briefing-item');
            box.disabled=true;
            try{
                await setSubmitted(box.dataset.name,box.dataset.date,box.dataset.reason,box.checked);
                row?.classList.toggle('is-absence-done',box.checked);
                // 제출 확인한 줄은 잠깐 취소선으로 보여준 뒤 목록에서 치운다(그 사이 다시 풀면 남는다).
                if(box.checked&&row)setTimeout(()=>{
                    if(!box.checked||!row.isConnected)return;
                    row.remove();
                    if(onChange)onChange();
                },700);
            }catch(error){
                console.error('결석신고서 제출 확인 저장 오류:',error);
                box.checked=!box.checked;
                alert('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
            }finally{
                box.disabled=false;
                if(onChange)onChange();
            }
        };
        content.addEventListener('change',boundHandler);
        boundContent=content;
    }

    function remainingCount(){
        return Array.from(document.querySelectorAll('.absence-check')).filter(box=>!box.checked).length;
    }

    // ---- 등교 로그 탭의 결석신고서 전용 팝업: 체크만으로는 저장하지 않고,
    // "제출확인" 버튼을 눌러야 그 순간 체크된 학생만 한꺼번에 반영한다.
    // (홈 탭 "아 맞다!" 팝업의 체크는 그냥 확인용이라 저장하지 않는다 — bindCheckboxes와는 별개.)
    // 위 bindCheckboxes와 마찬가지로 특정 컨테이너 id에 기대지 않는다.
    function updateConfirmButtonState(){
        const button=document.getElementById('absence-confirm-btn');
        if(!button)return;
        button.disabled=!document.querySelectorAll('.absence-check:checked').length;
    }

    async function confirmSelected(){
        const button=document.getElementById('absence-confirm-btn');
        const note=document.getElementById('absence-remaining');
        const boxes=Array.from(document.querySelectorAll('.absence-check:checked'));
        if(!boxes.length)return;

        if(button)button.disabled=true;
        boxes.forEach(box=>box.disabled=true);
        try{
            await Promise.all(boxes.map(box=>
                setSubmitted(box.dataset.name,box.dataset.date,box.dataset.reason,true)
            ));
            boxes.forEach(box=>box.closest('.briefing-item')?.classList.add('is-absence-done'));
            if(note)note.textContent=`✅ ${boxes.length}명 제출확인 처리했습니다.`;
            setTimeout(()=>{
                boxes.forEach(box=>box.closest('.briefing-item')?.remove());
                const left=document.querySelectorAll('.absence-check').length;
                if(note)note.textContent=left
                    ?`미제출 ${left}명 · 제출받은 학생을 체크하고 "제출확인"을 눌러주세요.`
                    :'모두 제출 확인 완료 🎉';
                refreshBadge();
            },650);
        }catch(error){
            console.error('결석신고서 제출 확인 저장 오류:',error);
            boxes.forEach(box=>box.disabled=false);
            alert('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }finally{
            updateConfirmButtonState();
        }
    }

    let boundConfirmContent=null,boundConfirmHandler=null;
    function bindConfirmPopup(){
        const content=document;
        if(boundConfirmContent&&boundConfirmHandler)boundConfirmContent.removeEventListener('change',boundConfirmHandler);
        boundConfirmHandler=event=>{
            if(event.target.closest?.('.absence-check'))updateConfirmButtonState();
        };
        content.addEventListener('change',boundConfirmHandler);
        boundConfirmContent=content;

        const button=document.getElementById('absence-confirm-btn');
        if(button)button.addEventListener('click',confirmSelected);
        updateConfirmButtonState();
    }

    // ---- 교사: 등교 로그 탭 ----
    async function refreshBadge(){
        const badge=document.getElementById('absence-doc-badge');
        if(!badge)return [];
        try{
            const rows=await loadAll();
            badge.textContent=String(rows.length);
            badge.hidden=rows.length===0;
            return rows;
        }catch(error){
            console.error('결석신고서 목록 조회 오류:',error);
            return [];
        }
    }

    async function openTeacherPopup(){
        let rows;
        try{rows=await loadAll();}catch(error){
            console.error('결석신고서 목록 조회 오류:',error);
            return alert('결석신고서 목록을 불러오지 못했어요.');
        }
        const body=rows.length
            ?`<div class="briefing-list">${teacherRowsHtml(rows)}</div>
               <p class="tiny muted" id="absence-remaining" style="margin:12px 0 0">미제출 ${rows.length}명 · 제출받은 학생을 체크하고 "제출확인"을 눌러주세요.</p>
               <div class="absence-actions"><button class="btn btn--primary" id="absence-confirm-btn" type="button" disabled>제출확인</button></div>`
            :'<p class="briefing-empty">결석신고서를 안 낸 학생이 없어요. 🎉</p>';
        window.openPopup(TITLE,`${styleHtml()}${body}`);
        window.briefingPopupLabel?.('닫기');
        if(rows.length)bindConfirmPopup();
        markShownToday('teacher-tab');
    }

    // 등교 로그 탭이 그려질 때마다 숫자를 채우고, 하루 한 번만 자동으로 띄운다.
    async function onLogsTabRendered(){
        const rows=await refreshBadge();
        if(rows.length&&!wasShownToday('teacher-tab'))openTeacherPopup();
    }

    window.AbsenceDocs={
        TITLE,loadAll,loadMine,setSubmitted,
        teacherRowsHtml,studentRowsHtml,styleHtml,
        bindCheckboxes,remainingCount,
        wasShownToday,markShownToday,
        openTeacherPopup,onLogsTabRendered,refreshBadge
    };
})();
