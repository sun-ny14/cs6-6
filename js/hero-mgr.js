// js/hero-mgr.js
// 용사 목록, 아바타, 학생 상세보기, 친구 방, 관리자 포인트 버튼

function initApp(){
    window.currentTab='home';

    if(typeof showTab==='function'){
        showTab('home');
    }

    renderHeroes();
}

function getAvatar(lv,selectedAnimal){
    const githubImageUrl="https://github.com/sun-ny14/cs6-6/blob/main/%EC%9C%A1%EC%9C%A1%EC%9D%B4.png?raw=true";
    const animals=[
        "귀여운","신사","사랑스러운","패셔니스타","밥먹는",
        "날쌘돌이","즐거운","행복한","정의로운","천사",
        "닌자","왕자","공주","근육맨","마법사",
        "용사","공부하는","춤추는","노래하는","무지개"
    ];

    const name=selectedAnimal||animals[Math.min(Math.max((parseInt(lv)||1)-1,0),19)];
    const index=animals.indexOf(name)===-1?0:animals.indexOf(name);
    const col=index%5;
    const row=Math.floor(index/5);
    const posX=col*25;
    const posY=row*33.33;

    return `
        <div style="width:70px;height:70px;overflow:hidden;border-radius:50%;background:white;margin:0 auto;display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <div style="width:100%;height:100%;background-image:url('${githubImageUrl}');background-size:500% 400%;background-position:${posX}% ${posY}%;background-repeat:no-repeat;image-rendering:pixelated;transform:scale(1.15);transform-origin:center;"></div>
        </div>
    `;
}

function renderHeroes(){
    const heroGrid=document.getElementById('hero-grid');

    if(!heroGrid)return;

    db.ref('users').once('value').then(snapshot=>{
        const usersData=snapshot.val()||{};
        const usersArray=[];

        Object.keys(usersData).forEach(key=>{
            const raw=usersData[key];

            if(!raw)return;

            const user={
                ...raw,
                _key:key,
                // Firebase key가 이름인 경우까지 대응
                name:raw.name||key
            };

            if(
                typeof adminEmail!=='undefined'&&
                user.email===adminEmail
            ){
                return;
            }

            if(
                user.name==='총사령관'||
                user.name.includes('선생님')
            ){
                return;
            }

            usersArray.push(user);
        });

        usersArray.sort((a,b)=>{
            const aNo=parseInt(a.number)||parseInt(a.no)||999;
            const bNo=parseInt(b.number)||parseInt(b.no)||999;
            return aNo-bNo;
        });

        const isUserAdmin=
            typeof isAdmin!=='undefined'&&
            isAdmin;

        let html='';

        usersArray.forEach(user=>{
            const name=user.name||user._key||'용사';
            const lv=parseInt(user.level)||parseInt(user.lv)||1;
            const role=user.role||(user.isHelper?'상점':'일반');
            const number=user.number||user.no||'';

            const isMySelf=
                typeof myName!=='undefined'&&
                user.name===myName;

            /*
             * 관리자:
             * 학생 카드 클릭 → 학생 상세정보 팝업
             *
             * 학생:
             * 다른 학생 카드 클릭 → 친구 방
             *
             * 학생은 본인/친구 모두 포인트를 볼 수 없음.
             */
            const safeName=escapeHeroValue(name);

            const clickAction=isUserAdmin
                ?`openPointPopupForUser('${safeName}')`
                :`openFriendRoom('${safeName}')`;

            let pointsHtml='';

            if(isUserAdmin){
                pointsHtml=`
                    <p style="font-weight:bold;color:var(--primary);margin:5px 0;">
                        Lv.${lv} | P:${user.points||0} | E:${user.exp||0}
                    </p>
                `;
            }else{
                pointsHtml=`
                    <p style="font-weight:bold;color:#7f8c8d;margin:5px 0;">
                        Lv.${lv}
                    </p>
                `;
            }

            html+=`
                <div
                    class="card hero-card-item"
                    style="text-align:center;cursor:pointer;background:white;border-radius:20px;padding:20px;box-shadow:0 4px 15px rgba(0,0,0,0.1);"
                    onclick="${clickAction}"
                >
                    <div>${getAvatar(lv,user.animal||user.selectedAnimal)}</div>
                    <h3 style="margin-top:10px;color:var(--dark);">
                        ${number?number+'. ':''}${escapeHeroHtml(name)}
                    </h3>
                    ${pointsHtml}
                    <p style="font-size:0.9rem;color:#666;">
                        역할:${escapeHeroHtml(role)}
                    </p>
                </div>
            `;
        });

        heroGrid.innerHTML=
            html||
            `<p style="text-align:center;color:#666;">등록된 용사가 없습니다.</p>`;

        /*
         * P 플로팅 버튼은 여기서만 생성한다.
         * global.js에는 같은 버튼을 만들지 않는다.
         */
        createBatchPointButton();
    }).catch(error=>{
        console.error('용사 목록 불러오기 오류:',error);

        heroGrid.innerHTML=`
            <p style="text-align:center;color:#e74c3c;">
                용사 목록을 불러오는 중 오류가 발생했습니다.
            </p>
        `;
    });
}

function escapeHeroHtml(value){
    return String(value??'')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
}

function escapeHeroValue(value){
    return String(value??'')
        .replace(/\\/g,'\\\\')
        .replace(/'/g,"\\'");
}

/*
 * 선생님 전용 P 플로팅 버튼
 */
function createBatchPointButton(){
    const existingBtn=document.getElementById('floating-batch-btn');

    if(existingBtn)existingBtn.remove();

    const isUserAdmin=
        typeof isAdmin!=='undefined'&&
        isAdmin;

    if(!isUserAdmin)return;

    const btn=document.createElement('button');

    btn.id='floating-batch-btn';
    btn.type='button';
    btn.innerHTML='P';

    btn.style.cssText=`
        position:fixed;
        bottom:35px;
        right:35px;
        width:75px;
        height:75px;
        border-radius:50%;
        background-color:#8e44ad;
        color:white;
        border:none;
        box-shadow:0 6px 15px rgba(0,0,0,0.35);
        font-weight:900;
        font-size:2rem;
        cursor:pointer;
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
    `;

    btn.onclick=function(e){
        e.preventDefault();
        e.stopPropagation();

        if(typeof window.openBatchPointModal==='function'){
            window.openBatchPointModal();
        }else{
            alert('포인트 지급 기능을 불러오지 못했습니다.');
        }
    };

    document.body.appendChild(btn);
}

/*
 * 관리자 학생 상세정보
 */
window.openPointPopupForUser=function(userName){
    if(typeof isAdmin==='undefined'||!isAdmin){
        return;
    }

    db.ref('users').once('value').then(snapshot=>{
        let targetUser=null;
        let targetKey=null;

        snapshot.forEach(child=>{
            const data=child.val()||{};
            const name=data.name||child.key;

            if(
                name===userName||
                child.key===userName
            ){
                targetUser={
                    ...data,
                    name:name
                };

                targetKey=child.key;
            }
        });

        if(!targetUser){
            alert('학생 정보를 찾을 수 없습니다.');
            return;
        }

        const popup=document.getElementById('point-popup');
        const titleEl=document.getElementById('point-pop-title');
        const bodyEl=document.getElementById('point-pop-body');
        const applyBtn=document.getElementById('point-apply-btn');

        if(!popup||!bodyEl){
            alert('학생 상세정보 팝업 구조를 찾을 수 없습니다.');
            return;
        }

        const lv=
            parseInt(targetUser.level)||
            parseInt(targetUser.lv)||
            1;

        const points=parseInt(targetUser.points)||0;
        const exp=parseInt(targetUser.exp)||0;

        if(titleEl){
            titleEl.innerHTML=`🛡️ ${escapeHeroHtml(userName)} 용사 정보`;
        }

        bodyEl.innerHTML=`
            <div style="text-align:center;margin-bottom:15px;">
                ${getAvatar(lv,targetUser.animal||targetUser.selectedAnimal)}
            </div>

            <div style="background:#f8f9fa;border-radius:10px;padding:15px;margin-bottom:15px;text-align:center;">
                <div style="font-size:1.3rem;font-weight:bold;margin-bottom:8px;">
                    ${escapeHeroHtml(userName)}
                </div>
                <div style="font-size:1.1rem;">
                    레벨:${lv}
                </div>
                <div style="font-size:1.1rem;">
                    포인트:${points}P
                </div>
                <div style="font-size:1.1rem;">
                    경험치:${exp}E
                </div>
            </div>

            <div>
                <input
                    type="text"
                    id="pop-reason"
                    placeholder="사유"
                    style="width:100%;padding:10px;margin-bottom:10px;box-sizing:border-box;"
                >

                <div style="display:flex;gap:10px;">
                    <input
                        type="number"
                        id="pop-p"
                        placeholder="P 증감"
                        style="width:50%;padding:8px;box-sizing:border-box;"
                    >

                    <input
                        type="number"
                        id="pop-e"
                        placeholder="E 증감"
                        style="width:50%;padding:8px;box-sizing:border-box;"
                    >
                </div>
            </div>
        `;

        if(applyBtn){
            applyBtn.style.display='block';

            applyBtn.onclick=function(){
                applyUserScore(
                    targetKey||userName,
                    lv
                );
            };
        }

        popup.style.display='flex';
    }).catch(error=>{
        console.error('학생 상세정보 오류:',error);
        alert('학생 정보를 불러오는 중 오류가 발생했습니다.');
    });
};

/*
 * 학생용 친구 방
 */
window.openFriendRoom=function(userName){
    if(typeof isAdmin!=='undefined'&&isAdmin){
        return;
    }

    if(typeof showTab==='function'){
        showTab('housing');
    }

    if(typeof loadSpecificUserRoom==='function'){
        loadSpecificUserRoom(userName);
    }else{
        alert(`${userName} 용사의 방으로 이동합니다.`);
    }
};
