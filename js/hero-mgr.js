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

function getAvatar(lv, selectedAnimal, size) {
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


    const avatarSize =
        Math.max(56, parseInt(size, 10) || 86);

    return `
        <div class="hero-avatar-frame" style="
            width:${avatarSize}px;
            height:${avatarSize}px;
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

/* global.js의 상세 팝업에서도 같은 스프라이트를 사용한다. */
window.getAvatar = getAvatar;

/* 레벨별 기본 칭호. 기존 프로젝트에서 같은 변수를 정의하면 그 설정을 우선 사용한다. */
window.HERO_TITLE_LEVELS = window.HERO_TITLE_LEVELS || [
    { level:1,  name:"모험가" },
    { level:3,  name:"견습 용사" },
    { level:5,  name:"용감한 용사" },
    { level:7,  name:"정예 용사" },
    { level:10, name:"빛나는 용사" },
    { level:12, name:"왕국 수호자" },
    { level:15, name:"전설의 용사" },
    { level:20, name:"마스터 용사" }
];

function heroEscape(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function heroNormalizeName(value) {
    return String(value == null ? "" : value)
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .trim();
}

function heroUserLevel(user) {
    return Math.max(
        1,
        parseInt(user && (user.level || user.lv), 10) || 1
    );
}

function heroUnlockedAnimals(level) {
    return window.AVATAR_NAMES.slice(
        0,
        Math.min(window.AVATAR_NAMES.length, Math.max(1, level))
    );
}

function heroUnlockedTitles(user, level) {
    const savedLists = [
        user && user.unlockedTitles,
        user && user.earnedTitles,
        user && user.titles
    ];

    const saved = savedLists.find(Array.isArray) || [];
    const byLevel = window.HERO_TITLE_LEVELS
        .filter(item => level >= item.level)
        .map(item => item.name);

    return Array.from(
        new Set(
            byLevel
                .concat(saved)
                .filter(Boolean)
                .map(String)
        )
    );
}

function heroFindUser(userName) {
    const listed=Array.isArray(window.currentUsers)
        ?window.currentUsers.find(user=>heroNormalizeName(user?.name)===heroNormalizeName(userName))
        :null;
    const userKey=String(listed?.__firebaseKey||window.myName||userName||'').trim();
    if(!userKey)return Promise.resolve(null);

    // 학생은 /users 전체를 읽을 권한이 없고 자기 레코드만 읽을 수 있다.
    return db.ref(`users/${userKey}`).once('value').then(snapshot=>{
        if(!snapshot.exists())return null;
        const user=snapshot.val()||{};
        return {key:snapshot.key,data:Object.assign({},user,{name:user.name||userName||snapshot.key})};
    });
}

function ensureHeroProfileEditorStyle() {
    if (document.getElementById("hero-profile-editor-style")) return;

    const style = document.createElement("style");
    style.id = "hero-profile-editor-style";
    style.textContent = `
        #hero-profile-editor-overlay {
            position: fixed;
            inset: 0;
            z-index: 2147483000;
            display: grid;
            place-items: center;
            padding: 22px;
            background: rgba(14, 24, 34, .55);
            backdrop-filter: blur(3px);
        }
        #hero-profile-editor-overlay * { box-sizing: border-box; }
       #hero-profile-editor-overlay .hpe-dialog {
    display: flex;
    flex-direction: column;
    width: min(960px, 96vw);
    height: min(850px, 94vh);
    max-height: min(850px, 94vh);
    overflow: hidden;
    border: 1px solid var(--ui-gold-line);
    border-radius: 24px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow-lg);
}
        #hero-profile-editor-overlay .hpe-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            min-height: 76px;
            padding: 16px 22px;
            color: var(--ui-text);
            background: var(--ui-gold-soft);
            border-bottom: 1px solid var(--ui-gold-line);
        }
        #hero-profile-editor-overlay .hpe-head h2 {
            margin: 0;
            font-family: var(--ui-font-display);
            font-size: var(--ui-subtitle-size);
            font-weight: 900;
        }
        #hero-profile-editor-overlay .hpe-close {
            width: 44px;
            min-width: 44px;
            min-height: 44px;
            padding: 0;
            color: var(--ui-text);
            background: var(--ui-surface);
            border: 1px solid var(--ui-line);
            border-radius: 12px;
            font-size: var(--ui-subtitle-size);
            line-height: 1;
            cursor: pointer;
        }
        #hero-profile-editor-overlay .hpe-body {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    min-height: 0;
    max-height: calc(94vh - 76px);
    overflow: hidden;
}
        #hero-profile-editor-overlay .hpe-preview {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 34px 25px 28px;
            text-align: center;
            background: linear-gradient(160deg, var(--ui-surface), var(--ui-gold-soft));
            border-right: 1px solid var(--ui-gold-line);
        }
        #hero-profile-editor-overlay .hpe-avatar-stage {
            display: grid;
            place-items: center;
            width: 184px;
            height: 184px;
            margin-bottom: 20px;
            background: var(--ui-surface);
            border: 5px solid var(--ui-gold);
            border-radius: 34px;
            box-shadow: var(--ui-shadow);
        }
        #hero-profile-editor-overlay .hpe-preview h3 {
            margin: 0 0 8px;
            color: var(--ui-text);
            font-family: var(--ui-font-display);
            font-size: var(--ui-title-size);
            font-weight: 900;
        }
        #hero-profile-editor-overlay .hpe-preview-title {
            margin: 0 0 18px;
            color: var(--ui-gold);
            font-size: var(--ui-text-size);
            font-weight: 800;
        }
        #hero-profile-editor-overlay .hpe-level {
            display: inline-flex;
            align-items: center;
            min-height: 38px;
            padding: 7px 14px;
            color: var(--ui-on-accent);
            background: var(--ui-accent);
            border-radius: 999px;
            font-size: var(--ui-text-size);
            font-weight: 850;
        }
        #hero-profile-editor-overlay .hpe-selectors {
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 26px 26px 20px;
}
        #hero-profile-editor-overlay .hpe-section + .hpe-section {
            margin-top: 28px;
        }
        #hero-profile-editor-overlay .hpe-section h3 {
            margin: 0 0 6px;
            color: var(--ui-text);
            font-family: var(--ui-font-display);
            font-size: var(--ui-heading-size);
            font-weight: 900;
        }
        #hero-profile-editor-overlay .hpe-help {
            margin: 0 0 14px;
            color: var(--ui-muted);
            font-size: var(--ui-text-size);
            line-height: 1.55;
        }
        #hero-profile-editor-overlay .hpe-avatar-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
            gap: 12px;
        }
        #hero-profile-editor-overlay .hpe-avatar-option {
            position: relative;
            min-height: 130px;
            padding: 12px 8px 10px;
            color: var(--ui-text);
            background: var(--ui-surface);
            border: 2px solid var(--ui-line);
            border-radius: 16px;
            font-size: var(--ui-small-size);
            font-weight: 800;
            cursor: pointer;
        }
        #hero-profile-editor-overlay .hpe-avatar-option.is-selected {
            border-color: var(--ui-gold);
            background: var(--ui-gold-soft);
            box-shadow: 0 0 0 3px var(--ui-gold-soft);
        }
        #hero-profile-editor-overlay .hpe-avatar-option:disabled {
            cursor: not-allowed;
            opacity: .42;
            filter: grayscale(.8);
        }
        #hero-profile-editor-overlay .hpe-avatar-name {
            display: block;
            margin-top: 7px;
        }
        #hero-profile-editor-overlay .hpe-lock-level {
            position: absolute;
            top: 7px;
            right: 7px;
            padding: 3px 6px;
            color: var(--ui-on-accent);
            background: var(--ui-muted);
            border-radius: 6px;
            font-size: var(--ui-tiny-size);
        }
        #hero-profile-editor-overlay .hpe-title-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        #hero-profile-editor-overlay .hpe-title-option {
            min-height: 44px;
            padding: 9px 15px;
            color: var(--ui-text);
            background: var(--ui-surface);
            border: 2px solid var(--ui-line);
            border-radius: 999px;
            font-size: var(--ui-text-size);
            font-weight: 850;
            cursor: pointer;
        }
        #hero-profile-editor-overlay .hpe-title-option.is-selected {
            color: var(--ui-accent-deep);
            border-color: var(--ui-gold);
            background: var(--ui-gold-soft);
        }
        #hero-profile-editor-overlay .hpe-actions {
            position: sticky;
            bottom: -20px;
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 12px;
            margin: 28px -26px -20px;
            padding: 16px 26px 20px;
            background: var(--ui-surface);
            border-top: 1px solid var(--ui-line-soft);
        }
        #hero-profile-editor-overlay .hpe-actions button {
            min-height: 52px;
            border: 0;
            border-radius: 13px;
            font-size: var(--ui-text-size);
            font-weight: 900;
            cursor: pointer;
        }
        #hero-profile-editor-overlay .hpe-cancel {
            color: var(--ui-text);
            background: var(--ui-surface-soft);
        }
        #hero-profile-editor-overlay .hpe-save {
            color: var(--ui-on-accent);
            background: var(--ui-accent);
        }
        #hero-profile-editor-overlay .hpe-save:disabled {
            cursor: wait;
            opacity: .6;
        }
        #hero-grid .hero-card-self,
        #hero-grid .hero-card-item.hero-card-self {
            order: -999;
            background: linear-gradient(145deg, var(--ui-surface) 0%, var(--ui-gold-soft) 100%);
            border-color: var(--ui-gold);
            box-shadow: var(--ui-shadow);
        }
        #hero-grid .hero-card-self .hero-self-badge {
            position: absolute;
            top: 12px;
            right: 14px;
            z-index: 2;
            padding: 5px 10px;
            color: var(--ui-accent-deep);
            background: var(--ui-gold-soft);
            border: 1px solid var(--ui-gold-line);
            border-radius: 999px;
            font-size: var(--ui-small-size);
            font-weight: 900;
        }
        @media (max-width: 720px) {
    #hero-profile-editor-overlay .hpe-dialog {
        width: 100%;
        height: 96vh;
        max-height: 96vh;
        border-radius: 18px;
    }
            #hero-profile-editor-overlay .hpe-body {
                display: block;
                max-height: calc(96vh - 70px);
                overflow-y: auto;
            }
            #hero-profile-editor-overlay .hpe-preview {
                padding: 24px 18px;
                border-right: 0;
                border-bottom: 1px solid var(--ui-gold-line);
            }
            #hero-profile-editor-overlay .hpe-avatar-stage {
                width: 164px;
                height: 164px;
            }
            #hero-profile-editor-overlay .hpe-selectors {
                overflow: visible;
                padding: 22px 16px 16px;
            }
            #hero-profile-editor-overlay .hpe-actions {
                bottom: -16px;
                margin: 24px -16px -16px;
                padding: 14px 16px 16px;
            }
        }
    `;

    document.head.appendChild(style);
}

window.closeHeroProfileEditor = function() {
    const overlay = document.getElementById("hero-profile-editor-overlay");
    if (overlay) overlay.remove();
};

function showHeroProfileEditor(user, userKey) {
    ensureHeroProfileEditorStyle();
    window.closeHeroProfileEditor();

    const level = heroUserLevel(user);
    const unlockedAnimals = heroUnlockedAnimals(level);
    const unlockedTitles = heroUnlockedTitles(user, level);
    const currentAnimal = user.selectedAnimal || user.animal;
    let selectedAnimal = unlockedAnimals.includes(currentAnimal)
        ? currentAnimal
        : unlockedAnimals[unlockedAnimals.length - 1];
    const currentTitle = user.selectedTitle || user.title;
    let selectedTitle = unlockedTitles.includes(currentTitle)
        ? currentTitle
        : unlockedTitles[unlockedTitles.length - 1];

    const overlay = document.createElement("div");
    overlay.id = "hero-profile-editor-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "내 용사 모습 변경");

    const avatarOptions = window.AVATAR_NAMES.map((name, index) => {
        const requiredLevel = index + 1;
        const unlocked = level >= requiredLevel;

        return `
            <button type="button"
                class="hpe-avatar-option${name === selectedAnimal ? " is-selected" : ""}"
                data-avatar-index="${index}"
                ${unlocked ? "" : "disabled"}>
                ${getAvatar(level, name, 72)}
                <span class="hpe-avatar-name">${heroEscape(name)}</span>
                ${unlocked ? "" : `<span class="hpe-lock-level">Lv.${requiredLevel}</span>`}
            </button>
        `;
    }).join("");

    const titleOptions = unlockedTitles.map((title, index) => `
        <button type="button"
            class="hpe-title-option${title === selectedTitle ? " is-selected" : ""}"
            data-title-index="${index}">
            ${heroEscape(title)}
        </button>
    `).join("");

    overlay.innerHTML = `
        <section class="hpe-dialog">
            <header class="hpe-head">
                <h2>내 용사 모습 변경</h2>
                <button type="button" class="hpe-close" aria-label="닫기">×</button>
            </header>
            <div class="hpe-body">
                <aside class="hpe-preview">
                    <div class="hpe-avatar-stage" data-profile-preview>
                        ${getAvatar(level, selectedAnimal, 148)}
                    </div>
                    <p class="hpe-preview-title" data-title-preview>
    ${heroEscape(selectedTitle)}
</p>

<h3>${heroEscape(user.name || window.myName || "용사")}</h3>

<span class="hpe-level">Lv.${level}</span>
                </aside>
                <main class="hpe-selectors">
                    <section class="hpe-section">
                        <h3>캐릭터 선택</h3>
                        <p class="hpe-help">현재 레벨까지 해금된 캐릭터만 선택할 수 있습니다.</p>
                        <div class="hpe-avatar-grid">${avatarOptions}</div>
                    </section>
                    <section class="hpe-section">
                        <h3>칭호 선택</h3>
                        <p class="hpe-help">획득했거나 현재 레벨에서 해금된 칭호입니다.</p>
                        <div class="hpe-title-list">${titleOptions}</div>
                    </section>
                    <div class="hpe-actions">
                        <button type="button" class="hpe-cancel">취소</button>
                        <button type="button" class="hpe-save">선택한 모습 저장</button>
                    </div>
                </main>
            </div>
        </section>
    `;

    document.body.appendChild(overlay);

    const preview = overlay.querySelector("[data-profile-preview]");
    const titlePreview = overlay.querySelector("[data-title-preview]");

    overlay.querySelectorAll(".hpe-avatar-option:not(:disabled)").forEach(button => {
        button.addEventListener("click", () => {
            selectedAnimal = window.AVATAR_NAMES[Number(button.dataset.avatarIndex)];
            overlay.querySelectorAll(".hpe-avatar-option").forEach(item => {
                item.classList.toggle("is-selected", item === button);
            });
            preview.innerHTML = getAvatar(level, selectedAnimal, 148);
        });
    });

    overlay.querySelectorAll(".hpe-title-option").forEach(button => {
        button.addEventListener("click", () => {
            selectedTitle = unlockedTitles[Number(button.dataset.titleIndex)];
            overlay.querySelectorAll(".hpe-title-option").forEach(item => {
                item.classList.toggle("is-selected", item === button);
            });
            titlePreview.textContent = selectedTitle;
        });
    });

    const close = () => window.closeHeroProfileEditor();
    overlay.querySelector(".hpe-close").addEventListener("click", close);
    overlay.querySelector(".hpe-cancel").addEventListener("click", close);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });

    overlay.querySelector(".hpe-save").addEventListener("click", async event => {
        const button = event.currentTarget;

        if (!unlockedAnimals.includes(selectedAnimal) ||
            !unlockedTitles.includes(selectedTitle)) {
            alert("현재 해금된 캐릭터와 칭호만 선택할 수 있습니다.");
            return;
        }

        button.disabled = true;
        button.textContent = "저장 중...";

        try {
    const savedProfile = {
        selectedAnimal: selectedAnimal,
        animal: selectedAnimal,
        selectedTitle: selectedTitle,
        title: selectedTitle
    };

    await db.ref(`users/${userKey}`).update(savedProfile);

    if (Array.isArray(window.currentUsers)) {
        const savedUser = window.currentUsers.find(item =>
            item && (
                item.__firebaseKey === userKey ||
                heroNormalizeName(item.name) ===
                    heroNormalizeName(user.name || window.myName)
            )
        );

        if (savedUser) {
            Object.assign(savedUser, savedProfile);
        }
    }

    window.closeHeroProfileEditor();
    window.renderHeroes(window.currentUsers);

} catch (error) {
    console.error("용사 모습 저장 오류:", error);
    alert("저장하지 못했습니다. 잠시 후 다시 시도해주세요.");

        button.disabled = false;
    button.textContent = "선택한 모습 저장";
}
    });
}

window.openHeroProfileEditor = function(userName) {
    const targetName = userName || window.myName;
    if (!targetName || targetName !== window.myName) return;

    heroFindUser(targetName).then(found => {
        if (!found) {
            alert("내 용사 정보를 찾을 수 없습니다.");
            return;
        }

        showHeroProfileEditor(found.data, found.key);
    }).catch(error => {
        console.error("내 용사 정보 불러오기 오류:", error);
        alert("내 용사 정보를 불러오지 못했습니다.");
    });
};

/* 이전 버튼과의 호환: 기존 모습 변경 버튼도 새 수정창을 연다. */
window.openAvatarPicker = function() {
    window.openHeroProfileEditor(window.myName);
};

window.selectAvatar = async function(name) {
    if (!window.myName || !window.AVATAR_NAMES.includes(name)) return;

    const found = await heroFindUser(window.myName);
    if (!found || !heroUnlockedAnimals(heroUserLevel(found.data)).includes(name)) {
        alert("아직 해금되지 않은 캐릭터입니다.");
        return;
    }

    await db.ref(`users/${found.key}`).update({
        selectedAnimal:name,
        animal:name
    });
    window.renderHeroes();
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

    /* 본인 카드 강조 스타일을 카드가 그려질 때 바로 준비한다. */
    ensureHeroProfileEditorStyle();


    const isAdminUser = heroIsAdmin();
    const loginName = heroNormalizeName(window.myName);


    const filteredUsers =
        usersArray.filter(user => {
            if (!user) return false;

            const name =
                user.name || "";

            if (
                name === "총사령관" ||
                user.isAdmin === true ||
                String(user.role || "").trim() === "관리자" ||
                (
                    typeof adminEmail !== "undefined" &&
                    String(user.email || "").trim().toLowerCase() ===
                        String(adminEmail || "").trim().toLowerCase()
                )
            ) {
                return false;
            }

            return true;
        });


    filteredUsers.sort((a, b) => {
        /* 학생 로그인 시 본인 카드를 항상 첫 번째에 배치 */
        if (!isAdminUser && loginName) {
            const aIsMine = heroNormalizeName(a.name) === loginName;
            const bIsMine = heroNormalizeName(b.name) === loginName;

            if (aIsMine !== bIsMine) {
                return aIsMine ? -1 : 1;
            }
        }

        const aNo =
            parseInt(a.number || a.no) || 999;

        const bNo =
            parseInt(b.number || b.no) || 999;

        if (aNo !== bNo) {
            return aNo - bNo;
        }

        return String(a.name || "").localeCompare(
            String(b.name || ""),
            "ko"
        );
    });


    let html = "";


    filteredUsers.forEach((user, index) => {
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

       const heroTitle = String(
    user.selectedTitle ||
    user.title ||
    ""
).trim();


        const isMySelf =
            !isAdminUser &&
            loginName &&
            heroNormalizeName(user.name) === loginName;


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
            const heroPointsValue = user.points || 0;
            pointsHtml = `
                <div class="hero-points${heroPointsValue < 0 ? " is-negative" : ""}">
                    🪙 ${heroPointsValue} P
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

        // 이 앱의 규칙: 100 EXP 마다 한 레벨 (global.js 의 레벨 환산과 동일)
        const heroExp = parseInt(user.exp, 10) || 0;
        const expIntoLevel = ((heroExp % 100) + 100) % 100;
        const expToNext = 100 - expIntoLevel;

        let expHtml = "";

        if (isAdminUser || isMySelf) {
            expHtml = `
                <div class="hero-exp-bar" role="img"
                     aria-label="다음 레벨까지 ${expToNext} 경험치">
                    <div class="hero-exp-fill" style="width:${expIntoLevel}%"></div>
                </div>
                <div class="hero-exp">
                    EXP ${heroExp} · 다음 레벨까지 ${expToNext}
                </div>
            `;
        }

        // 레벨 구간에 따라 카드 테두리 등급이 달라진다.
        const heroTier =
            lv >= 15 ? 4 :
            lv >= 10 ? 3 :
            lv >= 5  ? 2 : 1;


        html += `
            <div
                class="hero-card${isMySelf ? " hero-card-self" : ""}"
                data-name="${heroEscape(name)}"
                data-firebase-key="${heroEscape(user.__firebaseKey || name)}"
                data-tier="${heroTier}"
                style="--i:${index}"
                onclick="${clickAction}"
            >

                ${isMySelf ? `
                    <div class="hero-self-badge">내 용사</div>
                ` : ""}

                <div class="hero-card-level">
                    Lv.${lv}
                </div>

                <div class="hero-ring" style="--ring:${expIntoLevel}">
                    ${getAvatar(
                        lv,
                        user.selectedAnimal ||
                        user.animal,
                        88
                    )}
                </div>
                ${heroTitle ? `
    <span class="hero-card-title badge badge--gold">
        ${heroEscape(heroTitle)}
    </span>
` : ""}

               <h3 class="hero-name">
    ${number ? number + ". " : ""}${name}
</h3>

                ${pointsHtml}

                ${expHtml}



            </div>
        `;
    });


    heroGrid.innerHTML =
        html ||
        `
            <div class="empty">
                <strong>등록된 용사가 없습니다.</strong>
            </div>
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

    button.className =
        "btn btn--primary btn--lg";


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

window.openStudentProfile = async function(userName) {
    if (!heroIsAdmin()) return;
    try {
        const snapshot = await db.ref(`users/${userName}`).once('value');
        if (!snapshot.exists()) return alert('학생 정보를 찾을 수 없습니다.');
        const user = snapshot.val();
        return await window.openHeroDetail({ ...user, name: user.name || userName, __firebaseKey: userName });
    } catch (error) {
        console.error('학생 상세정보 로딩 오류:', error);
        alert('학생 상세정보를 불러오지 못했습니다.');
    }
};


/* =========================================================
   학생 본인 프로필
   ========================================================= */

window.openOwnStudentProfile = function(userName) {
    window.openHeroProfileEditor(userName);
};


/* =========================================================
   친구 방
   ========================================================= */

window.openFriendRoom = function(userName) {
    return window.visitFriendRoom(userName);
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
