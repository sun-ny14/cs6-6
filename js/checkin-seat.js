// js/checkin-seat.js
// 좌석 배치, 출결 처리, 더블클릭 상세 수정, 월간 출석부, 등교 제외 관리

function checkinGetToday(){
    if(typeof getTodayKST==='function')return getTodayKST();
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function checkinGetRowsCols(){
    const rowsEl=document.getElementById('seat-rows');
    const colsEl=document.getElementById('seat-cols');
    return {
        rows:parseInt(window.currentRows)||parseInt(rowsEl&&rowsEl.value)||6,
        cols:parseInt(window.currentCols)||parseInt(colsEl&&colsEl.value)||5
    };
}

function checkinEscape(value){
    return String(value??'')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

window.loadCheckinState=async function(){
    const snap=await db.ref('seatLayoutData').once('value');
    const data=snap.val()||{};
    const config=data.config||{};

    window.currentLayout=data.layout||{};
    window.currentRows=parseInt(config.rows)||6;
    window.currentCols=parseInt(config.cols)||5;

    const rowsEl=document.getElementById('seat-rows');
    const colsEl=document.getElementById('seat-cols');
    if(rowsEl)rowsEl.value=window.currentRows;
    if(colsEl)colsEl.value=window.currentCols;

    return {
        layout:window.currentLayout,
        rows:window.currentRows,
        cols:window.currentCols
    };
};

window.refreshCheckinGuide=async function(settings){
    let currentSettings=settings;
    if(!currentSettings){
        const snap=await db.ref('settings').once('value');
        currentSettings=snap.val()||{};
    }

    const guide=document.getElementById('checkin-guide');
    if(guide){
        guide.innerText=
            `✅ 정상: ~${currentSettings.lateTime||'08:40'} | `+
            `⚠️ 지각: ${currentSettings.closeTime||'09:00'} 마감`;
    }
};

window.submitCheckin=async function(
    user,
    reason,
    options={}
){
    if(!user){
        return null;
    }

    const today=
        checkinGetToday();

    const now=
        new Date();

    // ==========================================
    // 출결 상태 판정
    // ==========================================

    let category=reason;

    if(reason.includes('정상')){

        category='정상';

    }else if(reason.includes('지각')){

        category='지각';

    }else if(reason.includes('결석')){

        category='결석';

    }else if(reason.includes('조퇴')){

        category='조퇴';

    }else if(reason.includes('제외')){

        category='제외';
    }


    const result=
        category==='정상'||
        category==='지각'
            ?category+' 등교'
            :category;


    // ==========================================
    // 출결 처리 출처
    //
    // qr      = 학생 직접 등교
    // teacher = 담임 직접 지각 처리
    // manual  = 기타 수동 처리
    // ==========================================

    const source=
        options.source||
        (
            category==='지각'
                ?'teacher'
                :'manual'
        );


    // ==========================================
    // QR 지각 분수
    // ==========================================

    const lateBy=
        source==='qr'
            ?Math.max(
                0,
                parseInt(
                    options.lateMinutes,
                    10
                )||0
            )
            :0;


    // ==========================================
    // 지각 포인트 규칙
    //
    // 정상 등교
    // → 0P
    //
    // 학생 QR 등교
    // → 늦은 분수 × -1P
    // → 최대 -9P
    //
    // 담임 직접 지각 처리
    // → 무조건 총 -9P
    // ==========================================

    let desiredPenalty=0;


    if(category==='지각'){

        if(source==='qr'){

            desiredPenalty=
                -Math.min(
                    9,
                    lateBy
                );

        }else{

            desiredPenalty=-9;
        }
    }


    // ==========================================
    // 출결 시간
    // ==========================================

    const time=
        category==='정상'
            ?''
            :now.toLocaleTimeString(
                'ko-KR',
                {
                    hour:'2-digit',
                    minute:'2-digit',
                    hour12:false
                }
            );


    try{

        // ======================================
        // 기존 출결 + 학생 포인트 조회
        // ======================================

        const [
            checkinsSnap,
            userSnap
        ]=await Promise.all([

            db.ref(
                'checkins'
            ).once('value'),

            db.ref(
                `users/${user}`
            ).once('value')

        ]);


        let existingKey=null;
        let existingData=null;


        checkinsSnap.forEach(c=>{

            const v=
                c.val()||{};

            if(
                (v.user||v.name)===user&&
                v.date===today
            ){

                existingKey=c.key;
                existingData=v;
            }
        });


        // ======================================
        // 기존 지각 차감액
        //
        // 예:
        //
        // 기존 0
        // QR 3분 지각
        // → -3
        //
        // 기존 -3
        // 담임 지각 처리
        // → 추가 -6
        // → 최종 -9
        //
        // 기존 -9
        // 다시 지각 저장
        // → 추가 차감 0
        //
        // 기존 -9
        // 정상으로 수정
        // → +9 복구
        // ======================================

        const previousPenalty=
            parseInt(
                existingData&&
                existingData.pointPenalty,
                10
            )||0;


        const pointDelta=
            desiredPenalty-
            previousPenalty;


        const recordKey=
            existingKey||
            db.ref(
                'checkins'
            ).push().key;


        // ======================================
        // 출결 데이터
        // ======================================

        const data={

            ...(existingData||{}),

            user:user,

            name:user,

            reason:reason,

            category:category,

            subCategory:
                existingData&&
                existingData.subCategory
                    ?existingData.subCategory
                    :'해당없음',

            result:result,

            date:today,

            time:time,

            docSubmitted:
                existingData
                    ?!!existingData.docSubmitted
                    :false,

            timestamp:
                Date.now(),

            // ----------------------------------
            // 지각 포인트 정보
            // ----------------------------------

            pointPenalty:
                desiredPenalty,

            penaltySource:
                category==='지각'
                    ?source
                    :'none',

            lateMinutes:
                source==='qr'
                    ?lateBy
                    :0
        };


        const updates={};


        updates[
            `checkins/${recordKey}`
        ]=data;


        let newPoints=null;


        // ======================================
        // 실제 포인트 변동이 있을 때만 처리
        // ======================================

        if(
            userSnap.exists()&&
            pointDelta!==0
        ){

            const userData=
                userSnap.val()||{};


            const oldPoints=
                parseInt(
                    userData.points,
                    10
                )||0;


            newPoints=
                oldPoints+
                pointDelta;


            // 학생 현재 포인트
            updates[
                `users/${user}/points`
            ]=newPoints;


            // ==================================
            // 포인트 사유
            // ==================================

            let pointReason='';


            if(pointDelta>0){

                pointReason=
                    '출결 수정에 따른 지각 차감 복구';

            }else if(source==='qr'){

                pointReason=
                    `지각 등교 자동 차감 `+
                    `(${lateBy}분 지각)`;

            }else{

                pointReason=
                    '담임 지각 처리 자동 차감';
            }


            // ==================================
            // pointLogs
            // ==================================

            const pointLogKey=
                db.ref(
                    'pointLogs'
                ).push().key;


            updates[
                `pointLogs/${pointLogKey}`
            ]={

                name:user,

                pAmt:
                    pointDelta,

                reason:
                    pointReason,

                time:
                    new Date()
                    .toLocaleString(
                        'ko-KR'
                    ),

                timestamp:
                    Date.now()
            };


            // ==================================
            // pointHistory
            // ==================================

            const historyKey=
                db.ref(
                    `pointHistory/${user}`
                ).push().key;


            updates[
                `pointHistory/${user}/${historyKey}`
            ]={

                date:
                    today,

                time:
                    new Date()
                    .toLocaleTimeString(
                        'ko-KR',
                        {
                            hour:'2-digit',
                            minute:'2-digit',
                            hour12:false
                        }
                    ),

                reason:
                    pointReason,

                change:
                    pointDelta,

                pChange:
                    pointDelta,

                expChange:
                    0,

                result:
                    newPoints,

                pointResult:
                    newPoints,

                expResult:
                    parseInt(
                        userData.exp,
                        10
                    )||0,

                timestamp:
                    Date.now()
            };
        }


        // ======================================
        // 출결 + 포인트 한 번에 저장
        // ======================================

        await db.ref().update(
            updates
        );


        if(
            typeof closePopup===
            'function'
        ){
            closePopup();
        }


        if(
            typeof appendExtraLogsUI===
            'function'
        ){
            appendExtraLogsUI();
        }


        checkinRefreshSeatMap();


        return {

            category:
                category,

            source:
                source,

            lateMinutes:
                lateBy,

            penalty:
                desiredPenalty,

            pointDelta:
                pointDelta,

            points:
                newPoints
        };


    }catch(err){

        console.error(
            '출결 저장 오류:',
            err
        );

        throw err;
    }
};


// ====================================================
// 1. 좌석 지도
// ====================================================

window.renderSeatMap=function(rows,cols){
    const container=document.getElementById('seat-map-container');
    if(!container)return;

    rows=parseInt(rows)||6;
    cols=parseInt(cols)||5;

    container.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    container.innerHTML='';

    const dateInput=document.getElementById('checkin-date-filter');
    const targetDate=dateInput&&dateInput.value
        ?dateInput.value
        :checkinGetToday();

    const weekDays=['일','월','화','수','목','금','토'];
    const selectedDay=weekDays[
        new Date(targetDate+'T12:00:00').getDay()
    ];

    Promise.all([
        db.ref('checkins').once('value'),
        db.ref('checkinLogs').once('value'),
        db.ref('settings/fixedExclusions').once('value')
    ]).then(snaps=>{

        const logs={};

        snaps[1].forEach(c=>{
            const log=checkinNormalizeLog(
                c.val(),
                c.key,
                'checkinLogs'
            );

            if(log.name&&log.date===targetDate){
                logs[log.name]=log;
            }
        });

        snaps[0].forEach(c=>{
            const log=checkinNormalizeLog(
                c.val(),
                c.key,
                'checkins'
            );

            if(log.name&&log.date===targetDate){
                logs[log.name]=log;
            }
        });

        const exclusionData=snaps[2].val()||{};
        const todayExclusions=exclusionData[selectedDay]||[];
        const layout=window.currentLayout||{};

        for(let r=0;r<rows;r++){
            for(let c=0;c<cols;c++){

                const posId=`${r}-${c}`;
                const name=layout[posId]||'';
                const cell=document.createElement('div');

                let bgColor='#eee';
                let statusText='미등교';
                let textColor='#000';

                const log=name?logs[name]:null;

                const isFixedExcluded=
                    name&&todayExclusions.includes(name);

                if(name){

                    if(log){

                        statusText=
                            log.result||
                            log.reason||
                            '출결 기록 있음';

                        if(
                            statusText.includes('정상')||
                            statusText==='등교'
                        ){
                            bgColor='#ccffcc';

                        }else if(
                            statusText.includes('지각')
                        ){
                            bgColor='#ffcccc';

                        }else if(
                            statusText.includes('결석')
                        ){
                            bgColor='#ffd6d6';

                        }else if(
                            statusText.includes('조퇴')
                        ){
                            bgColor='#ffe0a3';

                        }else if(
                            statusText.includes('제외')
                        ){
                            bgColor='#3498db';
                            textColor='#fff';

                        }else{
                            bgColor='#f39c12';
                        }

                    }else if(isFixedExcluded){

                        bgColor='#3498db';
                        statusText='고정 제외';
                        textColor='#fff';

                    }else{

                        bgColor='#ffff00';
                        statusText='미등교';
                    }
                }

                cell.style.cssText=`
                    background:${bgColor};
                    border:1px solid #bbb;
                    min-height:120px;
                    border-radius:12px;
                    display:flex;
                    flex-direction:column;
                    justify-content:center;
                    align-items:center;
                    text-align:center;
                    padding:5px;
                    cursor:pointer;
                    color:${textColor};
                    user-select:none;
                    box-sizing:border-box;
                    transition:transform .12s;
                `;

                if(name){

                    const time=
                        log&&
                        log.time&&
                        log.time!=='-'
                            ?` · ${log.time}`
                            :'';

                    cell.innerHTML=`
                        <div style="
                            width:100%;
                            overflow:hidden;
                            color:${textColor};
                            font-weight:900;
                            font-size:clamp(1.45rem,2vw,2rem);
                            line-height:1.2;
                            white-space:nowrap;
                            word-break:keep-all;
                            text-overflow:ellipsis;
                        ">
                            ${checkinEscape(name)}
                        </div>
                    `;

                    cell.title=
                        `${name} · ${statusText}${time}`;

                }else{

                    cell.innerHTML='';
                    cell.title='빈 자리';
                }

                const doubleClickDelay=520;
                let detailOpenLock=false;

                const openDetailOnce=function(){

                    if(detailOpenLock)return;

                    detailOpenLock=true;

                    openCheckinEditModal(
                        name,
                        targetDate
                    );

                    setTimeout(()=>{
                        detailOpenLock=false;
                    },700);
                };

                cell.onclick=function(){

                    if(
                        typeof isEditMode!=='undefined'&&
                        isEditMode
                    ){
                        openStudentPicker(
                            posId,
                            rows,
                            cols
                        );
                        return;
                    }

                    if(!name)return;

                    if(cell._clickTimer){

                        clearTimeout(cell._clickTimer);
                        cell._clickTimer=null;

                        openDetailOnce();
                        return;
                    }

                    cell._clickTimer=setTimeout(()=>{

                        cell._clickTimer=null;

                        submitCheckin(
                            name,
                            '정상 등교'
                        );

                    },doubleClickDelay);
                };

                cell.ondblclick=function(e){

                    e.preventDefault();
                    e.stopPropagation();

                    if(
                        typeof isEditMode!=='undefined'&&
                        isEditMode
                    ){
                        return;
                    }

                    if(!name)return;

                    if(cell._clickTimer){
                        clearTimeout(cell._clickTimer);
                        cell._clickTimer=null;
                    }

                    openDetailOnce();
                };

                cell.onmouseenter=function(){
                    cell.style.transform='scale(1.01)';
                };

                cell.onmouseleave=function(){
                    cell.style.transform='scale(1)';
                };

                container.appendChild(cell);
            }
        }

    }).catch(err=>{

        console.error(
            '좌석 출결 데이터 로드 오류:',
            err
        );

        container.innerHTML=`
            <p style="
                color:#c0392b;
                text-align:center;
                padding:20px;
            ">
                출결 데이터를 불러오지 못했습니다.
            </p>
        `;
    });
};


// ====================================================
// 2. 좌석 배치 편집
// ====================================================

window.openStudentPicker=function(
    posId,
    rows,
    cols
){

    if(typeof window.currentLayout==='undefined'){
        window.currentLayout={};
    }

    const assignedNames=
        Object.values(window.currentLayout);

    let h=`
        <div style="
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:10px;
            padding:10px;
            max-height:400px;
            overflow-y:auto;
        ">
    `;

    h+=`
        <button
            onclick="assignStudentToSeat(
                '${posId}',
                '',
                ${rows},
                ${cols}
            )"
            style="
                background:#e74c3c;
                color:white;
                padding:12px;
                border:none;
                border-radius:8px;
                font-weight:bold;
                cursor:pointer;
            "
        >
            ❌ 비우기
        </button>
    `;

    if(typeof currentUsers!=='undefined'){

        currentUsers.forEach(u=>{

            if(u.name==='총사령관')return;

            const safeName=
                String(u.name)
                .replace(/\\/g,'\\\\')
                .replace(/'/g,"\\'");

            const isAssigned=
                assignedNames.includes(u.name);

            h+=`
                <button
                    onclick="assignStudentToSeat(
                        '${posId}',
                        '${safeName}',
                        ${rows},
                        ${cols}
                    )"
                    style="
                        background:${isAssigned
                            ?'#95a5a6'
                            :'var(--primary,#3498db)'};
                        color:white;
                        font-size:1.1rem;
                        padding:12px 5px;
                        border:none;
                        border-radius:8px;
                        font-weight:bold;
                        cursor:pointer;
                    "
                >
                    ${u.name}${isAssigned?' (배치됨)':''}
                </button>
            `;
        });
    }

    h+='</div>';

    if(typeof openPopup==='function'){
        openPopup(
            '🧑‍🎓 학생 배치',
            h
        );
    }
};


window.assignStudentToSeat=function(
    posId,
    name,
    rows,
    cols
){

    if(typeof window.currentLayout==='undefined'){
        window.currentLayout={};
    }

    if(name===''){

        delete window.currentLayout[posId];

    }else{

        Object.keys(window.currentLayout)
        .forEach(key=>{

            if(
                window.currentLayout[key]===name
            ){
                delete window.currentLayout[key];
            }
        });

        window.currentLayout[posId]=name;
    }

    if(typeof closePopup==='function'){
        closePopup();
    }

    renderSeatMap(
        rows,
        cols
    );
};


// ====================================================
// 3. 출결 원클릭 / 더블클릭 호환 함수
// ====================================================

window.attendanceClickTimer=null;

window.handleCheckinClick=function(user){

    if(window.attendanceClickTimer){

        clearTimeout(
            window.attendanceClickTimer
        );

        window.attendanceClickTimer=null;

        openCheckinEditModal(
            user,
            checkinGetToday()
        );

        return;
    }

    window.attendanceClickTimer=
        setTimeout(()=>{

            window.attendanceClickTimer=null;

            submitCheckin(
                user,
                '정상 등교'
            );

        },300);
};


// 기존 코드와의 호환
window.openDetailedCheckin=function(user){

    openCheckinEditModal(
        user,
        checkinGetToday()
    );
};


// 오류가 났던 함수명도 반드시 만들어 둡니다.
window.openCheckinEditModal=function(
    user,
    date
){

    openLogEditPopup(
        user,
        date||checkinGetToday()
    );
};


// ====================================================
// 4. 출결 저장
// ====================================================

window.submitCheckIn=async function(){
    if(window.isCheckingIn)return;

    const passInput=document.getElementById('checkin-pass');
    const password=passInput?passInput.value.trim():'';

    if(!/^\d{4}$/.test(password)){
        return alert('오늘의 등교 암호 4자리를 입력해 주세요.');
    }

    if(!window.myName){
        return alert('로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');
    }

    window.isCheckingIn=true;

    const button=document.getElementById('checkin-btn');
    if(button)button.disabled=true;

    try{
        const snap=await db.ref('settings').once('value');
        const settings=snap.val()||{};

        if(String(settings.password||'')!==password){
            alert('등교 암호가 맞지 않습니다.');
            return;
        }

        const toMinutes=value=>{
            const parts=String(value||'').split(':').map(Number);

            return parts.length===2&&parts.every(Number.isFinite)
                ?parts[0]*60+parts[1]
                :null;
        };

        const now=new Date();

        const currentMinutes=
            now.getHours()*60+
            now.getMinutes();

        const lateMinutes=
            toMinutes(
                settings.lateTime||'08:40'
            );

        const closeMinutes=
            toMinutes(
                settings.closeTime||'09:00'
            );

        if(
            closeMinutes!==null&&
            currentMinutes>closeMinutes
        ){
            alert(
                `등교 확인 시간이 마감되었습니다. `+
                `(${settings.closeTime||'09:00'})`
            );

            return;
        }

        // 지각 기준시간보다 몇 분 늦었는지 계산
        const lateBy=
            lateMinutes!==null
                ?Math.max(
                    0,
                    currentMinutes-lateMinutes
                )
                :0;

        const reason=
            lateBy>0
                ?'지각 등교'
                :'정상 등교';

        // QR/암호 직접 등교임을 명확하게 전달
        const saveResult=
            await submitCheckin(
                window.myName,
                reason,
                {
                    source:'qr',
                    lateMinutes:lateBy
                }
            );

        if(passInput){
            passInput.value='';
        }

        if(lateBy>0){

            const penalty=
                saveResult&&
                Number.isFinite(
                    saveResult.penalty
                )
                    ?Math.abs(
                        saveResult.penalty
                    )
                    :Math.min(
                        9,
                        lateBy
                    );

            alert(
                `⚠️ ${lateBy}분 지각입니다.\n`+
                `${penalty}포인트가 자동 차감되었습니다.`
            );

        }else{

            // 정상 등교는 포인트 변화 없음
            alert(
                '✅ 정상 등교 완료!'
            );
        }

    }catch(error){

        console.error(
            '등교 처리 오류:',
            error
        );

        alert(
            '등교 처리 중 오류가 발생했습니다.'
        );

    }finally{

        window.isCheckingIn=false;

        if(button){
            button.disabled=false;
        }
    }
};

// ====================================================
// 5. 출결 상세 수정
// ====================================================

window.openLogEditPopup=function(
    name,
    date
){

    Promise.all([

        db.ref('checkins')
        .once('value'),

        db.ref('checkinLogs')
        .once('value')

    ])
    .then(snaps=>{

        let log=null;
        let checkinsKey=null;
        let checkinLogsKey=null;

        // 현재 데이터
        snaps[0].forEach(c=>{

            const v=c.val()||{};

            if(
                (v.user||v.name)===name&&
                v.date===date
            ){

                log=
                    checkinNormalizeLog(
                        v,
                        c.key,
                        'checkins'
                    );

                checkinsKey=c.key;
            }
        });

        // 기존 데이터
        snaps[1].forEach(c=>{

            const v=c.val()||{};

            if(
                (v.user||v.name)===name&&
                v.date===date
            ){

                if(!log){

                    log=
                        checkinNormalizeLog(
                            v,
                            c.key,
                            'checkinLogs'
                        );
                }

                checkinLogsKey=c.key;
            }
        });

        if(!log){

            log={
                result:'정상 등교',
                category:'정상',
                subCategory:'해당없음',
                reason:'',
                time:'-'
            };
        }

        const category=
            log.category||
            (
                log.result.includes('지각')
                ?'지각'
                :log.result.includes('결석')
                ?'결석'
                :log.result.includes('조퇴')
                ?'조퇴'
                :log.result.includes('제외')
                ?'제외'
                :'정상'
            );

        const safeName=
            String(name)
            .replace(/\\/g,'\\\\')
            .replace(/'/g,"\\'");

        const safeDate=
            String(date)
            .replace(/\\/g,'\\\\')
            .replace(/'/g,"\\'");

        const safeKey=
            String(
                checkinsKey||
                checkinLogsKey||
                ''
            )
            .replace(/\\/g,'\\\\')
            .replace(/'/g,"\\'");

        const h=`

            <div style="
                text-align:left;
                padding:10px;
            ">

                <h3 style="
                    text-align:center;
                ">
                    ${name} 등교 상세 기록
                </h3>

                <label style="
                    display:block;
                    margin-top:10px;
                    font-weight:bold;
                ">
                    🚩 등교 상태
                </label>

                <select
                    id="edit-cat"
                    style="
                        width:100%;
                        padding:10px;
                        margin-top:5px;
                        border-radius:6px;
                        border:1px solid #ccc;
                        box-sizing:border-box;
                    "
                >

                    <option
                        value="정상"
                        ${category==='정상'
                            ?'selected':''}
                    >
                        정상 등교
                    </option>

                    <option
                        value="지각"
                        ${category==='지각'
                            ?'selected':''}
                    >
                        지각
                    </option>

                    <option
                        value="결석"
                        ${category==='결석'
                            ?'selected':''}
                    >
                        결석
                    </option>

                    <option
                        value="조퇴"
                        ${category==='조퇴'
                            ?'selected':''}
                    >
                        조퇴
                    </option>

                    <option
                        value="제외"
                        ${category==='제외'
                            ?'selected':''}
                    >
                        기록 제외
                    </option>

                </select>


                <label style="
                    display:block;
                    margin-top:10px;
                    font-weight:bold;
                ">
                    🔍 사유 구분
                </label>

                <select
                    id="edit-sub"
                    style="
                        width:100%;
                        padding:10px;
                        margin-top:5px;
                        border-radius:6px;
                        border:1px solid #ccc;
                        box-sizing:border-box;
                    "
                >

                    <option
                        value="해당없음"
                        ${log.subCategory==='해당없음'
                            ?'selected':''}
                    >
                        -
                    </option>

                    <option
                        value="질병"
                        ${log.subCategory==='질병'
                            ?'selected':''}
                    >
                        질병
                    </option>

                    <option
                        value="인정"
                        ${log.subCategory==='인정'
                            ?'selected':''}
                    >
                        인정
                    </option>

                    <option
                        value="미인정"
                        ${log.subCategory==='미인정'
                            ?'selected':''}
                    >
                        미인정
                    </option>

                    <option
                        value="기타"
                        ${log.subCategory==='기타'
                            ?'selected':''}
                    >
                        기타
                    </option>

                </select>


                <label style="
                    display:block;
                    margin-top:10px;
                    font-weight:bold;
                ">
                    📝 구체적 사유
                </label>

                <textarea
                    id="edit-desc"
                    rows="3"
                    placeholder="예: 아침 방과후 농구팀, 독감으로 인한 결석 등"
                    style="
                        width:100%;
                        padding:10px;
                        margin-top:5px;
                        border-radius:6px;
                        border:1px solid #ccc;
                        box-sizing:border-box;
                    "
                >${log.reason||''}</textarea>


                <button
                    onclick="
                        saveDetailLog(
                            '${safeName}',
                            '${safeDate}',
                            '${safeKey}'
                        )
                    "
                    style="
                        width:100%;
                        background:var(--primary,#3498db);
                        color:white;
                        font-weight:bold;
                        margin-top:15px;
                        padding:14px;
                        border:none;
                        border-radius:8px;
                        cursor:pointer;
                    "
                >
                    상태 및 사유 저장
                </button>

            </div>
        `;

        if(typeof openPopup==='function'){

            openPopup(
                '📊 등교 기록 수정',
                h
            );
        }

    })
    .catch(err=>{

        console.error(
            '상세 출결 로드 오류:',
            err
        );

        alert(
            '출결 상세 정보를 불러오지 못했습니다.'
        );
    });
};


// ====================================================
// 6. 상세 출결 저장
// ====================================================

window.saveDetailLog=async function(
    name,
    date,
    key
){

    const catEl=
        document.getElementById(
            'edit-cat'
        );

    const subEl=
        document.getElementById(
            'edit-sub'
        );

    const descEl=
        document.getElementById(
            'edit-desc'
        );


    if(
        !catEl||
        !subEl||
        !descEl
    ){
        return;
    }


    const category=
        catEl.value;

    const subCategory=
        subEl.value;

    const reason=
        descEl.value.trim();


    const result=
        category==='정상'||
        category==='지각'
            ?category+' 등교'
            :category;


    try{

        // ======================================
        // 기존 출결 + 기존 로그 + 학생 조회
        // ======================================

        const [
            checkinsSnap,
            logsSnap,
            userSnap
        ]=await Promise.all([

            db.ref(
                'checkins'
            ).once('value'),

            db.ref(
                'checkinLogs'
            ).once('value'),

            db.ref(
                `users/${name}`
            ).once('value')

        ]);


        let checkinsKey=null;
        let logsKey=null;

        let existingData=null;
        let existingLogData=null;


        // ======================================
        // checkins 기존 기록 찾기
        // ======================================

        checkinsSnap.forEach(c=>{

            const v=
                c.val()||{};

            if(
                (v.user||v.name)===name&&
                v.date===date
            ){

                checkinsKey=c.key;

                existingData=v;
            }
        });


        // ======================================
        // 과거 checkinLogs 기록 찾기
        // ======================================

        logsSnap.forEach(c=>{

            const v=
                c.val()||{};

            if(
                (v.user||v.name)===name&&
                v.date===date
            ){

                logsKey=c.key;

                existingLogData=v;
            }
        });


        // ======================================
        // 기존 지각 차감값 확인
        // ======================================

        let previousPenalty=0;


        if(
            existingData&&
            existingData.pointPenalty!==undefined
        ){

            previousPenalty=
                parseInt(
                    existingData.pointPenalty,
                    10
                )||0;

        }else if(
            existingLogData&&
            existingLogData.pointPenalty!==undefined
        ){

            previousPenalty=
                parseInt(
                    existingLogData.pointPenalty,
                    10
                )||0;
        }


        // ======================================
        // 담임 직접 지각
        //
        // 지각 = 무조건 총 -9P
        //
        // 다른 상태 = 지각 패널티 0P
        // ======================================

        const desiredPenalty=
            category==='지각'
                ?-9
                :0;


        // ======================================
        // 차이만 실제 포인트 반영
        //
        // QR로 이미 -3P
        // → 담임 지각
        // → -6P만 추가
        //
        // 이미 -9P
        // → 다시 지각
        // → 0P
        //
        // -9P 상태에서 정상 수정
        // → +9P
        // ======================================

        const pointDelta=
            desiredPenalty-
            previousPenalty;


        // ======================================
        // 기존 등교 시간 유지
        // ======================================

        const oldTime=
            (
                existingData&&
                existingData.time
            )||
            (
                existingLogData&&
                existingLogData.time
            )||
            '';


        let saveTime=
            oldTime;


        // 정상은 시간 표시 안 함
        if(category==='정상'){

            saveTime='';

        }else if(
            !saveTime||
            saveTime==='-'
        ){

            saveTime=
                new Date()
                .toLocaleTimeString(
                    'ko-KR',
                    {
                        hour:'2-digit',
                        minute:'2-digit',
                        hour12:false
                    }
                );
        }


        const baseData=
            existingData||
            existingLogData||
            {};


        // ======================================
        // 저장할 출결 데이터
        // ======================================

        const data={

            ...baseData,

            user:
                name,

            name:
                name,

            date:
                date,

            category:
                category,

            subCategory:
                subCategory,

            reason:
                reason,

            result:
                result,

            time:
                saveTime,

            docSubmitted:
                !!baseData.docSubmitted,

            timestamp:
                Date.now(),

            pointPenalty:
                desiredPenalty,

            penaltySource:
                category==='지각'
                    ?'teacher'
                    :'none',

            lateMinutes:
                0
        };


        const updates={};


        // ======================================
        // checkins 갱신
        // ======================================

        if(checkinsKey){

            updates[
                `checkins/${checkinsKey}`
            ]=data;

        }else{

            const newKey=
                db.ref(
                    'checkins'
                ).push().key;


            updates[
                `checkins/${newKey}`
            ]=data;
        }


        // ======================================
        // 예전 checkinLogs가 존재하면
        // 같이 맞춰줌
        // ======================================

        if(logsKey){

            updates[
                `checkinLogs/${logsKey}`
            ]={

                ...(existingLogData||{}),

                ...data
            };
        }


        let newPoints=null;


        // ======================================
        // 포인트 변경
        // ======================================

        if(
            userSnap.exists()&&
            pointDelta!==0
        ){

            const userData=
                userSnap.val()||{};


            const oldPoints=
                parseInt(
                    userData.points,
                    10
                )||0;


            newPoints=
                oldPoints+
                pointDelta;


            updates[
                `users/${name}/points`
            ]=newPoints;


            // ==================================
            // 포인트 로그 사유
            // ==================================

            const pointReason=
                pointDelta<0
                    ?'담임 지각 처리 자동 차감'
                    :'출결 수정에 따른 지각 차감 복구';


            // ==================================
            // pointLogs
            // ==================================

            const pointLogKey=
                db.ref(
                    'pointLogs'
                ).push().key;


            updates[
                `pointLogs/${pointLogKey}`
            ]={

                name:
                    name,

                pAmt:
                    pointDelta,

                reason:
                    pointReason,

                time:
                    new Date()
                    .toLocaleString(
                        'ko-KR'
                    ),

                timestamp:
                    Date.now()
            };


            // ==================================
            // pointHistory
            // ==================================

            const historyKey=
                db.ref(
                    `pointHistory/${name}`
                ).push().key;


            updates[
                `pointHistory/${name}/${historyKey}`
            ]={

                date:
                    date,

                time:
                    new Date()
                    .toLocaleTimeString(
                        'ko-KR',
                        {
                            hour:'2-digit',
                            minute:'2-digit',
                            hour12:false
                        }
                    ),

                reason:
                    pointReason,

                change:
                    pointDelta,

                pChange:
                    pointDelta,

                expChange:
                    0,

                result:
                    newPoints,

                pointResult:
                    newPoints,

                expResult:
                    parseInt(
                        userData.exp,
                        10
                    )||0,

                timestamp:
                    Date.now()
            };
        }


        // ======================================
        // Firebase 일괄 반영
        // ======================================

        await db.ref().update(
            updates
        );


        // ======================================
        // 완료 메시지
        // ======================================

        if(category==='지각'){

            if(pointDelta<0){

                alert(
                    `⚠️ 지각 처리 완료\n`+
                    `${Math.abs(pointDelta)}포인트가 추가 차감되었습니다.\n`+
                    `최종 지각 차감: 9포인트`
                );

            }else{

                alert(
                    `⚠️ 지각 처리 완료\n`+
                    `이미 9포인트가 차감된 상태입니다.`
                );
            }

        }else if(pointDelta>0){

            alert(
                `✅ 출결 수정 완료\n`+
                `기존 지각 차감 ${pointDelta}포인트가 복구되었습니다.`
            );

        }else{

            alert(
                '✅ 변동 사유가 반영되었습니다.'
            );
        }


        if(
            typeof closePopup===
            'function'
        ){
            closePopup();
        }


        checkinRefreshSeatMap();


    }catch(err){

        console.error(
            '상세 출결 저장 오류:',
            err
        );


        alert(
            '출결 수정 중 오류가 발생했습니다.'
        );
    }
};

// ====================================================
// 7. 요일별 등교 제외
// ====================================================

window.openExclusionPopup=function(){

    db.ref(
        'settings/fixedExclusions'
    )
    .once('value',snap=>{

        const data=snap.val()||{};

        const days=[
            '월',
            '화',
            '수',
            '목',
            '금'
        ];

        let h=`
            <div style="
                text-align:left;
            ">

                <p style="
                    font-size:1rem;
                    color:#e74c3c;
                    font-weight:bold;
                    margin-bottom:10px;
                ">
                    * 요일별로 등교 체크에서 제외할 학생을 선택하세요.
                </p>

                <div style="
                    display:flex;
                    gap:5px;
                    margin-bottom:15px;
                ">
        `;

        days.forEach(d=>{

            h+=`
                <button
                    onclick="showExclusionDay('${d}')"
                    class="day-tab"
                    id="tab-${d}"
                    style="
                        flex:1;
                        padding:10px;
                        border:1px solid #ccc;
                        border-radius:8px;
                        font-weight:bold;
                        cursor:pointer;
                    "
                >
                    ${d}
                </button>
            `;
        });

        h+=`</div>`;


        days.forEach(d=>{

            const list=data[d]||[];

            h+=`
                <div
                    id="day-cont-${d}"
                    class="day-content"
                    style="
                        display:none;
                        grid-template-columns:repeat(3,1fr);
                        gap:10px;
                        max-height:300px;
                        overflow-y:auto;
                    "
                >
            `;

            if(
                typeof currentUsers!=='undefined'
            ){

                currentUsers.forEach(u=>{

                    if(u.name==='총사령관'){
                        return;
                    }

                    const checked=
                        list.includes(u.name);

                    h+=`
                        <label style="
                            background:#f8f9fa;
                            padding:10px;
                            border-radius:10px;
                            text-align:center;
                            border:2px solid ${
                                checked
                                ?'#9b59b6'
                                :'#eee'
                            };
                            cursor:pointer;
                        ">

                            <input
                                type="checkbox"
                                class="ex-check-${d}"
                                value="${u.name}"
                                ${checked?'checked':''}
                                style="margin-bottom:5px;"
                            >

                            <div style="
                                font-weight:bold;
                                font-size:1.1rem;
                            ">
                                ${u.name}
                            </div>

                        </label>
                    `;
                });
            }

            h+=`</div>`;
        });


        h+=`
            <button
                onclick="saveExclusionsByDay()"
                style="
                    width:100%;
                    margin-top:20px;
                    background:#9b59b6;
                    color:white;
                    padding:15px;
                    border-radius:12px;
                    font-weight:bold;
                    cursor:pointer;
                "
            >
                설정 저장하기
            </button>

            </div>
        `;


        if(typeof openPopup==='function'){

            openPopup(
                '🚫 요일별 등교제외 설정',
                h
            );
        }

        showExclusionDay('월');
    });
};


window.showExclusionDay=function(day){

    document
        .querySelectorAll('.day-content')
        .forEach(el=>{
            el.style.display='none';
        });

    document
        .querySelectorAll('.day-tab')
        .forEach(el=>{
            el.style.background='white';
        });

    const cont=
        document.getElementById(
            'day-cont-'+day
        );

    const tab=
        document.getElementById(
            'tab-'+day
        );

    if(cont){
        cont.style.display='grid';
    }

    if(tab){
        tab.style.background='#e9ecef';
    }
};


window.saveExclusionsByDay=function(){

    const data={};

    [
        '월',
        '화',
        '수',
        '목',
        '금'
    ].forEach(d=>{

        data[d]=[];

        document
            .querySelectorAll(
                '.ex-check-'+d+':checked'
            )
            .forEach(el=>{
                data[d].push(el.value);
            });
    });


    db.ref(
        'settings/fixedExclusions'
    )
    .set(data)
    .then(()=>{

        alert(
            '✨ 요일별 제외 명단이 저장되었습니다.'
        );

        if(typeof closePopup==='function'){
            closePopup();
        }

        checkinRefreshSeatMap();
    });
};


// ====================================================
// 8. 월간 출석부
// ====================================================

window.openMonthlyCalendar=function(){

    const now=new Date();

    const year=now.getFullYear();
    const month=now.getMonth();

    const daysInMonth=
        new Date(
            year,
            month+1,
            0
        ).getDate();

    const weekdays=[];

    for(
        let d=1;
        d<=daysInMonth;
        d++
    ){

        const dow=
            new Date(
                year,
                month,
                d
            ).getDay();

        if(
            dow!==0&&
            dow!==6
        ){
            weekdays.push(d);
        }
    }


    Promise.all([

        db.ref('checkins')
        .once('value'),

        db.ref('checkinLogs')
        .once('value')

    ])
    .then(snaps=>{

        const usersSet=new Set();

        if(
            typeof currentUsers!=='undefined'
        ){

            currentUsers.forEach(u=>{

                if(
                    u.name!=='총사령관'
                ){
                    usersSet.add(u.name);
                }
            });
        }


        const records=[];

        snaps.forEach(snap=>{

            snap.forEach(c=>{

                const log=
                    checkinNormalizeLog(
                        c.val(),
                        c.key,
                        ''
                    );

                if(
                    log.name&&
                    log.name!=='총사령관'
                ){

                    usersSet.add(
                        log.name
                    );

                    records.push(log);
                }
            });
        });


        const users=
            Array.from(usersSet)
            .sort((a,b)=>{

                const ua=
                    typeof currentUsers!=='undefined'
                    ?currentUsers.find(
                        x=>x.name===a
                    )
                    :null;

                const ub=
                    typeof currentUsers!=='undefined'
                    ?currentUsers.find(
                        x=>x.name===b
                    )
                    :null;

                return(
                    parseInt(ua&&ua.no)||999
                )-(
                    parseInt(ub&&ub.no)||999
                );
            });


        const attendanceData={};

        users.forEach(u=>{
            attendanceData[u]={};
        });


        records.forEach(r=>{

            if(
                !r.date||
                !attendanceData[r.name]
            ){
                return;
            }

            if(
                r.date.startsWith(
                    year+'-'+
                    String(month+1).padStart(2,'0')
                )
            ){

                const d=
                    parseInt(
                        r.date.split('-')[2]
                    );

                if(!isNaN(d)){
                    attendanceData[
                        r.name
                    ][d]=r;
                }
            }
        });


        let tableHtml=`

            <style>

                #popup-modal-content{
                    max-width:95%!important;
                    width:1200px!important;
                }

                @media print{

                    body *{
                        visibility:hidden;
                    }

                    #print-area,
                    #print-area *{
                        visibility:visible;
                    }

                    #print-area{
                        position:absolute;
                        left:0;
                        top:0;
                        width:100%;
                    }

                    .no-print{
                        display:none!important;
                    }
                }

            </style>


            <div
                id="print-area"
                style="padding:10px;"
            >

                <h2
                    class="print-title"
                    style="
                        text-align:center;
                        margin-bottom:20px;
                        font-size:1.8rem;
                        display:none;
                    "
                >
                    ${month+1}월 학급 출석부 (${year}년)
                </h2>


                <div
                    class="no-print"
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-bottom:15px;
                    "
                >

                    <div>
                        📌 범례:

                        <b style="color:#2b8a3e;">
                            O
                        </b>
                        정상 /

                        <b style="color:#e03131;">
                            결
                        </b>
                        결석 /

                        <b style="color:#f59f00;">
                            지
                        </b>
                        지각 /

                        <b style="color:#1c7ed6;">
                            조
                        </b>
                        조퇴
                    </div>


                    <button
                        onclick="window.printAttendanceBook()"
                        style="
                            background:#228be6;
                            color:white;
                            border:none;
                            padding:10px 18px;
                            font-weight:bold;
                            border-radius:6px;
                            cursor:pointer;
                        "
                    >
                        🖨️ 출석부 인쇄
                    </button>

                </div>


                <div style="
                    overflow-x:auto;
                    background:#fff;
                    border-radius:8px;
                    border:1px solid #dee2e6;
                ">

                    <table style="
                        width:100%;
                        border-collapse:collapse;
                        text-align:center;
                        min-width:1000px;
                    ">

                        <thead>

                            <tr style="
                                background:#f8f9fa;
                            ">

                                <th style="
                                    border:1px solid #ced4da;
                                    padding:12px 8px;
                                    position:sticky;
                                    left:0;
                                    background:#f8f9fa;
                                    z-index:2;
                                ">
                                    이름
                                </th>
        `;


        weekdays.forEach(d=>{

            tableHtml+=`
                <th style="
                    border:1px solid #ced4da;
                    padding:12px 4px;
                    min-width:35px;
                ">
                    ${d}
                </th>
            `;
        });


        tableHtml+=`
                        </tr>

                        </thead>

                        <tbody>
        `;


        users.forEach(u=>{

            tableHtml+=`
                <tr>

                    <td style="
                        border:1px solid #ced4da;
                        padding:12px 8px;
                        font-weight:bold;
                        position:sticky;
                        left:0;
                        background:#fff;
                        z-index:1;
                    ">
                        ${u}
                    </td>
            `;


            weekdays.forEach(d=>{

                const record=
                    attendanceData[u][d];

                let mark='';
                let color='transparent';
                let remark='';


                if(record){

                    const status=
                        record.result||
                        record.reason||
                        '';

                    if(
                        record.reason&&
                        record.reason!==status
                    ){

                        remark=`
                            <div style="
                                font-size:.75rem;
                                color:#495057;
                                margin-top:3px;
                            ">
                                (${record.reason})
                            </div>
                        `;
                    }


                    if(
                        status.includes('정상')||
                        status==='등교'
                    ){

                        mark='O';
                        color='#ebfbee';

                    }else if(
                        status.includes('결석')
                    ){

                        mark='결';
                        color='#fff5f5';

                    }else if(
                        status.includes('지각')
                    ){

                        mark='지';
                        color='#fff9db';

                    }else if(
                        status.includes('조퇴')
                    ){

                        mark='조';
                        color='#e7f5ff';

                    }else{

                        mark=
                            status.substring(0,1);

                        color='#f3e5f5';
                    }
                }


                tableHtml+=`
                    <td style="
                        border:1px solid #ced4da;
                        padding:8px 4px;
                        background:${color};
                    ">
                        ${mark}
                        ${remark}
                    </td>
                `;
            });


            tableHtml+=`
                </tr>
            `;
        });


        tableHtml+=`
                        </tbody>

                    </table>

                </div>

            </div>
        `;


        if(
            typeof openPopup==='function'
        ){

            openPopup(
                `${month+1}월 학급 출석부`,
                tableHtml
            );
        }
    });
};


window.printAttendanceBook=function(){

    const title=
        document.querySelector(
            '.print-title'
        );

    if(title){
        title.style.display='block';
    }

    window.print();

    if(title){
        title.style.display='none';
    }
};


// ====================================================
// 9. 하단 출결 로그
// ====================================================

window.appendExtraLogsUI=function(){

    const board=
        document.getElementById(
            'tab-logs'
        );

    if(!board)return;


    let extraDiv=
        document.getElementById(
            'extra-logs-div'
        );


    if(!extraDiv){

        extraDiv=
            document.createElement(
                'div'
            );

        extraDiv.id=
            'extra-logs-div';

        board.appendChild(
            extraDiv
        );
    }


    db.ref('checkins')
    .once('value',snap=>{

        const checkins=[];

        snap.forEach(c=>{

            checkins.push({
                key:c.key,
                ...(c.val()||{})
            });
        });

        checkins.reverse();


        let html=`

            <hr style="
                margin:30px 0;
                border:1px dashed #ccc;
            ">


            <div style="
                text-align:center;
                margin-bottom:20px;
            ">

                <button
                    onclick="openMonthlyCalendar()"
                    style="
                        padding:12px 20px;
                        background:#9b59b6;
                        color:white;
                        border:none;
                        border-radius:10px;
                        font-weight:bold;
                        cursor:pointer;
                    "
                >
                    📊 이번 달 출석부(달력) 보기
                </button>

            </div>
        `;


        const missing=
            checkins.filter(c=>
                c.reason&&
                (
                    c.reason.includes('결석')||
                    c.reason.includes('체험학습')
                )&&
                !c.docSubmitted
            );


        if(
            typeof isAdmin!=='undefined'&&
            isAdmin&&
            missing.length
        ){

            html+=`

                <div style="
                    background:#ffebee;
                    border:2px solid #ef5350;
                    border-radius:10px;
                    padding:15px;
                    margin-bottom:20px;
                    text-align:left;
                ">

                    <h4 style="
                        margin:0 0 10px;
                        color:#c62828;
                    ">
                        ⚠️ 서류 미제출자
                    </h4>

                    <div style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:10px;
                    ">
            `;


            missing.forEach(c=>{

                html+=`

                    <button
                        onclick="completeDoc('${c.key}')"
                        style="
                            padding:8px 12px;
                            background:white;
                            border:2px solid #ef5350;
                            color:#c62828;
                            border-radius:8px;
                            font-weight:bold;
                            cursor:pointer;
                        "
                    >
                        ${c.user||c.name}
                        (${c.reason})
                    </button>
                `;
            });


            html+=`
                    </div>

                </div>
            `;
        }


        html+=`

            <h3 style="
                margin-bottom:10px;
                border-bottom:2px solid #eee;
                padding-bottom:10px;
            ">
                📜 전체 출결 로그
            </h3>

            <div style="
                max-height:300px;
                overflow-y:auto;
            ">
        `;


        checkins
        .slice(0,50)
        .forEach(c=>{

            html+=`

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    padding:10px;
                    border-bottom:1px solid #eee;
                ">

                    <span>
                        <b>
                            ${c.user||c.name}
                        </b>

                        -
                        ${c.reason||c.result||'정상 등교'}
                    </span>

                    <small style="
                        color:#666;
                    ">
                        ${c.time||''}
                    </small>

                </div>
            `;
        });


        if(!checkins.length){

            html+=`
                <p style="
                    text-align:center;
                    color:#999;
                    padding:20px;
                ">
                    출결 기록이 없습니다.
                </p>
            `;
        }


        html+=`
            </div>
        `;


        extraDiv.innerHTML=
            html;
    });
};


window.completeDoc=function(key){

    if(
        !confirm(
            '이 학생의 서류를 제출 완료 처리하시겠습니까?'
        )
    ){
        return;
    }

    db.ref(
        'checkins/'+key
    )
    .update({
        docSubmitted:true
    })
    .then(()=>{
        appendExtraLogsUI();
    });
};


console.log(
    'checkin-seat.js 로드 완료'
);
