// js/blackboard-admin.js
(function () {
    'use strict';

    const PERIODS = ['아침','1교시','2교시','3교시','4교시','점심시간','청소시간','5교시','6교시'];
    const WEEKDAYS = [
        {key:'1',label:'월'},{key:'2',label:'화'},{key:'3',label:'수'},
        {key:'4',label:'목'},{key:'5',label:'금'}
    ];
    const DEFAULTS = {
        '아침':{startTime:'08:00',endTime:'09:00',subject:'아침'},
        '1교시':{startTime:'09:00',endTime:'09:40',subject:'1교시'},
        '2교시':{startTime:'09:50',endTime:'10:30',subject:'2교시'},
        '3교시':{startTime:'10:40',endTime:'11:20',subject:'3교시'},
        '4교시':{startTime:'11:30',endTime:'12:10',subject:'4교시'},
        '점심시간':{startTime:'12:10',endTime:'13:00',subject:'점심시간'},
        '청소시간':{startTime:'13:00',endTime:'13:20',subject:'청소시간'},
        '5교시':{startTime:'13:20',endTime:'14:00',subject:'5교시'},
        '6교시':{startTime:'14:10',endTime:'14:50',subject:'6교시'}
    };
    const state = {
        legacySchedule:{}, periodTimes:{}, baseSchedule:{}, notices:{}, week:{},
        selectedNoticeDate:'', selectedWeekStart:'', selectedWeekDate:'', selectedBaseDay:'1'
    };

    function esc(value) {
        return String(value == null ? '' : value).replace(/&/g,'&amp;')
            .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function todayKst() {
        return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    }
    function addDays(dateString, amount) {
        const date = new Date(`${dateString}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + amount);
        return date.toISOString().slice(0,10);
    }
    function mondayOf(dateString) {
        const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
        return addDays(dateString, day === 0 ? -6 : 1 - day);
    }
    function dayKey(dateString) {
        return String(new Date(`${dateString}T00:00:00Z`).getUTCDay());
    }
    function isClassPeriod(name) { return /^\d교시$/.test(name); }
    function timeFor(name) {
        return {
            startTime:state.periodTimes[name]?.startTime || DEFAULTS[name].startTime,
            endTime:state.periodTimes[name]?.endTime || DEFAULTS[name].endTime
        };
    }
    function baseForDay(key) {
        const result = {};
        PERIODS.forEach(name => {
            result[name] = {
                ...DEFAULTS[name], ...(state.legacySchedule[name] || {}),
                ...(state.baseSchedule[key]?.[name] || {}), ...timeFor(name)
            };
        });
        return result;
    }

    function ensureStyles() {
        if (document.getElementById('bb-admin-v2-style')) return;
        const style = document.createElement('style');
        style.id = 'bb-admin-v2-style';
        style.textContent = `
            .bb-admin-grid{display:grid;gap:20px}.bb-panel{padding:22px;border:1px solid #dfe5ed;border-radius:16px;background:#fff}.bb-panel h3{margin:0 0 16px;color:#22324a}.bb-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.bb-btn{padding:11px 16px;border:0;border-radius:9px;font-weight:900;cursor:pointer}.bb-btn.primary{background:#3498db;color:#fff}.bb-btn.green{background:#27ae60;color:#fff}.bb-btn.dark{background:#263b63;color:#fff}.bb-btn.light{background:#edf1f6;color:#263b63}.bb-btn.red{background:#e74c3c;color:#fff}.bb-date-strip,.bb-day-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.bb-date-btn,.bb-day-btn{padding:10px 13px;border:2px solid #dce3ec;border-radius:10px;background:#fff;font-weight:850;cursor:pointer}.bb-date-btn.active,.bb-day-btn.active{border-color:#3498db;background:#eaf4fc;color:#17679f}.bb-editor{display:grid;gap:10px;margin-top:14px}.bb-period-row{display:grid;grid-template-columns:95px minmax(130px,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid #e1e6ed;border-radius:12px;background:#f8fafc}.bb-period-row input[type=text],.bb-period-row textarea,.bb-panel input[type=date],.bb-panel textarea{padding:10px;border:1px solid #bec8d5;border-radius:8px;font:inherit;box-sizing:border-box}.bb-period-extra{grid-column:2/-1;display:grid;grid-template-columns:1fr;gap:9px}.bb-period-extra textarea{width:100%;resize:vertical}.bb-check{display:flex;align-items:center;gap:6px;font-weight:850;white-space:nowrap}.bb-modal{position:fixed;inset:0;z-index:1000000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.62)}.bb-modal[hidden]{display:none}.bb-modal-dialog{width:min(1100px,96vw);max-height:94vh;overflow:auto;padding:25px;border-radius:20px;background:#fff;box-shadow:0 25px 70px rgba(0,0,0,.3)}.bb-modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.bb-modal-head h2{margin:0}.bb-time-grid{display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:12px;margin:18px 0 24px}.bb-time-row{padding:14px;border-radius:10px;background:#f3f6fa}.bb-time-row strong{display:block;margin-bottom:8px}.bb-time-row div{display:grid;grid-template-columns:minmax(145px,1fr) auto minmax(145px,1fr);align-items:center;gap:8px}.bb-time-row input[type=time]{width:100%;min-width:0;padding:10px 12px;box-sizing:border-box;font:inherit}.bb-notebook-grid{display:grid;grid-template-columns:repeat(5,minmax(180px,1fr));gap:12px;margin-top:20px}.bb-notebook-day{padding:14px;border-radius:14px;background:#f5f7fb;border:1px solid #dce3ec}.bb-notebook-day h3{margin:0 0 12px;color:#263b63}.bb-notebook-item{padding:12px;margin-top:9px;border-radius:10px;background:#fff;border-left:5px solid #8e44ad}.bb-notebook-item strong,.bb-notebook-item span{display:block}.bb-notebook-item p{margin:7px 0 0;white-space:pre-wrap;line-height:1.45}.bb-status{color:#667085;font-weight:800}.bb-empty{padding:28px;border:1px dashed #bbc5d2;border-radius:12px;text-align:center;color:#667085;font-weight:800}
            @media(max-width:1000px){.bb-notebook-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.bb-period-row{grid-template-columns:1fr}.bb-period-extra{grid-column:1;grid-template-columns:1fr}.bb-time-grid,.bb-notebook-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    function periodEditorHtml(schedule) {
        return PERIODS.map(name => {
            const item = schedule[name] || DEFAULTS[name];
            return `<section class="bb-period-row">
                <strong>${name}</strong>
                <input type="text" class="bb-subject" data-period="${name}" value="${esc(item.subject || name)}" placeholder="과목명">
                ${isClassPeriod(name) ? `<label class="bb-check"><input type="checkbox" class="bb-moving" data-period="${name}" ${item.isMovingClass?'checked':''}> 이동수업</label>` : '<span></span>'}
                <div class="bb-period-extra">
                    <textarea class="bb-action" data-period="${name}" rows="2" placeholder="화면 안내 문구">${esc(item.action || '')}</textarea>
                </div>
            </section>`;
        }).join('');
    }
    function readEditor(container, fallback) {
        const result = {};
        PERIODS.forEach(name => {
            const find = selector => container.querySelector(`${selector}[data-period="${name}"]`);
            const old = fallback[name] || DEFAULTS[name];
            result[name] = {
                subject:String(find('.bb-subject')?.value || old.subject || name).trim(),
                action:String(find('.bb-action')?.value || '').trim(),
                isMovingClass:Boolean(find('.bb-moving')?.checked),
                showLearningNote:Boolean(old.showLearningNote),
                learningNote:String(old.learningNote || '').trim()
            };
        });
        return result;
    }

    function renderNoticeStrip() {
        const strip = document.getElementById('bb-notice-date-strip');
        if (!strip) return;
        const monday = mondayOf(state.selectedNoticeDate);
        strip.innerHTML = Array.from({length:7}, (_, index) => {
            const date = addDays(monday,index);
            const label = ['월','화','수','목','금','토','일'][index];
            return `<button type="button" class="bb-date-btn${date===state.selectedNoticeDate?' active':''}" data-notice-date="${date}">${label}<br>${date.slice(5)}</button>`;
        }).join('');
        document.getElementById('bb-notice-date').value = state.selectedNoticeDate;
        document.getElementById('bb-notice-text').value = state.notices[state.selectedNoticeDate] || '';
    }
    function captureWeekDay() {
        const editor = document.getElementById('bb-week-editor');
        if (!editor?.querySelector('.bb-subject')) return;
        state.week[state.selectedWeekDate] = readEditor(editor,state.week[state.selectedWeekDate] || baseForDay(dayKey(state.selectedWeekDate)));
    }
    function renderWeekTabs() {
        const tabs = document.getElementById('bb-week-day-tabs');
        if (!tabs) return;
        tabs.innerHTML = WEEKDAYS.map((day,index) => {
            const date = addDays(state.selectedWeekStart,index);
            return `<button type="button" class="bb-day-btn${date===state.selectedWeekDate?' active':''}" data-week-date="${date}">${day.label} ${date.slice(5)}${state.week[date]?' ✓':''}</button>`;
        }).join('');
        document.getElementById('bb-week-label').textContent = `${state.selectedWeekStart} ~ ${addDays(state.selectedWeekStart,4)}`;
    }
    function renderWeekEditor() {
        const editor = document.getElementById('bb-week-editor');
        if (editor) editor.innerHTML = periodEditorHtml(state.week[state.selectedWeekDate] || baseForDay(dayKey(state.selectedWeekDate)));
    }

    function renderMain() {
        const container = document.getElementById('bb-schedule-form-container');
        container.innerHTML = `<div class="bb-admin-grid">
            <section class="bb-panel" style="background:#fffaf0;border-color:#ecd37a">
                <h3>📢 날짜별 공지</h3>
                <div class="bb-toolbar"><input type="date" id="bb-notice-date"><span class="bb-status">날짜를 클릭하면 해당 날짜 공지를 작성할 수 있습니다.</span></div>
                <div class="bb-date-strip" id="bb-notice-date-strip"></div>
                <textarea id="bb-notice-text" rows="4" style="width:100%" placeholder="선택한 날짜에 표시할 전자칠판 공지"></textarea>
                <div class="bb-toolbar" style="margin-top:12px"><button class="bb-btn primary" id="bb-save-notice">공지 저장</button><button class="bb-btn red" id="bb-delete-notice">공지 삭제</button></div>
            </section>
            <section class="bb-panel">
                <div class="bb-toolbar" style="justify-content:space-between"><h3 style="margin:0">🗓️ 주간 시간표</h3><button class="bb-btn dark" id="bb-open-settings">⚙️ 교시 시간·기본 시간표 설정</button></div>
                <div class="bb-toolbar" style="margin-top:16px"><input type="date" id="bb-week-anchor" value="${state.selectedWeekStart}"><button class="bb-btn light" id="bb-load-week">해당 주 열기</button><button class="bb-btn green" id="bb-copy-base">기본 시간표 불러오기</button><button class="bb-btn dark" id="bb-view-notebook">📖 주간 배움공책 &amp; 메모 모아보기</button><strong id="bb-week-label"></strong></div>
                <div class="bb-day-tabs" id="bb-week-day-tabs"></div><div class="bb-editor" id="bb-week-editor"></div>
                <button class="bb-btn primary" id="bb-save-week" style="width:100%;margin-top:16px;padding:16px">💾 이 주 시간표 저장</button>
            </section>
        </div>`;
        renderNoticeStrip(); renderWeekTabs(); renderWeekEditor(); bindMainEvents(container);
    }

    function bindMainEvents(container) {
        // 관리 탭을 다시 열어도 클릭 핸들러가 중복 등록되지 않게 교체합니다.
        container.onclick = async event => {
            const noticeDay = event.target.closest('[data-notice-date]');
            if (noticeDay) { state.selectedNoticeDate=noticeDay.dataset.noticeDate; renderNoticeStrip(); return; }
            const weekDay = event.target.closest('[data-week-date]');
            if (weekDay) { captureWeekDay(); state.selectedWeekDate=weekDay.dataset.weekDate; renderWeekTabs(); renderWeekEditor(); return; }
            if (event.target.closest('#bb-open-settings')) openSettings();
            if (event.target.closest('#bb-save-notice')) await saveNotice();
            if (event.target.closest('#bb-delete-notice')) await deleteNotice();
            if (event.target.closest('#bb-load-week')) {
                const anchor=document.getElementById('bb-week-anchor').value || todayKst();
                await loadWeek(mondayOf(anchor));
            }
            if (event.target.closest('#bb-copy-base')) {
                captureWeekDay();
                WEEKDAYS.forEach((day,index)=>{state.week[addDays(state.selectedWeekStart,index)]=baseForDay(day.key);});
                renderWeekTabs(); renderWeekEditor();
            }
            if (event.target.closest('#bb-view-notebook')) await openWeeklyNotebook();
            if (event.target.closest('#bb-save-week')) await saveWeek();
        };
        document.getElementById('bb-notice-date').addEventListener('change',event=>{state.selectedNoticeDate=event.target.value||todayKst();renderNoticeStrip();});
    }
    async function loadWeek(weekStart) {
        const snapshot=await db.ref(`blackboard/weeklySchedules/${weekStart}`).once('value');
        state.week=snapshot.val()||{}; state.selectedWeekStart=weekStart; state.selectedWeekDate=weekStart;
        renderWeekTabs(); renderWeekEditor();
    }
    async function saveNotice() {
        const text=String(document.getElementById('bb-notice-text').value||'').trim();
        await db.ref(`blackboard/notices/${state.selectedNoticeDate}`).set(text||null);
        if(text)state.notices[state.selectedNoticeDate]=text;else delete state.notices[state.selectedNoticeDate];
        alert(`${state.selectedNoticeDate} 공지를 저장했습니다.`);
    }
    async function deleteNotice() {
        await db.ref(`blackboard/notices/${state.selectedNoticeDate}`).remove();
        delete state.notices[state.selectedNoticeDate]; document.getElementById('bb-notice-text').value='';
        alert('선택한 날짜의 공지를 삭제했습니다.');
    }
    async function saveWeek() {
        captureWeekDay();
        await db.ref(`blackboard/weeklySchedules/${state.selectedWeekStart}`).set(state.week);
        renderWeekTabs(); alert(`${state.selectedWeekStart} 주간 시간표를 저장했습니다.`);
    }

    async function openWeeklyNotebook() {
        let modal=document.getElementById('bb-notebook-modal');
        if(!modal){
            modal=document.createElement('div');modal.id='bb-notebook-modal';modal.className='bb-modal';modal.hidden=true;
            modal.innerHTML='<div class="bb-modal-dialog"><div class="bb-modal-head"><h2>📖 주간 배움공책 &amp; 메모</h2><button class="bb-btn light" data-notebook-close>닫기</button></div><p class="bb-status">Firebase에 저장된 내용을 날짜·교시 순서로 표시합니다.</p><div id="bb-notebook-content"></div></div>';
            modal.addEventListener('click',event=>{if(event.target===modal||event.target.closest('[data-notebook-close]')){modal.hidden=true;document.body.style.overflow='';}});
            document.body.appendChild(modal);
        }
        const content=modal.querySelector('#bb-notebook-content');content.innerHTML='<div class="bb-empty">주간 배움공책 &amp; 메모를 불러오는 중입니다.</div>';modal.hidden=false;document.body.style.overflow='hidden';
        try{
            const snapshot=await db.ref(`blackboard/weeklySchedules/${state.selectedWeekStart}`).once('value');
            const savedWeek=snapshot.val()||{};
            let total=0;
            content.innerHTML=`<div class="bb-notebook-grid">${WEEKDAYS.map((day,index)=>{
                const date=addDays(state.selectedWeekStart,index);const schedule=savedWeek[date]||{};
                const notes=PERIODS.filter(isClassPeriod).map(name=>({name,...(schedule[name]||{})})).filter(item=>String(item.learningNote||'').trim());total+=notes.length;
                return `<section class="bb-notebook-day"><h3>${day.label}요일 · ${date.slice(5)}</h3>${notes.length?notes.map(item=>`<article class="bb-notebook-item"><strong>${item.name} · ${esc(item.subject||'')}</strong><p>${esc(item.learningNote)}</p></article>`).join(''):'<div class="bb-status">저장된 내용 없음</div>'}</section>`;
            }).join('')}</div>`;
            if(!total)content.innerHTML='<div class="bb-empty">이 주에 저장된 배움공책 &amp; 메모가 없습니다.</div>';
        }catch(error){console.error('주간 배움공책 & 메모 조회 실패:',error);content.innerHTML='<div class="bb-empty" style="color:#c0392b">주간 배움공책 &amp; 메모를 불러오지 못했습니다.</div>';}
    }

    function ensureModal() {
        let modal=document.getElementById('bb-settings-modal');
        if(modal)return modal;
        modal=document.createElement('div'); modal.id='bb-settings-modal'; modal.className='bb-modal'; modal.hidden=true;
        modal.innerHTML=`<div class="bb-modal-dialog"><div class="bb-modal-head"><h2>⚙️ 전자칠판 기본 설정</h2><button class="bb-btn light" data-bb-close>닫기</button></div><p class="bb-status">교시 시간과 월~금 기본 시간표는 여기에서 한 번 설정해 두면 됩니다.</p><div id="bb-settings-content"></div></div>`;
        modal.addEventListener('click',event=>{if(event.target===modal||event.target.closest('[data-bb-close]'))closeSettings();});
        document.body.appendChild(modal); return modal;
    }
    function captureBaseDay() {
        const editor=document.getElementById('bb-base-editor');
        if(editor?.querySelector('.bb-subject'))state.baseSchedule[state.selectedBaseDay]=readEditor(editor,baseForDay(state.selectedBaseDay));
    }
    function renderBaseEditor() {
        const editor=document.getElementById('bb-base-editor');
        if(editor)editor.innerHTML=periodEditorHtml(baseForDay(state.selectedBaseDay));
        document.querySelectorAll('[data-base-day]').forEach(button=>button.classList.toggle('active',button.dataset.baseDay===state.selectedBaseDay));
    }
    function openSettings() {
        const modal=ensureModal(); const content=modal.querySelector('#bb-settings-content');
        content.innerHTML=`<h3 style="margin-top:24px">⏰ 교시 시간 설정</h3><div class="bb-time-grid">${PERIODS.map(name=>{const time=timeFor(name);return `<div class="bb-time-row"><strong>${name}</strong><div><input type="time" class="bb-time-start" data-period="${name}" value="${time.startTime}"><span>~</span><input type="time" class="bb-time-end" data-period="${name}" value="${time.endTime}"></div></div>`;}).join('')}</div>
            <h3>📚 월~금 기본 시간표</h3><p class="bb-status">이동수업은 여기에서 체크하면 매주 그대로 복사됩니다.</p><div class="bb-day-tabs">${WEEKDAYS.map(day=>`<button class="bb-day-btn${day.key===state.selectedBaseDay?' active':''}" data-base-day="${day.key}">${day.label}요일</button>`).join('')}</div><div class="bb-editor" id="bb-base-editor"></div><button class="bb-btn primary" id="bb-save-settings" style="width:100%;margin-top:18px;padding:16px">기본 설정 저장</button>`;
        content.onclick=async event=>{const day=event.target.closest('[data-base-day]');if(day){captureBaseDay();state.selectedBaseDay=day.dataset.baseDay;renderBaseEditor();}if(event.target.closest('#bb-save-settings'))await saveSettings();};
        renderBaseEditor(); modal.hidden=false; document.body.style.overflow='hidden';
    }
    function closeSettings() { const modal=document.getElementById('bb-settings-modal');if(modal)modal.hidden=true;document.body.style.overflow=''; }
    async function saveSettings() {
        captureBaseDay(); const modal=document.getElementById('bb-settings-modal');
        PERIODS.forEach(name=>{const find=selector=>modal.querySelector(`${selector}[data-period="${name}"]`);state.periodTimes[name]={startTime:String(find('.bb-time-start')?.value||DEFAULTS[name].startTime),endTime:String(find('.bb-time-end')?.value||DEFAULTS[name].endTime)};});
        await db.ref('blackboard').update({periodTimes:state.periodTimes,baseSchedule:state.baseSchedule});
        closeSettings(); renderWeekEditor(); alert('교시 시간과 기본 시간표를 저장했습니다.');
    }

    window.initBlackboardAdmin=async function () {
        const container=document.getElementById('bb-schedule-form-container');if(!container)return;
        ensureStyles();container.innerHTML='<div class="bb-empty">전자칠판 정보를 불러오는 중입니다.</div>';
        const today=todayKst();state.selectedNoticeDate=today;state.selectedWeekStart=mondayOf(today);state.selectedWeekDate=state.selectedWeekStart;
        try{
            const [legacySchedule,periodTimes,baseSchedule,notices,week]=await Promise.all([
                db.ref('blackboard/schedule').once('value'),db.ref('blackboard/periodTimes').once('value'),
                db.ref('blackboard/baseSchedule').once('value'),db.ref('blackboard/notices').once('value'),
                db.ref(`blackboard/weeklySchedules/${state.selectedWeekStart}`).once('value')
            ]);
            state.legacySchedule=legacySchedule.val()||{};state.periodTimes=periodTimes.val()||{};state.baseSchedule=baseSchedule.val()||{};state.notices=notices.val()||{};state.week=week.val()||{};
            renderMain();
        }catch(error){console.error('전자칠판 관리 로딩 실패:',error);container.innerHTML='<div class="bb-empty" style="color:#c0392b">전자칠판 정보를 불러오지 못했습니다.</div>';}
    };
    window.saveBlackboardScheduleFromForm=saveWeek;
})();
