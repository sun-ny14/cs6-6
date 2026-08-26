// js/hero-mgr.js
// 용사 목록 / 육육이 아바타 / 친구방 / 관리자 학생 상세정보

/* =========================================================
   육육이 아바타
   ========================================================= */

window.AVATAR_NAMES = [
    "귀여운", "신사", "사랑스러운", "패셔니스타", "밥먹는",
    "날쌘돌이", "즐거운", "행복한", "정의로운", "천사",
    "닌자", "왕자", "공주", "근육맨", "마법사",
    "용사", "공부하는", "춤추는", "노래하는", "무지개"
];

function getAvatar(lv, selectedAnimal) {
    const githubImageUrl =
        "https://github.com/sun-ny14/cs6-6/blob/main/%EC%9C%A1%EC%9C%A1%EC%9D%B4.png?raw=true";

    const animals = window.AVATAR_NAMES;

    const level = parseInt(lv) || 1;

    const name =
        selectedAnimal ||
        animals[Math.min(Math.max(level - 1, 0), 19)];

    const index =
        animals.indexOf(name) === -1
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

window.openAvatarPicker = function() {
    if (!window.myName) return;

    const options = window.AVATAR_NAMES.map(name => `
        <button onclick="selectAvatar(${JSON.stringify(name)})"
            style="background:white;border:2px solid #ddd;border-radius:12px;padding:10px;cursor:pointer;">
            ${getAvatar(1, name)}
            <span style="display:block;margin-top:5px;font-weight:bold;">${name}</span>
        </button>
    `).join('');

    openPopup('모습 변경', `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;max-height:60vh;overflow:auto;">
            ${options}
        </div>
    `);
};

window.selectAvatar = async function(name) {
    if (!window.AVATAR_NAMES.includes(name) || !window.myName) return;
    await db.ref(`users/${window.myName}`).update({ selectedAnimal:name });
    closePopup();
};


/* =========================================================
   관리자 여부
   ========================================================= */

function heroIsAdmin() {
    return (
        typeof isAdmin !== "undefined" &&
        isAdmin === true
    );
}


/* =========================================================
   용사 목록
   ========================================================= */

window.renderHeroes = function(usersFromListener) {
    const heroGrid =
        document.getElementById("hero-grid");

    if (!heroGrid) return;


    /*
     * users 리스너에서 전달받은 데이터가 있으면 사용.
     * 없으면 Firebase에서 직접 가져온다.
     */

    if (usersFromListener && Array.isArray(usersFromListener)) {
        drawHeroes(usersFromListener);
        return;
    }


    /*
     * currentUsers가 이미 있으면 바로 그림
     */

    if (
        typeof currentUsers !== "undefined" &&
        Array.isArray(currentUsers) &&
        currentUsers.length > 0
    ) {
        drawHeroes(currentUsers);
        return;
    }


    /*
     * 로그인 직후 currentUsers가 아직 없을 경우
     */

    db.ref("users").once("value").then(snapshot => {
        const users = [];

        snapshot.forEach(child => {
            const user = child.val() || {};

            user.name = child.key;

            users.push(user);
        });

        drawHeroes(users);
    });
};


/* =========================================================
   실제 카드 생성
   ========================================================= */

function drawHeroes(usersArray) {
    const heroGrid =
        document.getElementById("hero-grid");

    if (!heroGrid) return;


    const isAdminUser = heroIsAdmin();


    const filteredUsers =
        usersArray.filter(user => {
            if (!user) return false;

            const name =
                user.name || "";

            /*
             * 총사령관 / 선생님 계정은 학생 용사 목록에서 제외
             */
            if (name === "총사령관") return false;
            if (name.includes("선생님")) return false;

            if (
                typeof adminEmail !== "undefined" &&
                user.email === adminEmail
            ) {
                return false;
            }

            return true;
        });


    filteredUsers.sort((a, b) => {
        const aNo =
            parseInt(a.number || a.no) || 999;

        const bNo =
            parseInt(b.number || b.no) || 999;

        return aNo - bNo;
    });


    let html = "";


    filteredUsers.forEach(user => {
        const name =
            user.name || "용사";

        const lv =
            parseInt(user.level || user.lv) || 1;

        const number =
            user.number ||
            user.no ||
            "";

        const role =
            user.role ||
            (user.isHelper ? "상점" : "일반");


        const isMySelf =
            typeof myName !== "undefined" &&
            user.name === myName;


        /*
         * -------------------------------------------------
         * 클릭 동작
         * -------------------------------------------------
         *
         * 관리자:
         *   학생 상세정보
         *
         * 학생:
         *   본인 -> 자기 프로필
         *   다른 학생 -> 친구 방
         */

        const encodedName =
    encodeURIComponent(name)
        .replace(/'/g, "%27");

const clickAction =
    `openUserHistory(decodeURIComponent('${encodedName}'))`;

        /*
         * -------------------------------------------------
         * 포인트 표시
         * -------------------------------------------------
         *
         * 관리자:
         *   모든 학생 포인트 표시
         *
         * 학생:
         *   자기 포인트만 표시
         *   친구 포인트는 절대 표시하지 않음
         */

        let pointsHtml = "";


        if (isAdminUser || isMySelf) {
            pointsHtml = `
                <div style="
                    display:inline-block;
                    background:#444;
                    color:#ffd700;
                    border-radius:8px;
                    padding:4px 10px;
                    margin-top:8px;
                    font-weight:bold;
                ">
                    🪙 ${user.points || 0} P
                </div>
            `;
        } else {
            /*
             * 친구 카드에는 포인트 HTML 자체를 만들지 않는다.
             */
            pointsHtml = "";
        }


        /*
         * 경험치 역시 관리자 또는 본인만 표시
         */

        let expHtml = "";

        if (isAdminUser || isMySelf) {
            expHtml = `
                <div style="
                    font-size:0.85rem;
                    color:#666;
                    margin-top:5px;
                ">
                    EXP ${user.exp || 0}
                </div>
            `;
        }


        html += `
            <div
                class="card hero-card-item"
                style="
                    text-align:center;
                    cursor:pointer;
                    background:white;
                    border-radius:20px;
                    padding:20px;
                    box-shadow:0 4px 15px rgba(0,0,0,0.1);
                    position:relative;
                "
                onclick="${clickAction}"
            >

                <div style="
                    position:absolute;
                    top:0;
                    left:0;
                    background:#bdc3c7;
                    color:white;
                    padding:4px 10px;
                    border-radius:0 0 10px 0;
                    font-weight:bold;
                ">
                    Lv.${lv}
                </div>

                ${getAvatar(
                    lv,
                    user.animal ||
                    user.selectedAnimal
                )}

                <h3 style="
                    margin-top:10px;
                    color:var(--dark,#2c3e50);
                ">
                    ${number ? number + ". " : ""}${name}
                </h3>

                ${pointsHtml}

                ${expHtml}

                <p style="
                    font-size:0.9rem;
                    color:#666;
                    margin-bottom:0;
                ">
                    역할: ${role}
                </p>

            </div>
        `;
    });


    heroGrid.innerHTML =
        html ||
        `
            <p style="
                text-align:center;
                color:#666;
                padding:30px;
            ">
                등록된 용사가 없습니다.
            </p>
        `;


    /*
     * 관리자에게만 P 버튼
     */

    createFloatingPointButton();
}


/* =========================================================
   관리자용 P 플로팅 버튼
   ========================================================= */

function createFloatingPointButton() {
    const old =
        document.getElementById("floating-point-btn-box");

    if (old) {
        old.remove();
    }


    if (!heroIsAdmin()) {
        return;
    }


    const box =
        document.createElement("div");

    box.id =
        "floating-point-btn-box";

    box.style.cssText = `
        position:fixed;
        bottom:35px;
        right:35px;
        z-index:99999;
    `;


    const button =
        document.createElement("button");

    button.type =
        "button";

    button.innerText =
        "P";

    button.style.cssText = `
        width:75px;
        height:75px;
        border-radius:50%;
        border:none;
        background:#8e44ad;
        color:white;
        font-weight:900;
        font-size:2rem;
        cursor:pointer;
        box-shadow:0 6px 15px rgba(0,0,0,0.35);
    `;


    button.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (
            typeof openBatchPointModal === "function"
        ) {
            openBatchPointModal();
        } else {
            alert(
                "차등 지급 기능을 불러오지 못했습니다."
            );
        }
    };


    box.appendChild(button);
    document.body.appendChild(box);
}


/* =========================================================
   관리자 학생 상세정보
   ========================================================= */

window.openStudentProfile = function(userName) {
    if (!heroIsAdmin()) {
        return;
    }


    db.ref("users").once("value").then(snapshot => {
        let targetUser = null;
        let targetKey = null;


        snapshot.forEach(child => {
            const data =
                child.val() || {};

            /*
             * Firebase key가 이름인 기존 구조
             */
            const name =
                data.name || child.key;

            if (name === userName) {
                targetUser = data;
                targetKey = child.key;
            }
        });


        if (!targetUser) {
            alert("학생 정보를 찾을 수 없습니다.");
            return;
        }


        const popup =
            document.getElementById("point-popup");

        const titleEl =
            document.getElementById("point-pop-title");

        const bodyEl =
            document.getElementById("point-pop-body");

        const applyBtn =
            document.getElementById("point-apply-btn");


        if (!popup || !bodyEl) {
            alert(
                "학생 상세정보 팝업을 찾을 수 없습니다."
            );
            return;
        }


        const level =
            parseInt(
                targetUser.level ||
                targetUser.lv
            ) || 1;


        const animal =
            targetUser.animal ||
            targetUser.selectedAnimal;


        if (titleEl) {
            titleEl.innerText =
                `🛡️ ${userName} 용사 정보`;
        }


        bodyEl.innerHTML = `
            <div style="
                text-align:center;
                margin-bottom:15px;
            ">
                ${getAvatar(level, animal)}

                <h2 style="
                    margin:10px 0 5px;
                ">
                    ${userName}
                </h2>

                <div style="
                    font-size:1.1rem;
                    font-weight:bold;
                ">
                    Lv.${level}
                </div>
            </div>

            <div style="
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:10px;
                margin-bottom:15px;
            ">

                <div style="
                    background:#f8f9fa;
                    padding:12px;
                    border-radius:8px;
                    text-align:center;
                ">
                    <div style="
                        color:#777;
                        font-size:0.9rem;
                    ">
                        포인트
                    </div>
                    <b style="
                        color:#8e44ad;
                        font-size:1.3rem;
                    ">
                        ${targetUser.points || 0} P
                    </b>
                </div>

                <div style="
                    background:#f8f9fa;
                    padding:12px;
                    border-radius:8px;
                    text-align:center;
                ">
                    <div style="
                        color:#777;
                        font-size:0.9rem;
                    ">
                        경험치
                    </div>
                    <b style="
                        color:#3498db;
                        font-size:1.3rem;
                    ">
                        ${targetUser.exp || 0} E
                    </b>
                </div>

            </div>

            <input
                type="text"
                id="pop-reason"
                placeholder="포인트/경험치 변경 사유"
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
                    placeholder="EXP 증감"
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
            applyBtn.style.display =
                "block";

            applyBtn.onclick =
                function() {
                    applyUserScore(
                        userName,
                        targetUser,
                        targetKey
                    );
                };
        }


        popup.style.display =
            "flex";
    });
};


/* =========================================================
   관리자 학생 점수 반영
   ========================================================= */

window.applyUserScore = async function(
    userName,
    oldUserData,
    userKey
) {
    if (!heroIsAdmin()) {
        return;
    }


    const reasonEl =
        document.getElementById("pop-reason");

    const pEl =
        document.getElementById("pop-p");

    const eEl =
        document.getElementById("pop-e");


    const reason =
        reasonEl
            ? reasonEl.value.trim()
            : "";


    if (!reason) {
        alert("사유를 입력해주세요.");
        return;
    }


    const pAmount =
        pEl && pEl.value !== ""
            ? parseInt(pEl.value)
            : 0;


    const eAmount =
        eEl && eEl.value !== ""
            ? parseInt(eEl.value)
            : 0;


    if (isNaN(pAmount) || isNaN(eAmount)) {
        alert("포인트와 경험치는 숫자로 입력해주세요.");
        return;
    }


    if (pAmount === 0 && eAmount === 0) {
        alert(
            "포인트 또는 경험치 중 하나는 입력해주세요."
        );
        return;
    }


    if (
        !confirm(
            `[${userName}] 학생에게\n` +
            `포인트 ${pAmount >= 0 ? "+" : ""}${pAmount}P\n` +
            `경험치 ${eAmount >= 0 ? "+" : ""}${eAmount}E\n` +
            `를 적용하시겠습니까?`
        )
    ) {
        return;
    }


    try {
        const userRef =
            db.ref(`users/${userKey}`);


        const currentPoints =
            parseInt(oldUserData.points) || 0;

        const currentExp =
            parseInt(oldUserData.exp) || 0;


        const newPoints =
            currentPoints + pAmount;

        const newExp =
            currentExp + eAmount;


        const updates = {};


        updates[`users/${userKey}/points`] =
            newPoints;

        updates[`users/${userKey}/exp`] =
            newExp;


        /*
         * 기존 pointHistory 구조 유지
         */

        if (pAmount !== 0) {
            const historyKey =
                db.ref(
                    `pointHistory/${userKey}`
                ).push().key;

            updates[
                `pointHistory/${userKey}/${historyKey}`
            ] = {
                date: getTodayKST(),
                time: new Date().toLocaleTimeString(
                    "ko-KR",
                    {
                        hour:"2-digit",
                        minute:"2-digit"
                    }
                ),
                reason: reason,
                change: pAmount,
                result: newPoints
            };
        }


        /*
         * 기존 pointLogs 구조도 유지
         * point-guide.js와 연결
         */

        if (pAmount !== 0) {
            const logKey =
                db.ref("pointLogs").push().key;

            updates[
                `pointLogs/${logKey}`
            ] = {
                name: userName,
                pAmt: pAmount,
                reason: reason,
                time: new Date().toLocaleString(
                    "ko-KR"
                )
            };
        }


        await db.ref().update(updates);


        alert(
            "✅ 학생 정보가 성공적으로 반영되었습니다."
        );


        if (
            typeof closePointPopup === "function"
        ) {
            closePointPopup();
        }


        renderHeroes();

    } catch (error) {
        console.error(
            "학생 점수 반영 오류:",
            error
        );

        alert(
            "반영 중 오류가 발생했습니다."
        );
    }
};


/* =========================================================
   학생 본인 프로필
   ========================================================= */

window.openOwnStudentProfile = function(userName) {
    /*
     * 학생은 관리자용 포인트 수정 팝업을 열 수 없다.
     * 기존 학생 프로필 함수가 있으면 우선 사용한다.
     */

    if (
        typeof openStudentProfileModal === "function"
    ) {
        openStudentProfileModal(userName);
        return;
    }


    /*
     * 기존에 학생 프로필 함수가 없다면
     * 자기 방으로 이동한다.
     */

    if (
        typeof showTab === "function"
    ) {
        showTab("housing");
    }

    if (
        typeof loadSpecificUserRoom === "function"
    ) {
        loadSpecificUserRoom(userName);
    }
};


/* =========================================================
   친구 방
   ========================================================= */

window.openFriendRoom = function(userName) {
    /*
     * 학생에게 다른 학생의 점수 정보는 전달하지 않는다.
     * 친구 방 기능만 실행한다.
     */

    if (
        typeof showTab === "function"
    ) {
        showTab("housing");
    }


    if (
        typeof loadSpecificUserRoom === "function"
    ) {
        loadSpecificUserRoom(userName);
    } else {
        alert(
            `${userName} 용사의 방으로 이동합니다.`
        );
    }
};


/* =========================================================
   이전 코드와의 호환
   ========================================================= */

window.openPointPopupForUser =
    function(userName) {
        openStudentProfile(userName);
    };


/* =========================================================
   팝업 닫기
   ========================================================= */

window.closePointPopup =
    function() {
        const popup =
            document.getElementById("point-popup");

        if (popup) {
            popup.style.display =
                "none";
        }
    };
