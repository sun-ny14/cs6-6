const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('public blackboard loads only the anonymous display subscriber', () => {
    const html = read('blackboard.html');
    assert.doesNotMatch(html, /firebase-auth-compat/);
    assert.doesNotMatch(html, /<script[^>]+(?:checkin-password|blackboard-share)\.js/);
    assert.match(html, /blackboard-display\.js/);
});

test('point bulk popup keeps actions outside the scrollable student list', () => {
    const html = read('index.html');
    const css = read('css/style.css');
    const script = read('js/point-guide.js');
    assert.match(html, /class="point-bulk-actions"/);
    assert.match(css, /#point-popup #point-pop-body[\s\S]*?min-height:\s*0/);
    assert.match(css, /#point-popup \.point-bulk-actions[\s\S]*?flex:\s*0 0 auto/);
    assert.match(script, /class="point-bulk-student-grid"/);
    assert.doesNotMatch(script, /max-height:400px/);
});

test('login uses tab-session persistence and inactivity logout limits', () => {
    const auth = read('js/auth.js');
    assert.match(auth, /Auth\.Persistence\.SESSION/);
    assert.doesNotMatch(auth, /Auth\.Persistence\.LOCAL/);
    assert.match(auth, /ADMIN_INACTIVITY_MS=30\*60\*1000/);
    assert.match(auth, /STUDENT_INACTIVITY_MS=2\*60\*60\*1000/);
});

test('firebase config includes the hardened realtime database rules file', () => {
    const config = JSON.parse(read('firebase.json'));
    assert.equal(config.database.rules, 'database.rules.json');
});

test('sensitive writes and student reads are denied at the database root', () => {
    const { rules } = JSON.parse(read('database.rules.json'));
    assert.equal(rules['.read'], false);
    assert.equal(rules['.write'], false);
    assert.match(rules.settings['.read'], /ksosuny@cberi\.go\.kr/);
    assert.match(rules.shop['.write'], /ksosuny@cberi\.go\.kr/);
    assert.equal(rules.publicProfiles['.write'], false);
});

test('point and housing purchases use callable server functions', () => {
    const shop = read('js/point-shop.js');
    const housing = read('js/housing.js');
    const functions = read('functions/index.js');
    assert.match(shop, /callSecure\('purchasePointShop'/);
    assert.match(housing, /callSecure\('purchaseHousingItem'/);
    assert.match(functions, /exports\.purchasePointShop/);
    assert.match(functions, /exports\.purchaseHousingItem/);
    assert.match(functions, /database\.ref\(\)\.transaction/);
});

test('teacher-managed email mapping remains authoritative for legacy student records', () => {
    const functions = read('functions/index.js');
    assert.match(functions, /userEmails\/\$\{emailKey\}/);
    assert.match(functions, /userSnapshot\.exists\(\)/);
    assert.doesNotMatch(functions, /cleanEmail\(user\.email\)\s*!==\s*email/);
});

test('attendance and cleaning writes mirror only display-safe realtime fields', () => {
    const checkin = read('js/checkin-seat.js');
    const cleaning = read('js/cleaning.js');
    const functions = read('functions/index.js');
    assert.match(checkin, /callSecure\('submitStudentCheckin'/);
    assert.match(functions, /blackboardDisplay\.data\.checkins/);
    assert.match(functions, /\{name:current\.name,date,attended:true\}/);
    assert.match(cleaning, /blackboardDisplay\/data\/cleaningRoot\/\$\{today\}\/\$\{name\}\/cleanDone/);
    assert.match(cleaning, /await db\.ref\(\)\.update\(updates\)/);
});
