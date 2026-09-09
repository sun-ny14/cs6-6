const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('blackboard restores existing authentication without a separate login button', () => {
    const html = read('blackboard.html');
    assert.match(html, /firebase-auth-compat/);
    assert.match(html, /blackboard-auth\.js/);
    assert.match(html, /functions\/checkin-password-core\.js/);
    assert.doesNotMatch(html, /id="bb-teacher-login"/);
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

test('check-in password remains valid until the teacher replaces it', () => {
    const password = read('js/checkin-password.js');
    const checkin = read('js/checkin-seat.js');
    const board = read('js/blackboard-display.js');
    assert.doesNotMatch(password, /settings\.passwordDate\s*!==\s*core\.today/);
    assert.doesNotMatch(checkin, /settings\.passwordDate\s*!==/);
    assert.doesNotMatch(board, /code\?\.date\s*===\s*today/);
    assert.match(password, /기존 암호는 새로 저장할 때까지 유지됩니다/);
});

test('firebase config includes the hardened realtime database rules file', () => {
    const config = JSON.parse(read('firebase.json'));
    assert.equal(config.database.rules, 'database.rules.json');
});

test('attendance and cleaning writes mirror only display-safe realtime fields', () => {
    const checkin = read('js/checkin-seat.js');
    const cleaning = read('js/cleaning.js');
    assert.match(checkin, /blackboardDisplay\/data\/checkins\/\$\{recordKey\}/);
    assert.match(checkin, /attended:checkinIsAttendedCategory\(category\)/);
    assert.match(cleaning, /blackboardDisplay\/data\/cleaningRoot\/\$\{today\}\/\$\{name\}\/cleanDone/);
    assert.match(cleaning, /await db\.ref\(\)\.update\(updates\)/);
});

test('batch point editor uses compact horizontal rows and an isolated scroll area', () => {
    const global = read('js/global.js');
    assert.match(global, /class="batch-column-head"/);
    assert.match(global, /grid-template-columns: 34px minmax\(150px, 1fr\) 92px minmax\(130px, \.48fr\) minmax\(130px, \.48fr\)/);
    assert.match(global, /class="batch-check-cell"[\s\S]*?batch-card-name[\s\S]*?batch-card-current-point[\s\S]*?batch-p-input[\s\S]*?batch-exp-input/);
    assert.match(global, /\.batch-student-grid[\s\S]*?flex: 1 1 360px[\s\S]*?max-height: calc\(100dvh - 330px\)[\s\S]*?overflow-y: auto/);
    assert.match(global, /\.batch-action-buttons[\s\S]*?position: static/);
});
