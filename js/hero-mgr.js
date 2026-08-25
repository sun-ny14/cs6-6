// js/hero-mgr.js
// 용사 목록, 육육이 아바타, 친구 방, 교사용 학생 상세정보

function initApp() {
    if (typeof currentTab !== 'undefined' && typeof showTab === 'function') {
        showTab(currentTab);
    }
    renderHeroes();
}


// =====================================================
// 육육이 아바타
// =====================================================

function getAvatar(lv, selectedAnimal) {
    const githubImageUrl = "https://github.com/sun-ny14/cs6-6/blob/main/%EC%9C%A1%EC%9C%A1%EC%9D%B4.png?raw=true";

    const animals = [
        "귀여운",
        "신사",
        "사랑스러운",
        "패셔니스타",
        "밥먹는",
        "날쌘돌이",
        "즐거운",
        "행복한",
        "정의로운",
        "천사",
        "닌자",
        "왕자",
        "공주",
        "근육맨",
        "마법사",
        "용사",
        "공부하는",
        "춤추는",
        "노래하는",
        "무지개"
    ];

    const level = parseInt(lv) || 1;
    const name = selectedAnimal || animals[Math.min(Math.max(level - 1, 0), 19)];

    const index = animals.indexOf(name) === -1
        ? 0
        : animals.indexOf(name);

    const col = index % 5;
    const row = Math.floor(index / 5);

    const posX = col * 25;
    const posY = row * 33.33;

    return `
        <div style="
            width:70px;
            height:70px;
            overflow:hidden;
            border-radius:50%;
            background:white;
            margin:0 auto;
            display:flex;
            align-items:center;
            justify-content:center;
            position:relative;
            box-shadow:0 2px 5px rgba(0,0,0,0.1);
        ">
            <div style="
                width:100%;
                height:100%;
                background-image:url('${githubImageUrl}');
                background-size:500% 400%;
                background-position:${posX}% ${posY}%;
                background-repeat:no-repeat;
                image-rendering:pixelated;
                transform:scale(1.15);
                transform-origin:center;
            "></div>
        </div>
    `;
}


// =====================================================
// 용사 목록
// =====================================================

window.renderHeroes = async function() {
    const heroGrid = document.getElementById('hero-grid');

    if (!heroGrid) {
        console.warn('hero-grid를 찾을 수 없습니다.');
        return;
    }

    try {
        const snapshot = await db.ref('users').once('value');

        const usersData = snapshot.val() || {};
        const usersArray = [];

        Object.keys(usersData).forEach(key => {
            const user = usersData[key];

            if (!user) return;

            const name = user.name || key;

            // 선생님 / 총사령관 제외
            if (name === '총사령관') return;
            if (name.includes('선생님')) return;

            // 관리자 계정 이메일 제외
            if (
                typeof adminEmail !== 'undefined' &&
                user.email &&
                user.email === adminEmail
            ) {
                return;
            }

            usersArray.push({
                key: key,
                ...user,
                name: name
            });
        });


        usersArray.sort((a, b) => {
            const aNo = parseInt(a.number || a.no) || 999;
            const bNo = parseInt(b.number || b.no) || 999;

            return aNo - bNo;
        });


        const isUserAdmin =
            typeof isAdmin !== 'undefined' &&
            isAdmin === true;


        heroGrid.innerHTML = '';


        if (usersArray.length === 0) {
            heroGrid.innerHTML = `
                <p style="
                    text-align:center;
                    color:#666;
                    padding:30px;
                ">
                    등록된 용사가 없습니다.
                </p>
            `;
        }


        usersArray.forEach(user => {
            const name = user.name || '용사';

            const lv =
                parseInt(user.level || user.lv) || 1;

            const number =
                user.number || user.no || '';

            const role =
                user.role ||
                (user.isHelper ? '상점' : '일반');

            const isMySelf =
                typeof myName !== 'undefined' &&
                user.name === myName;


            // -----------------------------------------
            // 학생에게 다른 학생의 포인트 숨기기
            // -----------------------------------------

            let pointsHtml = '';

            if (isUserAdmin || isMySelf) {
                pointsHtml = `
                    <div style="
                        display:inline-block;
                        background:#4b4b4b;
                        color:#ffd700;
                        border-radius:8px;
                        padding:5px 10px;
                        margin-top:8px;
                        font-size:0.95rem;
                        font-weight:bold;
                    ">
                        🪙 ${user.points || 0} P
                    </div>
                `;
            } else {
                pointsHtml = '';
            }


            // -----------------------------------------
            // 카드
            // -----------------------------------------

            const card = document.createElement('div');

            card.className =
                'card hero-card-item';

            card.style.cssText = `
                text-align:center;
                cursor:pointer;
                background:white;
                border-radius:20px;
                padding:20px;
                box-shadow:0 4px 15px rgba(0,0,0,0.1);
                transition:transform 0.15s, box-shadow 0.15s;
            `;


            card.innerHTML = `
                <div>
                    ${getAvatar(
                        lv,
                        user.selectedAnimal || user.animal
                    )}
                </div>

                <h3 style="
                    margin-top:10px;
                    color:var(--dark);
                ">
                    ${number ? number + '. ' : ''}${name}
                </h3>

                <div style="
                    font-weight:bold;
                    color:#555;
                    margin:5px 0;
                ">
                    Lv.${lv}
                </div>

                ${pointsHtml}

                <p style="
                    font-size:0.9rem;
                    color:#666;
                    margin-bottom:0;
                ">
                    역할: ${role}
                </p>
            `;


            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-3px)';
                card.style.boxShadow =
                    '0 7px 20px rgba(0,0,0,0.15)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow =
                    '0 4px 15px rgba(0,0,0,0.1)';
            });


            // -----------------------------------------
            // 클릭 동작
            // -----------------------------------------

            card.addEventListener('click', () => {

                if (isUserAdmin) {
                    openPointPopupForUser(
                        user.key,
                        user
                    );
                } else {
                    openFriendRoom(name);
                }

            });


            heroGrid.appendChild(card);
        });


        // ---------------------------------------------
        // 관리자 전용 P 버튼
        // ---------------------------------------------

        createBatchPointButton();


    } catch (error) {
        console.error('용사 목록 불러오기 오류:', error);

        heroGrid.innerHTML = `
            <p style="
                text-align:center;
                color:#e74c3c;
                padding:30px;
            ">
                용사 목록을 불러오는 중 오류가 발생했습니다.
            </p>
        `;
    }
};


// =====================================================
// 교사용 학생 상세정보
// =====================================================

window.openPointPopupForUser = async function(userKey, userData) {

    if (
        typeof isAdmin === 'undefined' ||
        !isAdmin
    ) {
        return;
    }


    let targetUser = userData;


    // 데이터가 직접 넘어오지 않았을 경우 Firebase에서 조회
    if (!targetUser) {

        const snap =
            await db.ref(`users/${userKey}`).once('value');

        if (!snap.exists()) {
            alert('학생 정보를 찾을 수 없습니다.');
            return;
        }

        targetUser = snap.val();
    }


    const userName =
        targetUser.name || userKey;

    const level =
        parseInt(targetUser.level || targetUser.lv) || 1;

    const points =
        parseInt(targetUser.points) || 0;

    const exp =
        parseInt(targetUser.exp) || 0;


    const popup =
        document.getElementById('point-popup');

    const titleEl =
        document.getElementById('point-pop-title');

    const bodyEl =
        document.getElementById('point-pop-body');

    const applyBtn =
        document.getElementById('point-apply-btn');


    if (!popup || !bodyEl) {
        alert('학생 상세정보 팝업을 찾을 수 없습니다.');
        return;
    }


    if (titleEl) {
        titleEl.innerHTML =
            `🛡️ ${userName} 용사 정보`;
    }


    bodyEl.innerHTML = `
        <div style="
            text-align:center;
            margin-bottom:15px;
        ">
            ${getAvatar(
                level,
                targetUser.selectedAnimal || targetUser.animal
            )}
        </div>

        <div style="
            background:#f8f9fa;
            border-radius:10px;
            padding:15px;
            margin-bottom:15px;
            text-align:center;
        ">
            <div style="
                font-size:1.2rem;
                font-weight:bold;
                margin-bottom:8px;
            ">
                ${userName}
            </div>

            <div>
                레벨: <b>Lv.${level}</b>
            </div>

            <div>
                현재 포인트:
                <b style="color:#e67e22;">
                    ${points}P
                </b>
            </div>

            <div>
                현재 경험치:
                <b style="color:#3498db;">
                    ${exp}E
                </b>
            </div>
        </div>

        <input
            type="text"
            id="pop-reason"
            placeholder="포인트/경험치 지급 사유"
            style="
                width:100%;
                padding:10px;
                margin-bottom:10px;
                box-sizing:border-box;
                border:1px solid #ccc;
                border-radius:8px;
            "
        >

        <div style="
            display:flex;
            gap:10px;
        ">
            <input
                type="number"
                id="pop-p"
                placeholder="P 증감"
                style="
                    width:50%;
                    padding:10px;
                    box-sizing:border-box;
                    border:1px solid #ccc;
                    border-radius:8px;
                "
            >

            <input
                type="number"
                id="pop-e"
                placeholder="E 증감"
                style="
                    width:50%;
                    padding:10px;
                    box-sizing:border-box;
                    border:1px solid #ccc;
                    border-radius:8px;
                "
            >
        </div>
    `;


    if (applyBtn) {

        applyBtn.style.display = 'block';

        applyBtn.onclick = async function() {

            if (
                typeof applyUserScore === 'function'
            ) {
                await applyUserScore(
                    userName,
                    level
                );
            } else {
                alert(
                    '포인트 반영 함수(applyUserScore)를 찾을 수 없습니다.'
                );
            }

        };
    }


    popup.style.display = 'flex';
};


// =====================================================
// 학생 → 친구 방
// =====================================================

window.openFriendRoom = function(userName) {

    if (!userName) return;


    if (typeof showTab === 'function') {
        showTab('housing');
    }


    if (
        typeof loadSpecificUserRoom === 'function'
    ) {
        loadSpecificUserRoom(userName);
    } else {
        alert(
            `${userName} 용사의 방 기능을 찾을 수 없습니다.`
        );
    }
};


// =====================================================
// 관리자 전용 P 플로팅 버튼
// =====================================================

window.createBatchPointButton = function() {

    const old =
        document.getElementById('floating-point-btn-box');

    if (old) {
        old.remove();
    }


    const isUserAdmin =
        typeof isAdmin !== 'undefined' &&
        isAdmin === true;


    if (!isUserAdmin) {
        return;
    }


    const floatingBox =
        document.createElement('div');

    floatingBox.id =
        'floating-point-btn-box';

    floatingBox.style.cssText = `
        position:fixed;
        bottom:35px;
        right:35px;
        z-index:99999;
    `;


    const button =
        document.createElement('button');

    button.innerText = 'P';

    button.style.cssText = `
        background:#8e44ad;
        color:white;
        border:none;
        width:75px;
        height:75px;
        border-radius:50%;
        font-weight:900;
        font-size:2rem;
        cursor:pointer;
        box-shadow:0 6px 15px rgba(0,0,0,0.35);
        display:flex;
        align-items:center;
        justify-content:center;
    `;


    button.onclick = function() {

        if (
            typeof openBatchPointModal === 'function'
        ) {
            openBatchPointModal();
        } else {
            alert(
                '차등 포인트 지급 기능을 찾을 수 없습니다.'
            );
        }

    };


    floatingBox.appendChild(button);

    document.body.appendChild(floatingBox);
};
