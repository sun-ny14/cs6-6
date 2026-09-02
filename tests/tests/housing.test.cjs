// Run with: node --test tests/housing.test.cjs
// No live classroom data is read or written. Each client runs the production
// scripts against a shared in-memory transactional database and a minimal DOM.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));

class Element {
    constructor(tag, document) {
        this.tagName = tag.toUpperCase(); this.document = document;
        this.style = {}; this.children = []; this.hidden = false;
        this.attributes = {}; this.listeners = {}; this.clientWidth = 640; this.clientHeight = 480;
        this.classList = { add() {}, remove() {} };
    }
    set id(value) { this._id = value; this.document.nodes.set(value, this); }
    get id() { return this._id; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return (this._text || '') + this.children.map(child => child.textContent).join(''); }
    set innerHTML(value) { this._html = value; this._text = ''; this.children = []; }
    get innerHTML() { return this._html || ''; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    insertBefore(child) { return this.appendChild(child); }
    replaceChildren(...children) { this._text = ''; this.children = []; this.append(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    querySelectorAll(selector) {
        return this.children.flatMap(child => [
            ...(selector === 'button' && child.tagName === 'BUTTON' ? [child] : []),
            ...child.querySelectorAll(selector)
        ]);
    }
}

function database() {
    const state = {
        settings: {}, '.info': { serverTimeOffset: 0 },
        users: {
            Alice: { level: 1, roomCoins: 20, roomRewardedLevel: 1 },
            Bob: { myRoom: { background: 'bob.png', objects: { chair: { img: 'chair.png', x: 25, y: 40, flipX: true } } } },
            Carol: { myRoom: { background: 'carol.png' } }
        }
    };
    let sequence = 0;
    const db = { state, writes: [], reads: [], holds: new Map(), failTransaction: false, failRead: '' };
    db.read = key => key.split('/').reduce((value, part) => value?.[part], state) ?? null;
    db.write = (key, value) => {
        const parts = key.split('/'); const last = parts.pop(); let parent = state;
        for (const part of parts) parent = parent[part] ||= {};
        parent[last] = copy(value); db.writes.push(key);
    };
    const snapshot = value => ({ val: () => copy(value), exists: () => value != null,
        forEach: fn => Object.entries(value || {}).forEach(([key, child]) => fn({ key, val: () => copy(child) })) });
    db.ref = key => ({
        key: key.split('/').at(-1),
        once: async (_event, callback) => {
            db.reads.push(key);
            const value = copy(db.read(key));
            const hold = db.holds.get(key);
            if (hold) { db.holds.delete(key); await hold; }
            if (db.failRead === key) throw Error('Read denied');
            const result = snapshot(value); if (callback) callback(result); return result;
        },
        set: async value => db.write(key, value),
        update: async value => db.write(key, { ...(db.read(key) || {}), ...value }),
        remove: async () => db.write(key, null),
        push: value => {
            const child = db.ref(`${key}/entry-${String(++sequence).padStart(5, '0')}`);
            return value === undefined ? child : child.set(value);
        },
        transaction: async updater => {
            await Promise.resolve();
            if (db.failTransaction) throw Error('Write denied');
            // Firebase can first invoke a transaction with a cold local cache.
            updater(null);
            const next = updater(copy(db.read(key)));
            if (next === undefined) return { committed: false, snapshot: snapshot(db.read(key)) };
            const resolve = value => {
                if (value && typeof value === 'object') {
                    if (value['.sv'] === 'timestamp') return db.now;
                    for (const name of Object.keys(value)) value[name] = resolve(value[name]);
                }
                return value;
            };
            db.write(key, resolve(next));
            return { committed: true, snapshot: snapshot(db.read(key)) };
        }
    });
    db.now = Date.parse('2026-09-02T05:00:00Z');
    return db;
}

function client(db = database(), name = 'Alice', admin = false) {
    const document = {
        nodes: new Map(), createElement(tag) { return new Element(tag, this); },
        getElementById(id) { return this.nodes.get(id) || null; },
        querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {}
    };
    const parent = document.createElement('div');
    for (const match of source('index.html').matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)) {
        const element = document.createElement(match[1]); element.id = match[2];
        element.hidden = /\bhidden\b/.test(match[0]); parent.appendChild(element);
    }
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [db.now])); }
        static now() { return db.now; }
    }
    const context = vm.createContext({ document, db, Date: Clock, console: { error() {}, warn() {} },
        myName: name, isAdmin: admin, isHousingEnabled: true, currentTab: 'housing',
        firebase: { database: { ServerValue: { TIMESTAMP: { '.sv': 'timestamp' } } } },
        sessionStorage: { setItem() {} }, alert() {}, confirm: () => true,
        setTimeout, clearTimeout, openPopup(title, html) { context.popup = { title, html }; },
        closePopup() { context.popup = null; }
    });
    context.window = context;
    vm.runInContext(source('js/housing.js'), context);
    const global = source('js/global.js');
    vm.runInContext(global.slice(global.indexOf('function showTab('), global.indexOf('\n/* =========================================================\n   등교 관리자 권한')), context);
    const hero = source('js/hero-mgr.js');
    vm.runInContext(hero.slice(hero.indexOf('window.openFriendRoom ='), hero.indexOf('\n\n\n/*', hero.indexOf('window.openFriendRoom ='))), context);
    return { app: context, db, get: id => document.getElementById(id) };
}

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const count = (db, name) => Object.keys(db.read(`users/${name}/myRoom/guestbook`) || {}).length;

test('friend card opens the named room, read-only, with reactions and guestbook', async () => {
    const { app, get, db } = client();
    app.openFriendRoom('Bob'); await flush();
    assert.equal(get('housing-room-title').textContent, '🏰 Bob의 방');
    assert.equal(get('my-room-container').style.backgroundImage, "url('bob.png')");
    assert.equal(get('housing-social').hidden, false);
    assert.equal(get('housing-reactions').children.length, 4);
    for (const id of ['housing-shop-button', 'housing-save-controls', 'housing-inventory-panel']) assert.equal(get(id).hidden, true);
    const furniture = get('my-room-canvas').children[0];
    assert.equal(furniture.style.left, '25px');
    assert.equal(furniture.ondblclick, undefined);
    assert.equal(furniture.listeners.mousedown, undefined);
    assert.match(furniture.children[0].style.cssText, /scaleX\(-1\)/);
    assert.equal(db.writes.length, 0);
    assert.equal(db.reads.includes('users/Bob'), false);
});

test('returning to own tab restores editing, shop and own guestbook', async () => {
    const { app, get } = client();
    app.openFriendRoom('Bob'); await flush();
    app.showTab('housing'); await flush();
    assert.equal(get('housing-room-title').textContent, '🏰 Alice의 방');
    assert.equal(app.canManageHousing(), true);
    for (const id of ['housing-shop-button', 'housing-inventory-panel', 'housing-wallet-bar', 'housing-background-panel']) assert.equal(get(id).hidden, false);
    assert.equal(get('housing-reactions').hidden, true);
    await app.toggleRoomGuestbook();
    assert.equal(get('housing-guestbook').hidden, false);
});

test('one reaction total per friend/day across different emojis and reloads', async () => {
    const { app, db, get } = client();
    await app.openHousingTab('Bob');
    const objects = copy(db.read('users/Bob/myRoom/objects'));
    await app.sendRoomReaction('Bob', 'likes');
    await app.sendRoomReaction('Bob', 'hearts');
    const reload = client(db).app;
    await reload.openHousingTab('Bob');
    await reload.sendRoomReaction('Bob', 'stars');
    assert.equal(count(db, 'Bob'), 1);
    assert.equal(db.read('users/Bob/myRoom/dailyReactions/Alice/2026-09-02'), 'likes');
    assert.deepEqual(db.read('users/Bob/myRoom/objects'), objects);
    assert.equal(db.read('users/Bob/myRoom/background'), 'bob.png');
    assert.equal(get('housing-guestbook').hidden, false);
    assert.ok(get('housing-reactions').children.every(button => button.disabled));
});

test('double clicks and simultaneous clients commit only one guestbook entry', async () => {
    const db = database(); const a = client(db).app; const b = client(db).app;
    await Promise.all([a.openHousingTab('Bob'), b.openHousingTab('Bob')]);
    await Promise.all([a.sendRoomReaction('Bob', 'likes'), a.sendRoomReaction('Bob', 'hearts'), b.sendRoomReaction('Bob', 'stars')]);
    assert.equal(count(db, 'Bob'), 1);
    const room = db.read('users/Bob/myRoom');
    assert.equal((room.likes || 0) + (room.hearts || 0) + (room.stars || 0), 1);
});

test('different friends and different visitors each have an independent allowance', async () => {
    const { app, db } = client();
    await app.openHousingTab('Bob'); await app.sendRoomReaction('Bob', 'likes');
    await app.openHousingTab('Carol'); await app.sendRoomReaction('Carol', 'smiles');
    const other = client(db, 'Carol').app;
    await other.openHousingTab('Bob'); await other.sendRoomReaction('Bob', 'hearts');
    assert.equal(count(db, 'Bob'), 2); assert.equal(count(db, 'Carol'), 1);
});

test('allowance resets at Korean midnight, not UTC midnight', async () => {
    const { app, db } = client();
    db.now = Date.parse('2026-09-02T14:59:59Z');
    await app.openHousingTab('Bob'); await app.sendRoomReaction('Bob', 'likes');
    db.now = Date.parse('2026-09-02T15:00:00Z');
    await app.sendRoomReaction('Bob', 'hearts');
    assert.equal(count(db, 'Bob'), 2);
    assert.equal(db.read('users/Bob/myRoom/dailyReactions/Alice/2026-09-03'), 'hearts');
});

test('server time offset is used for the daily key', async () => {
    const { app, db } = client();
    db.now = Date.parse('2026-09-02T14:59:00Z');
    db.state['.info'].serverTimeOffset = 120000;
    await app.openHousingTab('Bob'); await app.sendRoomReaction('Bob', 'likes');
    assert.equal(db.read('users/Bob/myRoom/dailyReactions/Alice/2026-09-03'), 'likes');
});

test('legacy reactions and guestbook entries are preserved and counted', async () => {
    const { app, db, get } = client();
    db.state.users.Bob.myRoom.reactions_hearts = { Alice: { '2026-09-02': true } };
    db.state.users.Bob.myRoom.guestbook = { old: { text: '이전 방문 기록', time: '9월 2일' } };
    await app.openHousingTab('Bob'); await app.sendRoomReaction('Bob', 'stars');
    assert.equal(count(db, 'Bob'), 1);
    assert.match(get('housing-guestbook-list').textContent, /이전 방문 기록/);
});

test('failed writes leave no partial daily marker and allow a retry', async () => {
    const { app, db, get } = client();
    await app.openHousingTab('Bob'); db.failTransaction = true;
    await app.sendRoomReaction('Bob', 'likes');
    assert.equal(count(db, 'Bob'), 0);
    assert.equal(db.read('users/Bob/myRoom/dailyReactions'), null);
    assert.match(get('housing-reaction-status').textContent, /저장하지 못/);
    assert.ok(get('housing-reactions').children.every(button => !button.disabled));
    db.failTransaction = false; await app.sendRoomReaction('Bob', 'hearts');
    assert.equal(count(db, 'Bob'), 1);
});

test('self, invalid emoji, wrong room, disabled housing and logged-out reactions cannot write', async () => {
    const { app, db } = client();
    await app.openHousingTab('Bob');
    await app.sendRoomReaction('Alice', 'likes');
    await app.sendRoomReaction('Carol', 'likes');
    await app.sendRoomReaction('Bob', 'toString');
    app.isHousingEnabled = false; await app.sendRoomReaction('Bob', 'likes');
    app.isHousingEnabled = true; app.myName = ''; await app.sendRoomReaction('Bob', 'likes');
    assert.equal(db.writes.length, 0);
});

test('all editing and shopping entry points refuse the visitor context', async () => {
    const { app, db } = client();
    await app.openHousingTab('Bob');
    await app.openHousingShopPopup(); await app.buyHousingItem('builtin-bed');
    await app.applyUnlockedHousingBackground('other.png', 1);
    app.openItemEditor('chair', '가구', 48, 48, false);
    app.toggleFlipRoomItem('chair', false); app.resizeRoomItem('chair', 60, 60, 200, 200, 'up');
    app.deleteRoomItem('chair'); app.placeOrApplyHousingItem('bed.png', '가구');
    await flush();
    assert.equal(db.writes.length, 0); assert.equal(app.popup, undefined);
});

test('student and admin shops both contain an explicit close button; purchasing still works', async () => {
    for (const admin of [false, true]) {
        const { app, db } = client(undefined, 'Alice', admin);
        await app.openHousingTab(); await app.openHousingShopPopup();
        assert.match(app.popup.html, /onclick="closePopup\(\)"[^>]*>✕ 상점 닫기/);
        await app.buyHousingItem('builtin-bed'); await flush();
        assert.equal(db.read('users/Alice/roomCoins'), admin ? 20 : 12);
        assert.equal(Object.values(db.read('users/Alice/housingInventory'))[0].shopKey, 'builtin-bed');
        app.closePopup(); assert.equal(app.popup, null);
    }
});

test('a delayed room load cannot overwrite a more recently opened friend room', async () => {
    const { app, db, get } = client(); let release;
    db.holds.set('users/Bob/myRoom', new Promise(resolve => release = resolve));
    const old = app.openHousingTab('Bob');
    await app.openHousingTab('Carol'); release(); await old;
    assert.equal(get('housing-room-title').textContent, '🏰 Carol의 방');
    assert.equal(get('my-room-container').style.backgroundImage, "url('carol.png')");
    assert.equal(get('my-room-canvas').children.length, 0);
    assert.equal(get('housing-shop-button').hidden, true);
});

test('a shop request in flight cannot open after entering a friend room', async () => {
    const { app } = client(); await app.openHousingTab(); let release;
    app.syncHousingRewards = () => new Promise(resolve => release = resolve);
    const pending = app.openHousingShopPopup(); await app.openHousingTab('Bob');
    release({ roomCoins: 20 }); await pending;
    assert.equal(app.popup, undefined);
});

test('guestbook sorts new entries first and renders names/text as text, including legacy records', async () => {
    const { app, db, get } = client();
    db.state.users.Bob.myRoom.guestbook = {
        legacy: { text: '<img src=x onerror=alert(1)>', time: '옛날' },
        newer: { user: '<b>Alice</b>', type: 'likes', timestamp: db.now },
        older: { user: 'Carol', type: 'stars', timestamp: db.now - 1000 }
    };
    await app.openHousingTab('Bob'); await app.toggleRoomGuestbook();
    const rows = get('housing-guestbook-list').children;
    assert.match(rows[0].textContent, /<b>Alice<\/b>/);
    assert.match(rows[1].textContent, /Carol/);
    assert.match(rows[2].textContent, /<img/);
    assert.equal(rows[0].children[0].innerHTML, '');
    db.state.users.Bob.myRoom.guestbook.latest = { user: 'Dana', type: 'hearts', timestamp: db.now + 1 };
    await app.toggleRoomGuestbook(); await app.toggleRoomGuestbook();
    assert.match(get('housing-guestbook-list').children[0].textContent, /Dana/);
});

test('load failures and disabled housing never show stale editing controls', async () => {
    const { app, db, get } = client();
    await app.openHousingTab(); db.failRead = 'users/Bob/myRoom';
    await app.openHousingTab('Bob');
    assert.match(get('housing-room-status').textContent, /불러오지 못/);
    assert.equal(get('housing-social').hidden, true);
    assert.equal(get('housing-shop-button').hidden, true);
    db.failRead = ''; await get('housing-room-status').children[0].onclick();
    assert.equal(get('housing-social').hidden, false);
    app.isHousingEnabled = false; await app.openHousingTab();
    assert.equal(get('housing-shop-button').hidden, true);
    assert.equal(get('my-room-canvas').children.length, 0);
});

test('leaving housing invalidates editing and pending room renders', async () => {
    const { app, db } = client(); await app.openHousingTab();
    app.showTab('main'); const before = db.writes.length;
    app.placeOrApplyHousingItem('bed.png', '가구');
    await app.buyHousingItem('builtin-bed');
    assert.equal(app.canManageHousing(), false); assert.equal(db.writes.length, before);
});
