// Run: node --test tests/profile.test.cjs
// Exercises production handlers with a minimal DOM; does not validate layout.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const globalCode = read('js/global.js');
const detailCode = globalCode.slice(globalCode.indexOf('// 용사 상세창 V5:'), globalCode.indexOf('// 포인트 개별 차등 지급 — 학생 카드 그리드 V6'));
const heroCode = read('js/hero-mgr.js');
const profileCode = heroCode.slice(heroCode.indexOf('window.openStudentProfile ='), heroCode.indexOf('/* =========================================================\n   학생 본인 프로필'));

function setup() {
    const nodes = new Map();
    class Element {
        constructor() { this.style = {}; this.dataset = {}; this.children = new Map(); }
        set id(value) { this._id = value; nodes.set(value, this); }
        get id() { return this._id; }
        set innerHTML(value) {
            this.html = value; this.children.clear();
            if (value.includes('hd-dialog')) {
                for (const selector of ['.hd-log-list', '[data-hd-room]']) this.children.set(selector, new Element());
            }
        }
        get innerHTML() { return this.html || ''; }
        querySelector(selector) { return this.children.get(selector) || null; }
        addEventListener() {}
        appendChild(element) { if (element.id) nodes.set(element.id, element); }
    }
    const document = { head: new Element(), body: new Element(), createElement: () => new Element(),
        getElementById: id => nodes.get(id), addEventListener() {} };
    const records = Array.from({ length: 60 }, (_, index) => ({ key: `log-${index}`, val: () => ({
        name: 'Alice', pAmt: index, eAmt: 2, reason: `기록 ${index}`, timestamp: 100000 + index
    }) }));
    const state = { records, hold: null, visits: [], reads: [], fail: false };
    const snapshot = data => ({ exists: () => !!data, val: () => data, forEach: fn => records.forEach(fn) });
    const db = { ref(key) {
        const ref = { orderByChild: () => ref, equalTo: () => ref, limitToLast: () => ref, once: async () => {
            state.reads.push(key);
            if (key.startsWith('users/')) return snapshot({ name: 'Alice', points: 42, exp: 250 });
            if (state.hold) await state.hold;
            if (state.fail) throw Error('Read denied');
            return snapshot({});
        } }; return ref;
    } };
    const app = vm.createContext({ document, db, console: { warn() {}, error() {} },
        isAdmin: true, myName: '총사령관', heroIsAdmin: () => true, addEventListener() {},
        openFriendRoom: owner => state.visits.push(owner), alert() {} });
    app.window = app;
    vm.runInContext(detailCode + profileCode, app);
    return { app, state, document, overlay: () => nodes.get('hero-detail-v5') };
}

test('loading a long history preserves the profile and its points/experience', async () => {
    const { app, state, overlay } = setup(); let release;
    state.hold = new Promise(resolve => release = resolve);
    const pending = app.openHeroDetail({ name: 'Alice', points: 125, exp: 360 });
    const shell = overlay().innerHTML;
    assert.match(shell, /125 P/); assert.match(shell, /360 EXP/);
    release(); await pending;
    assert.equal(overlay().innerHTML, shell, 'only the history list should be replaced');
    assert.equal((overlay().querySelector('.hd-log-list').innerHTML.match(/class="hd-log-row"/g) || []).length, 50);
});

test('teacher can visit the correct database room while history is still loading', async () => {
    const { app, state, overlay, document } = setup(); let release;
    state.hold = new Promise(resolve => release = resolve);
    document.body.style.overflow = 'auto';
    const pending = app.openHeroDetail({ name: 'Alice', __firebaseKey: 'student-key' });
    overlay().querySelector('[data-hd-room]').onclick();
    assert.deepEqual(state.visits, ['student-key']);
    assert.equal(overlay().hidden, true); assert.equal(document.body.style.overflow, 'auto');
    release(); await pending;
    assert.equal(overlay().innerHTML, '', 'late history must not reopen the profile over the room');
});

test('a failed history read retains the profile and room visit action', async () => {
    const { app, state, overlay } = setup(); state.fail = true;
    await app.openHeroDetail({ name: 'Alice', points: 42, exp: 250 });
    assert.match(overlay().innerHTML, /42 P/); assert.match(overlay().innerHTML, /250 EXP/);
    overlay().querySelector('[data-hd-room]').onclick();
    assert.deepEqual(state.visits, ['Alice']);
});

test('legacy teacher profile entry uses the same detail and room visit controls', async () => {
    const { app, state, overlay } = setup();
    await app.openStudentProfile('student-key');
    assert.match(overlay().innerHTML, /42 P/); assert.match(overlay().innerHTML, /250 EXP/);
    overlay().querySelector('[data-hd-room]').onclick();
    assert.deepEqual(state.visits, ['student-key']);
    assert.ok(state.reads.includes('pointHistory/student-key'));
});
