const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('shop approval never transacts the restored database root',()=>{
    const source=read('functions/index.js');
    const block=source.slice(source.indexOf('exports.manageShopOrder'),
        source.indexOf('\n});',source.indexOf('exports.manageShopOrder')));
    assert.match(block,/orderRef\.transaction/);
    assert.match(block,/userRef\.transaction/);
    assert.doesNotMatch(block,/database\.ref\(\)\.transaction/);
});

test('shop tab uses the visible request list and restores per-student bulk approval',()=>{
    const html=read('index.html'),points=read('js/point-guide.js'),global=read('js/global.js');
    assert.match(html,/id="order-list"/);
    assert.match(points,/getElementById\('order-list'\)/);
    assert.match(points,/pendingByUser/);
    assert.match(points,/일괄승인/);
    assert.match(global,/if\(t==='shop'\)[\s\S]*?initPointsTabListeners\(\)/);
    assert.doesNotMatch(read('js/point-shop.js'),/admin-order-list/);
    assert.match(read('functions/index.js'),/exports\.syncAccessRole/);
});

test('assigned cleaner reads the role projection and actual seat layout',async()=>{
    const rules=JSON.parse(read('database.rules.json')).rules;
    assert.equal(rules.cleaningSettings['.read'],'auth != null');
    assert.match(rules.cleaningSettings['.write'],/ksosuny@cberi\.go\.kr/);
    assert.match(rules.classManagement.cleaningStatus.$date.$userName['.read'],/\$userName/);
    assert.match(read('js/cleaning.js'),/cleaningSettings\/studentRoles\/\$\{name\}/);
    const container={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
    const fixtures={
        cleaningSettings:{studentRoles:{영민:'청소'},cleaningAssignments:{영민:true}},
        'classManagement/cleaningStatus/2026-09-15/영민':{cleanDone:false},
        seatLayoutData:{layout:{'0-0':'영민'},config:{rows:1,cols:1}}
    };
    const ctx={console,myName:'영민',isAdmin:false,currentUsers:[{name:'영민',no:1}],
        currentUser:{role:'학생'},document:{getElementById:id=>id==='tab-cleaning'?container:null},
        sessionStorage:{getItem:()=>null,setItem:()=>{}},
        db:{ref:key=>({once:async()=>({val:()=>fixtures[key]||null})})},
        getTodayKST:()=> '2026-09-15',canManageCleaningChecks:()=>false};
    ctx.window=ctx;
    vm.runInNewContext(read('js/cleaning.js'),ctx);
    ctx.cleaningSubTab='cleaning';
    ctx.renderRoleCleaning();
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.match(container.innerHTML,/영민/);
    assert.match(container.innerHTML,/청소 완료/);
});

test('grade editor keeps unassessed students blank and advances with one click',()=>{
    const source=read('js/admin-grades.js');
    assert.doesNotMatch(source,/prompt\(\[?`?\[\$\{subject\}\] 평가의 제목/);
    assert.match(source,/PERF_STATES=\['','매우 잘함','잘함','노력 요함'\]/);
    assert.match(source,/window\.currentUsers/);
    assert.match(source,/if\(!roster\.length\)/);
    const button={dataset:{gradeStudent:'영민',gradeValue:''},textContent:'',className:''};
    const ctx={window:{},document:{querySelectorAll:()=>[button]},console};
    vm.runInNewContext(source,ctx);
    for(const expected of ['매우 잘함','잘함','노력 요함','']){
        ctx.window.togglePerfGrade('영민');
        assert.equal(button.dataset.gradeValue,expected);
    }
});

test('grade editor shows multiple cached students without reading the full roster again',async()=>{
    let html='';
    const ctx={console,window:{currentUsers:[
        {name:'영민',no:1,__firebaseKey:'영민'},
        {name:'수민',no:2,__firebaseKey:'수민'}
    ]},document:{getElementById:()=>null},
        db:{ref:key=>({once:async()=>({val:()=>({title:'새 평가',type:'perf',
            date:'2026-09-15',scores:{영민:'잘함○'}})})})},
        setTimeout:()=>{}};
    ctx.currentUsers=ctx.window.currentUsers;
    ctx.window=ctx;
    ctx.openPopup=(title,content)=>{html=content;};
    vm.runInNewContext(read('js/admin-grades.js'),ctx);
    await ctx.window.openGradeEditor('국어','testkey');
    assert.match(html,/영민/);
    assert.match(html,/수민/);
    assert.match(html,/잘함/);
    assert.match(html,/빈칸 · 미평가/);
    assert.match(html,/id="grade-editor-title"/);
});

test('settings password save reads only small metadata paths',()=>{
    const source=read('js/settings.js');
    const block=source.slice(source.indexOf('window.saveSettings'),source.indexOf('window.loadSystemSettings'));
    assert.match(block,/settingsRef\.child\('password'\)/);
    assert.doesNotMatch(block,/settingsRef\.once\('value'\)/);
});
