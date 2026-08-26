// js/global.js
// 공통 유틸리티, 탭 전환, 앱 시작, 공통 팝업, 차등 포인트 지급

window.currentTab=window.currentTab||'main';
window.isHousingEnabled=true;
window.rIdx=0;
window.routineActive=false;
window.routineItems=window.routineItems||[];

function getTodayKST(){
    const now=new Date();
    const krTime=new Date(now.getTime()+9*60*60*1000);
    return krTime.getUTCFullYear()+'-'+
        String(krTime.getUTCMonth()+1).padStart(2,'0')+'-'+
        String(krTime.getUTCDate()).padStart(2,'0');
}

function forceScreenDisplay(status){
    const load=document.getElementById('loading-screen');
    const login=document.getElementById('login-screen');
    const app=document.getElementById('main-app');

    if(load)load.style.display='none';

    if(status==='app'){
        if(login)login.style.display='none';
        if(app)app.style.display='flex';
    }else{
        if(login)login.style.display='flex';
        if(app)app.style.display='none';
    }
}


/* =========================================================
   공통 팝업
   ========================================================= */

window.openPopup=function(title,content){
    const overlay=document.getElementById('common-overlay');
    const titleEl=document.getElementById('pop-title');
    const contentEl=document.getElementById('pop-content');
    const closeBtn=document.getElementById('pop-close-btn');

    if(!overlay||!contentEl){
        console.error('common-overlay 또는 pop-content를 찾을 수 없습니다.');
        return;
    }

    if(titleEl)titleEl.innerText=title||'알림';

    contentEl.innerHTML=content||'';

    if(closeBtn)closeBtn.style.display='block';

    overlay.style.display='flex';
};

window.closePopup=function(){
    if(
        window.routineActive&&
        ++window.rIdx<(window.routineItems||[]).length
    ){
        const content=document.getElementById('pop-content');

        if(content){
            content.innerText=
                `[루틴 ${window.rIdx+1}단계]\n${window.routineItems[window.rIdx]}`;
        }

        return;
    }

    const overlay=document.getElementById('common-overlay');

    if(overlay)overlay.style.display='none';

    window.rIdx=0;
    window.routineActive=false;
};


/* =========================================================
   탭 전환
   ========================================================= */

function showTab(t){
    window.currentTab=t;

    try{
        sessionStorage.setItem('activeTab',t);
    }catch(e){}

    document.querySelectorAll('.tab-content').forEach(el=>{
        el.classList.remove('active');
        el.style.display='none';
    });

    document.querySelectorAll('.sidebar-menu button').forEach(el=>{
        el.classList.remove('active');
    });

    const tab=document.getElementById('tab-'+t);

    if(tab){
        tab.classList.add('active');
        tab.style.display='block';
    }

    const btn=document.getElementById('btn-'+t);

    if(btn)btn.classList.add('active');


    if(t==='main'){
        if(typeof renderHeroes==='function'){
            renderHeroes();
        }
    }


    if(t==='checkin'){
        if(typeof switchCheckinSub==='function'){
            switchCheckinSub('checkin-main');
        }

        const adminBtn=
            document.getElementById('sub-btn-checkin-logs');

        if(adminBtn){
            adminBtn.style.display=
                isCheckinAdminUser()?'block':'none';
        }

        if(typeof refreshCheckinGuide==='function'){
            refreshCheckinGuide();
        }
    }


    if(t==='shop'){
        if(typeof renderShop==='function'){
            renderShop();
        }

        if(typeof loadOrderRecords==='function'){
            loadOrderRecords();
        }
    }


    if(t==='points'){
        if(typeof renderPointGuide==='function'){
            renderPointGuide();
        }

        if(typeof initPointsTabListeners==='function'){
            initPointsTabListeners();
        }
    }


    if(t==='management'){
        if(typeof renderManagementSub==='function'){
            renderManagementSub('grades');
        }
    }
}


/* =========================================================
   아바타
   실제 아바타는 hero-mgr.js에서 정의
   ========================================================= */

function getAvatar(lv,selectedAnimal){
    return '';
}


/* =========================================================
   등교 관리자 권한
   ========================================================= */

function isCheckinAdminUser(){
    const admin=
        (typeof isAdmin!=='undefined'&&!!isAdmin)||
        !!window.isAdmin;

    const helper=
        (typeof isHelper!=='undefined'&&!!isHelper)||
        !!window.isHelper;

    const name=
        typeof myName!=='undefined'
            ?myName
            :window.myName;

    const role=
        typeof currentUser!=='undefined'&&currentUser
            ?currentUser.role
            :'';

    return(
        admin||
        helper||
        name==='총사령관'||
        role==='관리자'||
        role==='도우미'
    );
}


/* =========================================================
   등교 서브탭
   ========================================================= */

function switchCheckinSub(subId){
    const main=
        document.getElementById('sub-checkin-main');

    const logs=
        document.getElementById('sub-checkin-logs');

    const btnMain=
        document.getElementById('sub-btn-checkin-main');

    const btnLogs=
        document.getElementById('sub-btn-checkin-logs');


    if(main){
        main.style.display=
            subId==='checkin-main'
                ?'block'
                :'none';
    }

    if(logs){
        logs.style.display=
            subId==='checkin-logs'
                ?'block'
                :'none';
    }

    if(btnLogs){
        btnLogs.style.display=
            isCheckinAdminUser()
                ?'block'
                :'none';
    }


    if(btnMain){
        btnMain.style.background=
            subId==='checkin-main'
                ?'var(--dark,#2c3e50)'
                :'#ddd';

        btnMain.style.color=
            subId==='checkin-main'
                ?'white'
                :'#333';
    }


    if(btnLogs){
        btnLogs.style.background=
            subId==='checkin-logs'
                ?'var(--dark,#2c3e50)'
                :'#ddd';

        btnLogs.style.color=
            subId==='checkin-logs'
                ?'white'
                :'#333';
    }


    if(subId==='checkin-logs'){
        if(typeof refreshCheckinAdminPanel==='function'){
            refreshCheckinAdminPanel();
        }
    }
}


/* =========================================================
   학급관리
   ========================================================= */

function renderManagementSub(type){
    const container=
        document.getElementById('management-sub-container');

    const grades=
        document.getElementById('sub-btn-grades');

    const budget=
        document.getElementById('sub-btn-budget');


    if(type==='grades'){

        if(grades){
            grades.style.background='var(--primary)';
            grades.style.color='white';
        }

        if(budget){
            budget.style.background='#ddd';
            budget.style.color='#333';
        }

        if(typeof renderGradesMain==='function'){
            renderGradesMain();
        }else if(container){
            container.innerHTML=`
                <div class="card">
                    <h2>📝 성적 및 평가 관리</h2>
                    <p>학생들의 성적과 수행평가 기록을 관리하는 공간입니다.</p>
                </div>
            `;
        }

    }else{

        if(budget){
            budget.style.background='var(--primary)';
            budget.style.color='white';
        }

        if(grades){
            grades.style.background='#ddd';
            grades.style.color='#333';
        }

        if(typeof initBudgetManager==='function'){
            initBudgetManager();
        }
    }
}


/* =========================================================
   앱 시작
   ========================================================= */

function startApp(){

    const admin=
        typeof isAdmin!=='undefined'&&!!isAdmin;

    const helper=
        typeof isHelper!=='undefined'&&!!isHelper;

    const commander=
        typeof myName!=='undefined'&&
        myName==='총사령관';

    const canManage=
        admin||helper||commander;


    const orderMgr=
        document.getElementById('admin-order-mgr');

    if(orderMgr){
        orderMgr.style.display=
            canManage?'block':'none';
    }


    const blackboard=
        document.getElementById('btn-blackboard-admin');

    if(blackboard){
        blackboard.style.display=
            canManage?'block':'none';
    }


    const adminBtn=
        document.getElementById('btn-admin');

    if(adminBtn){
        adminBtn.style.display=
            canManage?'block':'none';
    }


    const checkinBtn=
        document.getElementById('btn-checkin');

    if(checkinBtn){
        checkinBtn.style.display='block';
    }


    const checkinLogsBtn=
        document.getElementById('sub-btn-checkin-logs');

    if(checkinLogsBtn){
        checkinLogsBtn.style.display=
            canManage?'block':'none';
    }


    const cleaning=
        document.getElementById('btn-cleaning');

    if(cleaning){
        cleaning.style.display=
            commander||
            (
                typeof currentUser!=='undefined'&&
                currentUser&&
                currentUser.role==='청소'
            )
                ?'inline-block'
                :'none';
    }


    db.ref('settings').on('value',snap=>{

        const s=snap.val()||{};

        window.giftList=s.giftList||[];

        window.routineItems=
            (s.routineText||'')
                .split('\n')
                .filter(t=>t.trim());


        if(admin){

            const pass=
                document.getElementById('conf-pass');

            const late=
                document.getElementById('conf-late');

            const close=
                document.getElementById('conf-close');

            const routine=
                document.getElementById('conf-routine');

            const gifts=
                document.getElementById('conf-gifts');


            if(pass)pass.value=s.password||'';

            if(late)late.value=s.lateTime||'08:40';

            if(close)close.value=s.closeTime||'09:00';

            if(routine)routine.value=s.routineText||'';

            if(gifts){
                gifts.value=
                    (s.giftList||[]).join('\n');
            }
        }


        const guide=
            document.getElementById('checkin-guide');

        if(guide){
            guide.innerText=
                `✅ 정상: ~${s.lateTime||'08:40'} | ⚠️ 지각: ${s.closeTime||'09:00'} 마감`;
        }


        window.currentDefaultBg=
            s.defaultBg||'';


        if(typeof refreshCheckinGuide==='function'){
            refreshCheckinGuide(s);
        }
    });


    db.ref('users').on('value',snap=>{

        const users=[];

        snap.forEach(child=>{

            const u=child.val()||{};

            if(!u.name){
                u.name=child.key;
            }

            users.push(u);
        });


        window.currentUsers=
            users.sort((a,b)=>{

                const my=
                    typeof myName!=='undefined'
                        ?myName
                        :window.myName;

                if(a.name===my)return -1;

                if(b.name===my)return 1;

                return(
                    (parseInt(a.no)||99)-
                    (parseInt(b.no)||99)
                );
            });


        if(admin&&typeof renderAdminList==='function'){
            renderAdminList();
        }


        if(typeof renderHeroes==='function'){
            renderHeroes();
        }
    });


    if(typeof generateNewLayout==='function'){
        generateNewLayout();
    }

    if(typeof renderPointGuide==='function'){
        renderPointGuide();
    }

    if(typeof initPointsTabListeners==='function'){
        initPointsTabListeners();
    }

    if(typeof loadOrderRecords==='function'){
        loadOrderRecords();
    }

    if(typeof renderHeroes==='function'){
        renderHeroes();
    }
}


/* =========================================================
   기존 호출명 호환
   ========================================================= */

window.openMultiPopup=function(title,points,reason){
    if(typeof openBulkPointPopup==='function'){
        openBulkPointPopup(
            reason||title,
            points
        );
    }else{
        alert('일괄 지급 팝업 함수를 찾을 수 없습니다.');
    }
};


/* =========================================================
   학생별 포인트/경험치 차등 지급
   ========================================================= */

window.openBatchPointModal=function(){

    if(!isCheckinAdminUser()){
        return;
    }


    let studentRows='';

    const users=
        Array.isArray(window.currentUsers)
            ?window.currentUsers
            :[];


    users.forEach(u=>{

        const name=u.name||'';

        if(
            !name||
            name==='총사령관'||
            name.includes('선생님')
        ){
            return;
        }


        const safe=
            String(name)
                .replace(/&/g,'&amp;')
                .replace(/</g,'&lt;')
                .replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;')
                .replace(/'/g,'&#39;');


        studentRows+=`
            <div class="batch-student-row"
                style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;">

                <label style="display:flex;align-items:center;gap:8px;flex:2;cursor:pointer;font-weight:bold;">
                    <input
                        type="checkbox"
                        class="batch-student-chk"
                        value="${safe}"
                        style="width:18px;height:18px;">

                    <span>${safe}</span>

                    <span style="font-size:.85rem;color:#666;">
                        (${parseInt(u.points)||0}P)
                    </span>
                </label>

                <input
                    type="number"
                    class="batch-p-input"
                    placeholder="포인트(P)"
                    style="flex:1;padding:6px;text-align:center;border:1px solid #ccc;border-radius:6px;font-size:1rem;">

                <input
                    type="number"
                    class="batch-exp-input"
                    placeholder="경험치(EXP)"
                    style="flex:1;padding:6px;text-align:center;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
            </div>
        `;
    });


    const html=`
        <div style="padding:10px;">

            <h3 style="margin-top:0;color:#2c3e50;text-align:center;">
                🎁 포인트 및 경험치 개별 차등 지급
            </h3>

            <input
                type="text"
                id="batch-reason"
                placeholder="공통 사유 입력 (예: 모둠 활동 우수)"
                style="width:100%;padding:12px;margin-bottom:12px;box-sizing:border-box;border-radius:8px;border:1px solid #ccc;font-size:1.1rem;">

            <div style="display:flex;gap:10px;margin-bottom:10px;">

                <button
                    onclick="document.querySelectorAll('.batch-student-chk').forEach(cb=>cb.checked=true)"
                    style="padding:8px;cursor:pointer;background:#ecf0f1;border:none;border-radius:6px;font-weight:bold;flex:1;">
                    전체 선택
                </button>

                <button
                    onclick="document.querySelectorAll('.batch-student-chk').forEach(cb=>cb.checked=false)"
                    style="padding:8px;cursor:pointer;background:#ecf0f1;border:none;border-radius:6px;font-weight:bold;flex:1;">
                    전체 해제
                </button>

            </div>

            <div
                style="max-height:280px;overflow-y:auto;border:1px solid #ddd;padding:10px;border-radius:8px;margin-bottom:20px;background:#fff;">

                ${studentRows||'<p style="text-align:center;color:#999;">학생이 없습니다.</p>'}

            </div>

            <div style="display:flex;gap:10px;">

                <button
                    onclick="closePopup()"
                    style="flex:1;padding:15px;background:#95a5a6;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
                    취소
                </button>

                <button
                    onclick="submitBatchPoints()"
                    style="flex:2;padding:15px;background:#27ae60;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
                    선택 학생 반영
                </button>

            </div>

        </div>
    `;


    openPopup(
        '🎁 포인트 개별 차등 지급',
        html
    );
};


window.submitBatchPoints=async function(){

    if(!isCheckinAdminUser()){
        return;
    }


    const reasonEl=
        document.getElementById('batch-reason');

    const reason=
        reasonEl
            ?reasonEl.value.trim()
            :'';


    if(!reason){
        return alert('공통 사유를 입력해 주세요.');
    }


    const targets=[];


    document
        .querySelectorAll('.batch-student-row')
        .forEach(row=>{

            const chk=
                row.querySelector('.batch-student-chk');

            if(!chk||!chk.checked)return;


            const pText=
                row.querySelector('.batch-p-input')?.value??'';

            const eText=
                row.querySelector('.batch-exp-input')?.value??'';


            const p=
                pText===''
                    ?0
                    :parseInt(pText);

            const exp=
                eText===''
                    ?0
                    :parseInt(eText);


            targets.push({
                name:chk.value,
                p:Number.isNaN(p)?0:p,
                exp:Number.isNaN(exp)?0:exp
            });
        });


    if(!targets.length){
        return alert('학생을 한 명 이상 선택해 주세요.');
    }


    if(!confirm(
        `선택한 ${targets.length}명의 학생에게 포인트와 경험치를 반영하시겠습니까?`
    )){
        return;
    }


    const today=
        typeof getTodayKST==='function'
            ?getTodayKST()
            :new Date().toISOString().slice(0,10);


    const time=
        new Date().toLocaleTimeString(
            'ko-KR',
            {
                hour:'2-digit',
                minute:'2-digit',
                hour12:false
            }
        );


    const updates={};


    try{

        for(const target of targets){

            const userSnap=
                await db.ref(
                    `users/${target.name}`
                ).once('value');


            if(!userSnap.exists()){
                continue;
            }


            const data=
                userSnap.val()||{};


            const oldPoints=
                parseInt(data.points)||0;

            const oldExp=
                parseInt(data.exp)||0;


            const newPoints=
                oldPoints+target.p;

            const newExp=
                oldExp+target.exp;


            updates[
                `users/${target.name}/points`
            ]=newPoints;

            updates[
                `users/${target.name}/exp`
            ]=newExp;


            if(target.p!==0){

                const logKey=
                    db.ref('pointLogs').push().key;


                updates[
                    `pointLogs/${logKey}`
                ]={
                    name:target.name,
                    pAmt:target.p,
                    reason:reason,
                    time:new Date().toLocaleString('ko-KR')
                };


                const historyKey=
                    db.ref(
                        `pointHistory/${target.name}`
                    ).push().key;


                updates[
                    `pointHistory/${target.name}/${historyKey}`
                ]={
                    date:today,
                    time:time,
                    reason:reason,
                    change:target.p,
                    result:newPoints
                };
            }
        }


        await db.ref().update(updates);


        alert(
            `✅ ${targets.length}명의 학생에게 포인트와 경험치를 반영했습니다.`
        );


        closePopup();

    }catch(error){

        console.error(
            '차등 지급 오류:',
            error
        );

        alert(
            '반영 중 오류가 발생했습니다.'
        );
    }
};


/* =========================================================
   기타
   ========================================================= */

window.toggleSelectAllStudents=function(masterCb){
    document
        .querySelectorAll('.student-checkbox')
        .forEach(cb=>{
            cb.checked=masterCb.checked;
        });
};


window.closePointPopup=function(){
    const popup=
        document.getElementById('point-popup');

    if(popup){
        popup.style.display='none';
    }
};
