// js/auth.js

const DEV_MODE=false;
const ADMIN_INACTIVITY_MS=30*60*1000;
const STUDENT_INACTIVITY_MS=2*60*60*1000;
let inactivityTimer=null;
let stopAccessListener=()=>{};

function resetInactivityTimer(){
    clearTimeout(inactivityTimer);
    if(!auth.currentUser)return;
    inactivityTimer=setTimeout(()=>auth.signOut(),window.isAdmin===true
        ?ADMIN_INACTIVITY_MS:STUDENT_INACTIVITY_MS);
}

['pointerdown','keydown','touchstart'].forEach(eventName=>
    window.addEventListener(eventName,resetInactivityTimer,{passive:true}));

async function handleLogin(){
    const provider=new firebase.auth.GoogleAuthProvider();
    try{
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        await auth.signInWithPopup(provider);
    }catch(error){
        console.error('로그인 오류:',error);
        alert('로그인에 실패했습니다.');
    }
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

window.canUseCleaningTab=function(){
    if(window.isAdmin===true)return true;

    if(window.canManageCleaningChecks())return true;

    const name=String(window.myName||'').trim();
    if(!name)return false;

    const assignments=window.cleaningAssignments||{};
    const saved=assignments[name];
    const roleValue=(window.studentRoles||{})[name];
    const role=typeof roleValue==='string'
        ?roleValue.trim()
        :String(
            roleValue?.role||
            roleValue?.name||
            roleValue?.title||
            ''
        ).trim();

    return saved===true||
        saved==='true'||
        (saved&&typeof saved==='object'&&saved.enabled===true)||
        /청소|쓸기|닦기|분리수거|쓰레기|정리/.test(role);
};

window.canManageCleaningChecks=function(){
    const role=String(window.currentUser?.role||'').trim();

    return window.isAdmin===true||role==='청소';
};

window.canManageShopRequests=function(){
    const role=String(window.currentUser?.role||'').trim();

    return window.isAdmin===true||
        role==='상점'||
        window.isHelper===true;
};

// 교사와 학생은 같은 화면 구조에 다른 팔레트를 씁니다.
// 색은 전부 css/style.css 의 body.role-teacher / body.role-student 토큰에서 나옵니다.
function applyRoleTheme(){
    const admin=window.isAdmin===true;
    const signedIn=!!String(window.myName||'').trim();

    document.body.classList.toggle('role-teacher',admin||!signedIn);
    document.body.classList.toggle('role-student',signedIn&&!admin);

    const roleLabel=document.getElementById('nav-role-label');
    if(roleLabel){
        roleLabel.textContent=admin
            ?'학급 관리'
            :signedIn
                ?String(window.myName)+' 용사'
                :'용사 관리 시스템';
    }

    const adminSection=document.getElementById('nav-admin-section');
    if(adminSection)adminSection.hidden=!admin;
}

window.applyRoleTheme=applyRoleTheme;

function applyAccessControl(){
    const admin=window.isAdmin===true;

    applyRoleTheme();

    // 관리자 전용 메뉴
    [
        'btn-logs',
        'btn-budget',
        'btn-management',
        'btn-blackboard-admin',
        'btn-admin',
        'btn-add-point-guide',
        'floating-point-btn',
        'floating-multi-btn'
    ].forEach(id=>{
        setMenuVisible(id,admin);
    });

    // 포인트 화면은 학생도 사용하지만, 포인트 도감은 교사에게만 공개한다.
    // 나의 인벤토리와 개인 포인트 내역은 아래에서 기존대로 표시된다.
    setMenuVisible('point-guide-panel',admin);

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
    stopAccessListener();
    stopAccessListener=()=>{};
    const loginScreen=document.getElementById('login-screen');
    const loadingScreen=document.getElementById('loading-screen');
    const mainApp=document.getElementById('main-app');
    const sidebarToggleBtn=document.getElementById(
        'sidebar-toggle-btn'
    );

    if(DEV_MODE)return;

    if(!user){
        clearTimeout(inactivityTimer);
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
            loginEmail===savedAdminEmail;

        // 등록 여부와 역할은 읽기 가능한 사용자 목록이 아니라 서버에서 검증한다.
        const session=await window.callSecure('getSecureSession');
        const studentName=String(session.name||'').trim();
        if(!studentName||Boolean(session.teacher)!==admin){
            throw new Error('로그인 권한 정보를 확인할 수 없습니다.');
        }
        const userData=session.user||{};

        window.myName=studentName;
        window.isAdmin=admin;

        window.isHelper=
            userData.isHelper===true||
            userData.isHelper==='true';

        window.currentUser={
            ...userData,
            name:userData.name||studentName
        };

        const accessRef=db.ref(`access/${user.uid}`);
        const receiveAccess=snapshot=>{
            const access=snapshot.val()||{};
            if(window.currentUser)window.currentUser.role=String(access.role||window.currentUser.role||'');
            window.isHelper=window.currentUser?.role==='상점';
            applyAccessControl();
        };
        accessRef.on('value',receiveAccess);
        stopAccessListener=()=>accessRef.off('value',receiveAccess);

        resetInactivityTimer();
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
