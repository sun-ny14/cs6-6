// js/global.js
// 공통 유틸리티, 탭 전환, 앱 시작, 공통 팝업, 차등 포인트 지급

window.currentTab=window.currentTab||sessionStorage.getItem('activeTab')||'main';
window.isHousingEnabled=window.isHousingEnabled!==false;
window.rIdx=window.rIdx||0;
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
   되돌리기 안내줄

   실수는 한 번의 클릭인데 복구가 다섯 단계이던 문제를 줄인다.
   확인창을 늘리면 정상 동작까지 두 배로 느려지므로,
   먼저 실행하고 잠깐 되돌릴 기회를 준다.
   ========================================================= */

window.dismissUndoBar=function(){
    const bar=document.getElementById('undo-bar');
    if(!bar)return;

    clearTimeout(window.undoBarTimer);
    window.undoBarTimer=null;
    bar.hidden=true;
    bar.innerHTML='';
};

window.showUndoBar=function(message,onUndo,seconds){
    let bar=document.getElementById('undo-bar');

    if(!bar){
        bar=document.createElement('div');
        bar.id='undo-bar';
        bar.setAttribute('role','status');
        document.body.appendChild(bar);
    }

    clearTimeout(window.undoBarTimer);

    const text=document.createElement('span');
    text.className='undo-bar-text';
    text.textContent=String(message||'');

    const undoButton=document.createElement('button');
    undoButton.type='button';
    undoButton.className='undo-bar-action';
    undoButton.textContent='되돌리기';

    const closeButton=document.createElement('button');
    closeButton.type='button';
    closeButton.className='undo-bar-close';
    closeButton.setAttribute('aria-label','닫기');
    closeButton.textContent='✕';
    closeButton.onclick=window.dismissUndoBar;

    undoButton.onclick=async()=>{
        undoButton.disabled=true;
        undoButton.textContent='되돌리는 중…';

        try{
            await onUndo();
            window.dismissUndoBar();
        }catch(error){
            console.error('되돌리기 실패:',error);
            undoButton.disabled=false;
            undoButton.textContent='되돌리기';
            alert('되돌리지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
    };

    bar.replaceChildren(text,undoButton,closeButton);
    bar.hidden=false;

    window.undoBarTimer=setTimeout(
        window.dismissUndoBar,
        Math.max(3000,(Number(seconds)||7)*1000)
    );
};


/* =========================================================
   탭 전환
   ========================================================= */

function showTab(t, housingOwner){
    const adminOnlyTabs=[
        'blackboard-admin',
        'management',
        'admin'
    ];

    const admin=
        window.isAdmin===true;

    const cleaningAllowed=
        typeof window.canUseCleaningTab==='function'
            ?window.canUseCleaningTab()
            :admin;

    if(
        adminOnlyTabs.includes(t)&&
        !admin
    ){
        console.warn(
            '관리자 전용 화면 접근 차단:',
            t
        );

        t='main';
    }

    if(
        t==='cleaning'&&
        !cleaningAllowed
    ){
        console.warn(
            '청소 화면 접근 차단'
        );

        t='main';
    }

    if(typeof window.leaveHousingTab==='function') window.leaveHousingTab();
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

    if(t==='housing'&&typeof window.openHousingTab==='function'){
        window.openHousingTab(housingOwner);
    }


    if(t==='main'){
      window.heroesLoaded=true;

if(typeof renderHeroes==='function'){
    renderHeroes(window.currentUsers);
}
    }


    if(t==='checkin'){
        if(typeof switchCheckinSub==='function'){
            switchCheckinSub(
                isCheckinAdminUser()
                    ?'checkin-logs'
                    :'checkin-main'
            );
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

    if(t==='assignments'&&typeof initAssignmentsTab==='function'){
        initAssignmentsTab();
    }


    if(t==='management'){
        if(typeof renderManagementSub==='function'){
            renderManagementSub('grades');
        }
    }
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
    const adminView=isCheckinAdminUser();
    if(adminView)subId='checkin-logs';
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
        btnMain.style.display=adminView?'none':'block';
    }

    // 버튼이 하나뿐이면 분절 컨트롤 자체가 의미 없으므로 감춥니다.
    // (교사는 '등교로그' 하나, 학생은 '등교하기' 하나만 보입니다)
    const subMenu=
        document.getElementById('checkin-sub-menu-container');

    if(subMenu){
        const visibleTabs=[btnMain,btnLogs].filter(
            button=>button&&button.style.display!=='none'
        );

        subMenu.style.display=
            visibleTabs.length>1?'flex':'none';
    }


    if(btnMain){
        btnMain.classList.toggle(
            'active',
            subId==='checkin-main'
        );
    }


    if(btnLogs){
        btnLogs.classList.toggle(
            'active',
            subId==='checkin-logs'
        );
    }


    if(subId==='checkin-logs'){
        if(typeof refreshCheckinAdminPanel==='function'){
            refreshCheckinAdminPanel();
        }
    }
}


/* =========================================================
   앱 시작
   ========================================================= */

function startApp(){

    if(window.appStarted)return;
    window.appStarted=true;

    const admin=
        typeof isAdmin!=='undefined'&&!!isAdmin;

    const helper=
        typeof isHelper!=='undefined'&&!!isHelper;

    const commander=
        typeof myName!=='undefined'&&
        myName==='총사령관';

   const canManage=
    typeof window.canManageShopRequests==='function'
        ?window.canManageShopRequests()
        :admin||commander;

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
        checkinBtn.textContent=admin
            ?'🗓️ 등교로그 및 좌석'
            :'⚔️ 등교';
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
            typeof window.canUseCleaningTab==='function'&&
            window.canUseCleaningTab()
                ?'inline-block'
                :'none';
    }


    db.ref(admin?'settings':'publicSettings').on('value',snap=>{

        const s=snap.val()||{};

        window.studentRoles=s.studentRoles||{};
        window.cleaningAssignments=s.cleaningAssignments||{};

        if(typeof window.applyAccessControl==='function'){
            window.applyAccessControl();
        }

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


            if (window.CheckinPassword) window.CheckinPassword.updateInput(s);
            else if (pass) pass.value = s.password || '';

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


        window.currentDefaultBg =
    s.defaultBg || '';

window.isHousingEnabled =
    s.housingEnabled !== false;

if (
    typeof window.refreshHousingAdminControl ===
    'function'
) {
    window.refreshHousingAdminControl();
}

if (typeof refreshCheckinGuide === 'function') {
    refreshCheckinGuide(s);
}
    });


    db.ref(admin?'users':'publicProfiles').on('value',snap=>{

        const users=[];

        snap.forEach(child=>{

            let u=child.val()||{};

            u.__firebaseKey=child.key;

            if(!u.name){
                u.name=child.key;
            }

            // 공개 명단에는 포인트/경험치가 없으므로, 로그인한 학생의
            // 보안 세션 정보만 자기 프로필에 합쳐 본인 화면에 표시한다.
            if(
                !admin&&
                window.currentUser&&
                String(u.name||'')===String(window.myName||window.currentUser.name||'')
            ){
                u={
                    ...u,
                    ...window.currentUser,
                    name:u.name||child.key,
                    __firebaseKey:child.key
                };
            }

            const role=String(u.role||'').trim();
            const userEmail=String(u.email||'').trim().toLowerCase();
            const administratorEmail=String(
                typeof adminEmail!=='undefined' ? adminEmail : ''
            ).trim().toLowerCase();
            if(
                u.name==='총사령관'||
                u.isAdmin===true||
                role==='관리자'||
                (
                    userEmail&&
                    administratorEmail&&
                    userEmail===administratorEmail
                )
            ){
                return;
            }

            users.push(u);
        });


        // 복구 이전 공개 프로필과 새 프로필의 키가 달라도 이름이 같으면
        // 한 학생으로 취급한다. 원본 데이터는 지우지 않고 화면에서만 합친다.
        const uniqueUsersByName=new Map();
        users.forEach(user=>{
            const identity=String(user&&user.name||'')
                .normalize('NFKC')
                .replace(/\s+/g,'')
                .trim();
            if(!identity)return;

            const previous=uniqueUsersByName.get(identity);
            if(!previous){
                uniqueUsersByName.set(identity,user);
                return;
            }

            const previousUsesNameKey=String(previous.__firebaseKey||'')===String(previous.name||'');
            const currentUsesNameKey=String(user.__firebaseKey||'')===String(user.name||'');
            uniqueUsersByName.set(
                identity,
                currentUsesNameKey&&!previousUsesNameKey
                    ?{...previous,...user}
                    :{...user,...previous}
            );
        });

        window.currentUsers=
            Array.from(uniqueUsersByName.values()).sort((a,b)=>{

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

        const loginName=String(window.myName||'').trim();
        const loggedInUser=window.currentUsers.find(user=>
            String(user&&user.name||'').trim()===loginName
        );

        if(loggedInUser){
            window.currentUser={...(window.currentUser||{}),...loggedInUser};
            window.isHelper=
                loggedInUser.isHelper===true||
                loggedInUser.isHelper==='true';

            if(typeof window.applyAccessControl==='function'){
                window.applyAccessControl();
            }
        }


        if(admin&&typeof renderAdminList==='function'){
            renderAdminList();
        }


        if(typeof renderHeroes==='function'){
            renderHeroes();
        }
    });

    // 학생 공개 명단에는 포인트/경험치가 의도적으로 빠져 있다.
    // 로그인한 학생에게 허용된 자기 레코드만 별도로 구독해 도감 지급,
    // 상점 구매 등 모든 포인트 변화를 화면에 즉시 반영한다.
    if(!admin&&String(window.myName||'').trim()){
        if(typeof window.stopOwnUserListener==='function'){
            window.stopOwnUserListener();
        }

        const ownUserRef=db.ref(`users/${window.myName}`);
        const receiveOwnUser=snapshot=>{
            if(!snapshot.exists())return;

            const ownData={
                ...(snapshot.val()||{}),
                name:window.myName,
                __firebaseKey:snapshot.key
            };

            window.currentUser={...(window.currentUser||{}),...ownData};

            if(Array.isArray(window.currentUsers)){
                const index=window.currentUsers.findIndex(user=>
                    String(user&&user.name||'')===String(window.myName||'')
                );
                if(index>=0){
                    window.currentUsers[index]={...window.currentUsers[index],...ownData};
                }
            }

            if(typeof renderHeroes==='function'){
                renderHeroes(window.currentUsers);
            }
        };

        ownUserRef.on('value',receiveOwnUser,error=>{
            console.error('내 포인트 갱신 오류:',error);
        });
        window.stopOwnUserListener=()=>ownUserRef.off('value',receiveOwnUser);
    }


    if(typeof generateNewLayout==='function'){
        generateNewLayout();
    }

    if(typeof loadCheckinState==='function'){
        loadCheckinState();
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

    if(typeof window.initHomeDashboard==='function'){
        window.initHomeDashboard();
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


// 포인트 증감과 로그 기록을 한 곳에서 처리합니다.
window.addScore=async function(userName,points,exp,reason){
    const pointValue=parseInt(points)||0;
    const expValue=parseInt(exp)||0;
    const requestId=`score_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    return window.callSecure('adjustStudentScores',{
        requestId,reason:reason||'포인트 변경',
        targets:[{name:userName,points:pointValue,exp:expValue}]
    });
};


window.togglePointPopInputs=function(checkbox){
    const row=checkbox&&checkbox.closest
        ?checkbox.closest('label,.batch-student-row')
        :null;
    if(!row)return;
    row.querySelectorAll('input[type="number"]').forEach(input=>{
        input.disabled=!checkbox.checked;
    });
};


// 팝업을 여는 기능이 실제 클릭 핸들러를 덮어씁니다.
// 초기 HTML의 fallback 호출이 남아 있어도 오류가 나지 않게 합니다.
window.submitPointPopupCustom=function(){
    alert('먼저 포인트 지급 대상을 선택해 주세요.');
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
            <div class="batch-student-row">

                <label class="row">
                    <input
                        type="checkbox"
                        class="batch-student-chk"
                        value="${safe}">

                    <span class="strong">${safe}</span>

                    <span class="muted small">
                        (${parseInt(u.points)||0}P)
                    </span>
                </label>

                <div class="batch-card-field">
                    <input
                        type="number"
                        class="batch-p-input"
                        placeholder="포인트(P)">
                </div>

                <div class="batch-card-field">
                    <input
                        type="number"
                        class="batch-exp-input"
                        placeholder="경험치(EXP)">
                </div>
            </div>
        `;
    });


    const html=`
        <div class="stack">

            <h3 class="center">
                🎁 포인트 및 경험치 개별 차등 지급
            </h3>

            <input
                type="text"
                id="batch-reason"
                placeholder="공통 사유 입력 (예: 모둠 활동 우수)">

            <div class="btn-row btn-row--fill">

                <button
                    class="btn"
                    onclick="document.querySelectorAll('.batch-student-chk').forEach(cb=>cb.checked=true)">
                    전체 선택
                </button>

                <button
                    class="btn"
                    onclick="document.querySelectorAll('.batch-student-chk').forEach(cb=>cb.checked=false)">
                    전체 해제
                </button>

            </div>

            <div class="batch-card-modal-v6">
    ${studentRows||'<div class="empty"><span>학생이 없습니다.</span></div>'}
</div>
            <div class="btn-row btn-row--fill">

                <button
                    class="btn"
                    onclick="closePopup()">
                    취소
                </button>

                <button
                    class="btn btn--good"
                    onclick="submitBatchPoints()">
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


    try{
        const requestId=`score_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
        await window.callSecure('adjustStudentScores',{
            requestId,reason,
            targets:targets.map(target=>({name:target.name,points:target.p,exp:target.exp}))
        });

        closePopup();

        alert(
            `✅ ${targets.length}명의 학생에게 포인트와 경험치를 반영했습니다.`
        );

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

// 등교/출결 화면 전용 독립 팝업 패치
(function () {
    'use strict';

    if (window.__checkinIndependentPopupInstalled) return;
    window.__checkinIndependentPopupInstalled = true;

    const OVERLAY_ID = 'checkin-independent-popup';
    const STYLE_ID = 'checkin-independent-popup-style';
    const originalOpenPopup = window.openPopup;
    const originalClosePopup = window.closePopup;

    function isCheckinPopup(title, content) {
        const text = `${title || ''} ${content || ''}`;

        // 판정 기준은 현재 탭입니다.
        // `sub-checkin-logs` 의 display 값은 탭을 이동해도 'block' 으로 유지되므로 사용하지 않습니다.
        const checkinTab = window.currentTab === 'checkin' ||
            document.getElementById('tab-checkin')?.classList.contains('active');

        const checkinContent = /등교|출석|출결|지각|결석|조퇴|학생 배치|요일별 등교제외/.test(text);

        return checkinTab || checkinContent;
    }

    function installStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483000;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100vw;
                height: 100vh;
                margin: 0;
                padding: 24px;
                overflow: hidden;
                background: rgba(14, 24, 34, .55);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                box-sizing: border-box;
            }

            #${OVERLAY_ID}[hidden] {
                display: none;
            }

            #${OVERLAY_ID} * {
                box-sizing: border-box;
            }

            #${OVERLAY_ID} .checkin-popup-dialog {
                display: flex;
                flex-direction: column;
                width: min(1120px, 96vw);
                max-width: 1120px;
                height: auto;
                max-height: 90vh;
                margin: 0;
                padding: 0;
                overflow: hidden;
                color: var(--ui-text);
                background: var(--ui-surface);
                border: 1px solid var(--ui-line);
                border-top: 7px solid var(--ui-accent);
                border-radius: 22px;
                box-shadow: var(--ui-shadow-lg);
                transform: none;
            }

            #${OVERLAY_ID} .checkin-popup-header {
                display: flex;
                flex: 0 0 auto;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                min-height: 72px;
                padding: 16px 20px 16px 26px;
                background: var(--ui-surface-soft);
                border-bottom: 1px solid var(--ui-line-soft);
            }

            #${OVERLAY_ID} .checkin-popup-title {
                min-width: 0;
                margin: 0;
                overflow: hidden;
                color: var(--ui-text);
                font-family: var(--ui-font-display);
                font-size: var(--ui-subtitle-size);
                font-weight: 900;
                line-height: 1.3;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            #${OVERLAY_ID} .checkin-popup-close {
                flex: 0 0 46px;
                width: 46px;
                height: 46px;
                min-height: 46px;
                margin: 0;
                padding: 0;
                color: var(--ui-accent);
                background: var(--ui-surface-soft);
                border: 0;
                border-radius: 13px;
                font-size: var(--ui-subtitle-size);
                font-weight: 900;
                line-height: 1;
                cursor: pointer;
                box-shadow: none;
            }

            #${OVERLAY_ID} .checkin-popup-content {
                flex: 1 1 auto;
                min-height: 0;
                padding: 24px 26px 28px;
                overflow-x: auto;
                overflow-y: auto;
                background: var(--ui-surface);
                font-family: var(--ui-font-body);
                font-size: var(--ui-text-size);
                line-height: 1.55;
            }

            #${OVERLAY_ID} .checkin-popup-content input,
            #${OVERLAY_ID} .checkin-popup-content select,
            #${OVERLAY_ID} .checkin-popup-content textarea,
            #${OVERLAY_ID} .checkin-popup-content button {
                font-size: var(--ui-text-size);
            }

            #${OVERLAY_ID} .checkin-popup-content table {
                max-width: none;
            }

            @media (max-width: 700px) {
                #${OVERLAY_ID} {
                    align-items: flex-start;
                    padding: 10px;
                }

                #${OVERLAY_ID} .checkin-popup-dialog {
                    width: 100%;
                    max-height: calc(100vh - 20px);
                    border-radius: 16px;
                }

                #${OVERLAY_ID} .checkin-popup-header {
                    min-height: 62px;
                    padding: 10px 12px 10px 16px;
                }

                #${OVERLAY_ID} .checkin-popup-title {
                    font-size: var(--ui-heading-size);
                }

                #${OVERLAY_ID} .checkin-popup-content {
                    padding: 18px 14px 22px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function ensureOverlay() {
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.hidden = true;
        overlay.innerHTML = `
            <section class="checkin-popup-dialog" role="dialog" aria-modal="true" aria-labelledby="checkin-popup-title">
                <header class="checkin-popup-header">
                    <h2 class="checkin-popup-title" id="checkin-popup-title"></h2>
                    <button type="button" class="checkin-popup-close" data-checkin-popup-close aria-label="닫기">×</button>
                </header>
                <div class="checkin-popup-content" id="checkin-popup-content"></div>
            </section>
        `;

        overlay.addEventListener('click', event => {
            if (event.target === overlay || event.target.closest('[data-checkin-popup-close]')) {
                closeCheckinPopup();
            }
        });

        document.body.appendChild(overlay);
        return overlay;
    }

    function openCheckinPopup(title, content) {
        installStyle();
        const overlay = ensureOverlay();
        const titleElement = overlay.querySelector('.checkin-popup-title');
        const contentElement = overlay.querySelector('.checkin-popup-content');
        const oldOverlay = document.getElementById('common-overlay');

        if (oldOverlay) oldOverlay.style.display = 'none';
        if (titleElement) titleElement.textContent = title || '등교 기록';
        if (contentElement) {
            contentElement.innerHTML = content || '';
            contentElement.scrollTop = 0;
            contentElement.scrollLeft = 0;
        }

        overlay.dataset.previousOverflow = document.body.style.overflow || '';
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';
        overlay.querySelector('.checkin-popup-close')?.focus();
    }

    function closeCheckinPopup() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (!overlay || overlay.hidden) return false;

        overlay.hidden = true;
        const content = overlay.querySelector('.checkin-popup-content');
        if (content) content.innerHTML = '';
        document.body.style.overflow = overlay.dataset.previousOverflow || '';
        return true;
    }

    window.openCheckinPopup = openCheckinPopup;
    window.closeCheckinPopup = closeCheckinPopup;

    window.openPopup = function (title, content) {
        if (isCheckinPopup(title, content)) {
            openCheckinPopup(title, content);
            return;
        }

        if (typeof originalOpenPopup === 'function') {
            return originalOpenPopup.apply(this, arguments);
        }
    };

    window.closePopup = function () {
        if (closeCheckinPopup()) return;

        if (typeof originalClosePopup === 'function') {
            return originalClosePopup.apply(this, arguments);
        }
    };

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeCheckinPopup();
    });
})();
// 용사 상세창 V5: 왼쪽 프로필 / 오른쪽 포인트 증감 내역
(function () {
    'use strict';
    if (window.__heroDetailV5Installed) return;
    window.__heroDetailV5Installed = true;

    const CARD_SELECTOR = '.hero-card,.hero-card-item,.student-card,[data-user-id],[data-student-id],#hero-grid > *,.hero-grid > *';
    const OVERLAY_ID = 'hero-detail-v5';
    const STYLE_ID = 'hero-detail-v5-style';
    let activeRequest = 0;

    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function first(object, keys, fallback = '-') {
        for (const key of keys) {
            const value = object?.[key];
            if (value !== undefined && value !== null && value !== '') return value;
        }
        return fallback;
    }

    function getUsers() {
        for (const source of [window.currentUsers, window.users, window.students, window.heroes]) {
            if (Array.isArray(source)) return source;
            if (source && typeof source === 'object') return Object.values(source);
        }
        return [];
    }

    function getCard(target) {
        const card = target instanceof Element ? target.closest(CARD_SELECTOR) : null;
        return card?.classList.contains('empty') ? null : card;
    }

    function getCardName(card) {
        const dataName = card.dataset.name || card.dataset.userName ||
            card.dataset.username || card.dataset.heroName || card.dataset.studentName;
        if (dataName) return String(dataName).trim();

        const text = String(card.textContent || '').replace(/\s+/g, ' ').trim();
        const match = getUsers().filter(user => user?.name && text.includes(String(user.name)))
            .sort((a, b) => String(b.name).length - String(a.name).length)[0];
        if (match) return String(match.name);

        const node = card.querySelector('.hero-name,.student-name,[data-name],h2,h3,h4');
        return node?.textContent?.trim() || text;
    }

    function getUser(card) {
        const list = getUsers();
        const id = card.dataset.userId || card.dataset.studentId ||
            card.dataset.uid || card.dataset.key || card.dataset.id;

        if (id) {
            const match = list.find(user =>
                [user?.id, user?.userId, user?.studentId, user?.uid, user?.key]
                    .some(value => value != null && String(value) === String(id))
            );
            if (match) return match;
        }

        const name = getCardName(card);
        return list.find(user =>
            String(first(user, ['name', 'userName', 'username'], '')).trim() === name
        ) || {
            name,
            points: card.dataset.points || card.dataset.point || 0,
            exp: card.dataset.exp || card.dataset.experience || 0,
            character: card.dataset.character || card.dataset.avatar || '🧙'
        };
    }

    async function getFullUser(card) {
        const localUser = getUser(card);
        if (window.isAdmin !== true) return localUser;

        const name = String(first(localUser, ['name', 'userName', 'username'], getCardName(card))).trim();
        const firebaseKey = String(
            card.dataset.firebaseKey || card.dataset.userKey || card.dataset.key || name
        ).trim();

        if (typeof db === 'undefined' || !db?.ref) return localUser;

        try {
            // 현재 앱은 users/{학생 이름} 경로에 학생 정보를 저장합니다.
            const directSnapshot = await db.ref(`users/${firebaseKey}`).once('value');
            if (directSnapshot.exists()) {
                const saved = directSnapshot.val() || {};
                return { ...localUser, ...saved, __firebaseKey: firebaseKey, name: saved.name || name || firebaseKey };
            }

            // 카드의 key와 학생 이름이 다른 경우 name 필드로 한 번 더 찾습니다.
            const nameSnapshot = await db.ref('users').orderByChild('name').equalTo(name).once('value');
            let found = null;
            nameSnapshot.forEach(child => {
                if (!found) found = { ...(child.val() || {}), __firebaseKey: child.key };
            });
            return found ? { ...localUser, ...found, name: found.name || name } : localUser;
        } catch (error) {
            console.error('학생 상세정보 로딩 오류:', error);
            return localUser;
        }
    }

    function avatarHtml(user, name) {
        const selectedAnimal = String(first(user,
            ['selectedAnimal', 'animal'],
            ''
        )).trim();
        const level = Number(first(user, ['level', 'lv'], 1)) || 1;

        if (typeof window.getAvatar === 'function') {
            return window.getAvatar(level, selectedAnimal || undefined, 148);
        }

        if (typeof getAvatar === 'function') {
            return getAvatar(level, selectedAnimal || undefined, 148);
        }

        const value = String(first(user,
            ['avatarUrl', 'profileImage', 'characterImage', 'image', 'photo', 'avatar', 'character'],
            String(name).charAt(0) || '용사'
        )).trim();
        if (/^(https?:|data:image\/|blob:|\/|\.\.\/|\.\/)/i.test(value)) {
            return `<img src="${esc(value)}" alt="${esc(name)} 캐릭터">`;
        }
        return `<span>${esc(value || String(name).charAt(0) || '용사')}</span>`;
    }

    function historyTime(item) {
        const raw = Number(item.timestamp || item.createdAt || item.timeStamp || 0);
        if (Number.isFinite(raw) && raw > 0) return raw;
        const parsed = Date.parse(`${item.date || ''} ${item.time || ''}`.trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function snapshotValues(snapshot) {
        const result = [];
        if (!snapshot?.forEach) return result;
        snapshot.forEach(child => result.push({ key: child.key, ...(child.val() || {}) }));
        return result;
    }

    function snapshotValues(snapshot) {
    const result = [];

    if (!snapshot?.forEach) return result;

    snapshot.forEach(child => {
        result.push({
            key: child.key,
            ...(child.val() || {})
        });
    });

    return result;
}

function historyAmount(item) {
    return Number(first(
        item,
        [
            'pChange',
            'change',
            'pAmt',
            'amount',
            'p',
            'pointDelta'
        ],
        0
    )) || 0;
}

function historyFingerprint(item) {
    const timestamp = historyTime(item);

    const timeKey = timestamp
        ? Math.floor(timestamp / 2000)
        : `${item.date || ''} ${item.time || ''}`.trim();

    return [
        timeKey,
        first(item, ['reason', 'title', 'memo'], ''),
        historyAmount(item),
        Number(
            first(
                item,
                ['expChange', 'eAmt', 'expAmt'],
                0
            )
        ) || 0
    ].join('|');
}

async function loadHistory(name, firebaseKey) {
    if (
        typeof db === 'undefined' ||
        !db?.ref ||
        !name
    ) {
        return [];
    }

    const normalizeName = value =>
        String(value ?? '')
            .normalize('NFC')
            .replace(/\s+/g, '')
            .trim();

    const targetName = normalizeName(name);

    /*
     * 학생 이름과 Firebase 사용자 키가 다를 수 있으므로
     * 두 경로를 모두 조회합니다.
     */
    const historyKeys = [
        ...new Set(
            [firebaseKey, name]
                .map(value => String(value || '').trim())
                .filter(Boolean)
        )
    ];

    /*
     * 학생별 포인트 기록을 우선 조회합니다.
     *
     * pointHistory/{학생키}
     */
    const directResults = await Promise.all(
        historyKeys.map(key =>
            db.ref(`pointHistory/${key}`)
                .limitToLast(100)
                .once('value')
                .then(snapshotValues)
                .catch(error => {
                    console.warn(
                        `학생별 포인트 내역 조회 실패 (${key}):`,
                        error
                    );

                    return [];
                })
        )
    );

    /*
     * pointLogs에만 저장된 기존 기록도 조회합니다.
     */
    let oldHistory = [];

    try {
        const snapshot = await db.ref('pointLogs')
            .orderByChild('name')
            .equalTo(name)
            .limitToLast(100)
            .once('value');

        oldHistory = snapshotValues(snapshot);

    } catch (error) {
        console.warn(
            '이름별 포인트 로그 조회 실패, 최근 로그로 재시도:',
            error
        );

        /*
         * 이름별 쿼리가 Firebase 규칙이나 인덱스 문제로 실패하면
         * 최근 전체 로그에서 학생 이름을 찾아냅니다.
         */
        try {
            const snapshot = await db.ref('pointLogs')
                .limitToLast(2000)
                .once('value');

            oldHistory = snapshotValues(snapshot)
                .filter(item =>
                    normalizeName(
                        first(
                            item,
                            [
                                'name',
                                'user',
                                'userName',
                                'studentName',
                                'targetName'
                            ],
                            ''
                        )
                    ) === targetName
                );

        } catch (fallbackError) {
            console.warn(
                '최근 포인트 로그 조회 실패:',
                fallbackError
            );
        }
    }

    /*
     * pointHistory와 pointLogs를 합치고
     * 중복 기록 제거 → 최신순 정렬 → 최근 50건 표시
     */
    const seen = new Set();

    return [
        ...directResults.flat(),
        ...oldHistory
    ]
        .sort((a, b) => {
            const timeDiff =
                historyTime(b) - historyTime(a);

            if (timeDiff) return timeDiff;

            return String(b.key || '')
                .localeCompare(String(a.key || ''));
        })
        .filter(item => {
            const fingerprint =
                historyFingerprint(item);

            if (seen.has(fingerprint)) {
                return false;
            }

            seen.add(fingerprint);
            return true;
        })
        .slice(0, 50);
}

    function renderHistory(items) {
        if (!items.length) return '<div class="hd-empty">아직 포인트 증감 내역이 없습니다.</div>';

        return items.map(item => {
            const amount = Number(
    item.pChange ??
    item.change ??
    item.pAmt ??
    item.amount ??
    item.p ??
    item.pointDelta ??
    0
) || 0;
            const expAmount = Number(first(item, ['eAmt', 'expAmt', 'expChange'], 0)) || 0;
            const reason = first(item, ['reason', 'title', 'memo'], '포인트 변경');
            const time = [item.date, item.time].filter(Boolean).join(' ') ||
                (historyTime(item) ? new Date(historyTime(item)).toLocaleString('ko-KR') : '날짜 정보 없음');
            const tone = amount > 0 ? 'plus' : amount < 0 ? 'minus' : 'zero';
            const signed = amount > 0 ? `+${amount}` : String(amount);
            const expText = expAmount
                ? `<span class="hd-exp-change">EXP ${expAmount > 0 ? '+' : ''}${esc(expAmount)}</span>`
                : '';

            return `<article class="hd-log-row">
                <div class="hd-log-copy"><strong>${esc(reason)}</strong><time>${esc(time)}</time><div>${expText}</div></div>
                <b class="hd-change ${tone}">${esc(signed)}P</b>
            </article>`;
        }).join('');
    }

    function installStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID}{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(14,24,34,.55);backdrop-filter:blur(5px);box-sizing:border-box}
            #${OVERLAY_ID}[hidden]{display:none}#${OVERLAY_ID} *{box-sizing:border-box}
            #${OVERLAY_ID} .hd-dialog{position:relative;display:grid;grid-template-columns:310px minmax(0,1fr);grid-template-rows:minmax(0,1fr);width:min(1000px,96vw);height:min(680px,90vh);overflow:hidden;background:var(--ui-surface);border:1px solid var(--ui-line);border-top:8px solid var(--ui-accent);border-radius:24px;box-shadow:var(--ui-shadow-lg)}
            #${OVERLAY_ID} .hd-close{position:absolute;top:14px;right:14px;z-index:2;width:46px;height:46px;padding:0;border:0;border-radius:14px;background:var(--ui-surface-soft);color:var(--ui-accent);font-size:var(--ui-subtitle-size);font-weight:900;cursor:pointer}
            #${OVERLAY_ID} .hd-profile{display:flex;min-height:0;overflow-y:auto;flex-direction:column;align-items:center;padding:42px 28px 30px;background:linear-gradient(155deg,var(--ui-surface),var(--ui-gold-soft));border-right:1px solid var(--ui-gold-line);text-align:center}
            #${OVERLAY_ID} .hd-avatar{display:grid;flex-shrink:0;place-items:center;width:170px;height:170px;margin:10px 0 22px;overflow:hidden;background:var(--ui-surface);border:5px solid var(--ui-gold-line);border-radius:38px;box-shadow:var(--ui-shadow);font-size:78px}
            #${OVERLAY_ID} .hd-avatar img{width:100%;height:100%;object-fit:contain}#${OVERLAY_ID} .hd-kicker{margin:0 0 6px;color:var(--ui-gold);font-family:var(--ui-font-body);font-size:var(--ui-text-size);font-weight:900}
            #${OVERLAY_ID} .hd-name{margin:0;color:var(--ui-text);font-family:var(--ui-font-display);font-size:var(--ui-title-size);line-height:1.2;font-weight:950}#${OVERLAY_ID} .hd-role{margin:8px 0 4px;color:var(--ui-muted);font-size:var(--ui-text-size);font-weight:750}#${OVERLAY_ID} .hd-meta{margin:0 0 22px;color:var(--ui-faint);font-size:var(--ui-small-size);font-weight:800}
            #${OVERLAY_ID} .hd-profile-stats{display:grid;flex-shrink:0;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin-top:auto}#${OVERLAY_ID} .hd-profile-stat{padding:17px 9px;background:var(--ui-surface);border:1px solid var(--ui-gold-line);border-radius:15px}
            #${OVERLAY_ID} .hd-profile-stat span{display:block;color:var(--ui-muted);font-size:var(--ui-small-size);font-weight:800}#${OVERLAY_ID} .hd-profile-stat strong{display:block;margin-top:5px;color:var(--ui-text);font-size:var(--ui-heading-size);font-weight:950}
            #${OVERLAY_ID} .hd-history{display:flex;min-width:0;min-height:0;flex-direction:column;padding:36px 32px 28px;background:var(--ui-surface-soft)}#${OVERLAY_ID} .hd-history-head{flex-shrink:0;padding-right:48px;margin-bottom:18px}
            #${OVERLAY_ID} .hd-history-head h3{margin:0;color:var(--ui-text);font-family:var(--ui-font-display);font-size:var(--ui-subtitle-size);font-weight:950}#${OVERLAY_ID} .hd-history-head p{margin:7px 0 0;color:var(--ui-muted);font-size:var(--ui-small-size)}
            #${OVERLAY_ID} .hd-log-list{flex:1;min-height:0;overflow-y:auto;padding-right:5px}#${OVERLAY_ID} .hd-log-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 18px;margin-bottom:10px;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px}
            #${OVERLAY_ID} .hd-log-copy{min-width:0}#${OVERLAY_ID} .hd-log-copy>strong{display:block;overflow:hidden;color:var(--ui-accent);font-size:var(--ui-text-size);text-overflow:ellipsis;white-space:nowrap}#${OVERLAY_ID} .hd-log-copy time{display:block;margin:5px 0;color:var(--ui-faint);font-size:var(--ui-small-size)}
            #${OVERLAY_ID} .hd-exp-change,#${OVERLAY_ID} .hd-result{display:inline-block;margin-right:10px;color:var(--ui-muted);font-size:var(--ui-tiny-size);font-weight:750}#${OVERLAY_ID} .hd-change{flex:0 0 auto;font-size:var(--ui-heading-size);font-weight:950}
            #${OVERLAY_ID} .hd-change.plus{color:var(--ui-good)}#${OVERLAY_ID} .hd-change.minus{color:var(--ui-bad)}#${OVERLAY_ID} .hd-change.zero{color:var(--ui-muted)}#${OVERLAY_ID} .hd-empty,#${OVERLAY_ID} .hd-loading{display:grid;place-items:center;min-height:260px;color:var(--ui-faint);background:var(--ui-surface);border:1px dashed var(--ui-line);border-radius:16px;font-size:var(--ui-text-size);text-align:center}
            #${OVERLAY_ID} .hd-room-button{flex-shrink:0;width:100%;margin-top:16px;padding:13px;border:0;border-radius:12px;background:var(--ui-accent);color:var(--ui-on-accent);font-size:var(--ui-text-size);font-weight:800;cursor:pointer}
            @media(max-width:720px){#${OVERLAY_ID}{padding:8px}#${OVERLAY_ID} .hd-dialog{display:block;height:min(92vh,760px);overflow-y:auto}#${OVERLAY_ID} .hd-profile{min-height:370px;overflow:visible;padding:28px 18px 20px;border-right:0;border-bottom:1px solid var(--ui-gold-line)}#${OVERLAY_ID} .hd-avatar{width:125px;height:125px;margin:4px 0 14px;border-radius:28px;font-size:58px}#${OVERLAY_ID} .hd-name{font-size:var(--ui-title-size)}#${OVERLAY_ID} .hd-role{margin-bottom:15px}#${OVERLAY_ID} .hd-history{padding:24px 16px}#${OVERLAY_ID} .hd-history-head h3{font-size:var(--ui-heading-size)}#${OVERLAY_ID} .hd-log-list{overflow:visible}}
        `;
        document.head.appendChild(style);
    }

    function closeDetail() {
        const overlay = document.getElementById(OVERLAY_ID);
        activeRequest++;
        if (!overlay) return;
        overlay.hidden = true;
        overlay.innerHTML = '';
        document.body.style.overflow = overlay.dataset.oldOverflow || '';
    }

    function ensureOverlay() {
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.hidden = true;
        overlay.addEventListener('click', event => {
            if (event.target === overlay || event.target.closest('[data-hd-close]')) closeDetail();
        });
        document.body.appendChild(overlay);
        return overlay;
    }

    async function openDetail(user) {
        installStyle();
        const requestId = ++activeRequest;
        const overlay = ensureOverlay();
        const name = first(user, ['name', 'userName', 'username'], '이름 없음');
        const points = Number(first(user, ['points', 'point', 'score'], 0)) || 0;
        const exp = Number(first(user, ['exp', 'experience', 'xp'], 0)) || 0;
        const level = first(user, ['level', 'lv'], Math.max(1, Math.floor(exp / 100) + 1));
        const number = first(user, ['no', 'number', 'studentNo'], '-');
        const title = first(user, ['selectedTitle', 'title', 'rank', 'grade'], '모험가');
        const role = first(user, ['role', 'job', 'classRole'], '용사');

        overlay.dataset.oldOverflow = document.body.style.overflow || '';
        overlay.innerHTML = `<section class="hd-dialog" role="dialog" aria-modal="true" aria-label="${esc(name)} 상세정보">
            <button type="button" class="hd-close" data-hd-close aria-label="닫기">×</button>
            <aside class="hd-profile"><div class="hd-avatar">${avatarHtml(user, name)}</div><p class="hd-kicker">⚔ 용사 프로필</p><h2 class="hd-name">${esc(name)}</h2><p class="hd-role">${esc(title)} · ${esc(role)}</p><p class="hd-meta">Lv.${esc(level)} · ${esc(number)}번</p>
                <div class="hd-profile-stats"><div class="hd-profile-stat"><span>포인트</span><strong>${points.toLocaleString('ko-KR')} P</strong></div><div class="hd-profile-stat"><span>경험치</span><strong>${exp.toLocaleString('ko-KR')} EXP</strong></div></div>
                <button type="button" class="hd-room-button" data-hd-room>🏠 학생 방 방문하기</button>
            </aside>
            <main class="hd-history"><header class="hd-history-head"><h3>포인트 증감 내역</h3><p>최근 기록부터 표시됩니다.</p></header><div class="hd-log-list"><div class="hd-loading">내역을 불러오는 중입니다.</div></div></main>
        </section>`;
        overlay.querySelector('[data-hd-room]').onclick = () => {
            const owner = String(first(user, ['__firebaseKey', 'firebaseKey', 'userKey'], name));
            closeDetail();
            window.openFriendRoom(owner);
        };
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';

       const items = await loadHistory(
    String(name),
    first(user, ['__firebaseKey', 'firebaseKey', 'userKey'], name)
);
        if (requestId !== activeRequest || overlay.hidden) return;
        const list = overlay.querySelector('.hd-log-list');
        if (list) list.innerHTML = renderHistory(items);
    }

    // window 캡처 단계에서 먼저 처리하여 이전 상세창 클릭 코드를 확실히 막습니다.
    if (typeof window.addEventListener === 'function') window.addEventListener('click', async event => {
        const card = getCard(event.target);
        if (!card) return;
        const control = event.target.closest('button,a,input,select,textarea,label');
        if (control && control !== card) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const user = await getFullUser(card);
        const name = String(first(user, ['name', 'userName', 'username'], getCardName(card))).trim();
        const adminUser = window.isAdmin === true ||
            (typeof isAdmin !== 'undefined' && isAdmin === true);

        if (!adminUser) {
            if (name && name === window.myName &&
                typeof window.openHeroProfileEditor === 'function') {
                window.openHeroProfileEditor(name);
                return;
            }

            if (typeof window.openFriendRoom === 'function') {
                window.openFriendRoom(name);
            }
            return;
        }

        openDetail(user);
    }, true);

    document.addEventListener('mouseover', event => {
        const card = getCard(event.target);
        if (!card) return;
        card.style.cursor = 'pointer';
        card.title = card.title || '클릭하여 용사 상세정보 보기';
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeDetail();
    });

    window.openHeroDetail = openDetail;
    window.closeHeroDetail = closeDetail;
})();

// 포인트 개별 차등 지급 — 학생 카드 그리드 V6
(function () {
    'use strict';

    if (window.__batchStudentCardV6Installed) return;
    window.__batchStudentCardV6Installed = true;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 카드 그리드는 css/style.css의 .batch-card-modal-v6 / .batch-student-row /
    // .batch-card-field / .batch-p-input / .batch-exp-input 클래스를 그대로 씁니다.

    // 검색으로 걸러진 학생은 전체 선택에서도 빠집니다.
    function setAllCards(checked) {
        document.querySelectorAll('.batch-card-modal-v6 .batch-student-row').forEach(row => {
            if (row.hidden) return;

            const checkbox = row.querySelector('.batch-student-chk');
            if (!checkbox) return;

            checkbox.checked = checked;
            row.classList.toggle('is-selected', checked);
        });
    }

    function batchHint(message) {
        const hint = document.getElementById('batch-hint');
        if (hint) hint.textContent = String(message || '');
    }

    // 번호나 이름 일부로 즉시 좁힙니다. 25명이 넘어가면 눈으로 찾는 게 일이 됩니다.
    window.batchFilterCardsV6 = function (value) {
        const query = String(value || '').trim().toLowerCase();
        let shown = 0;

        document.querySelectorAll('.batch-card-modal-v6 .batch-student-row').forEach(row => {
            const name = String(row.dataset.name || '').toLowerCase();
            const no = String(row.dataset.no || '');
            const match = !query || name.includes(query) || no.startsWith(query);

            row.hidden = !match;
            if (match) shown += 1;
        });

        batchHint(query ? `${shown}명 표시 중` : '');
    };

    // 반 전체에 +1P 같은 가장 흔한 작업을 위해, 선택한 학생 입력칸을 한 번에 채웁니다.
    window.batchFillSelectedV6 = function () {
        const pointValue = String(document.getElementById('batch-fill-p')?.value ?? '').trim();
        const expValue = String(document.getElementById('batch-fill-exp')?.value ?? '').trim();

        if (pointValue === '' && expValue === '') {
            batchHint('채울 포인트나 경험치를 먼저 입력해 주세요.');
            return;
        }

        let filled = 0;

        document.querySelectorAll('.batch-card-modal-v6 .batch-student-row').forEach(row => {
            const checkbox = row.querySelector('.batch-student-chk');
            if (!checkbox || !checkbox.checked) return;

            if (pointValue !== '') {
                const input = row.querySelector('.batch-p-input');
                if (input) input.value = pointValue;
            }

            if (expValue !== '') {
                const input = row.querySelector('.batch-exp-input');
                if (input) input.value = expValue;
            }

            filled += 1;
        });

        batchHint(
            filled
                ? `${filled}명의 입력칸을 채웠습니다. 값은 개별로 고쳐도 됩니다.`
                : '선택된 학생이 없습니다. 먼저 학생을 고르세요.'
        );
    };

    window.batchSelectAllCardsV6 = function () {
        setAllCards(true);
    };

    window.batchClearAllCardsV6 = function () {
        setAllCards(false);
    };

    window.openBatchPointModal = function () {
        if (typeof isCheckinAdminUser === 'function' && !isCheckinAdminUser()) return;

        const users = Array.isArray(window.currentUsers) ? window.currentUsers : [];
        const cards = users
            .filter(user => {
                const name = user?.name || '';
                return name && name !== '총사령관' && !name.includes('선생님');
            })
            .sort((a, b) => (Number.parseInt(a.no, 10) || 99) - (Number.parseInt(b.no, 10) || 99))
            .map(user => {
                const safeName = escapeHtml(user.name || '');
                const points = Number.parseInt(user.points, 10) || 0;
                const no = Number.parseInt(user.no, 10);
                const label = Number.isFinite(no) && no > 0 ? String(no) : '–';

                return `
                    <article class="batch-student-row" data-name="${safeName}" data-no="${escapeHtml(label)}">
                        <label class="row">
                            <input type="checkbox" class="batch-student-chk" value="${safeName}">
                            <span class="batch-no">${escapeHtml(label)}</span>
                            <span class="strong">${safeName}</span>
                            <span class="badge badge--gold">${points.toLocaleString('ko-KR')}P</span>
                        </label>

                        <div class="batch-card-field">
                            <input type="number" class="batch-p-input" placeholder="포인트" aria-label="${safeName} 포인트" title="포인트" inputmode="numeric">
                        </div>

                        <div class="batch-card-field">
                            <input type="number" class="batch-exp-input" placeholder="경험치" aria-label="${safeName} 경험치" title="경험치" inputmode="numeric">
                        </div>
                    </article>
                `;
            })
            .join('');

        const html = `
            <div class="stack">
                <input
                    type="text"
                    id="batch-reason"
                    placeholder="공통 사유 입력 (예: 모둠 활동 우수)"
                >

                <input
                    type="search"
                    id="batch-search"
                    placeholder="번호나 이름으로 찾기 (예: 7, 김)"
                    oninput="batchFilterCardsV6(this.value)"
                >

                <div class="btn-row btn-row--fill">
                    <button type="button" class="btn" onclick="batchSelectAllCardsV6()">전체 선택</button>
                    <button type="button" class="btn" onclick="batchClearAllCardsV6()">전체 해제</button>
                </div>

                <div class="batch-fill">
                    <span class="batch-fill-label">선택 학생 한 번에</span>
                    <input type="number" id="batch-fill-p" class="input--num" placeholder="P" inputmode="numeric" aria-label="일괄 포인트">
                    <input type="number" id="batch-fill-exp" class="input--num" placeholder="EXP" inputmode="numeric" aria-label="일괄 경험치">
                    <button type="button" class="btn btn--sm" onclick="batchFillSelectedV6()">채우기</button>
                </div>

                <p id="batch-hint" class="muted small" role="status"></p>

                <section class="batch-card-modal-v6">
                    ${cards || '<div class="empty"><span>학생이 없습니다.</span></div>'}
                </section>

                <div class="btn-row btn-row--fill">
                    <button type="button" class="btn" onclick="closePopup()">취소</button>
                    <button type="button" class="btn btn--good" onclick="submitBatchPoints()">선택 학생 반영</button>
                </div>
            </div>
        `;

        openPopup('🎁 포인트 개별 차등 지급', html);
    };

    document.addEventListener('change', event => {
        if (!event.target.matches('.batch-card-modal-v6 .batch-student-chk')) return;
        event.target.closest('.batch-student-row')
            ?.classList.toggle('is-selected', event.target.checked);
    });
})();
