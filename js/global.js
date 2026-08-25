// js/global.js
// 공통 유틸리티 및 앱 초기화

function getTodayKST(){
    const now=new Date();
    const krTime=new Date(now.getTime()+9*60*60*1000);
    return krTime.getUTCFullYear()+"-"+String(krTime.getUTCMonth()+1).padStart(2,'0')+"-"+String(krTime.getUTCDate()).padStart(2,'0');
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

function showTab(t){
    window.currentTab=t;

    try{
        sessionStorage.setItem('activeTab',t);
    }catch(e){
        console.warn('activeTab 저장 실패:',e);
    }

    document.querySelectorAll('.tab-content').forEach(s=>{
        s.classList.remove('active');
        s.style.display='none';
    });

    document.querySelectorAll('.sidebar-menu button').forEach(b=>{
        b.classList.remove('active');
    });

    const targetTab=document.getElementById('tab-'+t);

    if(targetTab){
        targetTab.classList.add('active');
        targetTab.style.display='block';
    }

    const targetBtn=document.getElementById('btn-'+t);

    if(targetBtn)targetBtn.classList.add('active');

    if(t==='checkin'){
        if(typeof switchCheckinSub==='function'){
            switchCheckinSub('checkin-main');
        }

        const adminCheckinBtn=document.getElementById('sub-btn-checkin-logs');

        if(adminCheckinBtn){
            const adminStatus=
                (typeof isAdmin!=='undefined'&&isAdmin)||
                (typeof isHelper!=='undefined'&&isHelper)||
                (typeof myName!=='undefined'&&myName==='총사령관');

            adminCheckinBtn.style.display=adminStatus?'block':'none';
        }
    }

    if(t==='shop'){
        if(typeof renderShop==='function')renderShop();
        if(typeof loadOrderRecords==='function')loadOrderRecords();
    }

    if(t==='points'){
        if(typeof renderPointGuide==='function')renderPointGuide();
        if(typeof initPointsTabListeners==='function')initPointsTabListeners();
    }

    if(t==='management'){
        if(typeof renderManagementSub==='function')renderManagementSub('grades');
    }

    if(t==='checkin'){
        const logArea=document.getElementById('sub-checkin-logs');

        if(
            logArea&&
            logArea.style.display!=='none'&&
            typeof refreshCheckinManagement==='function'
        ){
            refreshCheckinManagement();
        }
    }

    // 용사 목록은 hero-mgr.js가 전담한다.
    if(t==='home'&&typeof renderHeroes==='function'){
        renderHeroes();
    }
}

function closePopup(){
    if(
        window.routineActive&&
        ++rIdx<routineItems.length
    ){
        const content=document.getElementById('pop-content');

        if(content){
            content.innerText=
                `[루틴 ${rIdx+1}단계]\n${routineItems[rIdx]}`;
        }
    }else{
        const overlay=document.getElementById('common-overlay');

        if(overlay)overlay.style.display='none';

        rIdx=0;
    }
}

function getAvatar(lv,selectedAnimal){
    if(typeof window.getAvatar==='function'&&window.getAvatar!==getAvatar){
        return window.getAvatar(lv,selectedAnimal);
    }
    return '';
}

function switchCheckinSub(subId){
    const subMain=document.getElementById('sub-checkin-main');
    const subLogs=document.getElementById('sub-checkin-logs');
    const btnMain=document.getElementById('sub-btn-checkin-main');
    const btnLogs=document.getElementById('sub-btn-checkin-logs');

    if(subMain){
        subMain.style.display=subId==='checkin-main'?'block':'none';
    }

    if(subLogs){
        subLogs.style.display=subId==='checkin-logs'?'block':'none';
    }

    if(btnMain){
        btnMain.style.background=subId==='checkin-main'?'var(--dark,#2c3e50)':'#ddd';
        btnMain.style.color=subId==='checkin-main'?'white':'#333';
    }

    if(btnLogs){
        btnLogs.style.background=subId==='checkin-logs'?'var(--dark,#2c3e50)':'#ddd';
        btnLogs.style.color=subId==='checkin-logs'?'white':'#333';
    }

    if(subId==='checkin-logs'){
        if(typeof refreshCheckinManagement==='function'){
            refreshCheckinManagement();
        }else if(typeof generateNewLayout==='function'){
            generateNewLayout();
        }
    }
}

function renderManagementSub(type){
    const container=document.getElementById('management-sub-container');
    const btnGrades=document.getElementById('sub-btn-grades');
    const btnBudget=document.getElementById('sub-btn-budget');

    if(type==='grades'){
        if(btnGrades){
            btnGrades.style.background='var(--primary)';
            btnGrades.style.color='white';
        }

        if(btnBudget){
            btnBudget.style.background='#ddd';
            btnBudget.style.color='#333';
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
    }else if(type==='budget'){
        if(btnBudget){
            btnBudget.style.background='var(--primary)';
            btnBudget.style.color='white';
        }

        if(btnGrades){
            btnGrades.style.background='#ddd';
            btnGrades.style.color='#333';
        }

        if(typeof initBudgetManager==='function'){
            initBudgetManager();
        }
    }
}

function startApp(){
    const adminStatus=typeof isAdmin!=='undefined'&&isAdmin;
    const helperStatus=typeof isHelper!=='undefined'&&isHelper;
    const commanderStatus=typeof myName!=='undefined'&&myName==='총사령관';

    if(adminStatus||helperStatus||commanderStatus){
        const orderMgr=document.getElementById('admin-order-mgr');
        if(orderMgr)orderMgr.style.display='block';

        const bbAdminBtn=document.getElementById('btn-blackboard-admin');
        if(bbAdminBtn)bbAdminBtn.style.display='block';

        const adminBtn=document.getElementById('btn-admin');
        if(adminBtn)adminBtn.style.display='block';
    }else{
        const adminBtn=document.getElementById('btn-admin');
        if(adminBtn)adminBtn.style.display='none';
    }

    const checkinTabBtn=document.getElementById('btn-checkin');
    if(checkinTabBtn)checkinTabBtn.style.display='block';

    const checkinLogBtn=document.getElementById('sub-btn-checkin-logs');

    if(checkinLogBtn){
        checkinLogBtn.style.display=
            (adminStatus||helperStatus||commanderStatus)
            ?'block'
            :'none';
    }

    if(commanderStatus){
        const cleaningTabBtn=document.getElementById('btn-cleaning');
        if(cleaningTabBtn)cleaningTabBtn.style.display='inline-block';
    }else if(
        typeof currentUser!=='undefined'&&
        currentUser&&
        currentUser.role==='청소'
    ){
        const cleaningTabBtn=document.getElementById('btn-cleaning');
        if(cleaningTabBtn)cleaningTabBtn.style.display='inline-block';
    }

    window.isHousingEnabled=true;

    db.ref('settings').on('value',snap=>{
        const s=snap.val()||{};

        giftList=s.giftList||[];

        routineItems=
            s.routineText
            ?.split('\n')
            .filter(t=>t.trim())||[];

        if(adminStatus){
            const passEl=document.getElementById('conf-pass');
            const lateEl=document.getElementById('conf-late');
            const closeEl=document.getElementById('conf-close');
            const routineEl=document.getElementById('conf-routine');
            const giftsEl=document.getElementById('conf-gifts');

            if(passEl)passEl.value=s.password||'';
            if(lateEl)lateEl.value=s.lateTime||'08:40';
            if(closeEl)closeEl.value=s.closeTime||'09:00';
            if(routineEl)routineEl.value=s.routineText||'';
            if(giftsEl)giftsEl.value=s.giftList?.join('\n')||'';
        }

        const guide=document.getElementById('checkin-guide');

        if(guide){
            guide.innerText=
                `✅ 정상: ~${s.lateTime||'08:40'} | ⚠️ 지각: ${s.closeTime||'09:00'} 마감`;
        }

        window.currentDefaultBg=s.defaultBg||'';
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

    /*
     * users 데이터는 여기서 currentUsers만 만든다.
     * hero-grid는 절대 건드리지 않는다.
     * 용사 목록은 hero-mgr.js의 renderHeroes()가 전담한다.
     */
    db.ref('users').on('value',snap=>{
        const users=[];

        snap.forEach(c=>{
            const u=c.val()||{};

            // Firebase key가 학생 이름인 구조까지 대응
            u.name=u.name||c.key;
            u._key=c.key;

            users.push(u);
        });

        currentUsers=users.sort((a,b)=>{
            if(a.name===myName)return -1;
            if(b.name===myName)return 1;
            return (parseInt(a.no)||parseInt(a.number)||99)-
                   (parseInt(b.no)||parseInt(b.number)||99);
        });

        if(
            adminStatus&&
            typeof renderAdminList==='function'
        ){
            renderAdminList();
        }

        if(typeof generateNewLayout==='function'){
            generateNewLayout();
        }
    });

    /*
     * 로그인 완료 후 무조건 용사 목록을 첫 화면으로 띄운다.
     */
    if(typeof renderHeroes==='function'){
        renderHeroes();
    }

    const homeTab=document.getElementById('tab-home');

    if(homeTab&&typeof showTab==='function'){
        window.currentTab='home';
        showTab('home');
    }
}
