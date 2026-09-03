// Run with: node --test tests/blackboard.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function board(time = '2026-09-02T09:39:59+09:00', signedIn = true) {
    const clock = { now: Date.parse(time) };
    const nodes = new Map(); const listeners = {}; const windowListeners = {};
    const subscriptions = {}; const errors = {}; const writes = []; const timers = new Map(); const intervals = [];
    let authCallback;
    let timerId = 0;
    const document = {
        activeElement: null, visibilityState: 'visible',
        getElementById: id => nodes.get(id),
        addEventListener: (type, listener) => listeners[type] = listener
    };
    function element() {
        const events = {}; const classes = new Set();
        return {
            dataset: {}, textContent: '', isConnected: true, events,
            classList: { add: value => classes.add(value), remove: value => classes.delete(value),
                toggle: (value, active) => active ? classes.add(value) : classes.delete(value) },
            addEventListener: (type, listener) => events[type] = listener,
            querySelector: () => ({ textContent: '', isConnected: true }),
            get innerHTML() { return this.html || ''; },
            set innerHTML(html) {
                this.html = html;
                if (this === nodes.get('stage') && document.activeElement) {
                    document.activeElement.isConnected = false;
                    document.activeElement = null;
                }
            }
        };
    }
    for (const id of ['clock-display', 'date-display', 'notice-display', 'timeline', 'viewer-controls', 'stage', 'bb-sync-status']) nodes.set(id, element());
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [clock.now])); }
        static now() { return clock.now; }
    }
    const db = { ref: key => ({
        on: (_event, callback, error) => { subscriptions[key] = callback; errors[key] = error; callback({ val: () => null }); },
        off: () => { delete subscriptions[key]; },
        update: async value => { writes.push({ key, value: JSON.parse(JSON.stringify(value)) }); },
        set: async value => { writes.push({ key, value }); }
    }) };
    const context = vm.createContext({ document, db, Date: Clock, console,
        adminEmail: 'teacher@example.test',
        auth: { onAuthStateChanged: callback => { authCallback = callback; callback(signedIn ? { email: 'teacher@example.test' } : null); } },
        setInterval: callback => { intervals.push(callback); },
        setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
        clearTimeout: id => timers.delete(id),
        addEventListener: (type, listener) => windowListeners[type] = listener
    });
    context.window = context;
    context.CheckinPasswordCore = require('../functions/checkin-password-core');
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/blackboard-display.js'), 'utf8'), context);
    function tick(time) { if (time) clock.now = Date.parse(time); intervals.forEach(callback => callback()); }
    function select(name) {
        nodes.get('timeline').events.click({ target: { closest: () => ({ dataset: { periodName: name } }) } });
    }
    function edit(name = '1교시', date = '2026-09-02') {
        const textarea = { dataset: { noteDate: date }, value: '전환 전에 쓴 메모', isConnected: true,
            matches: () => true,
            closest(selector) {
                if (selector === '[data-dismissal-note]') return name === '하교' ? this : null;
                if (selector === '[data-inline-learning-note]') return name !== '하교' ? this : null;
                return { querySelector: () => ({ textContent: '', isConnected: true }) };
            }
        };
        if (name !== '하교') textarea.dataset.inlineLearningNote = name;
        else textarea.dataset.dismissalNote = '';
        document.activeElement = textarea;
        return textarea;
    }
    return { tick, select, edit, nodes, writes, clock, document, listeners, windowListeners, timers, subscriptions,
        signOut: () => authCallback(null),
        fail: key => errors[key]?.(new Error('Permission denied')),
        emit: (key, value) => subscriptions[key]({ val: () => value }),
        stage: () => nodes.get('stage').innerHTML,
        controls: () => nodes.get('viewer-controls').innerHTML
    };
}

test('clock automatically advances from class to break and next class', () => {
    const app = board();
    assert.match(app.stage(), /1교시 수업 중/);
    app.tick('2026-09-02T09:40:00+09:00'); assert.match(app.stage(), /쉬는 시간입니다/);
    app.tick('2026-09-02T09:48:00+09:00'); assert.match(app.stage(), /수업 준비하세요/);
    app.tick('2026-09-02T09:50:00+09:00'); assert.match(app.stage(), /2교시 수업 중/);
});

test('a focused memo does not freeze the board at a period boundary', async () => {
    const app = board(); const textarea = app.edit();
    app.nodes.get('stage').events.input({ target: textarea });
    app.tick('2026-09-02T09:40:00+09:00');
    assert.match(app.stage(), /쉬는 시간입니다/);
    assert.deepEqual(app.writes[0], {
        key: 'blackboard/weeklySchedules/2026-08-31/2026-09-02/1교시',
        value: { learningNote: '전환 전에 쓴 메모', showLearningNote: true }
    });
    assert.equal(app.timers.size, 0);
});

test('typing within the same class keeps the textarea and unsaved value intact', () => {
    const app = board('2026-09-02T09:10:00+09:00'); const textarea = app.edit();
    app.tick('2026-09-02T09:10:01+09:00');
    assert.equal(app.document.activeElement, textarea);
    assert.equal(textarea.value, '전환 전에 쓴 메모');
    assert.equal(app.writes.length, 0);
});

test('manual preview lasts within a time slot, then returns to automatic switching', () => {
    const app = board(); app.select('점심시간');
    assert.match(app.stage(), /🍱/); assert.match(app.controls(), /수동/);
    app.tick(); assert.match(app.stage(), /🍱/);
    app.tick('2026-09-02T09:40:00+09:00');
    assert.match(app.stage(), /쉬는 시간입니다/); assert.match(app.controls(), /자동 전환 중/);
});

test('manual preview during break returns to the next scheduled lesson', () => {
    const app = board('2026-09-02T09:45:00+09:00'); app.select('청소시간');
    assert.match(app.stage(), /청소 확인/);
    app.tick('2026-09-02T09:50:00+09:00'); assert.match(app.stage(), /2교시 수업 중/);
});

test('return-to-auto works immediately even while a preview memo has focus', () => {
    const app = board(); app.select('2교시'); app.edit('2교시');
    app.nodes.get('viewer-controls').events.click({ target: { closest: () => ({}) } });
    assert.match(app.stage(), /1교시 수업 중/); assert.match(app.controls(), /자동 전환 중/);
    assert.equal(app.writes[0].key, 'blackboard/weeklySchedules/2026-08-31/2026-09-02/2교시');
});

test('manual preview at midnight resets and saves dismissal text against its original date', () => {
    const app = board('2026-09-06T23:59:59+09:00'); app.select('하교'); app.edit('하교', '2026-09-06');
    app.tick('2026-09-07T00:00:00+09:00');
    assert.match(app.stage(), /쉬는 시간입니다/); assert.match(app.controls(), /자동 전환 중/);
    assert.equal(app.writes[0].key, 'blackboard/dismissalNotes/2026-09-06/teacherMessage');
});

test('a memo crossing midnight/week boundary is saved to its original lesson and week', () => {
    const app = board('2026-09-06T23:59:59+09:00'); app.select('1교시'); app.edit('1교시', '2026-09-06');
    app.tick('2026-09-07T00:00:00+09:00');
    assert.equal(app.writes[0].key, 'blackboard/weeklySchedules/2026-08-31/2026-09-06/1교시');
});

test('resume events immediately catch up to the current time without waiting for the timer', () => {
    for (const event of ['visibilitychange', 'focus', 'pageshow']) {
        const app = board(); app.clock.now = Date.parse('2026-09-02T10:00:00+09:00');
        if (event === 'visibilitychange') app.listeners[event]();
        else app.windowListeners[event]();
        assert.match(app.stage(), /2교시 수업 중/);
    }
});

test('custom period times and realtime schedule updates drive automatic switching', () => {
    const app = board('2026-09-02T09:10:00+09:00');
    app.emit('blackboard/periodTimes', { '1교시': { startTime: '09:00', endTime: '09:15' }, '2교시': { startTime: '09:20', endTime: '10:00' } });
    app.select('점심시간');
    app.tick('2026-09-02T09:15:00+09:00'); assert.match(app.stage(), /쉬는 시간입니다/);
    app.tick('2026-09-02T09:20:00+09:00'); assert.match(app.stage(), /2교시 수업 중/);
});

test('lunch, cleaning, afternoon lesson and dismissal switch at the expected boundaries', () => {
    const app = board('2026-09-02T12:09:59+09:00');
    app.tick('2026-09-02T12:10:00+09:00'); assert.match(app.stage(), /🍱/);
    app.tick('2026-09-02T13:00:00+09:00'); assert.match(app.stage(), /청소 확인/);
    app.tick('2026-09-02T13:20:00+09:00'); assert.match(app.stage(), /5교시 수업 중/);
    app.tick('2026-09-02T14:50:00+09:00'); assert.match(app.stage(), /하교합니다/);
});

test('a fresh device only subscribes to public board data and the server clock', () => {
    const app = board(undefined, false);
    assert.deepEqual(Object.keys(app.subscriptions).sort(), ['.info/serverTimeOffset', 'blackboardDisplay']);
    assert.match(app.stage(), /자료를 기다리고/);
    assert.match(app.nodes.get('bb-sync-status').textContent, /공유 자료가 아직 없습니다/);
    app.emit('blackboardDisplay', { schemaVersion: 1, data: { legacySchedule: { '1교시': { subject: '국어', learningNote: '함께 읽기' } } } });
    assert.match(app.stage(), /국어/); assert.match(app.stage(), /함께 읽기/);
    assert.doesNotMatch(app.stage(), /<textarea/);
});

test('two signed-out devices receive saved changes without a login or refresh', () => {
    const first = board(undefined, false); const second = board(undefined, false);
    const shared = { schemaVersion: 1, data: { legacySchedule: { '1교시': { subject: '국어', learningNote: '첫 메모' } } } };
    for (const app of [first, second]) app.emit('blackboardDisplay', shared);
    assert.equal(first.stage(), second.stage());
    shared.data.legacySchedule['1교시'].learningNote = '수정한 메모';
    for (const app of [first, second]) app.emit('blackboardDisplay', shared);
    assert.match(first.stage(), /수정한 메모/); assert.equal(first.stage(), second.stage());
});

test('sign-out removes private subscriptions and a denied public read shows a connection error', () => {
    const app = board(); app.signOut();
    assert.deepEqual(Object.keys(app.subscriptions).sort(), ['.info/serverTimeOffset', 'blackboardDisplay']);
    app.fail('blackboardDisplay');
    assert.match(app.nodes.get('bb-sync-status').textContent, /읽지 못했습니다/);
    assert.doesNotMatch(app.stage(), /1교시 수업 중/);
});

test('server clock correction keeps devices on the same scheduled lesson', () => {
    const app = board('2026-09-02T09:49:00+09:00');
    app.emit('.info/serverTimeOffset', 120000);
    assert.match(app.stage(), /2교시 수업 중/);
    assert.equal(app.nodes.get('clock-display').textContent, '09:51:00');
});


test('morning shows today password and hides yesterday password and non-morning fields', () => {
    const app = board('2026-09-03T08:30:00+09:00');
    app.emit('settings', { password:'0123', passwordDate:'2026-09-03', passwordRevision:2 });
    assert.match(app.stage(), /오늘의 등교 암호/);
    assert.match(app.stage(), /<strong>0123<\/strong>/);
    app.emit('settings', { password:'9876', passwordDate:'2026-09-02' });
    assert.doesNotMatch(app.stage(), /9876/);
    assert.match(app.stage(), /암호를 준비/);
    app.tick('2026-09-03T09:00:00+09:00');
    assert.doesNotMatch(app.stage(), /morning-password/);
    app.select('청소시간'); assert.doesNotMatch(app.stage(), /morning-password/);
});

test('anonymous board receives live manual password changes from public sibling', () => {
    const app = board('2026-09-03T08:30:00+09:00', false);
    const payload = { schemaVersion:1, data:{}, checkinPassword:{password:'1357',date:'2026-09-03',revision:1} };
    app.emit('blackboardDisplay', payload); assert.match(app.stage(), /1357/);
    payload.checkinPassword = { password:'2468', date:'2026-09-03', revision:2 };
    app.emit('blackboardDisplay', payload); assert.match(app.stage(), /2468/);
    assert.doesNotMatch(app.stage(), /1357/);
    assert.equal(app.subscriptions.settings, undefined);
});

test('dismissal shows literal tomorrow across year and month boundaries without a legacy fallback', () => {
    const app = board('2026-12-31T15:00:00+09:00');
    app.emit('blackboard/notices', {'2027-01-01':'내일 준비물 <책>\n물통', '2026-12-31':'오늘 공지'});
    assert.match(app.stage(), /내일 공지/);
    assert.match(app.stage(), /2027-01-01/);
    assert.match(app.stage(), /내일 준비물 &lt;책&gt;\n물통/);
    app.tick('2027-01-31T15:00:00+09:00');
    app.emit('blackboard/notice', '공통 공지');
    assert.match(app.stage(), /2027-02-01/);
    assert.match(app.stage(), /등록된 내일 공지가 없습니다/);
    assert.doesNotMatch(app.stage(), /공통 공지/);
});
