// js/auth.js

const DEV_MODE=false;
const ADMIN_INACTIVITY_MS=3*60*60*1000;
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
        // SESSION으로 해뒀더니 새로고침할 때마다(같은 탭이어도) 다시 로그인해야
        // 했다는 피드백으로 LOCAL로 바꿨다. 로그인 결과 전달 방식(팝업/리다이렉트)과는
        // 무관한 설정이라 아래 팝업 관련 대응에는 영향이 없다.
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        // 팝업 방식을 기본으로 쓴다. GitHub Pages가 모든 페이지에
        // Cross-Origin-Opener-Policy: same-origin을 붙여서(직접 끌 수 없음)
        // 팝업이 닫혔는지 확인하는 내부 폴링이 콘솔 에러를 내지만, 로그인
        // 자체(postMessage로 오가는 인증 결과)는 이 에러와 무관하게 완료된다.
        //
        // 리다이렉트 방식(2026-09-16~09-17 한때 사용)은 authDomain
        // (cs6-6class.firebaseapp.com)과 이 사이트 사이에서 스토리지를 주고받아
        // 로그인 결과를 전달해야 하는데, 브라우저/기기별로 서드파티 스토리지
        // 접근이 막혀 있으면 "구글 계정 선택까지는 되고 결과를 못 받아 로그인
        // 화면으로 되돌아가는" 증상이 생긴다 — 기기마다 다르게 나타나 "일부
        // 계정만 안 되는" 것처럼 보였던 원인. 그래서 팝업이 막힌 경우에만
        // 리다이렉트로 폴백한다.
        try{
            await auth.signInWithPopup(provider);
        }catch(popupError){
            if(popupError?.code==='auth/popup-blocked'||
                popupError?.code==='auth/operation-not-supported-in-this-environment'){
                await auth.signInWithRedirect(provider);
                return;
            }
            throw popupError;
        }
    }catch(error){
        if(error?.code==='auth/popup-closed-by-user'||
            error?.code==='auth/cancelled-popup-request')return;
        console.error('로그인 오류:',error);
        alert('로그인에 실패했습니다.');
    }
}

auth.getRedirectResult?.().catch(error=>{
    if(error?.code==='auth/no-current-user'||!error)return;
    console.error('로그인 리다이렉트 오류:',error);
    alert('로그인에 실패했습니다. 다시 시도해 주세요.');
});

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

    // js/cleaning.js의 isCleaningStudent()와 판정 기준을 동일하게 맞춘다.
    const isCleaner=saved===true||
        saved==='true'||
        (saved&&typeof saved==='object'&&saved.enabled===true)||
        /청소|쓸기|닦기|분리수거|쓰레기|정리/.test(role);

    // 청소 담당이 아니어도 1인 1역이 배정된 학생은 자기 역할 확인을 위해 탭에 들어갈 수 있어야 한다.
    return isCleaner||Boolean(role);
};

window.canManageCleaningChecks=function(){
    const role=String(window.currentUser?.role||'').trim();

    return window.isAdmin===true||role==='청소';
};

window.canManageShopRequests=function(){
    const role=String(window.currentUser?.role||'').trim();

    return window.isAdmin===true||
        role==='상점'||
        window.isHelper===true||
        window.currentUser?.isHelper===true;
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
        'btn-blackboard-admin',
        'btn-attendance-admin',
        'btn-class-ops',
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

    // 학생 등교와 교사 최종 출결은 메뉴와 탭을 공유하지 않는다.
    setMenuVisible('btn-student-checkin',!admin);
    setMenuVisible('btn-attendance-admin',admin);

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
    if(typeof window.stopOwnUserListener==='function'){
        window.stopOwnUserListener();
        window.stopOwnUserListener=()=>{};
    }
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

        // 청소 역할명과 별개로 교사가 '청소 담당 학생' 체크박스로
        // 지정한 학생도 메뉴를 열 수 있게 로그인 세션의 판정을 보관합니다.
        if(session.cleaningAssigned===true){
            window.cleaningAssignments={
                ...(window.cleaningAssignments||{}),
                [studentName]:true
            };
        }

        const accessRef=db.ref(`access/${user.uid}`);
        const receiveAccess=snapshot=>{
            const access=snapshot.val()||{};
            if(window.currentUser&&Object.prototype.hasOwnProperty.call(access,'role')){
                window.currentUser.role=String(access.role||'');
            }
            window.isHelper=window.currentUser?.role==='상점'||
                window.currentUser?.isHelper===true;
            applyAccessControl();
            if(['shop','points'].includes(window.currentTab)&&
                typeof window.initPointsTabListeners==='function'){
                window.initPointsTabListeners();
            }
        };
        accessRef.on('value',receiveAccess);
        stopAccessListener=()=>accessRef.off('value',receiveAccess);

        resetInactivityTimer();
        applyAccessControl();

        // publicProfiles가 비어 있던 기존 학생 데이터를 한 번만 채운다.
        // 이미 채워진 뒤에는 서버가 즉시 alreadyDone으로 응답하고 끝낸다.
        if(admin){
            window.callSecure('backfillPublicProfiles').catch(error=>{
                console.warn('공개 프로필 백필 오류:',error);
            });
            // 배치 개수 검증 없이 무한 배치할 수 있던 버그로 생긴 중복 하우징
            // 오브젝트를 한 번만 정리한다. 이미 정리됐으면 서버가 곧장 종료한다.
            window.callSecure('cleanupDuplicateHousingItems').then(result=>{
                if(result?.removed)console.info(`중복 하우징 아이템 ${result.removed}개 정리(학생 ${result.affectedStudents}명)`);
            }).catch(error=>{
                console.warn('중복 하우징 아이템 정리 오류:',error);
            });
        }

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

        // 로그인 직후에는 window.currentTab의 기본값이 이미 'main'이라
        // showTab('main')의 "탭이 바뀔 때만" 훅이 안 걸린다. 로그인 진입은
        // 여기서 별도로 한 번 불러준다(오늘의 브리핑 팝업용).
        if(typeof window.onEnterMainTab==='function'){
            window.onEnterMainTab();
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
