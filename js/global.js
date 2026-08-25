// js/global.js
// 공통 유틸리티 및 앱 초기화

function getTodayKST(){
    const now=new Date();
    const krTime=new Date(
        now.getTime()+9*60*60*1000
    );

    return(
        krTime.getUTCFullYear()+
        "-" +
        String(krTime.getUTCMonth()+1).padStart(2,'0')+
        "-" +
        String(krTime.getUTCDate()).padStart(2,'0')
    );
}

// ============================================================
// 화면
// ============================================================

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

// ============================================================
// 탭
// ============================================================

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

    if(targetBtn){
        targetBtn.classList.add('active');
    }

    if(t==='checkin'){
        if(typeof switchCheckinSub==='function'){
            switchCheckinSub('checkin-main');
        }

        const adminCheckinBtn=
            document.getElementById('sub-btn-checkin-logs');

        if(adminCheckinBtn){
            const adminStatus=
                (typeof isAdmin!=='undefined'&&isAdmin)||
                (typeof isHelper!=='undefined'&&isHelper)||
                (typeof myName!=='undefined'&&myName==='총사령관');

            adminCheckinBtn.style.display=
                adminStatus?'block':'none';
        }
    }

    if(t==='shop'){
        if(typeof renderShop==='function')renderShop();
        if(typeof loadOrderRecords==='function')loadOrderRecords();
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

    if(t==='checkin'){
        const logArea=
            document.getElementById('sub-checkin-logs');

        if(
            logArea&&
            logArea.style.display!=='none'&&
            typeof refreshCheckinManagement==='function'
        ){
            refreshCheckinManagement();
        }
    }
}

// ============================================================
// 공통 팝업
// ============================================================

function closePopup(){
    if(
        window.routineActive&&
        ++rIdx<routineItems.length
    ){
        document.getElementById('pop-content').innerText=
            `[루틴 ${rIdx+1}단계]\n${routineItems[rIdx]}`;
    }else{
        const overlay=
            document.getElementById('common-overlay');

        if(overlay){
            overlay.style.display='none';
        }

        rIdx=0;
    }
}

// ============================================================
// 아바타
// ============================================================

function getAvatar(lv,selectedAnimal){
    return"";
}

// ============================================================
// 등교 서브탭
// ============================================================

function switchCheckinSub(subId){
    const subMain=
        document.getElementById('sub-checkin-main');

    const subLogs=
        document.getElementById('sub-checkin-logs');

    const btnMain=
        document.getElementById('sub-btn-checkin-main');

    const btnLogs=
        document.getElementById('sub-btn-checkin-logs');

    if(subMain){
        subMain.style.display=
            subId==='checkin-main'
            ?'block'
            :'none';
    }

    if(subLogs){
        subLogs.style.display=
            subId==='checkin-logs'
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
        if(typeof refreshCheckinManagement==='function'){
            refreshCheckinManagement();
        }else if(typeof generateNewLayout==='function'){
            generateNewLayout();
        }
    }
}

// ============================================================
// 학급관리
// ============================================================

function renderManagementSub(type){
    const container=
        document.getElementById('management-sub-container');

    const btnGrades=
        document.getElementById('sub-btn-grades');

    const btnBudget=
        document.getElementById('sub-btn-budget');

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
            </div>`;
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

// ============================================================
// 앱 시작
// ============================================================

function startApp(){
    const adminStatus=
        typeof isAdmin!=='undefined'&&isAdmin;

    const helperStatus=
        typeof isHelper!=='undefined'&&isHelper;

    const commanderStatus=
        typeof myName!=='undefined'&&
        myName==="총사령관";

    const hasAdminAccess=
        adminStatus||
        helperStatus||
        commanderStatus;

    if(hasAdminAccess){
        const orderMgr=
            document.getElementById('admin-order-mgr');

        if(orderMgr)orderMgr.style.display='block';

        const bbAdminBtn=
            document.getElementById('btn-blackboard-admin');

        if(bbAdminBtn)bbAdminBtn.style.display='block';

        const adminBtn=
            document.getElementById('btn-admin');

        if(adminBtn)adminBtn.style.display='block';
    }else{
        const adminBtn=
            document.getElementById('btn-admin');

        if(adminBtn)adminBtn.style.display='none';
    }

    const checkinTabBtn=
        document.getElementById('btn-checkin');

    if(checkinTabBtn){
        checkinTabBtn.style.display='block';
    }

    const checkinLogBtn=
        document.getElementById('sub-btn-checkin-logs');

    if(checkinLogBtn){
        checkinLogBtn.style.display=
            hasAdminAccess?'block':'none';
    }

    // ========================================================
    // 청소
    // ========================================================

    if(commanderStatus){
        const cleaningTabBtn=
            document.getElementById('btn-cleaning');

        if(cleaningTabBtn){
            cleaningTabBtn.style.display='inline-block';
        }
    }else if(
        typeof currentUser!=='undefined'&&
        currentUser&&
        currentUser.role==='청소'
    ){
        const cleaningTabBtn=
            document.getElementById('btn-cleaning');

        if(cleaningTabBtn){
            cleaningTabBtn.style.display='inline-block';
        }
    }

    window.isHousingEnabled=true;

    // ========================================================
    // settings
    // ========================================================

    db.ref('settings').on('value',snap=>{
        const s=snap.val()||{};

        giftList=s.giftList||[];

        routineItems=
            s.routineText
            ?.split('\n')
            .filter(t=>t.trim())||[];

        if(adminStatus){
            const passEl=
                document.getElementById('conf-pass');

            const lateEl=
                document.getElementById('conf-late');

            const closeEl=
                document.getElementById('conf-close');

            const routineEl=
                document.getElementById('conf-routine');

            const giftsEl=
                document.getElementById('conf-gifts');

            if(passEl)passEl.value=s.password||"";
            if(lateEl)lateEl.value=s.lateTime||"08:40";
            if(closeEl)closeEl.value=s.closeTime||"09:00";
            if(routineEl)routineEl.value=s.routineText||"";
            if(giftsEl)giftsEl.value=s.giftList?.join('\n')||"";
        }

        const guide=
            document.getElementById('checkin-guide');

        if(guide){
            guide.innerText=
                `✅ 정상: ~${s.lateTime||'08:40'} | ⚠️ 지각: ${s.closeTime||'09:00'} 마감`;
        }

        window.currentDefaultBg=s.defaultBg||"";
    });

    // ========================================================
    // 좌석
    // ========================================================

    if(typeof generateNewLayout==='function'){
        generateNewLayout();
    }

    // ========================================================
    // 포인트
    // ========================================================

    if(typeof renderPointGuide==='function'){
        renderPointGuide();
    }

    if(typeof initPointsTabListeners==='function'){
        initPointsTabListeners();
    }

    // ========================================================
    // 주문
    // ========================================================

    if(typeof loadOrderRecords==='function'){
        loadOrderRecords();
    }

    // ========================================================
    // users
    // ========================================================

    db.ref('users').on('value',snap=>{
        let users=[];

        snap.forEach(c=>{
            let u=c.val();
            u.name=c.key;
            users.push(u);
        });

        currentUsers=users.sort((a,b)=>
            a.name===myName
            ?-1
            :b.name===myName
                ?1
                :(a.no||99)-(b.no||99)
        );

        let h="";

        currentUsers.forEach(u=>{
            if(
                u.name==="총사령관"||
                u.name.includes("선생님")
            )return;

            const isMe=u.name===myName;
            const title=
                u.selectedAnimal
                ?`${u.selectedAnimal} `
                :"";

            const level=u.lv||1;

            const pointDisplay=`
            <div style="background:rgba(0,0,0,.6);color:#ffdf00;border-radius:8px;padding:4px 10px;display:inline-block;font-size:.95rem;font-weight:bold;margin-top:10px;box-shadow:inset 0 2px 4px rgba(0,0,0,.8);border:1px solid rgba(255,255,255,.2);">
                💰 ${u.points||0} P
            </div>`;

            let cardBg=
                "linear-gradient(135deg,#fdfbfb 0%,#ebedee 100%)";

            let borderColor="#bdc3c7";

            if(level>=30){
                cardBg=
                    "linear-gradient(135deg,#ffecd2 0%,#fcb69f 100%)";
                borderColor="#e67e22";
            }else if(level>=20){
                cardBg=
                    "linear-gradient(135deg,#e0c3fc 0%,#8ec5fc 100%)";
                borderColor="#9b59b6";
            }else if(level>=10){
                cardBg=
                    "linear-gradient(135deg,#d4fc79 0%,#96e6a1 100%)";
                borderColor="#2ecc71";
            }

            const myHighlight=isMe
                ?"box-shadow:0 0 15px rgba(241,196,15,.8),inset 0 0 10px rgba(255,255,255,.5);"
                :"box-shadow:3px 5px 10px rgba(0,0,0,.15);";

            const safeName=
                String(u.name)
                .replace(/\\/g,'\\\\')
                .replace(/'/g,"\\'");

            h+=`
            <div class="hero-card" onclick="openStudentProfile('${safeName}')" style="background:${cardBg};border:3px solid ${borderColor};border-radius:15px;padding:20px 10px 15px;text-align:center;cursor:pointer;transition:transform .2s;${myHighlight}position:relative;overflow:hidden;">

                <div style="position:absolute;top:0;left:0;background:${borderColor};color:#fff;padding:4px 12px;border-radius:0 0 12px 0;font-weight:900;font-size:1.1rem;text-shadow:1px 1px 2px rgba(0,0,0,.3);">
                    Lv.${level}
                </div>

                <div style="font-size:3.2rem;margin-top:10px;margin-bottom:8px;filter:drop-shadow(2px 4px 4px rgba(0,0,0,.2));">
                    ${getAvatar(level,u.selectedAnimal)||'🐣'}
                </div>

                <b style="font-size:1.4rem;font-weight:900;display:block;color:#2c3e50;text-shadow:1px 1px 2px rgba(255,255,255,.9);background:rgba(255,255,255,.6);padding:6px;border-radius:8px;margin:0 10px;">
                    ${isMe?'⭐ ':''}${title}${u.name}
                </b>

                ${pointDisplay}
            </div>`;
        });

        const heroGrid=
            document.getElementById('hero-grid');

        if(heroGrid){
            heroGrid.innerHTML=h;
        }

        if(
            adminStatus&&
            typeof renderAdminList==='function'
        ){
            renderAdminList();
        }

        if(typeof generateNewLayout==='function'){
            generateNewLayout();
        }

        // 관리자 정보가 확정된 뒤 P 버튼 생성
        createBatchPointButton();
    });
}

// ============================================================
// 플로팅 P 버튼
// ============================================================

window.createBatchPointButton=function(){
    if(
        typeof isAdmin==='undefined'||
        !isAdmin
    )return;

    const oldBtn=
        document.getElementById('floating-batch-btn');

    if(oldBtn)oldBtn.remove();

    const btn=document.createElement('button');

    btn.id='floating-batch-btn';
    btn.innerHTML='P';

    btn.style.cssText=`
        position:fixed;
        bottom:35px;
        right:35px;
        width:75px;
        height:75px;
        border-radius:50%;
        background:#8e44ad;
        color:#fff;
        border:none;
        box-shadow:0 6px 15px rgba(0,0,0,.35);
        font-weight:900;
        font-size:2rem;
        cursor:pointer;
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
    `;

    btn.onclick=function(){
        openBatchPointModal();
    };

    document.body.appendChild(btn);
};

// ============================================================
// 학생별 차등 포인트/경험치 지급
// ============================================================

window.openBatchPointModal=function(){
    if(
        typeof isAdmin==='undefined'||
        !isAdmin
    ){
        alert("관리자만 사용할 수 있습니다.");
        return;
    }

    const overlay=
        document.getElementById('common-overlay');

    if(!overlay){
        alert("공통 팝업 영역(common-overlay)을 찾을 수 없습니다.");
        return;
    }

    let studentRows="";

    if(
        typeof currentUsers!=='undefined'&&
        Array.isArray(currentUsers)
    ){
        currentUsers.forEach(u=>{
            if(
                u.name==="총사령관"||
                String(u.name).includes("선생님")
            )return;

            const safeName=
                String(u.name)
                .replace(/&/g,'&amp;')
                .replace(/"/g,'&quot;')
                .replace(/</g,'&lt;')
                .replace(/>/g,'&gt;');

            studentRows+=`
            <div class="batch-student-row" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;">
                <label style="display:flex;align-items:center;gap:8px;flex:2;cursor:pointer;font-weight:bold;">
                    <input type="checkbox" class="batch-student-chk" value="${safeName}" style="width:18px;height:18px;">
                    <span>${safeName}</span>
                    <span style="font-size:.85rem;color:#666;">
                        (${u.points||0}P)
                    </span>
                </label>

                <input type="number" class="batch-p-input" placeholder="포인트" style="flex:1;padding:6px;text-align:center;border:1px solid #ccc;border-radius:6px;font-size:1rem;">

                <input type="number" class="batch-exp-input" placeholder="경험치" style="flex:1;padding:6px;text-align:center;border:1px solid #ccc;border-radius:6px;font-size:1rem;">
            </div>`;
        });
    }

    document.getElementById('pop-title').innerText=
        "🎁 포인트 및 경험치 개별 차등 지급";

    document.getElementById('pop-content').innerHTML=`
    <div style="padding:10px;">
        <input type="text" id="batch-reason" placeholder="공통 사유 입력 (예: 모둠 활동 우수)" style="width:100%;padding:12px;margin-bottom:12px;box-sizing:border-box;border-radius:8px;border:1px solid #ccc;font-size:1.1rem;">

        <div style="margin-bottom:10px;display:flex;gap:10px;">
            <button onclick="document.querySelectorAll('.batch-student-chk').forEach(cb=>cb.checked=true)" style="padding:6px;cursor:pointer;background:#ecf0f1;border:none;border-radius:6px;font-weight:bold;flex:1;">
                전체 선택
            </button>

            <button onclick="document.querySelectorAll('.batch-student-chk').forEach(cb=>cb.checked=false)" style="padding:6px;cursor:pointer;background:#ecf0f1;border:none;border-radius:6px;font-weight:bold;flex:1;">
                전체 해제
            </button>
        </div>

        <div style="max-height:280px;overflow-y:auto;border:1px solid #ddd;padding:10px;border-radius:8px;margin-bottom:20px;background:#fff;">
            ${studentRows||`
            <p style="text-align:center;color:#999;padding:20px;">
                학생 목록이 없습니다.
            </p>`}
        </div>

        <div style="display:flex;gap:10px;">
            <button onclick="closePopup()" style="flex:1;padding:15px;background:#95a5a6;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:1.1rem;">
                취소
            </button>

            <button onclick="submitBatchPoints()" style="flex:2;padding:15px;background:#27ae60;color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:1.1rem;cursor:pointer;">
                선택된 학생들 반영하기
            </button>
        </div>
    </div>`;

    const closeBtn=
        document.getElementById('pop-close-btn');

    if(closeBtn){
        closeBtn.style.display='none';
    }

    overlay.style.display='flex';
};

// ============================================================
// 차등 지급 실행
// ============================================================

window.submitBatchPoints=async function(){
    const reasonElement=
        document.getElementById('batch-reason');

    if(!reasonElement){
        alert("사유 입력창을 찾을 수 없습니다.");
        return;
    }

    const reason=
        reasonElement.value.trim();

    if(!reason){
        alert("공통 사유를 정확히 입력해주세요.");
        return;
    }

    const rowElements=
        document.querySelectorAll('.batch-student-row');

    const targets=[];

    rowElements.forEach(row=>{
        const chk=
            row.querySelector('.batch-student-chk');

        if(!chk||!chk.checked)return;

        const pInput=
            row.querySelector('.batch-p-input');

        const expInput=
            row.querySelector('.batch-exp-input');

        const pValue=pInput?.value||"";
        const expValue=expInput?.value||"";

        const pAmount=
            pValue===""
            ?0
            :parseInt(pValue);

        const expAmount=
            expValue===""
            ?0
            :parseInt(expValue);

        targets.push({
            name:chk.value,
            p:isNaN(pAmount)?0:pAmount,
            exp:isNaN(expAmount)?0:expAmount
        });
    });

    if(targets.length===0){
        alert("학생을 최소 1명 이상 체크해주세요.");
        return;
    }

    const hasChange=targets.some(
        t=>t.p!==0||t.exp!==0
    );

    if(!hasChange){
        alert("포인트 또는 경험치를 최소 1명에게 입력해주세요.");
        return;
    }

    if(!confirm(
        `선택한 ${targets.length}명의 학생에게\n"${reason}" 사유로 반영하시겠습니까?`
    ))return;

    const today=
        typeof checkinGetTodayKST==='function'
        ?checkinGetTodayKST()
        :getTodayKST();

    const time=
        typeof checkinGetNowKSTTime==='function'
        ?checkinGetNowKSTTime()
        :new Date().toLocaleTimeString(
            'ko-KR',
            {
                hour:'2-digit',
                minute:'2-digit',
                hour12:false
            }
        );

    const updates={};

    try{
        for(const t of targets){
            const userSnap=
                await db.ref(`users/${t.name}`).once('value');

            if(!userSnap.exists())continue;

            const userData=userSnap.val()||{};

            const currentPoints=
                parseInt(userData.points)||0;

            const currentExp=
                parseInt(userData.exp)||0;

            const newPoints=
                currentPoints+t.p;

            const newExp=
                currentExp+t.exp;

            updates[`users/${t.name}/points`]=
                newPoints;

            updates[`users/${t.name}/exp`]=
                newExp;

            // 포인트 기록은 pointLogs 하나로 통일
            if(t.p!==0){
                const logRef=
                    db.ref('pointLogs').push();

                updates[`pointLogs/${logRef.key}`]={
                    name:t.name,
                    pAmt:t.p,
                    reason,
                    time:`${today} ${time}`
                };
            }

            // 경험치 기록은 별도 로그가 없던 기존 구조를 유지
        }

        await db.ref().update(updates);

        alert(
            `✅ ${targets.length}명의 학생에게 포인트와 경험치가 반영되었습니다!`
        );

        closePopup();

    }catch(error){
        console.error("차등 지급 오류:",error);
        alert("반영 중 오류가 발생했습니다.");
    }
};

// ============================================================
// 시작 시 P 버튼 생성은 users 로딩 후 처리
// ============================================================
// 기존 DOMContentLoaded에서 한 번만 검사하던 코드는 삭제.
// Firebase users 로딩 후 createBatchPointButton()을 호출한다.
