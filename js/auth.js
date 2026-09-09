// js/auth.js

const DEV_MODE=false;
const ADMIN_INACTIVITY_MS=30*60*1000;
const STUDENT_INACTIVITY_MS=2*60*60*1000;
const INACTIVITY_EVENTS=['pointerdown','keydown','touchstart','scroll'];
let inactivityTimer=null;
let lastInactivityReset=0;

function stopInactivityLogout(){
    if(inactivityTimer){
        clearTimeout(inactivityTimer);
        inactivityTimer=null;
    }
    INACTIVITY_EVENTS.forEach(eventName=>{
        window.removeEventListener(eventName,recordActivity,true);
    });
}

function recordActivity(){
    const now=Date.now();
    if(now-lastInactivityReset<15000)return;
    lastInactivityReset=now;
    scheduleInactivityLogout();
}

function scheduleInactivityLogout(){
    if(!auth?.currentUser)return;
    clearTimeout(inactivityTimer);
    const limit=window.isAdmin===true
        ?ADMIN_INACTIVITY_MS
        :STUDENT_INACTIVITY_MS;
    inactivityTimer=setTimeout(async()=>{
        try{
            await auth.signOut();
            alert('장시간 사용하지 않아 안전하게 자동 로그아웃되었습니다.');
        }catch(error){
            console.error('자동 로그아웃 오류:',error);
        }
    },limit);
}

function startInactivityLogout(){
    stopInactivityLogout();
    lastInactivityReset=Date.now();
    INACTIVITY_EVENTS.forEach(eventName=>{
        window.addEventListener(eventName,recordActivity,true);
    });
    scheduleInactivityLogout();
}

function handleLogin(){
    const provider=new firebase.auth.GoogleAuthProvider();

    auth.setPersistence(
        firebase.auth.Auth.Persistence.SESSION
    ).then(()=>{
        return auth.signInWithPopup(provider);
    }).catch(error=>{
        console.error('로그인 오류:',error);
        alert('로그인에 실패했습니다.');
    });
}

function setMenuVisible(id,visible,displayType='block'){
    const element=document.getElementById(id);

    if(!element)return;

    element.hidden=!visible;

    element.style.setProperty(
        'display',
        visible ? displayType : 'none',
        'important'
    );
}

window.canManageCleaningChecks=function(){
    if(window.isVerifiedAdmin())return true;
    const name=String(window.myName||'').trim();
    const role=String(window.currentUser?.role||'').trim();
    const assigned=(window.cleaningAssignments||{})[name];
    return role==='청소'||assigned===true||assigned==='true'||
        (assigned&&typeof assigned==='object'&&assigned.enabled===true);
};
window.canUseCleaningTab=()=>window.canManageCleaningChecks();
window.canManageShopRequests=function(){
    if(window.isVerifiedAdmin())return true;
    const name=String(window.myName||'').trim();
    return String(window.currentUser?.role||'').trim()==='상점'||
        String((window.studentRoles||{})[name]||'').trim()==='상점'||
        window.currentUser?.isHelper===true;
};

function applyAccessControl(){
    const admin=window.isVerifiedAdmin();

    // 관리자 전용 메뉴
    [
        'btn-logs',
        'btn-budget',
        'btn-management',
        'btn-blackboard-admin',
        'btn-admin',
        'floating-point-btn',
        'floating-multi-btn'
    ].forEach(id=>{
        setMenuVisible(id,admin);
    });

    // 상점 주문 관리
    setMenuVisible(
        'admin-order-mgr',
        window.canManageShopRequests()
    );

    // 등교로그 및 좌석
    setMenuVisible(
        'sub-btn-checkin-logs',
        admin
    );

    setMenuVisible(
        'sub-btn-checkin-main',
        !admin,
        'block'
    );

    const checkinButton=document.getElementById('btn-checkin');
    if(checkinButton){
        checkinButton.textContent=admin
            ?'🗓️ 등교로그 및 좌석'
            :'⚔️ 등교';
    }

    // 청소 메뉴는 관리자 또는 청소 역할 학생만
    setMenuVisible(
        'btn-cleaning',
        window.canUseCleaningTab()
    );

    // 관리자에게는 학생용 보관함 숨김
    setMenuVisible(
        'my-inventory',
        !admin
    );
}

window.applyAccessControl=applyAccessControl;

auth.onAuthStateChanged(async user=>{
    const loginScreen=document.getElementById('login-screen');
    const loadingScreen=document.getElementById('loading-screen');
    const mainApp=document.getElementById('main-app');
    const sidebarToggleBtn=document.getElementById(
        'sidebar-toggle-btn'
    );

    if(DEV_MODE)return;

    if(!user){
        stopInactivityLogout();
        window.myName='';
        window.isAdmin=false;
        window.isHelper=false;
        window.currentUser=null;
        window.appStarted=false;

        applyAccessControl();

        if(loginScreen){
            loginScreen.style.setProperty(
                'display',
                'flex',
                'important'
            );
        }

        if(loadingScreen){
            loadingScreen.style.setProperty(
                'display',
                'none',
                'important'
            );
        }

        if(mainApp){
            mainApp.style.setProperty(
                'display',
                'none',
                'important'
            );
        }

        if(sidebarToggleBtn){
            sidebarToggleBtn.style.setProperty(
                'display',
                'none',
                'important'
            );
        }

        return;
    }

    try{
        const loginEmail=String(user.email||'')
            .trim()
            .toLowerCase();

        const savedAdminEmail=String(adminEmail||'')
            .trim()
            .toLowerCase();

        const admin=
            loginEmail===savedAdminEmail && window.isVerifiedAdmin();

        const emailKey=
            loginEmail.replace(/\./g,',');

        const emailSnapshot=
            await db.ref(
                `userEmails/${emailKey}`
            ).once('value');

        if(!emailSnapshot.exists()&&!admin){
            alert('미등록 용사입니다.');
            await auth.signOut();
            return;
        }

        const studentName=
            emailSnapshot.val()||
            '총사령관';

        const userSnapshot=
            await db.ref(
                `users/${studentName}`
            ).once('value');

        const userData=
            userSnapshot.val()||{};

        window.myName=studentName;
        window.isAdmin=admin;

        window.isHelper=
            userData.isHelper===true||
            userData.isHelper==='true';

        window.currentUser={
            ...userData,
            name:userData.name||studentName
        };

        // 보안 구조 첫 적용 시 기존 공개 프로필/방을 한 번만 분리한다.
        if(admin&&typeof window.migratePublicDataOnce==='function'){
            try{
                await window.migratePublicDataOnce();
            }catch(error){
                console.error('공개 데이터 1회 분리 오류:',error);
                alert('보안 데이터 분리를 완료하지 못했습니다. Functions 배포 상태를 확인해 주세요.');
            }
        }

        startInactivityLogout();

        // 로그인할 때마다 권한 다시 적용
        applyAccessControl();

        if(loginScreen){
            loginScreen.style.setProperty(
                'display',
                'none',
                'important'
            );
        }

        if(loadingScreen){
            loadingScreen.style.setProperty(
                'display',
                'none',
                'important'
            );
        }

        if(mainApp){
            mainApp.style.setProperty(
                'display',
                'flex',
                'important'
            );
        }

        if(sidebarToggleBtn){
            sidebarToggleBtn.style.setProperty(
                'display',
                'flex',
                'important'
            );
        }

        if(typeof startApp==='function'){
            startApp();
        }

        // startApp 실행 후 다시 한번 권한 적용
        applyAccessControl();

        if(typeof showTab==='function'){
            showTab('main');
        }

    }catch(error){
        stopInactivityLogout();
        console.error('로그인 정보 처리 오류:',error);
        alert('로그인 정보를 불러오지 못했습니다.');
    }
});

window.openUserHistory=function(userName){
    if(
        window.isAdmin===true&&
        typeof openStudentProfile==='function'
    ){
        openStudentProfile(userName);

    }else if(
        userName===window.myName&&
        typeof openOwnStudentProfile==='function'
    ){
        openOwnStudentProfile(userName);

    }else if(
        typeof openFriendRoom==='function'
    ){
        openFriendRoom(userName);
    }
};
