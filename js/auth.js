// js/auth.js

const DEV_MODE=false;

function handleLogin(){
    const provider=new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider).catch(error=>{
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

window.canUseCleaningTab=function(){
    if(window.isAdmin===true)return true;

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

function applyAccessControl(){
    const admin=window.isAdmin===true;

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
        admin
    );

    // 등교로그 및 좌석
    setMenuVisible(
        'sub-btn-checkin-logs',
        admin
    );

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
