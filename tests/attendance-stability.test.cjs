const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('student check-in reads only the selected date and has sufficient memory', () => {
    const source = read('functions/index.js');
    assert.match(source, /memory:\s*'1GiB'/);
    assert.match(source, /ref\('checkins'\)\.orderByChild\('date'\)\.equalTo\(date\)\.get\(\)/);
    assert.doesNotMatch(source, /const priorRecords=\(await database\.ref\('checkins'\)\.get\(\)/);
});

test('student sees only their own secure point value', () => {
    const source = read('js/global.js');
    assert.match(source, /!admin&&\s*window\.currentUser/);
    assert.match(source, /\.\.\.window\.currentUser/);
    assert.match(source, /String\(u\.name\|\|''\)===String\(window\.myName/);
});

test('teacher one-click and detail edit do not share a double-click timer', () => {
    const source = read('js/checkin-seat.js');
    assert.match(source, /class=\"checkin-detail-button\"/);
    assert.match(source, /await window\.checkinWithUndo\(name,'정상 등교'\)/);
    assert.doesNotMatch(source, /const doubleClickDelay=520/);
    assert.doesNotMatch(source, /cell\._clickTimer/);
});

test('teacher one-click attendance uses the dedicated callable and mirrors the board', () => {
    const client=read('js/checkin-seat.js');
    const server=read('functions/index.js');
    assert.match(client, /callSecure\('teacherQuickCheckin'/);
    assert.match(server, /exports\.teacherQuickCheckin/);
    assert.match(server, /blackboardDisplay\/data\/checkins/);
});

test('every teacher point adjustment uses the server history writer', () => {
    const global=read('js/global.js');
    const guide=read('js/point-guide.js');
    const server=read('functions/index.js');
    assert.match(global, /callSecure\('adjustStudentScores'/);
    assert.match(guide, /callSecure\('adjustStudentScores'/);
    assert.match(server, /exports\.adjustStudentScores/);
    assert.match(server, /exports\.mirrorScoreChangeReceipt/);
    assert.match(server, /\[`pointLogs\/\$\{logKey\}`\]/);
    assert.match(server, /\[`pointHistory\/\$\{name\}\/\$\{logKey\}`\]/);
});

test('batch point editor keeps each student on one horizontal row', () => {
    const css=read('css/style.css');
    assert.match(css, /\.batch-student-row\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(250px, 1fr\) minmax\(130px, 170px\) minmax\(130px, 170px\)/);
});

test('attendance remains complete until it is explicitly marked absent', () => {
    const editor=read('js/checkin-seat.js');
    const board=read('js/blackboard-display.js');
    assert.match(editor, /attended:category!=='결석'/);
    assert.match(board, /const absent=category==='결석'\|\|result\.includes\('결석'\)/);
});

test('attendance date queries are indexed in realtime database rules', () => {
    const rules = JSON.parse(read('database.rules.json')).rules;
    assert.deepEqual(rules.checkins['.indexOn'], ['date']);
    assert.deepEqual(rules.checkinLogs['.indexOn'], ['date']);
});

test('teacher inactivity logout is three hours while student remains two hours', () => {
    const source = read('js/auth.js');
    assert.match(source, /const ADMIN_INACTIVITY_MS=3\*60\*60\*1000/);
    assert.match(source, /const STUDENT_INACTIVITY_MS=2\*60\*60\*1000/);
});

test('home dashboard is read-only and reuses the public blackboard projection', () => {
    const source = read('js/home-dashboard.js');
    assert.match(source, /db\.ref\('blackboardDisplay\/data'\)\.on\('value'/);
    assert.doesNotMatch(source, /\.(?:set|update|push|remove)\s*\(/);
});

test('home keeps the electronic board as an open button and preserves tab navigation', () => {
    const html = read('index.html');
    assert.match(html, /class="home-board-button"/);
    assert.match(html, /window\.open\('blackboard\.html'/);
    assert.match(html, /showTab\('assignments'\);initAssignmentsTab\(\)/);
    assert.match(html, /css\/classroom-dashboard\.css/);
});

test('new classroom theme applies to both teacher and student roles', () => {
    const css = read('css/classroom-dashboard.css');
    assert.match(css, /body\.role-student,\s*body\.role-teacher/);
    assert.match(css, /\.home-dashboard-grid/);
    assert.match(css, /@media \(max-width: 720px\)/);
});

test('home dashboard includes cute shop and cleaning previews', () => {
    const html = read('index.html');
    const script = read('js/home-dashboard.js');
    assert.match(html, /id="home-shop-list"/);
    assert.match(html, /id="home-clean-summary"/);
    assert.match(script, /window\.renderHomeShop/);
    assert.match(script, /renderCleaning\(data,today,students\)/);
    assert.match(script, /httpsCallable\('getPopularShopItems'\)/);
});

test('popular shop endpoint aggregates orders and returns only top three', () => {
    const source = read('functions/index.js');
    const start = source.indexOf('exports.getPopularShopItems');
    const end = source.indexOf('exports.purchasePointShop', start);
    const block = source.slice(start, end);
    assert.match(block, /database\.ref\('orders'\)\.get\(\)/);
    assert.match(block, /\.slice\(0,3\)/);
    assert.match(block, /publicShopStats/);
});

test('student subscribes only to their own private record for live points', () => {
    const source = read('js/global.js');
    assert.match(source, /db\.ref\(`users\/\$\{window\.myName\}`\)/);
    assert.match(source, /ownUserRef\.on\('value',receiveOwnUser/);
    assert.match(source, /window\.stopOwnUserListener=\(\)=>ownUserRef\.off/);
    assert.doesNotMatch(source, /!admin[\s\S]{0,120}db\.ref\(['"]users['"]\)\.on/);
});

test('point shop applies the authoritative returned balance immediately', () => {
    const source = read('js/point-shop.js');
    assert.match(source, /window\.currentUser\.points=Number\(result\.points\)/);
    assert.match(source, /renderHeroes\(window\.currentUsers\)/);
});

test('student hero list merges restored duplicate profiles by normalized name', () => {
    const source = read('js/global.js');
    assert.match(source, /const uniqueUsersByName=new Map\(\)/);
    assert.match(source, /Array\.from\(uniqueUsersByName\.values\(\)\)\.sort/);
});

test('point shop purchase never transacts the restored database root', () => {
    const source = read('functions/index.js');
    const purchase = source.slice(
        source.indexOf('exports.purchasePointShop'),
        source.indexOf('const BUILTIN_FURNITURE')
    );
    assert.doesNotMatch(purchase, /database\.ref\(\)\.transaction/);
    assert.match(purchase, /database\.ref\(`users\/\$\{current\.name\}`\)/);
    assert.match(purchase, /itemRef\.transaction/);
    assert.match(purchase, /purchaseReservations\[purchaseId\]/);
});

test('point shop reads the committed receipt from the final transaction snapshot', () => {
    const source = read('functions/index.js');
    const start = source.indexOf('exports.purchasePointShop');
    const end = source.indexOf('const BUILTIN_FURNITURE', start);
    const block = source.slice(start, end);
    assert.match(block, /await userRef\.get\(\)/);
    assert.match(block, /if\(user===null\)user=JSON\.parse\(JSON\.stringify\(current\.user\|\|\{\}\)\)/);
    assert.match(block, /userResult\.snapshot\.child\(`pointShopPurchases\/\$\{purchaseId\}`\)\.val\(\)/);
});

test('student home hides classroom-wide summary stats', () => {
    const css = read('css/classroom-dashboard.css');
    assert.match(css, /body\.role-student \.home-stats \{ display: none; \}/);
});

test('electronic board buttons are hidden from student home only', () => {
    const html = read('index.html');
    const css = read('css/classroom-dashboard.css');
    assert.match(html, /class="home-board-link"/);
    assert.match(css, /body\.role-student \.home-board-button/);
    assert.match(css, /body\.role-student \.home-board-link/);
});

test('housing reward callable returns only the small reward projection', () => {
    const source = read('functions/index.js');
    const start = source.indexOf('exports.syncHousingRewards');
    const end = source.indexOf('exports.setCheckinRoomReward', start);
    const block = source.slice(start, end);
    assert.match(block, /roomCoins:Number\(saved\.roomCoins\)/);
    assert.doesNotMatch(block, /return result\.snapshot\.val\(\)/);
});

test('settings save uses a targeted update instead of a settings transaction', () => {
    const source = read('js/settings.js');
    const start = source.indexOf('window.saveSettings');
    const end = source.indexOf('window.loadSystemSettings', start);
    const block = source.slice(start, end);
    assert.match(block, /settingsRef\.update\(updates\)/);
    assert.doesNotMatch(block, /settingsRef\.transaction|ref\('settings'\)\.transaction/);
});
