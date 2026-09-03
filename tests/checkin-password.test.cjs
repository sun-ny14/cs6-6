const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../functions/checkin-password-core');
const at = value => Date.parse(value);
const old = { password:'1234', passwordDate:'2026-09-02', passwordRevision:7,
    lateTime:'08:40', studentRoles:{student:'leader'} };

test('Korean midnight rotates exactly once, never repeats yesterday, and preserves other settings', () => {
    assert.equal(core.today(at('2026-09-02T14:59:59Z')), '2026-09-02');
    assert.equal(core.today(at('2026-09-02T15:00:00Z')), '2026-09-03');
    assert.equal(core.rotate(old, at('2026-09-02T14:59:59Z'), () => 234), undefined);
    const next = core.rotate(old, at('2026-09-02T15:00:00Z'), () => 234);
    assert.equal(next.password, '1235'); assert.equal(next.passwordRevision, 8);
    assert.equal(next.lateTime, old.lateTime); assert.deepEqual(next.studentRoles, old.studentRoles);
    assert.equal(core.rotate(next, at('2026-09-02T15:00:01Z'), () => 500), undefined);
    assert.equal(core.untilMidnight(at('2026-09-02T14:59:59Z')), 1000);
});

test('concurrent automatic transaction retries preserve the winning manual password until next midnight', () => {
    const now = at('2026-09-03T09:00:00+09:00');
    const first = core.rotate(old, now, () => 0);
    const manual = core.manual(old, '0042', now);
    assert.equal(core.rotate(manual, now, () => 55), undefined);
    assert.equal(core.newerDisplay(core.forDisplay(manual), core.forDisplay(first)), undefined);
    const nextDay = core.rotate(manual, at('2026-09-04T00:00:00+09:00'), () => 55);
    assert.notEqual(nextDay.password, '0042'); assert.equal(nextDay.passwordDate, '2026-09-04');
    assert.throws(() => core.manual(old, '12x4', now), /4자리/);
});

test('sequential manual saves produce ordered revisions; stale display publication cannot undo them', () => {
    const now = at('2026-09-03T09:00:00+09:00');
    const first = core.manual(old, '7777', now);
    const second = core.manual(first, '8888', now + 1);
    assert.equal(second.passwordRevision, first.passwordRevision + 1);
    assert.equal(core.newerDisplay(core.forDisplay(second), core.forDisplay(first)), undefined);
    assert.deepEqual(core.newerDisplay(core.forDisplay(first), core.forDisplay(second)), core.forDisplay(second));
    assert.deepEqual(Object.keys(core.forDisplay(second)).sort(), ['date','password','revision','updatedAt']);
});

test('missed days, initial migration, leading zeros and clock rollback are handled', () => {
    const now = at('2027-01-01T00:00:00+09:00');
    assert.equal(core.rotate(old, now, () => 8998).passwordDate, '2027-01-01');
    assert.equal(core.rotate({password:'9999',lateTime:'08:30'}, now, () => 0).password, '1000');
    assert.equal(core.manual(old, '0000', now).password, '0000');
    const future = core.manual(old, '4321', now);
    assert.equal(core.rotate(future, at('2026-12-31T23:59:59+09:00'), () => 1), undefined);
});

test('every random outcome is four digits and excludes the previous automatic password', () => {
    for (const previous of ['1000','1234','9999']) {
        for (let n = 0; n < 8999; n++) {
            const password = core.generate(previous, () => n);
            assert.match(password, /^\d{4}$/); assert.notEqual(password, previous);
        }
    }
});

function runtime() {
    let timestamp = at('2026-09-03T08:00:00+09:00'), authCallback, id = 0;
    const timers = new Map(), intervals = [], events = {}, listeners = new Map();
    const counts = { reads:0, transactions:0 };
    let settings = core.manual(old, '2468', timestamp), published = null;
    const db = { ref(path) { return {
        on(_event, callback) { listeners.set(path, callback); if (path === 'settings') callback({val:() => settings}); },
        off() { listeners.delete(path); },
        async once() { counts.reads++; return {val:() => settings}; },
        async transaction(update) {
            counts.transactions++;
            const next = update(path === 'settings' ? settings : published);
            if (next !== undefined) {
                if (path === 'settings') { settings = next; listeners.get(path)?.({val:() => settings}); }
                else published = next;
            }
            return { committed:next !== undefined, snapshot:{val:() => path === 'settings' ? settings : published} };
        }
    }; } };
    class Clock extends Date { static now() { return timestamp; } }
    const context = { CheckinPasswordCore:core, Date:Clock, db, crypto:require('node:crypto').webcrypto,
        console, Uint32Array, setTimeout:fn => {timers.set(++id,fn);return id;}, clearTimeout:key => timers.delete(key),
        setInterval:fn => intervals.push(fn),
        auth:{onAuthStateChanged:fn => {authCallback=fn;}},
        document:{visibilityState:'visible',getElementById:() => null,addEventListener:(event,fn) => events[event]=fn},
        addEventListener:(event,fn) => events[event]=fn
    };
    context.window=context;
    vm.runInNewContext(fs.readFileSync(require.resolve('../js/checkin-password.js'),'utf8'),context);
    return {context,counts,intervals,timers,events,
        login:() => authCallback({uid:'student'}),
        emit:(path,value) => listeners.get(path)?.({val:() => value}),
        now:value => timestamp=at(value), settings:() => settings, published:() => published};
}

test('steady-state minute checks and wake-ups perform zero additional database reads or writes', async () => {
    const app=runtime(); app.login(); app.emit('.info/serverTimeOffset',0); app.emit('.info/connected',true);
    await app.context.CheckinPassword.refresh();
    const before={...app.counts};
    for(let n=0;n<1440;n++) await app.context.CheckinPassword.refresh();
    await app.events.focus();
    assert.deepEqual(app.counts,before);
    app.now('2026-09-04T00:00:00+09:00');
    await app.context.CheckinPassword.refresh();
    assert.equal(app.settings().passwordDate,'2026-09-04');
    assert.notEqual(app.settings().password,'2468');
    assert.equal(app.published().password,app.settings().password);
    assert.equal(app.counts.reads-before.reads,1);
});

test('server time offset drives rollover and an anonymous display never writes private settings', async () => {
    const app=runtime(); app.emit('.info/serverTimeOffset',0); app.emit('.info/connected',true);
    await app.context.CheckinPassword.refresh(); assert.equal(app.counts.reads,0);assert.equal(app.counts.transactions,0);
    app.login(); await app.context.CheckinPassword.refresh();
    app.emit('.info/serverTimeOffset',86400000); await app.context.CheckinPassword.refresh();
    assert.equal(app.settings().passwordDate,'2026-09-04');
});
