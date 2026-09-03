const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { project, startPublisher, sources } = require('../js/blackboard-share.js');

test('projection includes board fields while removing emails, points, attendance reasons and history', () => {
    const shared = project({
        users: { privateUid: { name: '학생', no: 7, email: 'SECRET_EMAIL', points: 999, password: 'SECRET_PASSWORD', exp: 888, myRoom: { secret: 'SECRET_ROOM' } } },
        checkins: {
            privateId: { name: '학생', date: '2026-09-02', reason: 'SECRET_HEALTH', pointPenalty: 200, time: 'SECRET_TIME' },
            old: { name: '학생', date: '2026-09-01' }
        },
        cleaningRoot: { '2026-09-02': { 학생: { cleanDone: true, checkedBy: 'SECRET_TEACHER' } }, '2026-09-01': { 학생: { cleanDone: true } } },
        seatData: { config: { rows: 1, cols: 1, secret: 'SECRET_CONFIG' }, layout: { '0-0': { name: '학생', email: 'SECRET_SEAT' } }, secret: 'SECRET_LAYOUT' },
        assignments: { a: { title: '과제', dueDate: '2026-09-02', required: true, privateMemo: 'SECRET_MEMO' }, old: { title: '삭제된 과제', active: false } },
        assignmentCompletions: { a: { 학생: { completedAt: 1, completedBy: 'SECRET_TEACHER' } } },
        dismissalNotes: { '2026-09-02': { teacherMessage: '준비물 챙기기', privateMemo: 'SECRET_NOTE' } }
    }, '2026-09-02');
    const output = JSON.stringify(shared);
    assert.doesNotMatch(output, /SECRET|privateUid|privateId|999|888|2026-09-01/);
    assert.deepEqual(Object.values(shared.users), [{ name: '학생', number: 7 }]);
    assert.deepEqual(Object.values(shared.checkins), [{ name: '학생', date: '2026-09-02' }]);
    assert.deepEqual(shared.cleaningRoot, { '2026-09-02': { 학생: { cleanDone: true } } });
    assert.deepEqual(shared.assignmentCompletions, { a: { 학생: true } });
    assert.equal(shared.seatData.layout['0-0'], '학생');
    assert.equal(shared.dismissalNotes['2026-09-02'].teacherMessage, '준비물 챙기기');
});

test('partial weekly overrides keep inheritance and only copy display fields', () => {
    const value = project({
        legacySchedule: { '1교시': { subject: '국어', private: 'SECRET' } },
        baseSchedule: { 3: { '1교시': { subject: '수학', action: '교과서 펴기' } } },
        weeklySchedules: { '2026-08-31': { '2026-09-02': { '1교시': { learningNote: '오늘 메모' } } } },
        notices: { '2026-09-02': '공지' }
    }, '2026-09-02');
    assert.deepEqual(value.weeklySchedules['2026-08-31']['2026-09-02']['1교시'], { learningNote: '오늘 메모' });
    assert.equal(value.baseSchedule[3]['1교시'].subject, '수학');
    assert.equal(value.notices['2026-09-02'], '공지');
    assert.doesNotMatch(JSON.stringify(value), /SECRET/);
});

function harness() {
    let authCallback; let id = 0;
    const listeners = new Map(); const timers = new Map(); const intervals = new Map();
    const writes = []; const messages = [];
    const clock = { now: Date.parse('2026-09-02T14:59:00Z') };
    const db = { fail: false, ref(key) { return {
        on(_event, callback) { listeners.set(key, callback); },
        off() { listeners.delete(key); },
        async update(value) { if (db.fail) throw Error('Permission denied'); writes.push(JSON.parse(JSON.stringify(value))); }
    }; } };
    const stop = startPublisher(db, { onAuthStateChanged(callback) { authCallback = callback; callback(null); } }, {
        now: () => clock.now,
        setTimeout(callback) { timers.set(++id, callback); return id; },
        clearTimeout(key) { timers.delete(key); },
        setInterval(callback) { intervals.set(++id, callback); return id; },
        clearInterval(key) { intervals.delete(key); },
        report(message) { messages.push(message); }
    });
    const emit = (key, value) => listeners.get(key)?.({ val: () => value });
    async function flush() {
        const callbacks = [...timers.values()]; timers.clear();
        for (const callback of callbacks) await callback();
    }
    return { db, writes, messages, timers, intervals, listeners, clock, stop, emit, flush,
        login: () => authCallback({ uid: 'test-user' }), logout: () => authCallback(null),
        load: () => Object.values(sources).forEach(key => emit(key, null))
    };
}

test('signed-out devices never start private listeners or publish', async () => {
    const app = harness(); await app.flush();
    assert.equal(app.listeners.size, 0); assert.equal(app.writes.length, 0);
    app.stop();
});

test('initial publication waits for every source and persists the sanitized data', async () => {
    const app = harness(); app.login(); app.emit('.info/connected', true);
    const paths = Object.values(sources);
    paths.slice(0, -1).forEach(key => app.emit(key, null));
    await app.flush(); assert.equal(app.writes.length, 0);
    app.emit(paths.at(-1), null);
    app.emit('blackboard/notices', { '2026-09-02': '새 공지' });
    await app.flush();
    assert.equal(app.writes.length, 1);
    assert.equal(app.writes[0].data.notices['2026-09-02'], '새 공지');
    assert.equal(app.writes[0].schemaVersion, 1);
    assert.equal(app.writes[0].publishedDate, '2026-09-02');
    app.stop();
});

test('source changes automatically update the shared board but private-only changes do not', async () => {
    const app = harness(); app.login(); app.load(); app.emit('.info/connected', true);
    app.emit('users', { person: { name: '학생', number: 1, points: 5 } }); await app.flush();
    app.emit('users', { person: { name: '학생', number: 1, points: 999 } }); await app.flush();
    assert.equal(app.writes.length, 1);
    app.emit('blackboard/notices', { '2026-09-02': '수정 공지' }); await app.flush();
    assert.equal(app.writes.length, 2);
    assert.equal(app.writes[1].data.notices['2026-09-02'], '수정 공지');
    app.stop();
});

test('offline updates wait, failed publication retries and logout cancels listeners', async () => {
    const app = harness(); app.login(); app.load();
    await app.flush(); assert.equal(app.writes.length, 0);
    app.db.fail = true; app.emit('.info/connected', true); await app.flush();
    assert.equal(app.writes.length, 0); assert.match(app.messages.at(-1), /공유 실패/);
    app.db.fail = false; await app.flush(); assert.equal(app.writes.length, 1);
    app.logout(); assert.equal(app.listeners.size, 0); assert.equal(app.timers.size, 0); assert.equal(app.intervals.size, 0);
    app.stop();
});

test('Korean midnight refreshes only the current-day attendance projection', async () => {
    const app = harness(); app.login(); app.load(); app.emit('.info/connected', true);
    app.emit('users', { student: { name: '학생', number: 1 } });
    app.emit('checkins', { one: { name: '학생', date: '2026-09-02' } }); await app.flush();
    assert.equal(Object.keys(app.writes[0].data.checkins).length, 1);
    app.clock.now = Date.parse('2026-09-02T15:00:00Z');
    [...app.intervals.values()].forEach(callback => callback()); await app.flush();
    assert.equal(app.writes.at(-1).publishedDate, '2026-09-03');
    assert.deepEqual(app.writes.at(-1).data.checkins, {});
    app.stop();
});

test('rules grant anonymous read only to the display path, preserving existing login checks', () => {
    const { rules } = JSON.parse(fs.readFileSync(path.join(__dirname, '../database.rules.json'), 'utf8'));
    assert.equal(rules['.read'], 'auth != null');
    assert.equal(rules['.write'], 'auth != null');
    assert.deepEqual(rules.blackboardDisplay, { '.read': true });
    assert.deepEqual(rules.pointLogs, { '.indexOn': ['name'] });
    assert.deepEqual(Object.keys(rules).filter(key => !key.startsWith('.')).sort(), ['blackboardDisplay', 'pointLogs']);
});
