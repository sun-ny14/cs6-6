const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('class journal is admin-only, password-gated and server mediated',()=>{
    const server=read('functions/index.js');
    const client=read('js/class-journal.js');
    const rules=JSON.parse(read('database.rules.json')).rules;
    assert.match(server,/exports\.unlockClassJournal/);
    assert.match(server,/exports\.getClassJournalMonth/);
    assert.match(server,/exports\.saveClassJournalDay/);
    assert.match(server,/scryptSync/);
    assert.match(server,/email_verified === true/);
    assert.match(server,/journalPasswordIsValid/);
    assert.match(server,/\^\\d\{4\}\$/);
    assert.match(server,/classJournalSessions/);
    assert.match(client,/callSecure\('unlockClassJournal'/);
    assert.match(client,/callSecure\('getClassJournalMonth'/);
    assert.match(client,/callSecure\('saveClassJournalDay'/);
    assert.doesNotMatch(client,/db\.ref\(['"`]classJournal/);
    assert.equal(rules.classJournal['.read'],false);
    assert.equal(rules.classJournal['.write'],false);
});

test('journal unlock returns the selected month without a second client round trip',()=>{
    const server=read('functions/index.js');
    const client=read('js/class-journal.js');
    assert.match(server,/readJournalMonth\(database,month\)/);
    assert.match(server,/return \{journalToken:token,expiresAt,\.\.\.monthData\}/);
    assert.match(client,/result\.days\|\|\{\}/);
    assert.match(client,/result\.notices\|\|\{\}/);
});

test('journal editor uses timetable periods and extracts related students',()=>{
    const server=read('functions/index.js');
    const client=read('js/class-journal.js');
    const home=read('js/home-dashboard.js');
    assert.match(client,/const PERIODS=\['1교시','2교시','3교시','4교시','5교시','6교시'\]/);
    assert.match(client,/window\.getHomeDashboardData/);
    assert.match(home,/window\.getHomeDashboardData=\(\)=>state\.data\|\|\{\}/);
    assert.match(client,/relatedStudents:relatedStudents\(item\)/);
    assert.match(server,/relatedStudents:\[\.\.\.new Set/);
    assert.match(server,/const periodNotes=\{\}/);
    assert.doesNotMatch(client,/기록 0개/);
});

test('journal uses a mobile PIN keypad, large filtered calendar and typed entry picker',()=>{
    const client=read('js/class-journal.js');
    assert.match(client,/data-pin-key/);
    assert.match(client,/input\.value\.length===4&&previousLength<4\)unlock\(\)/);
    assert.match(client,/data-journal-filter/);
    assert.match(client,/\['all','전체'\]/);
    assert.match(client,/\['schedule','일정'\]/);
    assert.match(client,/\['counsel','상담'\]/);
    assert.match(client,/\['lesson','수업일지'\]/);
    assert.match(client,/min-height:125px/);
});

test('journal PIN also accepts a physical keyboard',()=>{
    const client=read('js/class-journal.js');
    assert.match(client,/lockIsActive/);
    assert.match(client,/\/\^\\d\$\/.test\(event\.key\)/);
    assert.match(client,/event\.key==='Backspace'/);
    assert.match(client,/event\.key==='Delete'/);
    assert.match(client,/event\.key==='Enter'/);
    assert.match(client,/state\.unlocking=true/);
});

test('only checked work schedules are copied to teacher alerts',()=>{
    const server=read('functions/index.js');
    assert.match(server,/schedules\.filter\(item=>item\.notify&&!item\.completed\)/);
    assert.match(server,/teacherAlerts\/\$\{date\}/);
    const rules=JSON.parse(read('database.rules.json')).rules;
    assert.match(rules.teacherAlerts['.read'],/ksosuny@cberi\.go\.kr/);
    assert.equal(rules.teacherAlerts['.write'],false);
});

test('notice items have per-line home visibility while board keeps full text',()=>{
    const admin=read('js/blackboard-admin.js');
    const board=read('js/blackboard-display.js');
    const home=read('js/home-dashboard.js');
    assert.match(admin,/data-notice-home-index/);
    assert.match(admin,/showOnHome/);
    assert.match(board,/noticeText/);
    assert.match(home,/filter\(item=>item\?\.showOnHome\)/);
});

test('dismissal keeps active incomplete assignments visible before and after due date',()=>{
    const board=read('js/blackboard-display.js');
    const block=board.slice(board.indexOf('function renderDismissal'),board.indexOf('async function saveDismissalNote'));
    assert.match(block,/entry\.item\.active!==false/);
    assert.match(block,/entry\.incomplete\.length>0/);
    assert.doesNotMatch(block,/dueDate<=today/);
});
