(function(){
    'use strict';

    const state={started:false,data:{},popularItems:[]};
    const esc=value=>String(value==null?'':value)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const todayKst=()=>new Intl.DateTimeFormat('sv-SE',{
        timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
    }).format(new Date());

    function assignmentRows(data){
        return Object.entries(data.assignments||{})
            .filter(([,item])=>item&&item.active!==false)
            .sort((a,b)=>String(a[1].dueDate||'9999').localeCompare(String(b[1].dueDate||'9999')));
    }

    function renderNotices(data,today){
        const target=document.getElementById('home-notice-list');
        if(!target)return;
        const notice=String(data.notices?.[today]||data.legacyNotice||'').trim();
        const lines=notice.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).slice(0,4);
        target.innerHTML=lines.length
            ?lines.map((line,index)=>`<div class="home-notice-item"><span>${index+1}</span><p>${esc(line)}</p></div>`).join('')
            :'<div class="home-empty">오늘 등록된 알림이 없어요.</div>';
    }

    function renderTasks(data){
        const target=document.getElementById('home-task-list');
        if(!target)return;
        const admin=window.isAdmin===true;
        const myName=String(window.myName||'').trim();
        const all=assignmentRows(data);
        const rows=admin
            ?all
            :all.filter(([id])=>!data.assignmentCompletions?.[id]?.[myName]);
        const title=document.getElementById('home-task-title');
        const label=document.getElementById('home-stat-task-label');
        if(title)title.textContent=admin?'📝 진행 중 과제':'📝 미완료 과제';
        if(label)label.textContent=admin?'진행 중 과제':'미완료 과제';
        const taskStat=document.getElementById('home-stat-tasks');
        if(taskStat)taskStat.textContent=String(rows.length);

        target.innerHTML=rows.length
            ?rows.slice(0,4).map(([id,item])=>{
                const completed=Object.keys(data.assignmentCompletions?.[id]||{}).length;
                const meta=admin
                    ?`완료 ${completed}명 · 마감 ${esc(item.dueDate||'-')}`
                    :`마감 ${esc(item.dueDate||'-')}`;
                return `<button type="button" class="home-task-item" onclick="showTab('assignments');initAssignmentsTab();"><span class="home-task-mark">${admin?'📋':'✎'}</span><span><strong>${esc(item.title||'제목 없는 과제')}</strong><small>${meta}</small></span><b aria-hidden="true">›</b></button>`;
            }).join('')
            :`<div class="home-empty">${admin?'진행 중인 과제가 없어요.':'미완료 과제가 없어요. 🎉'}</div>`;
    }

    function shopIcon(item){
        const text=`${item?.cat||''} ${item?.name||''}`;
        if(/쿠폰|티켓/.test(text))return '🎟️';
        if(/시간|시계/.test(text))return '⏰';
        if(/먹|간식|음료/.test(text))return '🍪';
        if(/학용품|연필|펜/.test(text))return '✏️';
        if(/뽑기/.test(text))return '🎁';
        return '🛍️';
    }

    window.renderHomeShop=function(){
        const target=document.getElementById('home-shop-list');
        if(!target)return;
        const items=state.popularItems;
        target.innerHTML=items.length?items.map(item=>
            `<button type="button" class="home-shop-item" onclick="showTab('shop');renderShop();"><span class="home-shop-icon">${shopIcon(item)}</span><span><strong>${esc(item.name)}</strong><small>${Number(item.price)||0} P · ${Number(item.count)||0}회 구매</small></span><b aria-hidden="true">›</b></button>`
        ).join(''):'<div class="home-empty">인기 상품을 집계하는 중이에요.</div>';
    };

    async function loadPopularShop(){
        try{
            const call=firebase.app().functions('asia-northeast3').httpsCallable('getPopularShopItems');
            const response=await call({});
            state.popularItems=Array.isArray(response.data?.items)?response.data.items:[];
            window.renderHomeShop();
        }catch(error){
            console.error('인기 상품 불러오기 오류:',error);
            const target=document.getElementById('home-shop-list');
            if(target)target.innerHTML='<div class="home-empty">인기 상품을 불러오지 못했어요.</div>';
        }
    }

    function renderCleaning(data,today,students){
        const target=document.getElementById('home-clean-summary');
        if(!target)return;
        const status=data.cleaningRoot?.[today]||{};
        const done=students.filter(student=>status[student.name]?.cleanDone).length;
        const total=students.length;
        const percent=total?Math.round(done/total*100):0;
        const waiting=students.filter(student=>!status[student.name]?.cleanDone)
            .slice(0,4).map(student=>student.name);
        target.innerHTML=`<div class="home-clean-count"><strong>${done} / ${total}</strong><span>${percent}% 완료</span></div><div class="home-clean-track"><i style="width:${percent}%"></i></div><div class="home-clean-row"><span>✅ 완료</span><b>${done}명</b></div><div class="home-clean-row"><span>🕒 남음</span><b>${Math.max(0,total-done)}명</b></div><p class="home-clean-names">${waiting.length?`확인할 용사: ${waiting.map(esc).join(', ')}${total-done>4?' 외':''}`:'모두 완료했어요! 🎉'}</p>`;
    }

    function render(){
        const data=state.data||{};
        const today=todayKst();
        const students=Object.values(data.users||{}).filter(user=>user&&user.name);
        const attended=new Set(Object.values(data.checkins||{})
            .filter(record=>record&&record.date===today&&record.attended)
            .map(record=>record.name));

        const dateLabel=document.getElementById('home-date-label');
        if(dateLabel){
            const date=new Date(`${today}T12:00:00`);
            dateLabel.textContent=new Intl.DateTimeFormat('ko-KR',{
                month:'long',day:'numeric',weekday:'long'
            }).format(date);
        }
        const studentStat=document.getElementById('home-stat-students');
        const attendanceStat=document.getElementById('home-stat-attendance');
        const heroCount=document.getElementById('home-hero-count');
        const welcome=document.getElementById('home-welcome-copy');
        if(studentStat)studentStat.textContent=String(students.length);
        if(attendanceStat)attendanceStat.textContent=`${attended.size} / ${students.length}`;
        if(heroCount)heroCount.textContent=`${students.length}명의 용사`;
        if(welcome)welcome.textContent=window.isAdmin===true
            ?'학급 현황을 한눈에 확인하고 필요한 메뉴로 이동하세요.'
            :`${window.myName||'용사'}님, 오늘도 즐거운 하루 보내세요.`;

        renderNotices(data,today);
        renderTasks(data);
        window.renderHomeShop();
        renderCleaning(data,today,students);
    }

    window.initHomeDashboard=function(){
        if(state.started){render();return;}
        state.started=true;
        loadPopularShop();
        db.ref('blackboardDisplay/data').on('value',snapshot=>{
            state.data=snapshot.val()||{};
            render();
        },error=>{
            console.error('홈 요약 불러오기 오류:',error);
            const notice=document.getElementById('home-notice-list');
            const tasks=document.getElementById('home-task-list');
            if(notice)notice.innerHTML='<div class="home-empty">알림을 불러오지 못했어요.</div>';
            if(tasks)tasks.innerHTML='<div class="home-empty">과제를 불러오지 못했어요.</div>';
        });
    };
})();
