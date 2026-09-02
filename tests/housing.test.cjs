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
        settings: {}, '.info': { serverTimeOffset: 0, connected: true },
        users: {
            Alice: { level: 1, roomCoins: 20, roomRewardedLevel: 1 },
            Bob: { myRoom: { background: 'bob.png', objects: { chair: { img: 'chair.png', x: 25, y: 40, flipX: true } } } },
            Carol: { myRoom: { background: 'carol.png' } }
        }
    };
    let sequence = 0;
    const db = { state, writes: [], reads: [], holds: new Map(), failTransaction: false, failRead: '', failures: [], transactions: 0, connectionListeners: new Set() };
    db.setConnected = connected => { state['.info'].connected = connected; for (const fn of [...db.connectionListeners]) fn({ val: () => connected }); };
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
        on: (_event, callback) => { db.connectionListeners.add(callback); callback({ val: () => state['.info'].connected }); },
        off: (_event, callback) => db.connectionListeners.delete(callback),
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
            db.transactions++;
            if (db.failTransaction) throw Error('PERMISSION_DENIED');
            const failure = db.failures.shift();
            if (failure === 'before') { db.setConnected(false); throw Error('disconnect'); }
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
            if (failure === 'after') { db.setConnected(false); throw Error('disconnect'); }
            return { committed: true, snapshot: snapshot(db.read(key)) };
        }
    });
    db.now = Date.parse('2026-09-02T05:00:00Z');
    return db;
}

function client(db = database(), name = 'Alice', admin = false, storage = new Map()) {
    const timers = new Map(); let timerId = 0;
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
        sessionStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key), removeItem: key => storage.delete(key) }, alerts: [], alert(message) { context.alerts.push(message); }, confirm: () => true,
        setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id), openPopup(title, html) { context.popup = { title, html }; },
        closePopup() { context.popup = null; }
    });
    context.window = context;
    vm.runInContext(source('js/housing.js'), context);
    const global = source('js/global.js');
    vm.runInContext(global.slice(global.indexOf('function showTab('), global.indexOf('\n/* =========================================================\n   등교 관리자 권한')), context);
    const hero = source('js/hero-mgr.js');
    vm.runInContext(hero.slice(hero.indexOf('window.openFriendRoom ='), hero.indexOf('\n\n\n/*', hero.indexOf('window.openFriendRoom ='))), context);
    return { app: context, db, storage, timers, get: id => document.getElementById(id) };
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


test('student purchase atomically persists balance, inventory and receipt across reloads', async () => {
    const { app, db } = client();
    db.state.users.Alice.points = 123;
    await app.openHousingTab();
    await app.buyHousingItem('builtin-bed');
    assert.equal(db.read('users/Alice/roomCoins'), 12);
    assert.equal(db.read('users/Alice/points'), 123);
    const [id, receipt] = Object.entries(db.read('users/Alice/housingPurchases'))[0];
    assert.equal(receipt.price, 8); assert.equal(receipt.balanceAfter, 12);
    assert.equal(receipt.timestamp, db.now);
    assert.equal(db.read(`users/Alice/housingInventory/${id}`).shopKey, 'builtin-bed');
    const reload = client(db).app; await reload.openHousingTab();
    await reload.openHousingPurchaseHistory();
    assert.match(reload.popup.html, /포근한 침대/); assert.match(reload.popup.html, /8C/);
    assert.equal(db.read('users/Alice/roomCoins'), 12);
});

test('teacher without a student record receives free inventory and a durable receipt', async () => {
    const { app, db } = client(undefined, '총사령관', true);
    await app.openHousingTab(); await app.buyHousingItem('builtin-bed');
    assert.equal(db.read('users/총사령관/roomCoins'), 10);
    assert.equal(Object.keys(db.read('users/총사령관/housingInventory')).length, 1);
    const receipt = Object.values(db.read('users/총사령관/housingPurchases'))[0];
    assert.equal(receipt.price, 0); assert.equal(receipt.teacherFree, true);
    const reload = client(db, '총사령관', true).app;
    await reload.openHousingTab(); await reload.openHousingPurchaseHistory();
    assert.match(reload.popup.html, /교사 무료/); assert.match(reload.popup.html, /포근한 침대/);
});

test('teacher free purchase preserves an existing zero or negative balance', async () => {
    for (const balance of [0, -2]) {
        const { app, db } = client(undefined, 'Alice', true);
        db.state.users.Alice.roomCoins = balance;
        await app.openHousingTab(); await app.buyHousingItem('builtin-bed');
        assert.equal(db.read('users/Alice/roomCoins'), balance);
        assert.equal(Object.keys(db.read('users/Alice/housingInventory')).length, 1);
    }
});

test('insufficient funds and a missing student never show a successful purchase', async () => {
    for (const missing of [false, true]) {
        const { app, db } = client();
        if (missing) delete db.state.users.Alice;
        else db.state.users.Alice.roomCoins = 2;
        await app.openHousingTab(); await app.buyHousingItem('builtin-bed');
        assert.equal(db.read('users/Alice/housingInventory'), null);
        assert.equal(db.read('users/Alice/housingPurchases'), null);
        assert.equal(app.alerts.some(text => text.includes('구매 완료')), false);
        assert.equal(db.read('users/Alice/roomCoins'), missing ? null : 2);
    }
});

test('write failure leaves balance and inventory intact, then allows one retry', async () => {
    const { app, db } = client(); await app.openHousingTab();
    db.failTransaction = true; await app.buyHousingItem('builtin-bed');
    assert.equal(db.read('users/Alice/roomCoins'), 20);
    assert.equal(db.read('users/Alice/housingInventory'), null);
    assert.equal(db.read('users/Alice/housingPurchases'), null);
    assert.match(app.alerts.at(-1), /저장 권한을 거부/);
    db.failTransaction = false; await app.buyHousingItem('builtin-bed');
    assert.equal(db.read('users/Alice/roomCoins'), 12);
    assert.equal(Object.keys(db.read('users/Alice/housingPurchases')).length, 1);
});

test('double click purchases only once and concurrent clients cannot overspend', async () => {
    const { app, db } = client(); await app.openHousingTab();
    await Promise.all([app.buyHousingItem('builtin-bed'), app.buyHousingItem('builtin-bed')]);
    assert.equal(db.read('users/Alice/roomCoins'), 12);
    assert.equal(Object.keys(db.read('users/Alice/housingPurchases')).length, 1);
    const second = client(db).app; await second.openHousingTab();
    await Promise.all([app.buyHousingItem('builtin-bed'), second.buyHousingItem('builtin-bed')]);
    assert.equal(db.read('users/Alice/roomCoins'), 4);
    assert.equal(Object.keys(db.read('users/Alice/housingPurchases')).length, 2);
});

test('simultaneous reward syncs and purchase preserve deduction and award levels once', async () => {
    const { app, db } = client(); await app.openHousingTab();
    const writes = db.writes.length;
    await app.syncHousingRewards('Alice');
    assert.equal(db.writes.length, writes, 'opening the shop must not rewrite unchanged rewards');
    db.state.users.Alice.level = 3;
    await Promise.all([app.syncHousingRewards('Alice'), app.syncHousingRewards('Alice'), app.buyHousingItem('builtin-bed')]);
    assert.equal(db.read('users/Alice/roomCoins'), 22);
    assert.equal(db.read('users/Alice/roomRewardedLevel'), 3);
    await app.openHousingShopPopup();
    assert.equal(db.read('users/Alice/roomCoins'), 22);
});

test('teacher visits and reacts once per student per day without editing student rooms', async () => {
    const { app, db, get } = client(undefined, '총사령관', true);
    app.openFriendRoom('Bob'); await flush();
    assert.equal(get('housing-room-title').textContent, '🏰 Bob의 방');
    for (const id of ['housing-shop-button', 'housing-purchase-history-button', 'housing-inventory-panel']) assert.equal(get(id).hidden, true);
    await app.openHousingPurchaseHistory(); assert.equal(app.popup, undefined);
    await app.buyHousingItem('builtin-bed'); assert.equal(db.read('users/Bob/housingInventory'), null);
    await app.sendRoomReaction('Bob', 'stars');
    await app.sendRoomReaction('Bob', 'hearts');
    assert.equal(count(db, 'Bob'), 1);
    assert.equal(Object.values(db.read('users/Bob/myRoom/guestbook'))[0].user, '총사령관');
    const reload = client(db, '총사령관', true).app; await reload.openHousingTab('Bob');
    await reload.sendRoomReaction('Bob', 'likes'); assert.equal(count(db, 'Bob'), 1);
    db.now += 86400000; await reload.sendRoomReaction('Bob', 'likes'); assert.equal(count(db, 'Bob'), 2);
    assert.equal(db.read('users/총사령관'), null, 'visiting does not need to create a teacher student record');
});


test('offline purchase waits for Firebase connectivity before writing', async () => {
    const { app, db, timers } = client(); await app.openHousingTab();
    db.setConnected(false); const before = db.transactions;
    const purchase = app.buyHousingItem('builtin-bed'); await flush();
    assert.equal(db.transactions, before); assert.equal(db.read('users/Alice/roomCoins'), 20);
    assert.equal(db.connectionListeners.size, 1);
    db.setConnected(true); await purchase;
    assert.equal(db.read('users/Alice/roomCoins'), 12);
    assert.equal(db.connectionListeners.size, 0); assert.equal(timers.size, 0);
});

test('disconnect before commit resumes one purchase after reconnection', async () => {
    const { app, db, storage } = client(); await app.openHousingTab();
    db.failures.push('before');
    const purchase = app.buyHousingItem('builtin-bed'); await flush();
    assert.equal(db.read('users/Alice/roomCoins'), 20);
    const id = JSON.parse(storage.get('housing-purchase-pending:Alice')).id;
    db.setConnected(true); await purchase;
    assert.equal(db.read('users/Alice/roomCoins'), 12);
    assert.deepEqual(Object.keys(db.read('users/Alice/housingPurchases')), [id]);
    assert.equal(storage.has('housing-purchase-pending:Alice'), false);
});

test('disconnect after server commit confirms the same receipt without charging twice', async () => {
    for (const admin of [false, true]) {
        const { app, db } = client(undefined, 'Alice', admin); await app.openHousingTab();
        db.failures.push('after');
        const purchase = app.buyHousingItem('builtin-bed'); await flush();
        assert.equal(db.read('users/Alice/roomCoins'), admin ? 20 : 12);
        db.setConnected(true); await purchase;
        assert.equal(db.read('users/Alice/roomCoins'), admin ? 20 : 12);
        assert.equal(Object.keys(db.read('users/Alice/housingPurchases')).length, 1);
        assert.equal(Object.keys(db.read('users/Alice/housingInventory')).length, 1);
        assert.match(app.alerts.at(-1), /구매 완료/);
    }
});

test('connection timeout stops waiting, retains the purchase ID, and recovers after reload', async () => {
    const { app, db, storage, timers } = client(); await app.openHousingTab();
    db.failures.push('after');
    const purchase = app.buyHousingItem('builtin-bed'); await flush();
    const id = Object.keys(db.read('users/Alice/housingPurchases'))[0];
    for (const timer of [...timers.values()]) timer.fn();
    await purchase;
    assert.match(app.alerts.at(-1), /서버 연결이 끊겨/);
    assert.equal(db.connectionListeners.size, 0); assert.equal(timers.size, 0);
    db.setConnected(true);
    const reload = client(db, 'Alice', false, storage).app; await reload.openHousingTab();
    await reload.buyHousingItem('builtin-chair');
    assert.match(reload.alerts.at(-1), /이전.*구매 결과/);
    await reload.buyHousingItem('builtin-bed');
    assert.equal(db.read('users/Alice/roomCoins'), 12);
    assert.deepEqual(Object.keys(db.read('users/Alice/housingPurchases')), [id]);
    assert.equal(storage.has('housing-purchase-pending:Alice'), false);
});

test('leaving the room during reconnect prevents a new charge', async () => {
    const { app, db } = client(); await app.openHousingTab();
    db.failures.push('before');
    const purchase = app.buyHousingItem('builtin-bed'); await flush();
    await app.openHousingTab('Bob'); db.setConnected(true); await purchase;
    assert.equal(db.read('users/Alice/roomCoins'), 20);
    assert.equal(db.read('users/Alice/housingPurchases'), null);
});

test('permission errors are not retried as connectivity failures', async () => {
    const { app, db } = client(); await app.openHousingTab();
    const before = db.transactions; db.failTransaction = true;
    await app.buyHousingItem('builtin-bed');
    assert.equal(db.transactions, before + 1);
    assert.match(app.alerts.at(-1), /저장 권한을 거부/);
    assert.equal(db.connectionListeners.size, 0);
});
