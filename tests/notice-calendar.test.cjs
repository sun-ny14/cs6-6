const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function calendar(time = '2026-09-03T08:00:00+09:00', notices = {}) {
    const nodes = new Map(), writes = [], alerts = [], state = { hold:null, fail:false };
    function element() { return { value:'', innerHTML:'', textContent:'', events:{},
        addEventListener(type, fn) {this.events[type]=fn;}, querySelector:() => null }; }
    for (const id of ['bb-schedule-form-container','bb-notice-date-strip','bb-notice-month-label',
        'bb-notice-date','bb-notice-text','bb-notice-editor-label','bb-week-label','bb-week-day-tabs',
        'bb-week-editor','bb-week-anchor']) nodes.set(id,element());
    const document = {getElementById:id => nodes.get(id), createElement:element,
        head:{appendChild:node => nodes.set(node.id,node)}};
    class Clock extends Date {constructor(...args) {super(...(args.length ? args : [time]));}}
    const db = {ref(key) {return {
        async once() {return {val:() => key === 'blackboard/notices' ? {...notices} : null};},
        async set(value) {if(state.hold)await state.hold;if(state.fail)throw Error('offline');writes.push({key,value});},
        async remove() {if(state.hold)await state.hold;if(state.fail)throw Error('offline');writes.push({key,value:null});}
    };}};
    const context={document,db,Date:Clock,Intl,alert:value => alerts.push(value),console:{error(){}}};
    context.window=context;
    vm.runInNewContext(fs.readFileSync(require.resolve('../js/blackboard-admin.js'),'utf8'),context);
    await context.initBlackboardAdmin();
    const click = (selector, node={}) => nodes.get('bb-schedule-form-container').onclick({target:{closest:key => key === selector ? node : null}});
    return {nodes,writes,alerts,state,click,context,
        select:date => click('[data-notice-date]',{dataset:{noticeDate:date}}),
        date:() => nodes.get('bb-notice-date').value,
        text:() => nodes.get('bb-notice-text').value,
        type:value => nodes.get('bb-notice-text').value=value,
        html:() => nodes.get('bb-notice-date-strip').innerHTML};
}

test('month grid includes every date once, today and saved notice preview with escaped content', async () => {
    const app=await calendar(undefined,{'2026-09-04':'책 <준비> & 물통'});
    assert.equal((app.html().match(/data-notice-date=/g)||[]).length,30);
    assert.match(app.html(), /2026-09-03 오늘/);
    assert.match(app.html(), /책 &lt;준비&gt; &amp; 물통/);
    assert.match(app.nodes.get('bb-notice-month-label').textContent,/2026년 9월/);
    await app.select('2026-09-04');assert.equal(app.text(),'책 <준비> & 물통');
});

test('month navigation clamps month-end dates, handles leap day and changes year', async () => {
    const app=await calendar('2028-01-31T08:00:00+09:00');
    await app.click('#bb-notice-next');assert.equal(app.date(),'2028-02-29');
    assert.equal((app.html().match(/data-notice-date=/g)||[]).length,29);
    await app.select('2026-12-31');await app.click('#bb-notice-next');assert.equal(app.date(),'2027-01-31');
    await app.click('#bb-notice-next');assert.equal(app.date(),'2027-02-28');
    await app.click('#bb-notice-today');assert.equal(app.date(),'2028-01-31');
});

test('switching dates preserves unsaved drafts and save/delete target only the selected date', async () => {
    const app=await calendar();app.type('오늘 작성 중');
    await app.select('2026-09-04');app.type('내일 공지');
    await app.click('#bb-save-notice');
    assert.deepEqual(app.writes,[{key:'blackboard/notices/2026-09-04',value:'내일 공지'}]);
    await app.select('2026-09-03');assert.equal(app.text(),'오늘 작성 중');
    await app.select('2026-09-04');assert.equal(app.text(),'내일 공지');
    await app.click('#bb-delete-notice');assert.equal(app.text(),'');
    assert.deepEqual(app.writes.at(-1),{key:'blackboard/notices/2026-09-04',value:null});
});

test('slow saves do not overwrite newer typing or a different selected date', async () => {
    const app=await calendar();app.type('저장 요청 내용');let release;
    app.state.hold=new Promise(resolve=>release=resolve);
    const pending=app.click('#bb-save-notice');
    app.type('저장 중 추가 작성');await app.select('2026-09-04');app.type('내일 작성');
    release();await pending;
    assert.equal(app.date(),'2026-09-04');assert.equal(app.text(),'내일 작성');
    await app.select('2026-09-03');assert.equal(app.text(),'저장 중 추가 작성');
    assert.deepEqual(app.writes[0],{key:'blackboard/notices/2026-09-03',value:'저장 요청 내용'});
});

test('failed save retains the draft for retry', async () => {
    const app=await calendar();app.type('보존할 공지');app.state.fail=true;
    await app.click('#bb-save-notice');assert.equal(app.text(),'보존할 공지');assert.equal(app.writes.length,0);
    app.state.fail=false;await app.click('#bb-save-notice');assert.equal(app.writes[0].value,'보존할 공지');
});
