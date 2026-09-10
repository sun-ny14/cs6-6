// js/housing.js - 용사의 방 렌더링, 가구 배치, 크기/반전 편집, 하우징 상점 및 친구 방 방문/방명록 통합 관리

window.housingView = { owner: '', version: 0, ready: false };

window.canManageHousing = function() {
    return !!window.myName && window.currentTab === 'housing' &&
        window.housingView.ready && window.housingView.owner === window.myName &&
        (window.isHousingEnabled !== false || window.isAdmin === true);
};

window.isCurrentHousingView = function(owner, version) {
    return window.currentTab === 'housing' && window.housingView.owner === owner &&
        window.housingView.version === version;
};

window.leaveHousingTab = function() {
    window.housingView = { owner: '', version: window.housingView.version + 1, ready: false };
    if (document.getElementById('housing-shop-items') || document.getElementById('housing-purchase-history')) window.closePopup();
};

window.updateHousingControls = function() {
    const editable = window.canManageHousing();
    ['housing-shop-button', 'housing-save-controls', 'housing-inventory-panel',
        'housing-wallet-bar', 'housing-background-panel', 'housing-purchase-history-button'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.hidden = !editable;
    });
};

// 1. 관리자용 하우징 시스템 ON/OFF 토글
window.refreshHousingAdminControl = function() {
    const control =
        document.getElementById("admin-housing-control");

    const status =
        document.getElementById("housing-current-status");

    const button =
        document.getElementById("housing-toggle-btn");

    const admin = window.isAdmin === true;

    if (control) {
        control.style.display = admin && window.housingView.owner === window.myName ? "block" : "none";
    }

    if (!admin) return;

    if (status) {
        status.textContent = window.isHousingEnabled
            ? "🟢 이용 가능"
            : "🔴 이용 중지";
    }

    if (button) {
        button.textContent = window.isHousingEnabled
            ? "용사의 방 닫기"
            : "용사의 방 열기";

        button.classList.remove("btn--warn", "btn--good", "btn--danger");
        button.classList.add(
            window.isHousingEnabled ? "btn--danger" : "btn--good"
        );
    }
};

window.toggleHousing = async function() {
    if (window.isAdmin !== true) return;

    const newState = !window.isHousingEnabled;

    try {
        await db.ref("settings/housingEnabled").set(newState);

        window.isHousingEnabled = newState;
        window.refreshHousingAdminControl();

        alert(
            newState
                ? "용사의 방을 열었습니다."
                : "용사의 방을 닫았습니다."
        );
    } catch (error) {
        console.error("용사의 방 상태 변경 오류:", error);
        alert("용사의 방 상태를 변경하지 못했습니다.");
    }
};

// 2. 하우징 탭 열기 및 활성화 검증
window.openHousingTab = function() {
    if (!myName) return alert("로그인이 필요합니다!");
    if (!window.isHousingEnabled && !isAdmin) return alert("🚧 [공사 공지] 지금은 총사령관이 방 시스템을 조정 중입니다! 잠시 후 이용해 주세요. 🍌");
    renderMyRoom();
    renderHousingInventory();
};

// 3. 기본 방 배경 업로드 (관리자 전용)
window.uploadDefaultBackground = function(input) {
    if (!isAdmin) return;
    if (input.files && input.files[0]) {
        const r = new FileReader();
        r.onload = function(e) {
            const base64Img = e.target.result;
            db.ref('settings/defaultBg').set(base64Img).then(() => {
                alert("기본 배경이 저장되었습니다! 모든 용사의 방에 적용됩니다. ✨");
                window.currentDefaultBg = base64Img;
                renderMyRoom(); 
            }).catch(err => alert("❌ 이미지 용량이 너무 커서 실패했습니다. (가급적 해상도를 낮춰주세요)"));
        };
        r.readAsDataURL(input.files[0]);
    }
};

// 4. 내 방 렌더링 (모바일 터치, 실시간 저장, 투명 배경, 크기 조절 통합)
window.renderMyRoom = function() {
    const { owner, version } = window.housingView;
    const container = document.getElementById('my-room-container'); 
    if (!container || !owner || !window.isCurrentHousingView(owner, version)) return;
    
    return Promise.all([
        db.ref(window.isAdmin===true?'settings/defaultBg':'publicSettings/defaultBg').once('value'),
        db.ref(owner===window.myName||window.isAdmin===true
            ?`users/${owner}/myRoom`:`publicProfiles/${owner}/myRoom`).once('value')
    ]).then(([defaultSnap, snap]) => {
            if (!window.isCurrentHousingView(owner, version)) return;
            const defaultBg = defaultSnap.val() || window.currentDefaultBg || 'assets/housing/backgrounds/level-1.png';
            const room = snap.val() || {}; 
            const myBg = room.background;
            window.housingView.ready = true;
            window.updateHousingControls();
            document.getElementById('housing-room-status').textContent = '';
            
            container.style.backgroundImage = `url('${myBg || defaultBg}')`;
            container.style.backgroundSize = "100% 100%";
            container.style.backgroundPosition = "center";
            
            const layer = document.getElementById('my-room-canvas'); 
            if (layer) layer.innerHTML = "";

            if (room.objects) {
                Object.keys(room.objects).forEach(key => {
                    const o = room.objects[key];
                    const div = document.createElement('div');
                    
                    let isPerson = (o.type && (o.type.includes('인물') || o.type.includes('사람')));
                    let baseW = isPerson ? 64 : 48;
                    let baseH = isPerson ? 96 : 48;

                    let currentW = o.w || baseW;
                    let currentH = o.h || baseH;

                    div.style.position = 'absolute';
                    div.style.left = (o.x || 0) + 'px';
                    div.style.top = (o.y || 0) + 'px';
                    div.style.width = currentW + 'px';
                    div.style.height = currentH + 'px';
                    const editable = window.canManageHousing();
                    div.style.cursor = editable ? 'grab' : 'default';
                    if (editable) div.title = "드래그: 이동 / 더블클릭(길게누르기): 크기 조절 및 삭제";
                    
                    const flipStyle = o.flipX ? 'transform: scaleX(-1);' : '';
                    
                    const image = document.createElement('img');
                    image.src = o.img || '';
                    image.alt = o.type || '가구';
                    image.style.cssText = `width:100%; height:100%; object-fit:contain; image-rendering:pixelated; pointer-events:none; background:transparent; ${flipStyle}`;
                    div.appendChild(image);

                    if (!editable) {
                        if (layer) layer.appendChild(div);
                        return;
                    }
                    
                    div.ondblclick = (e) => {
                        e.stopPropagation();
                        openItemEditor(key, o.type, currentW, currentH, o.flipX);
                    };

                    let pressTimer;
                    let isDragging = false;

                    const startDrag = function(e) {
                        if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
                        isDragging = false;
                        div.style.cursor = 'grabbing';
                        div.style.zIndex = 1000;
                        
                        const isTouch = e.type.includes('touch');
                        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
                        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
                        
                        let startX = clientX;
                        let startY = clientY;
                        let initialX = parseInt(div.style.left) || 0;
                        let initialY = parseInt(div.style.top) || 0;

                        pressTimer = setTimeout(() => {
                            if (!isDragging && isTouch && window.isCurrentHousingView(owner, version)) openItemEditor(key, o.type, currentW, currentH, o.flipX);
                        }, 600);

                        const moveDrag = function(e) {
                            isDragging = true;
                            clearTimeout(pressTimer); 
                            
                            if (e.type.includes('touch')) e.preventDefault(); 
                            
                            const currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                            const currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                            
                            let newX = initialX + (currentX - startX);
                            let newY = initialY + (currentY - startY);
                            
                            if (newX < 0) newX = 0;
                            if (newY < 0) newY = 0;
                            newX = Math.min(newX, Math.max(0, container.clientWidth - currentW));
                            newY = Math.min(newY, Math.max(0, container.clientHeight - currentH));
                            
                            div.style.left = newX + 'px';
                            div.style.top = newY + 'px';
                        };

                        const endDrag = function() {
                            clearTimeout(pressTimer);
                            document.removeEventListener('mousemove', moveDrag);
                            document.removeEventListener('touchmove', moveDrag);
                            document.removeEventListener('mouseup', endDrag);
                            document.removeEventListener('touchend', endDrag);
                            
                            div.style.cursor = 'grab';
                            div.style.zIndex = '';
                            
                            const finalX = parseInt(div.style.left);
                            const finalY = parseInt(div.style.top);
                            if (window.canManageHousing() && window.isCurrentHousingView(owner, version)) {
                                db.ref(`users/${owner}/myRoom/objects/${key}`).update({x: finalX, y: finalY});
                            }
                        };

                        document.addEventListener('mousemove', moveDrag);
                        document.addEventListener('touchmove', moveDrag, {passive: false});
                        document.addEventListener('mouseup', endDrag);
                        document.addEventListener('touchend', endDrag);
                    };

                    div.addEventListener('mousedown', startDrag);
                    div.addEventListener('touchstart', startDrag, {passive: false});
                    if (layer) layer.appendChild(div); 
                });
            }
            window.renderRoomSocial(room);
    });
};

// 5. 아이템 크기 조절, 반전 및 삭제 팝업
window.openItemEditor = function(key, type, currentW, currentH, isFlipped) {
    if (!window.canManageHousing()) return;
    let isPerson = (type && (type.includes('인물') || type.includes('사람')));
    const baseW = isPerson ? 64 : 48;
    const baseH = isPerson ? 96 : 48;

    const maxW = baseW * 4.0, maxH = baseH * 4.0;
    const minW = baseW * 0.5, minH = baseH * 0.5;

    let h = `
        <div class="stack center">
            <h3>🛠️ ${type} 설정</h3>
            <p class="muted">현재 크기: ${Math.round(currentW)} x ${Math.round(currentH)}</p>
            <div class="btn-row btn-row--fill">
                <button class="btn btn--good btn--lg" onclick="resizeRoomItem('${key}', ${currentW*1.2}, ${currentH*1.2}, ${maxW}, ${maxH}, 'up')">➕ 크게</button>
                <button class="btn btn--gold btn--lg" onclick="resizeRoomItem('${key}', ${currentW*0.8}, ${currentH*0.8}, ${minW}, ${minH}, 'down')">➖ 작게</button>
                <button class="btn btn--primary btn--lg" onclick="toggleFlipRoomItem('${key}', ${isFlipped ? true : false})">↔️ 반전</button>
            </div>
            <button class="btn btn--danger btn--lg btn--block" onclick="deleteRoomItem('${key}')">🗑️ 이 아이템 치우기</button>
        </div>
    `;
    if (typeof openPopup === 'function') openPopup("아이템 관리", h);
};

window.toggleFlipRoomItem = function(key, currentFlipState) {
    if (!window.canManageHousing()) return;
    db.ref(`users/${myName}/myRoom/objects/${key}`).update({
        flipX: !currentFlipState
    }).then(() => {
        renderMyRoom(); 
        if (typeof closePopup === 'function') closePopup(); 
    });
};

window.resizeRoomItem = function(key, newW, newH, limitW, limitH, dir) {
    if (!window.canManageHousing()) return;
    if (dir === 'up' && (newW > limitW || newH > limitH)) return alert("해당 아이템을 더 이상 크게 만들 수 없습니다!");
    if (dir === 'down' && (newW < limitW || newH < limitH)) return alert("해당 아이템을 더 이상 작게 만들 수 없습니다!");
    db.ref(`users/${myName}/myRoom/objects/${key}`).update({w: Math.round(newW), h: Math.round(newH)}).then(() => {
        renderMyRoom(); 
        if (typeof closePopup === 'function') closePopup(); 
    });
};

window.deleteRoomItem = function(key) {
    if (!window.canManageHousing()) return;
    if (confirm("정말 방에서 이 아이템을 치우시겠습니까?")) {
        db.ref(`users/${myName}/myRoom/objects/${key}`).remove().then(() => {
            renderMyRoom(); 
            if (typeof closePopup === 'function') closePopup();
        });
    }
};

// 6. 내 하우징 보관함 로드 및 배치
window.renderHousingInventory = function() {
    if (!window.canManageHousing()) return;
    const { owner, version } = window.housingView;
    const list = document.getElementById('housing-inventory-list');
    if (!list) return;

    return db.ref(`users/${owner}/housingInventory`).once('value', snap => {
        if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
        list.innerHTML = '';
        const inv = snap.val() || {};
        let hasItems = false;
        for (let k in inv) {
            hasItems = true; const i = inv[k];
            list.innerHTML += `<div class="shop-card">
                <div class="tiny muted strong">${i.category}</div>
                <img src="${i.img}" style="width:40px; height:40px; object-fit:contain; image-rendering:pixelated;">
                <div class="small strong nowrap" style="overflow:hidden; text-overflow:ellipsis;">${i.name}</div>
                <button class="btn btn--primary btn--sm btn--block" onclick="placeOrApplyHousingItem('${i.img}', '${i.category}')">${i.category==='배경'?'배경적용':'배치하기'}</button>
            </div>`;
        }
        if (!hasItems) list.innerHTML = `<div class="empty"><strong>아직 구매한 하우징 아이템이 없습니다.</strong></div>`;
    });
};

window.placeOrApplyHousingItem = function(img, category) {
    if (!window.canManageHousing()) return;
    if (category === '배경') {
        if (confirm("방 전체 배경을 이 이미지로 바꾸시겠습니까?")) {
            db.ref(`users/${myName}/myRoom/background`).set(img).then(() => renderMyRoom());
        }
    } else {
        const objId = Date.now();
        db.ref(`users/${myName}/myRoom/objects/${objId}`).set({
            img: img, type: category, x: 290, y: 210 
        }).then(() => renderMyRoom());
        alert("방 중앙에 배치되었습니다! 클릭해서 원하는 위치로 이동시키세요.");
    }
};

// 7. 하우징 상점 및 관리 로직
window.openHousingShopPopup = function() {
    let h = `
        <div class="stack">
            <div class="seg">
                <button onclick="loadHousingShop('전체')">전체</button>
                <button onclick="loadHousingShop('배경')">🖼️ 배경</button>
                <button onclick="loadHousingShop('가구')">🪑 가구</button>
                <button onclick="loadHousingShop('인물')">👤 인물</button>
            </div>
            ${isAdmin ? `<button class="btn btn--good btn--lg btn--block" onclick="openAddHousingShopPopup()">+ 새 아이템 직접 등록</button>` : ''}
            <div id="housing-shop-items" class="grid grid--tight scroll-y" style="max-height:50vh;">로딩 중...</div>
        </div>
    `;
    if (typeof openPopup === 'function') openPopup("🛒 하우징 상점", h);
    loadHousingShop('전체');
};

window.loadHousingShop = function(filterCat) {
    const container = document.getElementById('housing-shop-items');
    if (!container) return;
    db.ref('housingShop').once('value', snap => {
        let html = ""; let hasItems = false;
        snap.forEach(child => {
           const k = child.key;
const item = child.val() || {};

const rawCategory = String(
    item.category ||
    item.cat ||
    item.type ||
    ""
).trim();

let normalizedCategory = rawCategory;

if (rawCategory.includes("가구")) {
    normalizedCategory = "가구";
} else if (rawCategory.includes("인물")) {
    normalizedCategory = "인물";
} else if (rawCategory.includes("배경")) {
    normalizedCategory = "배경";
} else if (!rawCategory) {
    // 카테고리가 없는 예전 상품은 가구로 처리
    normalizedCategory = "가구";
}

item.category = normalizedCategory;

if (
    filterCat !== "전체" &&
    normalizedCategory !== filterCat
) {
    return;
}
            hasItems = true;
            html += `
                <div class="shop-card">
                    <div class="tiny muted">${item.category}</div>
                    <img src="${item.img}" style="width:50px; height:50px; object-fit:contain; image-rendering:pixelated;">
                    <div class="strong">${item.name}</div>
                    <div class="shop-price">${item.price}P</div>
                    <button class="btn btn--gold btn--sm btn--block" onclick="buyHousingItem('${k}')">구매하기</button>
                    ${isAdmin ? `<button class="btn btn--danger btn--xs btn--block" onclick="deleteHousingShopItem('${k}')">삭제</button>` : ''}
                </div>
            `;
        });
        container.innerHTML = hasItems ? html : `<div class="empty" style="grid-column:1/-1;"><strong>등록된 아이템이 없습니다.</strong></div>`;
    });
};

window.deleteHousingShopItem = function(key) {
    if (confirm("상점에서 이 아이템을 영구 삭제하시겠습니까?")) {
        db.ref('housingShop/' + key).remove().then(() => loadHousingShop('전체'));
    }
};

window.openAddHousingShopPopup = function(itemKey = null, itemData = {}) {
    let h = `
        <div class="stack">
            <div class="field">
                <label class="field-label">아이템명:</label>
                <input type="text" id="hs-name" value="${itemData.name || ''}">
            </div>
            <div class="field">
                <label class="field-label">가격(P):</label>
                <input type="number" id="hs-price" value="${itemData.price || 0}">
            </div>
            <div class="field">
                <label class="field-label">카테고리:</label>
                <select id="hs-cat">
                    <option value="배경">🖼️ 배경</option>
                    <option value="가구">🪑 가구</option>
                </select>
            </div>
            <div class="field">
                <label class="field-label">이미지 첨부:</label>
                <input type="file" id="hs-file" accept="image/*">
            </div>
            <button class="btn btn--primary btn--lg btn--block" onclick="saveHousingItem('${itemKey}')">저장하기</button>
        </div>
    `;
    if (typeof openPopup === 'function') openPopup("아이템 직접 등록", h);
};

window.saveHousingItem = function(key) {
    const fileInput = document.getElementById('hs-file');
    const name = document.getElementById('hs-name').value;
    const price = parseInt(document.getElementById('hs-price').value);
    const cat = document.getElementById('hs-cat').value;

    if (!name || isNaN(price)) return alert("이름과 가격을 확인해주세요!");

    const proceedSave = (imgString) => {
        const data = { name, price, category: cat, img: imgString };
        db.ref('housingShop').push(data).then(() => {
            alert("✅ 성공적으로 등록되었습니다!");
            if (typeof closePopup === 'function') closePopup(); 
            openHousingShopPopup();
        });
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) { proceedSave(e.target.result); }; 
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        alert("이미지 파일을 반드시 첨부해 주세요!");
    }
};

// 방은 가구를 옮기는 시점에 저장됩니다.
// 이 함수는 호환을 위해 남겨 두었고, 호출되면 알림 없이 반환합니다.
window.saveMyRoom = function() {
    if (!window.canManageHousing()) return;
    const hint = document.getElementById('housing-room-status');
    if (hint) hint.textContent = '가구를 옮기면 그 자리에서 바로 저장됩니다.';
};

// 8. 친구 방 방문 및 이모지 방명록
const HOUSING_REACTIONS = {
    likes: { emoji: '👍', label: '멋져요' },
    hearts: { emoji: '❤️', label: '귀여워요' },
    stars: { emoji: '🌟', label: '최고예요' },
    smiles: { emoji: '😊', label: '놀러 왔어요' }
};
const housingPendingReactions = new Set();

function housingToday(timestamp = Date.now()) {
    return new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function hasHousingReaction(room, visitor, day) {
    if (room.dailyReactions?.[visitor]?.[day]) return true;
    // 이전 버전에서 남긴 반응도 같은 날의 중복 반응으로 계산한다.
    return ['likes', 'hearts'].some(type => room[`reactions_${type}`]?.[visitor]?.[day]);
}

window.visitFriendRoom = function(targetUser) {
    if (!window.myName) return alert('로그인이 필요합니다!');
    if (!targetUser) return;
    showTab('housing', targetUser);
};

window.renderRoomSocial = function(room) {
    const { owner, ready } = window.housingView;
    if (!ready || window.currentTab !== 'housing') return;
    const social = document.getElementById('housing-social');
    const reactions = document.getElementById('housing-reactions');
    const status = document.getElementById('housing-reaction-status');
    const list = document.getElementById('housing-guestbook-list');
    social.hidden = false;
    reactions.hidden = owner === window.myName;
    reactions.replaceChildren();
    const today = housingToday(Date.now() + (window.housingServerTimeOffset || 0));
    const done = hasHousingReaction(room, window.myName, today);
    const pending = housingPendingReactions.has(`${owner}/${window.myName}`);
    status.textContent = owner === window.myName ? '' : pending ? '반응을 남기는 중이에요…' : done
        ? '오늘 반응을 남겼어요! 내일 또 놀러 와요.'
        : '친구 한 명에게 하루에 한 번, 이모지 하나를 남길 수 있어요.';
    if (owner !== window.myName) {
        Object.entries(HOUSING_REACTIONS).forEach(([type, reaction]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${reaction.emoji} ${reaction.label}`;
            button.disabled = done || pending;
            button.onclick = () => window.sendRoomReaction(owner, type);
            reactions.appendChild(button);
        });
    }

    list.replaceChildren();
    const entries = Object.entries(room.guestbook || {}).sort(([keyA, a], [keyB, b]) => {
        const timeA = Number(a.timestamp) || 0;
        const timeB = Number(b.timestamp) || 0;
        return timeB - timeA || keyB.localeCompare(keyA);
    });
    if (!entries.length) {
        const empty = document.createElement('p');
        empty.textContent = '아직 남겨진 반응이 없어요.';
        list.appendChild(empty);
    }
    entries.forEach(([, entry]) => {
        const row = document.createElement('div');
        row.className = 'housing-guestbook-entry';
        const message = document.createElement('span');
        const reaction = HOUSING_REACTIONS[entry.type];
        message.textContent = reaction
            ? `${entry.user} · ${reaction.emoji} ${reaction.label}`
            : entry.text || `${entry.user || '친구'} 용사가 다녀갔어요.`;
        const time = document.createElement('small');
        time.textContent = Number.isFinite(entry.timestamp)
            ? new Date(entry.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
            : entry.time || entry.day || '';
        row.append(message, time);
        list.appendChild(row);
    });
};

window.toggleRoomGuestbook = async function() {
    const { owner, version, ready } = window.housingView;
    if (!ready) return;
    const revision = window.housingView.socialRevision || 0;
    const panel = document.getElementById('housing-guestbook');
    const button = document.getElementById('housing-guestbook-button');
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    button.textContent = panel.hidden ? '📖 방명록 확인' : '📖 방명록 접기';
    if (panel.hidden) return;
    try {
        const snapshot = await db.ref(owner===window.myName||window.isAdmin===true
            ?`users/${owner}/myRoom`:`publicProfiles/${owner}/myRoom`).once('value');
        if (window.isCurrentHousingView(owner, version) && revision === (window.housingView.socialRevision || 0)) {
            window.renderRoomSocial(snapshot.val() || {});
        }
    } catch (error) {
        if (!window.isCurrentHousingView(owner, version) || revision !== (window.housingView.socialRevision || 0)) return;
        document.getElementById('housing-guestbook-list').textContent = '방명록을 불러오지 못했어요. 접었다가 다시 열어 주세요.';
    }
};

window.sendRoomReaction = async function(targetUser, type) {
    const { owner, version, ready } = window.housingView;
    const visitor = window.myName;
    if (!visitor || targetUser === visitor || !ready || owner !== targetUser ||
        !window.isCurrentHousingView(owner, version) ||
        (window.isHousingEnabled === false && window.isAdmin !== true) ||
        !Object.hasOwn(HOUSING_REACTIONS, type)) return;
    const pendingKey = `${owner}/${visitor}`;
    if (housingPendingReactions.has(pendingKey)) return;
    housingPendingReactions.add(pendingKey);
    const status = document.getElementById('housing-reaction-status');
    document.getElementById('housing-reactions').querySelectorAll('button').forEach(button => button.disabled = true);
    status.textContent = '반응을 남기는 중이에요…';
    try {
        const result = await window.callSecure('addRoomReaction', { owner, type });
        housingPendingReactions.delete(pendingKey);
        if (!window.isCurrentHousingView(owner, version)) return;
        window.housingView.socialRevision = (window.housingView.socialRevision || 0) + 1;
        window.renderRoomSocial(result.room || {});
        document.getElementById('housing-guestbook').hidden = false;
        const button = document.getElementById('housing-guestbook-button');
        button.setAttribute('aria-expanded', 'true');
        button.textContent = '📖 방명록 접기';
        status.textContent = result.committed
            ? '반응을 방명록에 남겼어요! 내일 또 놀러 와요.'
            : '오늘은 이미 반응을 남겼어요. 내일 다시 남겨 주세요.';
    } catch (error) {
        console.error('방 반응 저장 오류:', error);
        if (window.isCurrentHousingView(owner, version)) {
            document.getElementById('housing-reactions').querySelectorAll('button').forEach(button => button.disabled = false);
            status.textContent = '반응을 저장하지 못했어요. 다시 눌러 주세요.';
        }
    } finally {
        housingPendingReactions.delete(pendingKey);
    }
};
/* =========================================================
   용사의 방 V2
   - 기본 10코인
   - 정상등교 하루 1코인
   - 레벨업마다 5코인
   - 배경 레벨 해금
   - 상점에서 일반 포인트 대신 방꾸미기 코인 사용
   ========================================================= */

(function(){

    const START_COINS=10;
    const LEVEL_REWARD=5;
    const CHECKIN_REWARD=1;

    // 저장소에 포함된 기본 가구입니다. Firebase 상점 등록 여부와 관계없이 항상 표시합니다.
    const DEFAULT_FURNITURE={
        'builtin-bed':{name:'포근한 침대',category:'가구',img:'assets/housing/furniture/bed.png',price:8},
        'builtin-bookshelf':{name:'용사의 책장',category:'가구',img:'assets/housing/furniture/bookshelf.png',price:6},
        'builtin-chair':{name:'나무 의자',category:'가구',img:'assets/housing/furniture/chair.png',price:3},
        'builtin-clock':{name:'벽시계',category:'가구',img:'assets/housing/furniture/clock.png',price:4},
        'builtin-desk':{name:'공부 책상',category:'가구',img:'assets/housing/furniture/desk.png',price:7},
        'builtin-lamp':{name:'스탠드 조명',category:'가구',img:'assets/housing/furniture/lamp.png',price:4},
        'builtin-picture':{name:'모험 그림',category:'가구',img:'assets/housing/furniture/picture.png',price:4},
        'builtin-plant':{name:'초록 화분',category:'가구',img:'assets/housing/furniture/plant.png',price:3},
        'builtin-rug':{name:'포근한 러그',category:'가구',img:'assets/housing/furniture/rug.png',price:5},
        'builtin-toy-box':{name:'장난감 상자',category:'가구',img:'assets/housing/furniture/toy-box.png',price:5},
        'builtin-forest-sofa':{name:'숲속 독서 소파',category:'가구',img:'assets/housing/furniture/forest-sofa.png',price:6,requiredLevel:3},
        'builtin-potion-table':{name:'마법 물약 테이블',category:'가구',img:'assets/housing/furniture/potion-table.png',price:8,requiredLevel:5},
        'builtin-knight-stand':{name:'기사단 방패 장식',category:'가구',img:'assets/housing/furniture/knight-stand.png',price:10,requiredLevel:8},
        'builtin-star-telescope':{name:'별빛 망원경',category:'가구',img:'assets/housing/furniture/star-telescope.png',price:12,requiredLevel:12},
        'builtin-royal-chair':{name:'왕실 벨벳 의자',category:'가구',img:'assets/housing/furniture/royal-chair.png',price:15,requiredLevel:16},
        'builtin-sky-aquarium':{name:'구름섬 수족관',category:'가구',img:'assets/housing/furniture/sky-aquarium.png',price:18,requiredLevel:20}
    };

    function normalizeFurnitureItem(item){
        const value={...(item||{})};
        const rawCategory=String(value.category||value.cat||value.type||'').trim();
        value.category=rawCategory.includes('배경')?'배경':rawCategory.includes('인물')?'인물':'가구';
        value.img=value.img||value.url||'';
        const builtin=Object.values(DEFAULT_FURNITURE).find(entry=>entry.img===value.img);
        value.requiredLevel=Math.max(1,parseInt(value.requiredLevel,10)||1,builtin?.requiredLevel||1);
        return value;
    }

    const LEVEL_BACKGROUNDS=[
        {
            level:1,
            name:'초보 용사의 방',
            img:'assets/housing/backgrounds/level-1.png'
        },
        {
            level:3,
            name:'숲속 오두막',
            img:'assets/housing/backgrounds/level-3.png'
        },
        {
            level:5,
            name:'마법 연구실',
            img:'assets/housing/backgrounds/level-5.png'
        },
        {
            level:8,
            name:'기사단 숙소',
            img:'assets/housing/backgrounds/level-8.png'
        },
        {
            level:12,
            name:'별빛 관측실',
            img:'assets/housing/backgrounds/level-12.png'
        },
        {
            level:16,
            name:'왕실 용사의 방',
            img:'assets/housing/backgrounds/level-16.png'
        },
        {
            level:20,
            name:'구름 위 하늘 궁전',
            img:'assets/housing/backgrounds/level-20.png'
        }
    ];

    function roomIsAdmin(){
        return (
            typeof isAdmin!=='undefined'&&
            !!isAdmin
        );
    }

    function roomLevel(user){
        return Math.max(
            1,
            parseInt(
                user&&(
                    user.level||
                    user.lv
                ),
                10
            )||1
        );
    }

    function roomToday(){
        if(typeof getTodayKST==='function'){
            return getTodayKST();
        }

        return new Date().toLocaleDateString(
            'sv-SE',
            {
                timeZone:'Asia/Seoul'
            }
        );
    }

    function roomEscape(value){
        return String(value??'')
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#39;');
    }


    /* =====================================================
       코인 초기화 및 레벨업 보상
       ===================================================== */

    // 보상과 구매가 겹쳐도 최신 잔액을 기준으로 계산한다.
    function applyHousingRewards(user) {
        const level = roomLevel(user);
        const coins = parseInt(user.roomCoins, 10);
        const rewarded = parseInt(user.roomRewardedLevel, 10);
        user.roomCoins = Number.isFinite(coins) ? coins : START_COINS;
        user.roomRewardedLevel = Number.isFinite(rewarded) ? rewarded : level;
        if (Number.isFinite(coins) && Number.isFinite(rewarded) && level > rewarded) {
            user.roomCoins += (level - rewarded) * LEVEL_REWARD;
            user.roomRewardedLevel = level;
        }
        return user;
    }

    window.syncHousingRewards = async function(userName) {
        if (!userName) return null;
        if(userName!==window.myName)return null;
        return window.callSecure('syncHousingRewards');
    };

    /* =====================================================
       정상등교 코인 지급·회수

       같은 날짜에 여러 번 저장해도 1회만 지급
       정상 → 지각/결석 수정 시 다시 회수
       ===================================================== */

    window.setNormalCheckinRoomCoinReward=
    async function(
        userName,
        date,
        isNormal
    ){

        if(!userName||userName!==window.myName){
            return false;
        }

        const secureResult=await window.callSecure('setCheckinRoomReward',{date:String(date||'')});
        return Boolean(secureResult&&secureResult.normal);

        /* legacy client transaction retained below for reference; server return above is authoritative */

        const rewardDate=
            String(
                date||
                roomToday()
            ).slice(0,10);

        const ref=
            db.ref(
                `users/${userName}`
            );

        let changed=false;

        const result=
            await ref.transaction(user=>{

                if(!user){
                    return user;
                }

                const currentLevel=
                    roomLevel(user);

                const currentCoins=
                    parseInt(
                        user.roomCoins,
                        10
                    );

                if(!Number.isFinite(currentCoins)){

                    user.roomCoins=
                        START_COINS;

                    user.roomRewardedLevel=
                        currentLevel;
                }

                user.roomCoinRewards=
                    user.roomCoinRewards||{};

                user.roomCoinRewards.checkin=
                    user.roomCoinRewards.checkin||{};

                const oldReward=
                    user.roomCoinRewards
                        .checkin[rewardDate];

                /*
                 * 이미 정상등교 코인을 받은 경우
                 */
                if(isNormal&&oldReward){

                    return user;
                }

                /*
                 * 정상등교 1코인 지급
                 */
                if(isNormal){

                    user.roomCoins=
                        (
                            parseInt(
                                user.roomCoins,
                                10
                            )||0
                        )+
                        CHECKIN_REWARD;

                    user.roomCoinRewards
                        .checkin[rewardDate]={
                            amount:
                                CHECKIN_REWARD,

                            timestamp:
                                Date.now()
                        };

                    changed=true;

                    return user;
                }

                /*
                 * 정상등교가 취소된 경우 회수
                 */
                if(!isNormal&&oldReward){

                    const oldAmount=
                        parseInt(
                            oldReward.amount,
                            10
                        )||
                        CHECKIN_REWARD;

                    user.roomCoins=
                        Math.max(
                            0,
                            (
                                parseInt(
                                    user.roomCoins,
                                    10
                                )||0
                            )-
                            oldAmount
                        );

                    delete user
                        .roomCoinRewards
                        .checkin[rewardDate];

                    changed=true;
                }

                return user;
            });

        return !!(
            result.committed&&
            changed
        );
    };


    window.grantNormalCheckinRoomCoin=
    function(userName,date){

        return window
            .setNormalCheckinRoomCoinReward(
                userName,
                date,
                true
            );
    };


    /* =====================================================
       코인 및 배경 UI
       ===================================================== */

    function ensureRoomPanels(){

        const room=
            document.getElementById(
                'my-room-container'
            );

        if(
            !room||
            !room.parentNode
        ){
            return;
        }

        let wallet=
            document.getElementById(
                'housing-wallet-bar'
            );

        if(!wallet){

            wallet=
                document.createElement(
                    'div'
                );

            wallet.id=
                'housing-wallet-bar';

            wallet.className = 'housing-coin';
            wallet.style.cssText=`
                width:100%;
                max-width:640px;
                margin:0 auto 16px;
                box-sizing:border-box;
            `;

            room.parentNode.insertBefore(
                wallet,
                room
            );
        }

        let backgroundPanel=
            document.getElementById(
                'housing-background-panel'
            );

        if(!backgroundPanel){

            backgroundPanel=
                document.createElement(
                    'div'
                );

            backgroundPanel.id=
                'housing-background-panel';

            backgroundPanel.className = 'card card--soft';
            backgroundPanel.style.cssText=`
                width:100%;
                max-width:640px;
                margin:18px auto 0;
                box-sizing:border-box;
            `;

            room.parentNode.insertBefore(
                backgroundPanel,
                room.nextSibling
            );
        }
    }


    function renderRoomPanels(user){

        ensureRoomPanels();

        const wallet=
            document.getElementById(
                'housing-wallet-bar'
            );

        const panel=
            document.getElementById(
                'housing-background-panel'
            );

        const coins=
            parseInt(
                user&&user.roomCoins,
                10
            )||0;

        const level=
            roomLevel(user);

        const currentBackground=
            String(
                user&&
                user.myRoom&&
                user.myRoom.background||
                ''
            );

        if(wallet){

            wallet.innerHTML=`
                <span>
                    🪙 방꾸미기 코인
                </span>

                <strong class="housing-coin-value">
                    ${coins.toLocaleString('ko-KR')} C
                </strong>

                <small class="muted">
                    Lv.${level}
                    · 레벨업 +${LEVEL_REWARD}C
                    · 정상등교 +${CHECKIN_REWARD}C
                </small>
            `;
        }

        if(panel){

            panel.innerHTML=`
                <div class="stack">
                    <h3>🖼️ 레벨 배경</h3>

                    <div class="grid grid--tight">

                        ${
                            LEVEL_BACKGROUNDS
                            .map(background=>{

                                const unlocked=
                                    level>=
                                    background.level;

                                const selected=
                                    currentBackground===
                                    background.img;

                                return `
                                    <button
                                        type="button"
                                        class="pick-card${selected ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}"
                                        onclick="
                                            applyUnlockedHousingBackground(
                                                '${background.img}',
                                                ${background.level}
                                            )
                                        "
                                        ${unlocked?'':'disabled'}
                                    >

                                        <div class="pick-card-art" style="
                                            background-image:url('${background.img}');
                                        ">
                                        </div>

                                        <span class="pick-card-body">
                                            <span class="pick-card-title">${
                                                roomEscape(
                                                    background.name
                                                )
                                            }</span>

                                            <span class="pick-card-note">${
                                                selected
                                                    ?'사용 중'
                                                    :unlocked
                                                        ?'사용 가능'
                                                        :`Lv.${background.level} 해금`
                                            }</span>
                                        </span>

                                    </button>
                                `;
                            })
                            .join('')
                        }

                    </div>
                </div>
            `;
        }
    }


    /* =====================================================
       기존 방 렌더링을 유지하며 코인·배경 UI 추가
       ===================================================== */

    const originalRenderMyRoom = window.renderMyRoom;

    window.renderMyRoom = async function() {
        const { owner, version } = window.housingView;
        try {
            await originalRenderMyRoom();
            if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
            const snapshot = await db.ref(`users/${owner}`).once('value');
            if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
            renderRoomPanels(snapshot.val() || {});
            window.updateHousingControls();
        } catch (error) {
            console.error('방 불러오기 오류:', error);
            if (!window.isCurrentHousingView(owner, version)) return;
            window.housingView.ready = false;
            window.updateHousingControls();
            document.getElementById('housing-social').hidden = true;
            const status = document.getElementById('housing-room-status');
            status.textContent = '방을 불러오지 못했어요. ';
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.textContent = '다시 불러오기';
            retry.onclick = () => window.openHousingTab(owner);
            status.appendChild(retry);
        }
    };

    window.openHousingTab = async function(targetUser) {
        const owner = targetUser || window.myName;
        const version = window.housingView.version + 1;
        window.housingView = { owner, version, ready: false };
        window.updateHousingControls();
        window.refreshHousingAdminControl();
        document.getElementById('housing-room-title').textContent = owner ? `🏰 ${owner}의 방` : '🏰 용사의 방';
        document.getElementById('my-room-canvas').replaceChildren();
        document.getElementById('my-room-container').style.backgroundImage = 'none';
        document.getElementById('housing-social').hidden = true;
        document.getElementById('housing-guestbook').hidden = true;
        const guestbookButton = document.getElementById('housing-guestbook-button');
        guestbookButton.setAttribute('aria-expanded', 'false');
        guestbookButton.textContent = '📖 방명록 확인';
        const status = document.getElementById('housing-room-status');
        if (!window.myName) {
            status.textContent = '로그인이 필요합니다.';
            return;
        }
        if (window.isHousingEnabled === false && !roomIsAdmin()) {
            status.textContent = '현재 용사의 방을 점검 중입니다.';
            return;
        }
        status.textContent = '방을 불러오는 중이에요…';
        if (owner === window.myName) {
            try {
                await window.syncHousingRewards(owner);
            } catch (error) {
                console.error('방꾸미기 코인 초기화 오류:', error);
            }
        }
        if (!window.isCurrentHousingView(owner, version)) return;
        await window.renderMyRoom();
        if (window.canManageHousing() && window.isCurrentHousingView(owner, version)) {
            window.renderHousingInventory();
        }
    };


    /* =====================================================
       레벨 배경 적용
       ===================================================== */

    window.applyUnlockedHousingBackground=
    async function(
        image,
        requiredLevel
    ){
        if (!window.canManageHousing()) return;
        const { owner, version } = window.housingView;
        const background=LEVEL_BACKGROUNDS.find(entry=>entry.img===image);
        if (!background) return alert('배경 목록에서 선택해 주세요.');
        requiredLevel=background.level;

        const snapshot=
            await db.ref(
                `users/${window.myName}`
            )
            .once('value');

        if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
        const user=
            snapshot.val()||{};

        if(
            roomLevel(user)<
            parseInt(requiredLevel,10)
        ){

            return alert(
                `Lv.${requiredLevel}부터 `+
                `사용할 수 있는 배경입니다.`
            );
        }

        await db.ref(
            `users/${window.myName}/`+
            `myRoom/background`
        )
        .set(image);

        window.renderMyRoom();
    };


    /* =====================================================
       방꾸미기 코인 상점
       ===================================================== */

    window.openHousingShopPopup=
    async function(){
        if (!window.canManageHousing()) return;
        const { owner, version } = window.housingView;

       let user = {};

try {
    user =
        await window.syncHousingRewards(
            window.myName
        ) || {};
} catch (error) {
    console.error(
        "방꾸미기 코인 동기화 오류:",
        error
    );

    const snapshot = await db
        .ref(`users/${window.myName}`)
        .once("value");

    user = snapshot.val() || {};
}

        if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
        const coins=
            parseInt(
                user.roomCoins,
                10
            )||0;

        const html=`
            <div class="stack">
                <div class="housing-shop-toolbar">
                    <button type="button" onclick="closePopup()" aria-label="하우징 상점 닫기">✕ 상점 닫기</button>
                </div>
                <p id="housing-purchase-status" role="status" aria-live="polite"></p>
                <div class="housing-coin">
                    <span>
                        🪙 내 방꾸미기 코인
                    </span>

                    <strong class="housing-coin-value">
                        ${coins.toLocaleString('ko-KR')} C
                    </strong>
                </div>

                <div class="chip-group" id="housing-shop-cat-filter">
                    <button
                        type="button"
                        class="chip-toggle active"
                        data-housing-cat="전체"
                        onclick="loadHousingShop('전체')"
                    >
                        전체
                    </button>

                    <button
                        type="button"
                        class="chip-toggle"
                        data-housing-cat="가구"
                        onclick="loadHousingShop('가구')"
                    >
                        🪑 가구
                    </button>


                </div>

                <p class="muted center">
                    배경은 구매하지 않고 레벨에 따라 해금됩니다.
                </p>

                ${
                    roomIsAdmin()
                        ?`
                            <button
                                class="btn btn--outline btn--lg btn--block"
                                onclick="
                                    openAddHousingShopPopup()
                                "
                            >
                                + 새 가구 등록
                            </button>
                        `
                        :''
                }

                <div
                    id="housing-shop-items"
                    class="grid grid--tight scroll-y"
                    style="max-height:50vh;"
                >
                    불러오는 중...
                </div>
            </div>
        `;

        if(typeof openPopup==='function'){

            openPopup(
                '🛒 하우징 상점',
                html
            );
        }

        window.loadHousingShop(
            '전체'
        );
    };


    window.loadHousingShop=
    function(filterCategory){

        const container=
            document.getElementById(
                'housing-shop-items'
            );

        if(!container){
            return;
        }

        const catFilter=document.getElementById('housing-shop-cat-filter');
        if(catFilter){
            catFilter.querySelectorAll('.chip-toggle').forEach(chip=>{
                chip.classList.toggle('active',chip.dataset.housingCat===filterCategory);
            });
        }

        const {owner,version}=window.housingView;
        return Promise.all([db.ref('housingShop').once('value'),db.ref(`users/${owner}/level`).once('value'),db.ref(`users/${owner}/lv`).once('value')]).then(([snapshot,levelSnapshot,legacyLevelSnapshot])=>{
            if (!window.canManageHousing() || !window.isCurrentHousingView(owner,version)) return;
            const level=roomLevel({level:levelSnapshot.val(),lv:legacyLevelSnapshot.val()});
            const items=[];
            snapshot.forEach(child=>items.push({key:child.key,item:normalizeFurnitureItem(child.val())}));
            const savedImages=new Set(items.map(entry=>entry.item.img).filter(Boolean));
            Object.entries(DEFAULT_FURNITURE).forEach(([key,item])=>{if(!savedImages.has(item.img))items.push({key,item});});

            const visible=items.filter(({item})=>item.category!=='배경'&&(filterCategory==='전체'||item.category===filterCategory));
            const html=visible.map(({key,item})=>{
                const requiredLevel=Math.max(1,item.requiredLevel||1);
                const unlocked=roomIsAdmin()||level>=requiredLevel;
                return `
                    <div class="shop-card${unlocked ? '' : ' is-soldout'}">

                        <div class="tiny muted">
                            ${
                                roomEscape(
                                    item.category
                                )
                            }
                        </div>

                        <img loading="lazy" alt="${roomEscape(item.name)}"
                            src="${
                                roomEscape(
                                    item.img||
                                    item.url||
                                    ''
                                )
                            }"
                            style="
                                width:70px;
                                height:70px;
                                object-fit:contain;
                            "
                        >

                        <div class="strong">
                            ${
                                roomEscape(
                                    item.name
                                )
                            }
                        </div>

                        <div class="shop-price">
                            ${
                                parseInt(
                                    item.price,
                                    10
                                )||0
                            }C
                        </div>

                        ${requiredLevel>1?`<div class="badge ${unlocked?'badge--good':'badge--warn'}">${unlocked?`Lv.${requiredLevel} 해금 완료`:`🔒 Lv.${requiredLevel}부터 구매 가능`}</div>`:''}
                        <button
                            class="btn btn--gold btn--sm btn--block"
                            ${unlocked?'':'disabled'}
                            onclick="
                                buyHousingItem(
                                    '${key}'
                                )
                            "
                        >
                            ${unlocked?'구매하기':`Lv.${requiredLevel} 해금`}
                        </button>

                        ${
                            roomIsAdmin()&&!DEFAULT_FURNITURE[key]
                                ?`
                                    <div class="row-actions">
                                        <button
                                            class="btn btn--xs btn--danger"
                                            onclick="
                                                deleteHousingShopItem(
                                                    '${key}'
                                                )
                                            "
                                        >
                                            삭제
                                        </button>
                                    </div>
                                `
                                :''
                        }

                    </div>
                `;}).join('');

            container.innerHTML=
                visible.length
                    ?html
                    :`
                        <div class="empty" style="grid-column:1/-1;">
                            <strong>등록된 아이템이 없습니다.</strong>
                        </div>
                    `;
        }).catch(error=>{console.error('하우징 가구 불러오기 오류:',error);container.innerHTML='<div class="empty" style="grid-column:1/-1;"><strong>가구를 불러오지 못했습니다.</strong></div>';});
    };


    const pendingPurchases = new Set();
    const purchaseRequests = new Map();

    function purchaseRequest(owner, value) {
        const key = `housing-purchase-pending:${owner}`;
        if (arguments.length > 1) {
            if (value) purchaseRequests.set(owner, value);
            else purchaseRequests.delete(owner);
            try {
                if (value) sessionStorage.setItem(key, JSON.stringify(value));
                else sessionStorage.removeItem(key);
            } catch (_) { /* 저장소를 사용할 수 없어도 현재 탭에서는 같은 구매 번호를 유지한다. */ }
            return value;
        }
        if (purchaseRequests.has(owner)) return purchaseRequests.get(owner);
        try {
            const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
            if (saved && typeof saved.id === 'string' && /^[A-Za-z0-9_-]+$/.test(saved.id) && typeof saved.itemKey === 'string') {
                purchaseRequests.set(owner, saved);
                return saved;
            }
        } catch (_) { /* 브라우저 저장소가 차단된 경우 */ }
        return null;
    }

    function purchaseConnectionError(error) {
        return /disconnect|network[_ -]?(error|request[_ -]?failed)|unavailable/i.test(
            `${error?.code || ''} ${error?.message || ''}`
        );
    }

    function waitForHousingConnection() {
        return new Promise((resolve, reject) => {
            const ref = db.ref('.info/connected');
            let finished = false;
            const finish = error => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                ref.off('value', changed);
                if (error) reject(error); else resolve();
            };
            const changed = snapshot => { if (snapshot.val() === true) finish(); };
            const timer = setTimeout(() => finish(Object.assign(
                new Error('disconnect: connection timeout'), { code: 'housing/disconnect' }
            )), 12000);
            try { ref.on('value', changed, finish); } catch (error) { finish(error); }
        });
    }

    async function commitHousingPurchase(ref, update, owner, version, status) {
        // 재시도는 같은 구매 번호를 사용한다. 응답만 유실된 경우에도 다시 차감하지 않는다.
        for (let attempt = 0; attempt < 3; attempt++) {
            status(attempt ? '서버 연결을 기다리고 있어요. 같은 구매 건을 다시 확인합니다…' : '서버 연결을 확인하고 있어요…');
            await waitForHousingConnection();
            if (window.myName !== owner || !window.canManageHousing() || !window.isCurrentHousingView(owner, version)) {
                throw Object.assign(new Error('purchase view changed'), { code: 'housing/cancelled' });
            }
            try {
                status('구매를 저장하고 있어요. 잠시 기다려 주세요…');
                return await ref.transaction(update, undefined, false);
            } catch (error) {
                if (!purchaseConnectionError(error) || attempt === 2) throw error;
            }
        }
    }

    window.buyHousingItem = async function(itemKey) {
        if (!window.canManageHousing()) return;
        const { owner, version } = window.housingView;
        if (pendingPurchases.has(owner)) return;
        pendingPurchases.add(owner);
        let purchased = false;
        const status = message => {
            if (!window.isCurrentHousingView(owner, version)) return;
            const element = document.getElementById('housing-purchase-status') || document.getElementById('housing-room-status');
            if (element) element.textContent = message;
        };
        try {
            const previous = purchaseRequest(owner);
            if (previous && previous.itemKey !== itemKey) {
                return alert(`이전 [${previous.name || previous.itemKey}] 구매 결과를 먼저 확인해야 합니다. 같은 물건의 구매 버튼을 눌러 이어서 확인해 주세요.`);
            }
            let item = previous?.item || (Object.hasOwn(DEFAULT_FURNITURE, itemKey) ? DEFAULT_FURNITURE[itemKey] : null);
            if (!item) item = (await db.ref(`housingShop/${itemKey}`).once('value')).val();
            item = item ? normalizeFurnitureItem(item) : null;
            if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
            if (!item) return alert('존재하지 않는 아이템입니다.');
            if (item.category === '배경') return alert('배경은 레벨 해금 목록에서 선택해 주세요.');
            const price = Number(item.price);
            if (!Number.isSafeInteger(price) || price < 0) return alert('아이템 가격을 확인해 주세요.');
            const createAdmin = roomIsAdmin();
            const charge = createAdmin ? 0 : price;
            const message = createAdmin ? `[${item.name}]을 교사 무료 구매하시겠습니까?` :
                `[${item.name}]을 방꾸미기 코인 ${charge}C에 구매하시겠습니까?`;
            if (!confirm(previous ? `이전 [${item.name}] 구매를 확인합니다. 이미 저장됐으면 추가 차감하지 않습니다. 미완료라면 ${charge}C로 구매를 마칠까요?` : message)) return;
            const request = previous || purchaseRequest(owner, {
                id: db.ref(`users/${owner}/housingPurchases`).push().key, itemKey, name: item.name, item
            });
            const purchaseId = request.id;
            const requiredLevel = Math.max(1,item.requiredLevel||1);
            if (!createAdmin && roomLevel(window.currentUser || {}) < requiredLevel) {
                return alert(`Lv.${requiredLevel}부터 구매할 수 있는 가구입니다.`);
            }
            status('서버에서 가격·레벨·잔액을 확인하고 있어요…');
            const saved = await window.callSecure('purchaseHousingItem', { itemKey, purchaseId });
            purchaseRequest(owner, null);
            purchased = true;
            status('구매 내역과 보관함에 저장했습니다.');
            const receipt = saved.receipt;
            alert(receipt.teacherFree ? '교사 무료 구매 완료! 보관함과 구매 내역에 저장했습니다.' :
                `구매 완료! ${receipt.price}C를 사용했습니다. 남은 코인: ${saved.roomCoins}C`);
        } catch (error) {
            console.error('하우징 구매 저장 오류:', error);
            if (error.code === 'housing/cancelled') return;
            const message = purchaseConnectionError(error)
                ? 'Firebase 서버 연결이 끊겨 구매 결과를 확인하지 못했습니다. 연결이 돌아오면 같은 물건의 구매 버튼을 다시 눌러 주세요. 같은 구매 번호로 확인하므로 중복 차감하지 않습니다.'
                : /permission[_ -]?denied/i.test(`${error.code || ''} ${error.message || ''}`)
                    ? 'Firebase에서 저장 권한을 거부했습니다. 로그인 상태와 데이터베이스 규칙을 확인해 주세요.'
                    : `구매 처리 오류: ${error.message || error.code || '알 수 없는 오류'}`;
            status(message);
            alert(message);
        } finally {
            pendingPurchases.delete(owner);
        }
        if (purchased && window.canManageHousing() && window.isCurrentHousingView(owner, version)) {
            // 화면 새로고침 실패를 구매 실패로 표시하지 않는다.
            try {
                await window.renderHousingInventory();
                await window.renderMyRoom();
                if (window.canManageHousing() && window.isCurrentHousingView(owner, version)) await window.openHousingShopPopup();
            } catch (error) {
                console.error('구매 후 화면 갱신 오류:', error);
                alert('구매는 저장되었습니다. 방을 다시 열어 보관함과 잔액을 확인해 주세요.');
            }
        }
    };

    window.openHousingPurchaseHistory = async function() {
        if (!window.canManageHousing()) return;
        const { owner, version } = window.housingView;
        try {
            const snapshot = await db.ref(`users/${owner}/housingPurchases`).once('value');
            if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
            const records = Object.values(snapshot.val() || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const rows = records.map(record => `<li class="housing-guestbook-entry">
                <strong>${roomEscape(record.name)}</strong> · ${record.teacherFree ? '교사 무료' : `${roomEscape(record.price)}C`}
                <div>${roomEscape(new Date(record.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))}
                · 구매 후 잔액 ${roomEscape(record.balanceAfter)}C</div></li>`).join('');
            openPopup('🧾 내 하우징 구매 내역', `<div id="housing-purchase-history">
                <button type="button" onclick="closePopup()">✕ 닫기</button>
                <p>학생은 방꾸미기 코인(C) 사용, 교사는 무료로 기록됩니다. 이전 버전의 물건은 보관함에서 확인하세요.</p>
                ${rows ? `<ul class="scroll-y" style="max-height:55vh;">${rows}</ul>` : '<p>아직 저장된 구매 내역이 없습니다.</p>'}
            </div>`);
        } catch (error) {
            console.error('하우징 구매 내역 조회 오류:', error);
            if (window.isCurrentHousingView(owner, version)) alert('구매 내역을 불러오지 못했습니다. 다시 시도해 주세요.');
        }
    };

})();
