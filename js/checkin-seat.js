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

function checkinRefreshSeatMap(){
    const rc=checkinGetRowsCols();

    if(typeof window.renderSeatMap==='function'){
        window.renderSeatMap(
            rc.rows,
            rc.cols
        );
    }
}

window.checkinRefreshSeatMap=checkinRefreshSeatMap;

function checkinEscape(value){
    return String(value??'')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}
/* =========================================================
   출결 데이터 형식 통일
   ========================================================= */

function checkinNormalizeLog(value,key,source){
    const data=
        value&&typeof value==='object'
            ?value
            :{};

    const name=String(
        data.name||
        data.user||
        data.studentName||
        ''
    ).trim();

    const timestamp=
        Number(
            data.timestamp||
            data.createdAt||
            0
        )||0;

    let date=String(
        data.date||
        data.checkinDate||
        ''
    ).slice(0,10);

    if(!date&&timestamp){
        date=new Date(timestamp).toLocaleDateString(
            'sv-SE',
            {timeZone:'Asia/Seoul'}
        );
    }

    let time=String(
        data.time||
        data.checkinTime||
        ''
    ).trim();

    if(!time&&timestamp){
        time=new Date(timestamp).toLocaleTimeString(
            'ko-KR',
            {
                hour:'2-digit',
                minute:'2-digit',
                hour12:false,
                timeZone:'Asia/Seoul'
            }
        );
    }

    const category=String(
        data.category||
        data.status||
        ''
    ).trim();

    const reason=String(
        data.reason||
        data.result||
        category||
        '출결 기록'
    ).trim();

    const result=String(
        data.result||
        (
            category==='정상'||
            category==='지각'
                ?category+' 등교'
                :category
        )||
        reason
    ).trim();

    return {
        ...data,
        key:key||'',
        source:source||'',
        name:name,
        user:name,
        date:date,
        time:time,
        category:category,
        reason:reason,
        result:result,
        timestamp:timestamp
    };
}

window.checkinNormalizeLog=
    checkinNormalizeLog;


/* =========================================================
   좌석 및 출결 새로고침
   ========================================================= */

window.refreshCheckinManagement=async function(){
    if (window.isAdmin !== true) {
        checkinRefreshSeatMap();
        return;
    }

    const dateInput=
        document.getElementById('checkin-date-filter');

    const targetDate=
        dateInput&&dateInput.value
            ?dateInput.value
            :checkinGetToday();

    if(dateInput&&!dateInput.value){
        dateInput.value=targetDate;
    }

    try{
        await window.loadCheckinState();

        const [
            checkinsSnap,
            logsSnap,
            usersSnap,
            exclusionsSnap
        ]=
            await Promise.all([
                db.ref('checkins').orderByChild('date').equalTo(targetDate).once('value'),
                db.ref('checkinLogs').orderByChild('date').equalTo(targetDate).once('value'),
                db.ref('users').once('value'),
                db.ref('settings/fixedExclusions').once('value')
            ]);

        const byName=new Map();

        const collect=(snapshot,source)=>{
            snapshot.forEach(child=>{
                const log=checkinNormalizeLog(
                    child.val(),
                    child.key,
                    source
                );

                if(
                    !log.name||
                    log.date!==targetDate
                ){
                    return;
                }

                const old=byName.get(log.name);

                if(
                    !old||
                    log.timestamp>=old.timestamp||
                    source==='checkins'
                ){
                    byName.set(log.name,log);
                }
            });
        };

        collect(logsSnap,'checkinLogs');
        collect(checkinsSnap,'checkins');

        const loadedUsers=[];

        usersSnap.forEach(child=>{
            const user=child.val()||{};

            loadedUsers.push({
                ...user,
                name:String(user.name||child.key||'').trim()
            });
        });

        const students=loadedUsers.filter(user=>{
            const name=
                String(user&&user.name||'');

            return(
                name&&
                name!=='총사령관'&&
                !name.includes('선생님')
            );
        });

        const weekDays=['일','월','화','수','목','금','토'];
        const selectedDay=weekDays[
            new Date(targetDate+'T12:00:00').getDay()
        ];

        const fixedExclusions=
            exclusionsSnap.val()||{};

        const excludedNames=new Set(
            Array.isArray(fixedExclusions[selectedDay])
                ?fixedExclusions[selectedDay]
                :[]
        );

       const attendanceStudents=students.filter(
    user=>!excludedNames.has(user.name)
);

const excludedStudents=students.filter(
    user=>excludedNames.has(user.name)
);

const attendanceStudentNames=new Set(
            attendanceStudents.map(user=>user.name)
        );

        const records=
            Array.from(byName.values())
            .sort((a,b)=>{
                const aUser=students.find(
                    user=>user.name===a.name
                );

                const bUser=students.find(
                    user=>user.name===b.name
                );

                return(
                    (parseInt(aUser&&aUser.no)||999)-
                    (parseInt(bUser&&bUser.no)||999)
                );
            });

        const countRecords=records.filter(
            log=>attendanceStudentNames.has(log.name)
        );

        const normal=countRecords.filter(log=>{
            const result=String(log.result||'');

            return(
                result.includes('정상')||
                result==='등교'
            );
        }).length;

        const late=countRecords.filter(log=>
            String(log.result||'').includes('지각')
        ).length;

        const attendedNames=new Set(
            countRecords
                .filter(log=>{
                    const result=
                        String(log.result||'');

                    return(
                        result.includes('정상')||
                        result==='등교'||
                        result.includes('지각')
                    );
                })
                .map(log=>log.name)
        );

        // 인원수와 함께 명단 배열도 유지합니다. 아래 요약 줄에서 이름 목록으로 표시합니다.
        const absentStudents=attendanceStudents
            .filter(user=>!attendedNames.has(user.name))
            .sort((a,b)=>(parseInt(a.no)||999)-(parseInt(b.no)||999));

        const absent=absentStudents.length;

        const numberByName=new Map(
            students.map(user=>[
                user.name,
                parseInt(user.no)||null
            ])
        );

        const summary=
            document.getElementById(
                'checkin-summary'
            );

       if(summary){
    summary.innerHTML=`
        <div class="checkin-summary-card">
            전체 학생 <b>${students.length}명</b>

            ${
                excludedStudents.length
                    ?`
                        <small class="muted tiny">
                            등교 제외 ${excludedStudents.length}명
                        </small>
                    `
                    :''
            }
        </div>

        <div class="checkin-summary-card is-good">
            정상등교 <b>${normal}명</b>
        </div>

        <div class="checkin-summary-card is-warn">
            지각등교 <b>${late}명</b>
        </div>

        <div class="checkin-summary-card is-bad">
            미등교 <b>${absent}명</b>
        </div>

        ${
            absentStudents.length
                ?`
                    <div class="checkin-absent-panel">
                        <b class="checkin-absent-title">아직 안 온 학생</b>

                        <div class="checkin-absent-list">
                            ${absentStudents.map(user=>`
                                <button
                                    type="button"
                                    class="checkin-absent-chip"
                                    onclick="openCheckinEditModal('${checkinEscape(user.name).replace(/'/g,"\\'")}')"
                                    title="${checkinEscape(user.name)} 등교 기록 바로 수정"
                                >
                                    <span class="an-no">${numberByName.get(user.name)||'–'}</span>
                                    ${checkinEscape(user.name)}
                                </button>
                            `).join('')}
                        </div>

                        <small class="muted tiny">이름을 누르면 그 학생의 등교 기록이 바로 열립니다.</small>
                    </div>
                `
                :''
        }
    `;
}

        const list=
            document.getElementById(
                'checkin-log-list'
            );

        if(list){
            list.innerHTML=records.length
                ?`
                    <div class="checkin-log-table-wrap">
                        <table class="checkin-log-table">
                            <thead>
                                <tr>
                                    <th>번호</th>
                                    <th>이름</th>
                                    <th>상태</th>
                                    <th>시간</th>
                                    <th>사유</th>
                                </tr>
                            </thead>

                            <tbody>
                                ${records.map(log=>`
                                    <tr>
                                        <td class="num muted">
                                            ${numberByName.get(log.name)||'–'}
                                        </td>

                                        <td>
                                            ${checkinEscape(log.name)}
                                        </td>

                                        <td>
                                            ${checkinEscape(log.result)}
                                        </td>

                                        <td>
                                            ${checkinEscape(log.time||'-')}
                                        </td>

                                        <td>
                                            ${checkinEscape(log.reason||'-')}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `
                :`
                    <p class="well center muted">
                        해당 날짜의 등교 기록이 없습니다.
                    </p>
                `;
        }

        checkinRefreshSeatMap();

    }catch(error){
        console.error(
            '등교 관리 새로고침 오류:',
            error
        );
    }
};

window.refreshCheckinAdminPanel=
    window.refreshCheckinManagement;

window.generateNewLayout=
    window.refreshCheckinManagement;

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

// 오늘 내 등교 기록을 찾아 화면에 표시한다.
// 제출 결과를 알림창이 아니라 화면에 유지하기 위한 함수다.
window.findMyCheckinToday=async function(name){
    const who=String(name||window.myName||'').trim();
    if(!who)return null;

    const today=checkinGetToday();

    if(window.isAdmin!==true){
        if(who!==window.myName)return null;
        const own=await db.ref(`users/${who}/attendanceState/${today}`).once('value');
        if(own.exists())return checkinNormalizeLog({...own.val(),name:who},today,'own');
    }

    const checkinsSnap=await db.ref('blackboardDisplay/data/checkins').once('value');

    let found=null;

    const scan=(snapshot,source)=>{
        snapshot.forEach(child=>{
            const value=child.val()||{};
            const log=checkinNormalizeLog({
                ...value,
                category:value.category||'',
                result:value.attended?'등교 확인됨':value.result
            },child.key,source);
            if(!log)return;
            if(log.name!==who)return;
            if(log.date!==today)return;
            // 같은 날 기록이 여러 개면 가장 늦은 것을 쓴다.
            if(!found||(log.timestamp||0)>=(found.timestamp||0))found=log;
        });
    };

    scan(checkinsSnap,'publicCheckins');

    return found;
};

// 학생 등교 카드를 '아직 안 함' 또는 '오늘 이렇게 처리됨' 둘 중 하나로 그린다.
window.renderMyCheckinCard=async function(){
    const panel=document.getElementById('checkin-my-status');
    const form=document.getElementById('checkin-form');
    if(!panel||!form)return;

    if(window.isAdmin===true||!window.myName){
        panel.hidden=true;
        form.hidden=false;
        return;
    }

    let record=null;
    try{
        record=await window.findMyCheckinToday(window.myName);
    }catch(error){
        console.error('오늘 등교 기록 조회 오류:',error);
        panel.hidden=true;
        form.hidden=false;
        return;
    }

    if(!record){
        panel.hidden=true;
        form.hidden=false;
        return;
    }

    const tone=
        record.category==='정상'?'is-good':
        record.category==='지각'?'is-warn':
        record.category==='결석'?'is-bad':'is-warn';

    const mark=
        record.category==='정상'?'✅':
        record.category==='지각'?'⚠️':'📝';

    panel.className='checkin-stamp '+tone;
    panel.innerHTML=
        '<div class="checkin-stamp-mark">'+mark+'</div>'+
        '<div class="checkin-stamp-body">'+
            '<strong>'+checkinEscape(record.result||record.category)+'</strong>'+
            '<span>'+checkinEscape(record.time||'')+' 확인</span>'+
        '</div>';

    panel.hidden=false;
    form.hidden=true;
};

window.refreshCheckinGuide=async function(settings){
    let currentSettings=settings;
    if(!currentSettings){
        const snap=await db.ref(window.isAdmin===true?'settings':'publicSettings').once('value');
        currentSettings=snap.val()||{};
    }

    const guide=document.getElementById('checkin-guide');
    if(guide){
        guide.innerText=
            `✅ 정상: ~${currentSettings.lateTime||'08:40'} | `+
            `⚠️ 지각: ${currentSettings.closeTime||'09:00'} 마감`;
    }

    if(typeof window.renderMyCheckinCard==='function'){
        window.renderMyCheckinCard();
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

    const time=now.toLocaleTimeString(
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
            userSnap,
            exclusionsSnap
        ]=await Promise.all([

            db.ref(
                'checkins'
            ).orderByChild('date').equalTo(today).once('value'),

            db.ref(
                `users/${user}`
            ).once('value'),

            db.ref(
                window.isAdmin===true?'settings/fixedExclusions':'publicSettings/fixedExclusions'
            ).once('value')

        ]);

        const isFixedExcluded=checkinIsFixedExcluded(
            exclusionsSnap.val()||{},
            today,
            user
        );

        if(isFixedExcluded){
            desiredPenalty=0;
        }


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
// 일반 학생 직접 등교 시 권한 제한 경로 제외
// ======================================


// 등교 기록과 학생 포인트 저장
await db.ref().update(updates);
if(
    typeof window.setNormalCheckinRoomCoinReward===
    'function'
){
    try{
        await window.setNormalCheckinRoomCoinReward(
            user,
            today,
            category==='정상'
        );
    }catch(roomCoinError){
        console.error(
            '정상등교 방꾸미기 코인 처리 오류:',
            roomCoinError
        );
    }
}

        if(
            typeof appendExtraLogsUI===
            'function'
        ){
            appendExtraLogsUI();
        }


        if(
            typeof isAdmin!=='undefined'&&
            isAdmin&&
            typeof window.refreshCheckinManagement==='function'
        ){
            await window.refreshCheckinManagement();
        }else{
            checkinRefreshSeatMap();
        }
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
                newPoints,

            // 되돌리기에 필요한 정보. 어느 기록을 썼는지와 그 전 상태.
            recordKey:
                recordKey,

            hadPrevious:
                !!existingKey,

            previousData:
                existingData
                    ?JSON.parse(JSON.stringify(existingData))
                    :null,

            previousPoints:
                userSnap.exists()
                    ?(userSnap.val()||{}).points
                    :null
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

    const adminView=window.isAdmin===true;
    const emptySnapshot={forEach:()=>{},val:()=>({})};
    const attendanceReads=adminView
        ?Promise.all([
            db.ref('checkins').orderByChild('date').equalTo(targetDate).once('value'),
            db.ref('checkinLogs').orderByChild('date').equalTo(targetDate).once('value'),
            db.ref('settings/fixedExclusions').once('value')
        ])
        :Promise.all([
            db.ref('blackboardDisplay/data/checkins').once('value'),
            Promise.resolve(emptySnapshot),
            Promise.resolve(emptySnapshot)
        ]);

    attendanceReads.then(snaps=>{

        const logs={};

        snaps[1].forEach(c=>{
            const value=c.val()||{};
            const log=checkinNormalizeLog(
                adminView?value:{
                    ...value,
                    category:value.attended?'정상':value.category,
                    result:value.attended?'정상 등교':value.result
                },
                c.key,
                'checkinLogs'
            );

            if(log.name&&log.date===targetDate){
                logs[log.name]=log;
            }
        });

        snaps[0].forEach(c=>{
            const value=c.val()||{};
            const log=checkinNormalizeLog(
                adminView?value:{...value,result:value.attended?'등교':'미등교'},
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

                let stateClass='is-empty';
                let statusText='미등교';

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
                            stateClass='is-good';

                        }else if(
                            statusText.includes('지각')
                        ){
                            stateClass='is-bad';

                        }else if(
                            statusText.includes('결석')
                        ){
                            stateClass='is-bad';

                        }else if(
                            statusText.includes('조퇴')
                        ){
                            stateClass='is-warn';

                        }else if(
                            statusText.includes('제외')
                        ){
                            stateClass='is-warn';

                        }else{
                            stateClass='is-warn';
                        }

                    }else if(isFixedExcluded){

                        stateClass='is-warn';
                        statusText='고정 제외';

                    }else{

                        stateClass='is-bad';
                        statusText='미등교';
                    }
                }

                cell.className=`checkin-card ${stateClass}`;

                if(name){

                    const time=
                        log&&
                        log.time&&
                        log.time!=='-'
                            ?` · ${log.time}`
                            :'';

                    cell.innerHTML=`
    <div class="seat-name nowrap">
        ${checkinEscape(name)}
    </div>

    <div class="seat-state">
        ${checkinEscape(statusText)}
        ${checkinEscape(time)}
    </div>

    ${adminView?'<button type="button" class="checkin-detail-button">상세 수정</button>':''}
`;

                    cell.title=
                        `${name} · ${statusText}${time}`;

                }else{

                    cell.innerHTML='';
                    cell.title='빈 자리';
                }

                const detailButton=
                    cell.querySelector('.checkin-detail-button');

                if(detailButton){
                    detailButton.onclick=function(event){
                        event.preventDefault();
                        event.stopPropagation();
                        openCheckinEditModal(name,targetDate);
                    };
                }

                cell.onclick=async function(){

                    if(!adminView){
                        if(name&&typeof window.openFriendRoom==='function'){
                            window.openFriendRoom(name);
                        }
                        return;
                    }

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

                    if(cell.dataset.saving==='true')return;
                    cell.dataset.saving='true';
                    cell.setAttribute('aria-busy','true');

                    try{
                        await window.checkinWithUndo(name,'정상 등교');
                    }finally{
                        delete cell.dataset.saving;
                        cell.removeAttribute('aria-busy');
                    }
                };

                // 상세 수정은 명시적 버튼으로만 연다. 단일/더블클릭
                // 타이머 경합으로 팝업이 곧바로 닫히는 문제를 막는다.
                cell.ondblclick=null;

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
            <p class="well center muted">
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
        <div class="batch-card-modal-v6">
    `;

    h+=`
        <button
            onclick="assignStudentToSeat(
                '${posId}',
                '',
                ${rows},
                ${cols}
            )"
            class="btn btn--danger"
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
                    class="btn ${isAssigned?'btn--quiet':'btn--primary'}"
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

// 좌석 클릭 한 번으로 기록되는 출결에 되돌릴 기회를 붙인다.
// 좌석 격자와 예전 진입점 두 곳이 같은 동작을 쓰도록 여기 모은다.
window.checkinWithUndo=async function(user,reason){
    const label=reason||'정상 등교';
    const result=window.isAdmin===true&&label.includes('정상')
        ?await window.callSecure('teacherQuickCheckin',{name:user,date:checkinGetToday()})
        :await submitCheckin(user,label);

    if(window.isAdmin===true){
        try{
            await window.refreshCheckinManagement();
        }catch(refreshError){
            console.error('원클릭 출결 화면 갱신 오류:',refreshError);
            checkinRefreshSeatMap();
        }
    }

    if(!result||typeof window.showUndoBar!=='function')return result;

    window.showUndoBar(
        `${user} · ${label} 처리했습니다.`,
        async()=>{
            const updates={};

            updates[`checkins/${result.recordKey}`]=
                result.hadPrevious
                    ?result.previousData
                    :null;

            updates[`blackboardDisplay/data/checkins/${result.recordKey}`]=
                result.hadPrevious&&result.previousData
                    ?{name:user,date:result.previousData.date,
                        attended:['정상','지각'].includes(result.previousData.category)}
                    :null;

            if(
                result.previousPoints!==null&&
                result.previousPoints!==undefined&&
                result.pointDelta
            ){
                updates[`users/${user}/points`]=result.previousPoints;
            }

            await db.ref().update(updates);

            if(typeof window.refreshCheckinManagement==='function'){
                await window.refreshCheckinManagement();
            }else{
                checkinRefreshSeatMap();
            }
        }
    );

    return result;
};

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

            window.checkinWithUndo(user,'정상 등교');

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
        // 암호 검증, 시간 판정, 포인트 및 코인 반영을 서버 트랜잭션에서 한 번에 처리한다.
        const saveResult=await window.callSecure('submitStudentCheckin',{password});
        const lateBy=Number(saveResult.lateBy)||0;

        // 공개 프로필에는 민감한 포인트가 없으므로 서버가 반환한 본인 값으로
        // 현재 화면만 즉시 갱신한다. 다른 학생에게는 이 값이 노출되지 않는다.
        if(window.currentUser&&Number.isFinite(Number(saveResult.points))){
            window.currentUser.points=Number(saveResult.points);
            window.currentUser.roomCoins=Number(saveResult.roomCoins)||0;

            const mine=Array.isArray(window.currentUsers)
                ?window.currentUsers.find(item=>item&&item.name===window.myName)
                :null;
            if(mine){
                mine.points=window.currentUser.points;
                mine.roomCoins=window.currentUser.roomCoins;
            }

            if(typeof renderHeroes==='function')renderHeroes(window.currentUsers);
        }

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

            // 정상 등교는 포인트 변화가 없다.
            // 알림창 대신 화면에 기록을 남기므로 여기서는 따로 알리지 않는다.
        }

        // 결과를 화면에 도장처럼 남긴다. 새로고침해도 그대로 보인다.
        await window.renderMyCheckinCard();

    }catch(error){

        console.error(
            '등교 처리 오류:',
            error
        );

        alert(
            error.message||
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
        .orderByChild('date')
        .equalTo(date)
        .once('value'),

        db.ref('checkinLogs')
        .orderByChild('date')
        .equalTo(date)
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

            <div class="stack">

                <h3 class="center">
                    ${name} 등교 상세 기록
                </h3>

                <label class="field-label">
                    🚩 등교 상태
                </label>

                <select
                    id="edit-cat"
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


                <label class="field-label">
                    🔍 사유 구분
                </label>

                <select
                    id="edit-sub"
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


                <label class="field-label">
                    📝 구체적 사유
                </label>

                <textarea
                    id="edit-desc"
                    rows="3"
                    placeholder="예: 아침 방과후 농구팀, 독감으로 인한 결석 등"
                >${log.reason||''}</textarea>


                <button
                    onclick="
                        saveDetailLog(
                            '${safeName}',
                            '${safeDate}',
                            '${safeKey}'
                        )
                    "
                    class="btn btn--primary btn--block"
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


        if(
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

        const checkinRecordKey=checkinsKey||db.ref('checkins').push().key;
        updates[`checkins/${checkinRecordKey}`]=data;

        // 한 번 등교한 학생은 상세 화면에서 명시적으로 결석 처리하기 전까지
        // 공개 좌석판에서도 계속 등교 완료로 유지한다.
        updates[`blackboardDisplay/data/checkins/${checkinRecordKey}`]={
            name:name,
            date:date,
            attended:category!=='결석',
            category:category,
            result:result
        };


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
        if(
    typeof window.setNormalCheckinRoomCoinReward===
    'function'
){
    try{
        await window.setNormalCheckinRoomCoinReward(
            name,
            date,
            category==='정상'
        );
    }catch(roomCoinError){
        console.error(
            '출결 수정 방꾸미기 코인 처리 오류:',
            roomCoinError
        );
    }
}


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


        if(
            typeof window.refreshCheckinManagement==='function'
        ){
            await window.refreshCheckinManagement();
        }else{
            checkinRefreshSeatMap();
        }


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
            <div class="stack">

                <p class="strong">
                    * 요일별로 등교 체크에서 제외할 학생을 선택하세요.
                </p>

                <div class="btn-row btn-row--fill">
        `;

        days.forEach(d=>{

            h+=`
                <button
                    onclick="showExclusionDay('${d}')"
                    class="day-tab btn"
                    id="tab-${d}"
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
                    class="day-content batch-card-modal-v6"
                    style="display:none;"
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
                        <label class="batch-student-row center${checked?' is-selected':''}">

                            <input
                                type="checkbox"
                                class="ex-check-${d}"
                                value="${u.name}"
                                ${checked?'checked':''}
                            >

                            <div class="strong">
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
                class="btn btn--primary btn--block"
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
            el.classList.remove('btn--primary');
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
        tab.classList.add('btn--primary');
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

        if(
            typeof window.refreshCheckinManagement==='function'
        ){
            window.refreshCheckinManagement();
        }else{
            checkinRefreshSeatMap();
        }
    });
};


// ====================================================
// 8. 월간 출석부
// ====================================================

window.openMonthlyCalendar=function(targetYear,targetMonth){

    const hasTarget=
        Number.isFinite(Number(targetYear))&&
        Number.isFinite(Number(targetMonth));

    const now=hasTarget
        ?new Date(
            Number(targetYear),
            Number(targetMonth),
            1
        )
        :new Date();

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
                    max-width:95%;
                    width:1200px;
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
                        display:none;
                    }
                }

            </style>


            <div
                id="print-area"
            >

                <h2
                    class="print-title center"
                    style="display:none;"
                >
                    ${month+1}월 학급 출석부 (${year}년)
                </h2>


                <div class="no-print row row--between">

    <div class="row">

        <button
            type="button"
            onclick="openMonthlyCalendar(${year},${month-1})"
            class="btn btn--sm"
        >
            ◀ 이전 달
        </button>

        <strong class="center">
            ${year}년 ${month+1}월
        </strong>

        <button
            type="button"
            onclick="openMonthlyCalendar(${year},${month+1})"
            class="btn btn--sm"
        >
            다음 달 ▶
        </button>

    </div>

    <div>
        📌 범례:

                        <b class="badge badge--good">
                            O
                        </b>
                        정상 /

                        <b class="badge badge--bad">
                            결
                        </b>
                        결석 /

                        <b class="badge badge--warn">
                            지
                        </b>
                        지각 /

                        <b class="badge badge--info">
                            조
                        </b>
                        조퇴
                    </div>


                    <button
                        onclick="window.printAttendanceBook()"
                        class="btn btn--primary"
                    >
                        🖨️ 출석부 인쇄
                    </button>

                </div>


               <div class="table-wrap">

    <table class="table">

                        <thead>

                            <tr>

                                <th class="center">
                                    이름
                                </th>
        `;


        weekdays.forEach(d=>{

            tableHtml+=`
                <th class="center">
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

                    <td class="center strong">
                        ${u}
                    </td>
            `;


            weekdays.forEach(d=>{

                const record=
                    attendanceData[u][d];

                let mark='';
                let stateClass='';
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
                            <div class="tiny muted">
                                (${record.reason})
                            </div>
                        `;
                    }


                    if(
                        status.includes('정상')||
                        status==='등교'
                    ){

                        mark='O';
                        stateClass='is-good';

                    }else if(
                        status.includes('결석')
                    ){

                        mark='결';
                        stateClass='is-bad';

                    }else if(
                        status.includes('지각')
                    ){

                        mark='지';
                        stateClass='is-bad';

                    }else if(
                        status.includes('조퇴')
                    ){

                        mark='조';
                        stateClass='is-warn';

                    }else{

                        mark=
                            status.substring(0,1);

                        stateClass='is-warn';
                    }
                }


                tableHtml+=`
                    <td class="center ${stateClass}">
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

            <hr class="divider">


            <div class="center">

                <button
                    onclick="openMonthlyCalendar()"
                    class="btn btn--primary"
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

                <div class="card is-bad">

                    <h4 class="strong">
                        ⚠️ 서류 미제출자
                    </h4>

                    <div class="btn-row">
            `;


            missing.forEach(c=>{

                html+=`

                    <button
                        onclick="completeDoc('${c.key}')"
                        class="btn btn--danger btn--sm"
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

            <h3>
                📜 전체 출결 로그
            </h3>

            <div class="list scroll-y" style="max-height:300px;">
        `;


        checkins
        .slice(0,50)
        .forEach(c=>{

            html+=`

                <div class="list-item">

                    <span>
                        <b>
                            ${c.user||c.name}
                        </b>

                        -
                        ${c.reason||c.result||'정상 등교'}
                    </span>

                    <small class="muted small">
                        ${c.time||''}
                    </small>

                </div>
            `;
        });


        if(!checkins.length){

            html+=`
                <p class="well center muted">
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
