const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../functions/checkin-password-core');
function setup({input='1234',baseline='1234',current='5678'}={}) {
    const now=Date.parse('2026-09-04T08:00:00+09:00');
    let settings={password:current,passwordDate:'2026-09-04',passwordRevision:5,studentRoles:{student:'leader'}};
    const nodes={ 'conf-pass':{value:input,dataset:{savedPassword:baseline}},'conf-late':{value:'08:40'},
        'conf-close':{value:'09:00'},'conf-routine':{value:'활동'} };
    const published=[],alerts=[];
    const ctx={CheckinPasswordCore:core,
        CheckinPassword:{ensureCurrent:async()=>settings,now:()=>now,randomInt:()=>0,publish:async value=>published.push(value)},
        document:{getElementById:id=>nodes[id]},alert:value=>alerts.push(value),console,
        db:{ref:()=>({transaction:async update=>{settings=update(settings);return{snapshot:{val:()=>settings}};}})}
    };ctx.window=ctx;
    const source=fs.readFileSync(require.resolve('../js/settings.js'),'utf8');
    vm.runInNewContext(source.slice(source.indexOf('window.saveSettings ='),source.indexOf('window.loadSystemSettings')),ctx);
    return {ctx,nodes,published,alerts,settings:()=>settings};
}

test('saving unrelated settings from an old form preserves the newer automatic password',async()=>{
    const app=setup();await app.ctx.saveSettings();
    assert.equal(app.settings().password,'5678');assert.equal(app.settings().passwordRevision,5);
    assert.equal(app.settings().lateTime,'08:40');assert.equal(app.nodes['conf-pass'].value,'5678');
});

test('manual generation and save retain a four-digit code and broadcast the new revision',async()=>{
    const app=setup({input:'0042'});await app.ctx.saveSettings();
    assert.equal(app.settings().password,'0042');assert.equal(app.settings().passwordDate,'2026-09-04');
    assert.equal(app.settings().passwordRevision,6);assert.equal(app.published[0].password,'0042');
    assert.deepEqual(app.settings().studentRoles,{student:'leader'});
});

test('invalid manual passwords cannot be saved',async()=>{
    const app=setup({input:'12x4'});await app.ctx.saveSettings();
    assert.equal(app.settings().password,'5678');assert.equal(app.published.length,0);
    assert.match(app.alerts[0],/4자리/);
});
