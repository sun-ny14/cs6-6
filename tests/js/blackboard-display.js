// js/blackboard-display.js - 전자칠판 표시 화면
(function () {
    'use strict';

    const PERIODS = ['아침','1교시','2교시','3교시','4교시','점심시간','청소시간','5교시','6교시','하교'];
    const DEFAULTS = {
        '아침':{startTime:'08:00',endTime:'09:00',subject:'아침'},
        '1교시':{startTime:'09:00',endTime:'09:40',subject:'1교시'},
        '2교시':{startTime:'09:50',endTime:'10:30',subject:'2교시'},
        '3교시':{startTime:'10:40',endTime:'11:20',subject:'3교시'},
        '4교시':{startTime:'11:30',endTime:'12:10',subject:'4교시'},
        '점심시간':{startTime:'12:10',endTime:'13:00',subject:'점심시간'},
        '청소시간':{startTime:'13:00',endTime:'13:20',subject:'청소시간'},
        '5교시':{startTime:'13:20',endTime:'14:00',subject:'5교시'},
        '6교시':{startTime:'14:10',endTime:'14:50',subject:'6교시'},
        '하교':{startTime:'14:50',endTime:'18:00',subject:'하교'}
    };
    const state = {
        legacySchedule:{}, legacyNotice:'', periodTimes:{}, baseSchedule:{},
        weeklySchedules:{}, notices:{}, users:{}, checkins:{}, seatData:{},
        cleaningRoot:{}, assignments:{}, assignmentCompletions:{}, dismissalNotes:{},
        manualPeriodName:'', manualModeKey:'', authUser:null, canEdit:false, memoTimers:{},
        dataReady:false, syncMessage:'전자칠판 자료를 연결하고 있습니다…', serverOffset:0
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function addDays(dateString, amount) {
        const date = new Date(`${dateString}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + amount);
        return date.toISOString().slice(0, 10);
    }

    function mondayOf(dateString) {
        const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
        return addDays(dateString, day === 0 ? -6 : 1 - day);
    }

    function toMinutes(value) {
        const [hour, minute] = String(value || '').split(':').map(Number);
        return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
    }

    function koreanNow() {
        const shifted = new Date(Date.now() + state.serverOffset + 9 * 60 * 60 * 1000);
        return {
            date:shifted.toISOString().slice(0,10),
            hour:shifted.getUTCHours(), minute:shifted.getUTCMinutes(),
            second:shifted.getUTCSeconds(), day:shifted.getUTCDay()
        };
    }

    function pad(value) { return String(value).padStart(2, '0'); }
    function isClassPeriod(name) { return /^\d교시$/.test(name); }

    function updateEditPermission() {
        const authUser = state.authUser;
        const savedAdminEmail = typeof adminEmail !== 'undefined'
            ? String(adminEmail || '').trim().toLowerCase()
            : '';
        const loginEmail = String(authUser?.email || '').trim().toLowerCase();
        const matchedUser = Object.values(state.users || {}).find(user =>
            String(user?.email || '').trim().toLowerCase() === loginEmail
        ) || {};
        const name = String(matchedUser.name || '').trim();
        const role = String(matchedUser.role || '').trim();
        state.canEdit = Boolean(authUser && (
            (savedAdminEmail && loginEmail === savedAdminEmail) ||
            matchedUser.isAdmin === true ||
            name === '총사령관' ||
            name.includes('선생님') ||
            role === '관리자' ||
            role === '교사'
        ));
    }

    function getSchedule(now) {
        const weekStart = mondayOf(now.date);
        const weekly = state.weeklySchedules?.[weekStart]?.[now.date] || {};
        const base = state.baseSchedule?.[String(now.day)] || {};
        const schedule = {};
        PERIODS.forEach(name => {
            const times = state.periodTimes[name] || {};
            schedule[name] = {
                ...DEFAULTS[name],
                ...(state.legacySchedule[name] || {}),
                ...(base[name] || {}),
                ...(weekly[name] || {}),
                startTime:times.startTime || state.legacySchedule[name]?.startTime || DEFAULTS[name].startTime,
                endTime:times.endTime || state.legacySchedule[name]?.endTime || DEFAULTS[name].endTime
            };
        });
        return schedule;
    }

    function getTimeline(schedule) {
        return PERIODS.map(name => {
            const data = schedule[name];
            return { name, ...data, start:toMinutes(data.startTime), end:toMinutes(data.endTime) };
        }).filter(item => item.start !== null && item.end !== null && item.end > item.start);
    }

    function getMode(nowMinutes, schedule) {
        const timeline = getTimeline(schedule);
        const active = timeline.find(item => nowMinutes >= item.start && nowMinutes < item.end);
        if (active) return { type:'period', active, timeline };
        const next = timeline.find(item => item.start > nowMinutes);
        if (next) return { type:'break', next, minutesUntil:next.start - nowMinutes, timeline };
        return { type:'finished', timeline };
    }

    function modeKey(now, mode) {
        const period = mode.active || mode.next;
        return `${now.date}/${mode.type}/${period?.name || ''}/${period?.start || 0}/${period?.end || 0}`;
    }

    function getCheckedNames(today) {
        const checked = new Set();
        Object.values(state.checkins || {}).forEach(value => {
            const item = value || {};
            const date = String(item.date || item.checkinDate || '').slice(0,10);
            const name = String(item.name || item.user || item.userName || '').trim();
            if (date === today && name) checked.add(name);
        });
        return checked;
    }

    function getSeats() {
        const data = state.seatData || {};
        const config = data.config || {};
        const layout = data.layout || {};
        const rows = Number(config.rows || data.rows) || 6;
        const cols = Number(config.cols || data.cols) || 5;
        const seats = [];
        for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                const key = `${row}-${col}`;
                const raw = layout[key] || layout[`seat-${row}-${col}`];
                const name = typeof raw === 'string'
                    ? raw.trim()
                    : String(raw && (raw.name || raw.studentName) || '').trim();
                seats.push({ row, col, key, name });
            }
        }
        return { rows, cols, seats };
    }

    function getStudentNumber(name) {
        const users=state.users||{};
        const direct=users[name]||{};
        const matched=direct?.name?direct:Object.values(users).find(user=>String(user?.name||'').trim()===name)||{};
        const number=Number(matched.number||matched.no||matched.studentNo);
        return Number.isFinite(number)&&number>0?number:null;
    }

    function getRoster() {
        const names=new Set();
        getSeats().seats.forEach(seat=>{if(seat.name)names.add(seat.name);});
        Object.entries(state.users||{}).forEach(([key,user])=>{const name=String(user?.name||key||'').trim();if(name&&name!=='총사령관'&&!name.includes('관리자')&&!name.includes('선생님'))names.add(name);});
        return Array.from(names).map(name=>({name,number:getStudentNumber(name)})).filter(student=>student.number!==null).sort((a,b)=>a.number-b.number);
    }

    function renderTimeline(activeName, schedule) {
        document.getElementById('timeline').innerHTML = PERIODS.map(name => {
            const data = schedule[name];
            const manual = name === state.manualPeriodName;
            return `<button type="button" class="period-chip${name === activeName ? ' is-active' : ''}${manual ? ' is-manual' : ''}" data-period-name="${name}" title="클릭하여 ${name} 화면 보기"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(data.startTime || '--:--')} · ${escapeHtml(data.subject || name)}</span></button>`;
        }).join('');
    }

    function renderViewerControls(autoActiveName) {
        const controls = document.getElementById('viewer-controls');
        if (state.manualPeriodName) {
            controls.innerHTML = `<strong>교사 수동 보기 · ${escapeHtml(state.manualPeriodName)}</strong><span>다음 수업·쉬는 시간이 되면 자동 전환으로 돌아갑니다.</span><button type="button" id="bb-return-auto">현재 시간 화면으로 돌아가기</button>`;
            controls.classList.add('manual');
        } else {
            controls.innerHTML = `<span>자동 전환 중${autoActiveName ? ` · 현재 ${escapeHtml(autoActiveName)}` : ''}</span><span>위 시간표를 클릭하면 점심·청소·수업 화면을 미리 볼 수 있습니다.</span>`;
            controls.classList.remove('manual');
        }
    }

    function renderNotice(today) {
        const notice = document.getElementById('notice-display');
        const hasDatedNotices = Object.keys(state.notices || {}).length > 0;
        const text = String(
            hasDatedNotices ? (state.notices[today] || '') : (state.legacyNotice || '')
        ).trim();
        notice.classList.toggle('is-visible', Boolean(text));
        notice.querySelector('span').textContent = text;
    }

    function renderSeatGrid(mode, today, item) {
        const seatInfo = getSeats();
        const checked = getCheckedNames(today);
        const cleaning = state.cleaningRoot?.[today] || {};
        let completed = 0;
        const cards = seatInfo.seats.map(seat => {
            if (!seat.name) return `<div class="seat empty"><span class="seat-number">${seat.row+1}-${seat.col+1}</span><span class="seat-name">빈자리</span></div>`;
            let good = false;
            let label = '';
            if (mode === 'morning') {
                good = checked.has(seat.name);
                label = good ? '등교 완료' : '미등교';
            } else {
                good = Boolean(cleaning[seat.name] && cleaning[seat.name].cleanDone);
                if (good) completed += 1;
                label = good ? '청소 확인 완료' : '확인 전';
            }
            return `<article class="seat ${good ? 'good' : mode === 'morning' ? 'bad' : 'wait'}"><span class="seat-number">${seat.row+1}-${seat.col+1}</span><strong class="seat-name">${escapeHtml(seat.name)}</strong><span class="seat-state">${label}</span></article>`;
        }).join('');
        const occupied = seatInfo.seats.filter(seat => seat.name).length;
        const goodCount = mode === 'morning'
            ? seatInfo.seats.filter(seat => seat.name && checked.has(seat.name)).length
            : completed;
        const badCount = Math.max(0, occupied - goodCount);
        const title = mode === 'morning' ? '아침 등교 확인' : '청소 확인';
        const guide = mode === 'morning' ? '자기 이름이 초록색인지 확인하세요.' : '자리 청소가 확인되면 초록색으로 바뀝니다.';
        const action=String(item?.action||'').trim();
        return `<div class="state-kicker">${title}</div><h2 class="state-title">${guide}</h2>${action?`<div class="action">${escapeHtml(action)}</div>`:''}<div class="summary-row"><span class="summary-pill good">완료 ${goodCount}명</span><span class="summary-pill ${badCount ? 'bad' : 'good'}">${mode === 'morning' ? '미등교' : '확인 전'} ${badCount}명</span></div><div class="seat-grid" style="--seat-cols:${seatInfo.cols}">${cards}</div>`;
    }

    function renderLesson(item, today) {
        const subject = String(item.subject || item.name).trim();
        const action = String(item.action || '').trim();
        const note = String(item.learningNote || '').trim();
        const memoBody = state.canEdit
            ? `<textarea class="inline-memo-input" data-inline-learning-note="${escapeHtml(item.name)}" data-note-date="${today}" placeholder="여기에 바로 입력하세요. 입력을 멈추면 자동 저장됩니다.">${escapeHtml(note)}</textarea>`
            : `<div class="inline-memo-view${note ? '' : ' inline-memo-empty'}">${note ? escapeHtml(note) : '아직 작성된 배움공책 & 메모가 없습니다.'}</div>`;
        return `<div class="state-kicker">${escapeHtml(item.name)} 수업 중</div><h2 class="state-title">${escapeHtml(subject)}</h2>${action ? `<div class="action">${escapeHtml(action)}</div>` : ''}<section class="inline-memo-card"><div class="inline-memo-head"><span>📖 배움공책 &amp; 메모</span>${state.canEdit ? '<span class="inline-memo-status" data-memo-status>입력하면 자동 저장됩니다.</span>' : ''}</div>${memoBody}</section>`;
    }

    async function saveInlineMemo(textarea) {
        if (!state.canEdit || !textarea?.isConnected) return;
        const periodName = textarea.dataset.inlineLearningNote || '';
        const date = textarea.dataset.noteDate || koreanNow().date;
        const weekStart = mondayOf(date);
        const learningNote = String(textarea.value || '').trim();
        const status = textarea.closest('.inline-memo-card')?.querySelector('[data-memo-status]');
        state.weeklySchedules[weekStart] ||= {};
        state.weeklySchedules[weekStart][date] ||= {};
        state.weeklySchedules[weekStart][date][periodName] ||= {};
        Object.assign(state.weeklySchedules[weekStart][date][periodName], {
            learningNote,
            showLearningNote:Boolean(learningNote)
        });
        if (status) status.textContent = '저장 중...';
        try {
            const path = `blackboard/weeklySchedules/${weekStart}/${date}/${periodName}`;
            await db.ref(path).update({ learningNote, showLearningNote:Boolean(learningNote) });
            if (status?.isConnected) status.textContent = 'Firebase에 저장됨';
        } catch (error) {
            console.error('배움공책 & 메모 자동 저장 실패:', error);
            if (status?.isConnected) status.textContent = '저장 실패 · 로그인 상태 확인';
        }
    }

    function renderSimplePeriod(item) {
        const action = String(item.action || '').trim();
        const icon = item.name === '점심시간' ? '🍱' : '☀️';
        return `<div class="state-kicker">${escapeHtml(item.name)}</div><h2 class="state-title">${icon} ${escapeHtml(item.subject || item.name)}</h2>${action ? `<p class="state-subtitle simple-action">${escapeHtml(action)}</p>` : ''}`;
    }

    function numbersHtml(students) {
        if(!students.length)return '<div class="number-list all-done">없음 🎉</div>';
        return `<div class="number-list">${students.map(student=>`${student.number}번`).join(', ')}</div>`;
    }

    function renderDismissal(today) {
        const roster=getRoster();
        const cleaning=state.cleaningRoot?.[today]||{};
        const cleaningIncomplete=roster.filter(student=>!Boolean(cleaning[student.name]?.cleanDone));
        const dueAssignments=Object.entries(state.assignments||{}).map(([id,item])=>{const completed=state.assignmentCompletions?.[id]||{};const incomplete=roster.filter(student=>!completed[student.name]);return {id,item,incomplete};}).filter(entry=>entry.item&&entry.item.active!==false&&entry.item.required!==false&&entry.item.dueDate<=today&&entry.incomplete.length>0);
        const assignmentHtml=dueAssignments.length?dueAssignments.map(({item,incomplete})=>{
            return `<div class="task-due-item"><div class="task-due-title">${escapeHtml(item.title||'제목 없는 과제')} · 마감 ${escapeHtml(item.dueDate||'')}</div><div class="task-due-numbers">${incomplete.map(student=>`${student.number}번`).join(', ')}</div></div>`;
        }).join(''):'<div class="number-list all-done" style="font-size:32px">미완료 과제 없음</div>';
        const manual=String(state.dismissalNotes?.[today]?.teacherMessage||state.dismissalNotes?.[today]?.manualIncomplete||'');
        const manualBody=state.canEdit?`<textarea class="dismissal-input" data-dismissal-note data-note-date="${today}" placeholder="하교 전 학생들에게 전달할 내용을 적으세요.">${escapeHtml(manual)}</textarea><div class="dismissal-status" data-dismissal-status>입력을 멈추면 자동 저장됩니다.</div>`:`<div class="dismissal-view">${manual?escapeHtml(manual):'전달사항 없음'}</div>`;
        return `<div class="dismissal-board"><div class="state-kicker">6교시 이후</div><h2 class="state-title">🏠 하교합니다</h2><p class="state-subtitle">아래 번호의 학생은 할 일을 마치고 하교하세요.</p><div class="dismissal-grid"><section class="dismissal-card clean"><h3>🧹 오늘 청소 미완료</h3>${numbersHtml(cleaningIncomplete)}</section><section class="dismissal-card task"><h3>📝 필수 과제 미완료</h3>${assignmentHtml}</section><section class="dismissal-card manual"><h3>📣 교사 전달사항</h3>${manualBody}</section></div></div>`;
    }

    async function saveDismissalNote(textarea) {
        if(!state.canEdit||!textarea?.isConnected)return;
        const today=textarea.dataset.noteDate||koreanNow().date;const teacherMessage=String(textarea.value||'').trim();
        const status=textarea.closest('.dismissal-card')?.querySelector('[data-dismissal-status]');
        state.dismissalNotes[today]={...(state.dismissalNotes[today]||{}),teacherMessage};
        if(status)status.textContent='저장 중...';
        try{await db.ref(`blackboard/dismissalNotes/${today}/teacherMessage`).set(teacherMessage||null);if(status?.isConnected)status.textContent='Firebase에 저장됨';}
        catch(error){console.error('하교 미완료 메모 저장 실패:',error);if(status?.isConnected)status.textContent='저장 실패 · 로그인 상태 확인';}
    }

    function renderBreak(mode, timeText) {
        const next = mode.next;
        const moving = isClassPeriod(next.name) && Boolean(next.isMovingClass);
        let message = '쉬는 시간입니다.';
        let tone = '';
        if (moving && mode.minutesUntil <= 5) {
            message = '이동수업입니다. 줄 서세요.';
            tone = 'move';
        } else if (isClassPeriod(next.name) && mode.minutesUntil <= 2) {
            message = '수업 준비하세요.';
            tone = 'prepare';
        }
        return `<div class="break-clock">${timeText.slice(0,5)}</div><div class="break-message ${tone}">${message}</div><div class="next-class">다음 시간 · ${escapeHtml(next.name)} ${escapeHtml(next.subject || next.name)} · ${escapeHtml(next.startTime)}</div>`;
    }

    function periodHtml(item, now) {
        if (item.name === '아침') return renderSeatGrid('morning', now.date, item);
        if (item.name === '청소시간') return renderSeatGrid('cleaning', now.date, item);
        if (item.name === '하교') return renderDismissal(now.date);
        if (isClassPeriod(item.name)) return renderLesson(item, now.date);
        return renderSimplePeriod(item);
    }

    function render() {
        const now = koreanNow();
        const schedule = getSchedule(now);
        const currentMinutes = now.hour * 60 + now.minute;
        const timeText = `${pad(now.hour)}:${pad(now.minute)}:${pad(now.second)}`;
        const dateText = new Intl.DateTimeFormat('ko-KR', {
            timeZone:'Asia/Seoul', year:'numeric', month:'long', day:'numeric', weekday:'long'
        }).format(new Date(Date.now() + state.serverOffset));
        document.getElementById('clock-display').textContent = timeText;
        document.getElementById('date-display').textContent = dateText;
        const syncStatus = document.getElementById('bb-sync-status');
        if (syncStatus) syncStatus.textContent = state.syncMessage;
        if (!state.dataReady) {
            document.getElementById('timeline').innerHTML = '';
            document.getElementById('viewer-controls').innerHTML = '';
            document.getElementById('notice-display').classList.remove('is-visible');
            document.getElementById('stage').innerHTML = '<div class="empty-message">전자칠판 자료를 기다리고 있습니다.</div>';
            return;
        }
        renderNotice(now.date);

        const mode = getMode(currentMinutes, schedule);
        const autoModeKey = modeKey(now, mode);
        if (state.manualPeriodName && state.manualModeKey !== autoModeKey) {
            state.manualPeriodName = '';
            state.manualModeKey = '';
        }
        const autoActiveName = mode.type === 'period' ? mode.active.name : '';
        const activeName = state.manualPeriodName || autoActiveName;
        renderTimeline(activeName, schedule);
        renderViewerControls(autoActiveName);
        const stage = document.getElementById('stage');
        const textarea = document.activeElement;
        const editingMemo = textarea?.matches?.('[data-inline-learning-note],[data-dismissal-note]');
        const viewKey = state.manualPeriodName
            ? `${now.date}/manual/${state.manualPeriodName}`
            : autoModeKey;

        // 입력 중에는 같은 화면만 유지한다. 교시·날짜가 바뀌면 저장 후 전환한다.
        if (editingMemo && stage.dataset.viewKey === viewKey) return;
        // Firebase의 즉시 로컬 갱신이 render를 다시 호출해도 중복 저장하지 않는다.
        stage.dataset.viewKey = viewKey;
        if (editingMemo) {
            if (textarea.dataset.inlineLearningNote) {
                clearTimeout(state.memoTimers[textarea.dataset.inlineLearningNote]);
                saveInlineMemo(textarea);
            } else {
                clearTimeout(state.memoTimers.dismissal);
                saveDismissalNote(textarea);
            }
        }
        if (state.manualPeriodName) {
            const manual = getTimeline(schedule).find(item => item.name === state.manualPeriodName);
            stage.innerHTML = manual ? periodHtml(manual, now) : '<div class="empty-message">선택한 화면을 찾을 수 없습니다.</div>';
        } else if (mode.type === 'period') {
            stage.innerHTML = periodHtml(mode.active, now);
        } else if (mode.type === 'break') {
            stage.innerHTML = renderBreak(mode, timeText);
        } else {
            stage.innerHTML = renderDismissal(now.date);
        }
    }

    const sourcePaths = {
        legacySchedule:'blackboard/schedule', legacyNotice:'blackboard/notice',
        periodTimes:'blackboard/periodTimes', baseSchedule:'blackboard/baseSchedule',
        weeklySchedules:'blackboard/weeklySchedules', notices:'blackboard/notices',
        users:'users', checkins:'checkins', seatData:'seatLayoutData',
        cleaningRoot:'classManagement/cleaningStatus', assignments:'blackboard/assignments',
        assignmentCompletions:'blackboard/assignmentCompletions', dismissalNotes:'blackboard/dismissalNotes'
    };
    let sourceGeneration = 0;
    let sourceStops = [];

    function connectSources(user) {
        const generation = ++sourceGeneration;
        sourceStops.forEach(stop => stop());
        sourceStops = [];
        Object.keys(sourcePaths).forEach(key => state[key] = key === 'legacyNotice' ? '' : {});
        state.dataReady = false;
        state.manualPeriodName = '';
        state.manualModeKey = '';
        state.syncMessage = '전자칠판 자료를 연결하고 있습니다…';
        const subscribe = (path, receive) => {
            const ref = db.ref(path);
            const callback = snapshot => { if (generation === sourceGeneration) receive(snapshot); };
            ref.on('value', callback, error => {
                if (generation !== sourceGeneration) return;
                state.syncMessage = '전자칠판 자료를 읽지 못했습니다. Firebase 규칙과 연결 상태를 확인해 주세요.';
                console.error('전자칠판 연결 실패:', error);
                render();
            });
            sourceStops.push(() => ref.off('value', callback));
        };
        if (user) {
            const waiting = new Set(Object.keys(sourcePaths));
            Object.entries(sourcePaths).forEach(([key, path]) => subscribe(path, snapshot => {
                state[key] = snapshot.val() ?? (key === 'legacyNotice' ? '' : {});
                waiting.delete(key);
                state.dataReady = waiting.size === 0;
                if (state.dataReady) state.syncMessage = '';
                if (key === 'users') updateEditPermission();
                render();
            }));
        } else {
            // A fresh device reads only the deliberately published display data.
            // It never requests users, points, attendance reasons or other private paths.
            subscribe('blackboardDisplay', snapshot => {
                const shared = snapshot.val();
                if (shared?.schemaVersion !== 1 || !shared.data) {
                    state.dataReady = false;
                    state.syncMessage = '공유 자료가 아직 없습니다. 관리자 PC에서 새 버전의 학급 앱에 한 번 로그인해 주세요.';
                } else {
                    Object.keys(sourcePaths).forEach(key => state[key] = shared.data[key] ?? (key === 'legacyNotice' ? '' : {}));
                    state.dataReady = true;
                    state.syncMessage = '';
                }
                render();
            });
        }
        render();
    }

    document.getElementById('timeline').addEventListener('click', event => {
        const button = event.target.closest('[data-period-name]');
        if (!button) return;
        const now = koreanNow();
        state.manualModeKey = modeKey(now, getMode(now.hour * 60 + now.minute, getSchedule(now)));
        state.manualPeriodName = button.dataset.periodName;
        render();
    });
    document.getElementById('viewer-controls').addEventListener('click', event => {
        if (!event.target.closest('#bb-return-auto')) return;
        state.manualPeriodName = '';
        state.manualModeKey = '';
        render();
    });
    document.getElementById('stage').addEventListener('input', event => {
        const dismissal=event.target.closest('[data-dismissal-note]');
        if(dismissal){const status=dismissal.closest('.dismissal-card')?.querySelector('[data-dismissal-status]');if(status)status.textContent='저장 대기 중...';clearTimeout(state.memoTimers.dismissal);state.memoTimers.dismissal=setTimeout(()=>saveDismissalNote(dismissal),800);return;}
        const textarea = event.target.closest('[data-inline-learning-note]');
        if (!textarea) return;
        const key = textarea.dataset.inlineLearningNote;
        const status = textarea.closest('.inline-memo-card')?.querySelector('[data-memo-status]');
        if (status) status.textContent = '저장 대기 중...';
        clearTimeout(state.memoTimers[key]);
        state.memoTimers[key] = setTimeout(() => saveInlineMemo(textarea), 800);
    });
    document.getElementById('stage').addEventListener('focusout', event => {
        const dismissal=event.target.closest('[data-dismissal-note]');
        if(dismissal){clearTimeout(state.memoTimers.dismissal);saveDismissalNote(dismissal);return;}
        const textarea = event.target.closest('[data-inline-learning-note]');
        if (!textarea) return;
        const key = textarea.dataset.inlineLearningNote;
        clearTimeout(state.memoTimers[key]);
        saveInlineMemo(textarea);
    });

    db.ref('.info/serverTimeOffset').on('value', snapshot => {
        state.serverOffset = Number(snapshot.val()) || 0;
        render();
    });
    if (typeof auth !== 'undefined' && auth?.onAuthStateChanged) {
        auth.onAuthStateChanged(user => {
            state.authUser = user || null;
            updateEditPermission();
            connectSources(user);
        });
    } else connectSources(null);
    setInterval(render, 1000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') render();
    });
    window.addEventListener('focus', render);
    window.addEventListener('pageshow', render);
    render();
})();
