// Only the fields actually shown on the board are copied to the public path.
(function (root) {
    'use strict';
    const sources = {
        legacySchedule: 'blackboard/schedule', legacyNotice: 'blackboard/notice',
        periodTimes: 'blackboard/periodTimes', baseSchedule: 'blackboard/baseSchedule',
        weeklySchedules: 'blackboard/weeklySchedules', notices: 'blackboard/notices',
        users: 'users', checkins: 'checkins', seatData: 'seatLayoutData',
        cleaningRoot: 'classManagement/cleaningStatus', assignments: 'blackboard/assignments',
        assignmentCompletions: 'blackboard/assignmentCompletions', dismissalNotes: 'blackboard/dismissalNotes'
    };
    const periods = ['아침','1교시','2교시','3교시','4교시','점심시간','청소시간','5교시','6교시','하교'];
    const text = value => typeof value === 'string' ? value : '';
    const entries = value => value && typeof value === 'object' ? Object.entries(value) : [];
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const dateMap = (value, convert) => Object.fromEntries(entries(value)
        .filter(([key]) => datePattern.test(key)).map(([key, item]) => [key, convert(item)]));
    const todayKst = timestamp => new Date(timestamp + 9 * 3600000).toISOString().slice(0, 10);

    function schedule(raw) {
        return Object.fromEntries(periods.filter(name => raw?.[name]).map(name => {
            const item = raw[name];
            const result = {};
            ['subject', 'action', 'startTime', 'endTime', 'learningNote'].forEach(key => {
                if (Object.hasOwn(item, key)) result[key] = text(item[key]);
            });
            ['isMovingClass', 'showLearningNote'].forEach(key => {
                if (Object.hasOwn(item, key)) result[key] = !!item[key];
            });
            return [name, result];
        }));
    }

    function project(raw, today) {
        const times = Object.fromEntries(periods.filter(name => raw.periodTimes?.[name]).map(name => [name, {
            startTime: text(raw.periodTimes[name].startTime), endTime: text(raw.periodTimes[name].endTime)
        }]));
        const users = {};
        entries(raw.users).forEach(([key, user], index) => {
            if (!user || typeof user !== 'object') return;
            const name = text(user.name || key).trim();
            if (!name || name === '총사령관' || name.includes('관리자') || name.includes('선생님')) return;
            const number = Number(user.number || user.no || user.studentNo);
            if (Number.isFinite(number) && number > 0) users[`student-${index}`] = { name, number };
        });
        const visibleNames = new Set(Object.values(users).map(user => user.name));
        entries(raw.seatData?.layout).filter(([key]) => /^(seat-)?\d+-\d+$/.test(key)).forEach(([, seat]) => {
            const name = typeof seat === 'string' ? seat : text(seat?.name || seat?.studentName);
            if (name) visibleNames.add(name.trim());
        });
        const checkins = {};
        entries(raw.checkins).forEach(([, record], index) => {
            const date = text(record?.date || record?.checkinDate).slice(0, 10);
            const name = text(record?.name || record?.user || record?.userName).trim();
            if (date === today && visibleNames.has(name)) checkins[`entry-${index}`] = { name, date };
        });
        const seat = raw.seatData || {};
        const layout = Object.fromEntries(entries(seat.layout).filter(([key]) => /^(seat-)?\d+-\d+$/.test(key))
            .map(([key, value]) => [key, typeof value === 'string' ? value : text(value?.name || value?.studentName)]));
        const dimension = (value, fallback) => Math.min(50, Math.max(1, parseInt(value, 10) || fallback));
        const cleaning = Object.fromEntries(entries(raw.cleaningRoot?.[today]).filter(([name]) => visibleNames.has(name))
            .map(([name, value]) => [name, { cleanDone: !!value?.cleanDone }]));
        const assignments = Object.fromEntries(entries(raw.assignments).filter(([, item]) => item && item.active !== false && item.required !== false)
            .map(([id, item]) => [id, { title: text(item.title), dueDate: text(item.dueDate),
                active: item.active !== false, required: item.required !== false }]));
        const completions = Object.fromEntries(Object.keys(assignments).map(id => [id,
            Object.fromEntries(entries(raw.assignmentCompletions?.[id]).filter(([name, value]) => visibleNames.has(name) && !!value)
                .map(([name]) => [name, true]))]));
        return {
            legacySchedule: schedule(raw.legacySchedule), legacyNotice: text(raw.legacyNotice),
            periodTimes: times,
            baseSchedule: Object.fromEntries(entries(raw.baseSchedule).filter(([day]) => /^[0-6]$/.test(day))
                .map(([day, value]) => [day, schedule(value)])),
            weeklySchedules: dateMap(raw.weeklySchedules, week => dateMap(week, schedule)),
            notices: dateMap(raw.notices, text), users, checkins,
            seatData: { config: { rows: dimension(seat.config?.rows || seat.rows, 6),
                cols: dimension(seat.config?.cols || seat.cols, 5) }, layout },
            cleaningRoot: { [today]: cleaning }, assignments, assignmentCompletions: completions,
            dismissalNotes: dateMap(raw.dismissalNotes, value => ({
                teacherMessage: text(value?.teacherMessage || value?.manualIncomplete)
            }))
        };
    }

    function startPublisher(database, authentication, options = {}) {
        const later = options.setTimeout || setTimeout;
        const cancel = options.clearTimeout || clearTimeout;
        const clock = options.now || Date.now;
        const stamp = options.timestamp || { '.sv': 'timestamp' };
        const report = options.report || (() => {});
        let stopSession = () => {};
        const stopAuth = authentication.onAuthStateChanged(user => {
            stopSession();
            if (!user) return;
            let active = true, connected = false, offset = 0, timer, writing = false;
            let lastSent = '', lastDay = '', dirty = false;
            const raw = {}, loaded = new Set(), failed = new Set(), subscriptions = [];
            const listen = (path, receive, fail) => {
                const ref = database.ref(path);
                ref.on('value', receive, fail);
                subscriptions.push(() => ref.off('value', receive));
            };
            const queue = () => {
                dirty = true;
                if (!active || !connected || writing) return;
                cancel(timer);
                timer = later(publish, 250);
            };
            async function publish() {
                if (!active || !connected || writing || loaded.size !== Object.keys(sources).length || failed.size) return;
                const day = todayKst(clock() + offset);
                const data = project(raw, day);
                const fingerprint = JSON.stringify({ day, data });
                if (fingerprint === lastSent) { dirty = false; return; }
                writing = true;
                dirty = false;
                try {
                    await database.ref('blackboardDisplay').set({ schemaVersion: 1,
                        publishedAt: stamp, publishedDate: day, data });
                    if (!active) return;
                    lastSent = fingerprint;
                    lastDay = day;
                    report('전자칠판 공유 완료 · 다른 기기에서도 주소만 열면 볼 수 있습니다.');
                } catch (error) {
                    if (active) {
                        report('전자칠판 공유 실패 · Firebase 연결과 규칙을 확인해 주세요.', error);
                        dirty = true;
                    }
                } finally {
                    writing = false;
                    if (active && dirty) { cancel(timer); timer = later(publish, 3000); }
                }
            }
            Object.entries(sources).forEach(([key, path]) => listen(path, snapshot => {
                if (!active) return;
                raw[key] = snapshot.val(); loaded.add(key); failed.delete(key); queue();
            }, error => {
                if (!active) return;
                failed.add(key);
                report('전자칠판 자료를 읽지 못했습니다. 로그인 상태와 Firebase 규칙을 확인해 주세요.', error);
            }));
            listen('.info/serverTimeOffset', snapshot => { offset = Number(snapshot.val()) || 0; queue(); });
            listen('.info/connected', snapshot => {
                connected = snapshot.val() === true;
                if (connected) { lastSent = ''; queue(); }
            });
            const interval = (options.setInterval || setInterval)(() => {
                if (todayKst(clock() + offset) !== lastDay) queue();
            }, 60000);
            stopSession = () => {
                active = false; cancel(timer);
                (options.clearInterval || clearInterval)(interval);
                subscriptions.forEach(stop => stop());
            };
            report('전자칠판 공유 자료를 준비하고 있습니다…');
        });
        return () => { stopSession(); if (typeof stopAuth === 'function') stopAuth(); };
    }

    const api = { sources, project, startPublisher };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.BlackboardShare = api;
    if (root && typeof db !== 'undefined' && typeof auth !== 'undefined') {
        startPublisher(db, auth, { report(message, error) {
            const status = document.getElementById('bb-share-status');
            if (status) status.textContent = message;
            if (error) console.error(message, error);
        } });
    }
})(typeof window !== 'undefined' ? window : null);
