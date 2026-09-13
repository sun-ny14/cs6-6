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
    assert.match(server,/classJournalSessions/);
    assert.match(client,/callSecure\('unlockClassJournal'/);
    assert.match(client,/callSecure\('getClassJournalMonth'/);
    assert.match(client,/callSecure\('saveClassJournalDay'/);
    assert.doesNotMatch(client,/db\.ref\(['"`]classJournal/);
    assert.equal(rules.classJournal['.read'],false);
    assert.equal(rules.classJournal['.write'],false);
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
