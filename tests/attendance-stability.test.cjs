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
