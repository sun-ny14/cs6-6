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
    if (document.getElementById('housing-shop-items')) window.closePopup();
};

window.updateHousingControls = function() {
    const editable = window.canManageHousing();
    ['housing-shop-button', 'housing-save-controls', 'housing-inventory-panel',
        'housing-wallet-bar', 'housing-background-panel'].forEach(id => {
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

        button.style.backgroundColor =
            window.isHousingEnabled
                ? "#e74c3c"
                : "#27ae60";
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
        db.ref('settings/defaultBg').once('value'),
        db.ref(`users/${owner}/myRoom`).once('value')
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
        <div style="text-align:center; padding: 10px;">
            <h3 style="margin-top:0;">🛠️ ${type} 설정</h3>
            <p style="color:#666; font-size:1.1rem;">현재 크기: ${Math.round(currentW)} x ${Math.round(currentH)}</p>
            <div style="display:flex; justify-content:center; gap:10px; margin-bottom: 20px;">
                <button onclick="resizeRoomItem('${key}', ${currentW*1.2}, ${currentH*1.2}, ${maxW}, ${maxH}, 'up')" style="flex:1; padding:15px; background:var(--green, #2ecc71); color:white; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem; cursor:pointer;">➕ 크게</button>
                <button onclick="resizeRoomItem('${key}', ${currentW*0.8}, ${currentH*0.8}, ${minW}, ${minH}, 'down')" style="flex:1; padding:15px; background:var(--gold, #f1c40f); color:var(--dark, #333); border:none; border-radius:10px; font-weight:bold; font-size:1.1rem; cursor:pointer;">➖ 작게</button>
                <button onclick="toggleFlipRoomItem('${key}', ${isFlipped ? true : false})" style="flex:1; padding:15px; background:var(--primary, #3498db); color:white; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem; cursor:pointer;">↔️ 반전</button>
            </div>
            <button onclick="deleteRoomItem('${key}')" style="padding:15px; width:100%; background:var(--red, #e74c3c); color:white; border:none; border-radius:10px; font-weight:bold; font-size:1.2rem; cursor:pointer;">🗑️ 이 아이템 치우기</button>
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

    db.ref(`users/${myName}/housingInventory`).once('value', snap => {
        if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;
        list.innerHTML = '';
        const inv = snap.val() || {};
        let hasItems = false;
        for (let k in inv) {
            hasItems = true; const i = inv[k];
            list.innerHTML += `<div style="border:1px solid #ccc; padding:10px; border-radius:8px; text-align:center; min-width:80px; background:#f8f9fa;">
                <div style="font-size:0.75rem; color:#666; font-weight:bold;">${i.category}</div>
                <img src="${i.img}" style="width:40px; height:40px; object-fit:contain; image-rendering:pixelated; margin:5px 0;">
                <div style="font-size:0.85rem; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${i.name}</div>
                <button onclick="placeOrApplyHousingItem('${i.img}', '${i.category}')" style="width:100%; padding:5px; margin-top:5px; background:var(--primary, #3498db); color:white; border:none; border-radius:4px; cursor:pointer;">${i.category==='배경'?'배경적용':'배치하기'}</button>
            </div>`;
        }
        if (!hasItems) list.innerHTML = `<p style="color:#888; font-size:0.9rem; margin-top:10px;">아직 구매한 하우징 아이템이 없습니다.</p>`;
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
        <div style="background:#f8f9fa; padding:15px; border-radius:15px; margin-bottom:15px; text-align:center;">
            <button onclick="loadHousingShop('전체')" style="padding:10px; margin:2px; cursor:pointer; font-weight:bold;">전체</button>
            <button onclick="loadHousingShop('배경')" style="padding:10px; margin:2px; cursor:pointer; font-weight:bold;">🖼️ 배경</button>
            <button onclick="loadHousingShop('가구')" style="padding:10px; margin:2px; cursor:pointer; font-weight:bold;">🪑 가구</button>
            <button onclick="loadHousingShop('인물')" style="padding:10px; margin:2px; cursor:pointer; font-weight:bold;">👤 인물</button>
        </div>
        ${isAdmin ? `<button onclick="openAddHousingShopPopup()" style="background:var(--green, #2ecc71); color:white; font-weight:bold; margin-bottom:15px; width:100%; border:none; padding:15px; border-radius:10px; cursor:pointer;">+ 새 아이템 직접 등록</button>` : ''}
        <div id="housing-shop-items" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:15px; max-height:50vh; overflow-y:auto; padding:5px;">로딩 중...</div>
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
                <div style="border:1px solid #ddd; padding:10px; border-radius:12px; text-align:center; background:white;">
                    <div style="font-size:0.75rem; color:#888;">${item.category}</div>
                    <img src="${item.img}" style="width:50px; height:50px; object-fit:contain; image-rendering:pixelated; margin:8px 0;">
                    <div style="font-weight:bold;">${item.name}</div>
                    <div style="color:var(--primary, #3498db); font-weight:bold; margin:5px 0;">${item.price}P</div>
                    <button onclick="buyHousingItem('${k}')" style="width:100%; padding:6px; background:var(--gold, #f1c40f); font-weight:bold; border:none; border-radius:6px; cursor:pointer;">구매하기</button>
                    ${isAdmin ? `<button onclick="deleteHousingShopItem('${k}')" style="width:100%; padding:4px; margin-top:5px; background:var(--red, #e74c3c); color:white; border:none; border-radius:6px; font-size:0.8rem; cursor:pointer;">삭제</button>` : ''}
                </div>
            `;
        });
        container.innerHTML = hasItems ? html : `<div style="grid-column:1/-1; text-align:center; color:#999;">등록된 아이템이 없습니다.</div>`;
    });
};

window.deleteHousingShopItem = function(key) {
    if (confirm("상점에서 이 아이템을 영구 삭제하시겠습니까?")) {
        db.ref('housingShop/' + key).remove().then(() => loadHousingShop('전체'));
    }
};

window.openAddHousingShopPopup = function(itemKey = null, itemData = {}) {
    let h = `
        <label style="font-weight:bold; display:block; margin-top:5px;">아이템명:</label><input type="text" id="hs-name" value="${itemData.name || ''}" style="width:100%; padding:8px; margin-top:5px; box-sizing:border-box;">
        <label style="font-weight:bold; display:block; margin-top:10px;">가격(P):</label><input type="number" id="hs-price" value="${itemData.price || 0}" style="width:100%; padding:8px; margin-top:5px; box-sizing:border-box;">
        <label style="font-weight:bold; display:block; margin-top:10px;">카테고리:</label>
        <select id="hs-cat" style="width:100%; padding:8px; margin-top:5px; box-sizing:border-box;">
            <option value="배경">🖼️ 배경</option>
            <option value="가구">🪑 가구</option>
        </select>
        <label style="font-weight:bold; display:block; margin-top:10px;">이미지 첨부:</label>
        <input type="file" id="hs-file" accept="image/*" style="width:100%; margin-top:5px;">
        <button onclick="saveHousingItem('${itemKey}')" style="width:100%; padding:15px; background:var(--primary, #3498db); color:white; border:none; border-radius:8px; font-weight:bold; margin-top:15px; cursor:pointer;">저장하기</button>
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

window.buyHousingItem = async function(key) {
    const sn = await db.ref('users/' + myName).once('value');
    const myPts = sn.val().points || 0;
    
    const itemSnap = await db.ref('housingShop/' + key).once('value');
    const item = itemSnap.val();
    if (!item) return alert("존재하지 않는 아이템입니다.");
    
    const price = parseInt(item.price) || 0;
    const name = item.name;
    const category = item.category;
    const img = item.img || item.url;

    if (!isAdmin && (myPts < 0 || myPts < price)) {
        return alert("포인트가 마이너스이거나 부족합니다! 😭");
    }

    if (!confirm(`[${name}] 아이템을 ${price}P에 구매하시겠습니까?`)) return;
    
    await db.ref('users/' + myName).update({ points: myPts - price });
    await db.ref(`users/${myName}/housingInventory`).push({ name: name, category: category, img: img });
    
    alert("✅ 구매 완료! 내 하우징 보관함을 확인하세요.");
    if (typeof currentTab !== 'undefined' && currentTab === 'housing') renderHousingInventory();
};

window.saveMyRoom = function() {
    if (!window.canManageHousing()) return;
    alert("가구나 인물을 움직이면 실시간으로 자동 저장됩니다! 🏠✨");
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
        const snapshot = await db.ref(`users/${owner}/myRoom`).once('value');
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
        const offset = await db.ref('.info/serverTimeOffset').once('value');
        window.housingServerTimeOffset = Number(offset.val()) || 0;
        if (!window.isCurrentHousingView(owner, version) || window.myName !== visitor) return;
        const day = housingToday(Date.now() + window.housingServerTimeOffset);
        const entryKey = db.ref(`users/${owner}/myRoom/guestbook`).push().key;
        // 한 트랜잭션에서 일일 제한과 방명록을 함께 저장한다.
        // 연속 클릭, 여러 탭, 서로 다른 이모지 요청이 겹쳐도 한 건만 기록된다.
        const result = await db.ref(`users/${owner}/myRoom`).transaction(current => {
            const room = current || {};
            if (hasHousingReaction(room, visitor, day)) return;
            room.dailyReactions = room.dailyReactions || {};
            room.dailyReactions[visitor] = room.dailyReactions[visitor] || {};
            room.dailyReactions[visitor][day] = type;
            room.guestbook = room.guestbook || {};
            room.guestbook[entryKey] = {
                user: visitor, type, day,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            room[type] = (Number(room[type]) || 0) + 1;
            return room;
        }, undefined, false);
        housingPendingReactions.delete(pendingKey);
        if (!window.isCurrentHousingView(owner, version)) return;
        window.housingView.socialRevision = (window.housingView.socialRevision || 0) + 1;
        window.renderRoomSocial(result.snapshot.val() || {});
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
        'builtin-toy-box':{name:'장난감 상자',category:'가구',img:'assets/housing/furniture/toy-box.png',price:5}
    };

    function normalizeFurnitureItem(item){
        const value={...(item||{})};
        const rawCategory=String(value.category||value.cat||value.type||'').trim();
        value.category=rawCategory.includes('배경')?'배경':rawCategory.includes('인물')?'인물':'가구';
        value.img=value.img||value.url||'';
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

   window.syncHousingRewards = async function(userName) {
    if (!userName) return null;

    const ref = db.ref(`users/${userName}`);
    const snapshot = await ref.once("value");
    const user = snapshot.val();

    if (!user) return null;

    const currentLevel = roomLevel(user);
    const savedCoins = parseInt(user.roomCoins, 10);
    const savedRewardedLevel =
        parseInt(user.roomRewardedLevel, 10);

    let nextCoins = Number.isFinite(savedCoins)
        ? savedCoins
        : START_COINS;

    let nextRewardedLevel =
        Number.isFinite(savedRewardedLevel)
            ? savedRewardedLevel
            : currentLevel;

    if (
        Number.isFinite(savedCoins) &&
        Number.isFinite(savedRewardedLevel) &&
        currentLevel > savedRewardedLevel
    ) {
        nextCoins +=
            (currentLevel - savedRewardedLevel) *
            LEVEL_REWARD;

        nextRewardedLevel = currentLevel;
    }

    const updates = {
        roomCoins: nextCoins,
        roomRewardedLevel: nextRewardedLevel
    };

    await ref.update(updates);

    return {
        ...user,
        ...updates
    };
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

        if(!userName){
            return false;
        }

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

            wallet.style.cssText=`
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                width:100%;
                max-width:640px;
                margin:0 auto 16px;
                padding:15px 18px;
                background:#fff4bd;
                border:2px solid #e7b625;
                border-radius:14px;
                color:#4b3a00;
                font-weight:900;
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

            backgroundPanel.style.cssText=`
                width:100%;
                max-width:640px;
                margin:18px auto 0;
                padding:18px;
                background:#f8fafc;
                border:1px solid #dbe2ea;
                border-radius:15px;
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

                <strong style="
                    font-size:1.35rem;
                ">
                    ${coins.toLocaleString('ko-KR')} C
                </strong>

                <small style="
                    color:#6b5a1c;
                ">
                    Lv.${level}
                    · 레벨업 +${LEVEL_REWARD}C
                    · 정상등교 +${CHECKIN_REWARD}C
                </small>
            `;
        }

        if(panel){

            panel.innerHTML=`
                <h3 style="
                    margin:0 0 12px;
                    color:#263b63;
                ">
                    🖼️ 레벨 배경
                </h3>

                <div style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(145px,1fr)
                        );
                    gap:10px;
                ">

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
                                    onclick="
                                        applyUnlockedHousingBackground(
                                            '${background.img}',
                                            ${background.level}
                                        )
                                    "
                                    ${unlocked?'':'disabled'}
                                    style="
                                        padding:10px;
                                        text-align:left;
                                        background:${
                                            selected
                                                ?'#e5f0ff'
                                                :'#fff'
                                        };
                                        border:2px solid ${
                                            selected
                                                ?'#3975d5'
                                                :'#d9e0e8'
                                        };
                                        border-radius:12px;
                                        cursor:${
                                            unlocked
                                                ?'pointer'
                                                :'not-allowed'
                                        };
                                        opacity:${
                                            unlocked
                                                ?'1'
                                                :'.55'
                                        };
                                    "
                                >

                                    <div style="
                                        height:78px;
                                        margin-bottom:7px;
                                        border-radius:8px;
                                        background:
                                            #e9edf3
                                            url('${background.img}')
                                            center/cover
                                            no-repeat;
                                    ">
                                    </div>

                                    <strong style="
                                        display:block;
                                        color:#263b63;
                                    ">
                                        ${
                                            roomEscape(
                                                background.name
                                            )
                                        }
                                    </strong>

                                    <small style="
                                        color:${
                                            unlocked
                                                ?'#24713f'
                                                :'#a33'
                                        };
                                        font-weight:800;
                                    ">
                                        ${
                                            unlocked
                                                ?'사용 가능'
                                                :`Lv.${background.level} 해금`
                                        }
                                    </small>

                                </button>
                            `;
                        })
                        .join('')
                    }

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
            <div class="housing-shop-toolbar">
                <button type="button" onclick="closePopup()" aria-label="하우징 상점 닫기">✕ 상점 닫기</button>
            </div>
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                padding:14px 16px;
                margin-bottom:12px;
                background:#fff4bd;
                border:2px solid #e7b625;
                border-radius:13px;
                color:#4b3a00;
                font-weight:900;
            ">
                <span>
                    🪙 내 방꾸미기 코인
                </span>

                <strong style="
                    font-size:1.35rem;
                ">
                    ${coins.toLocaleString('ko-KR')} C
                </strong>
            </div>

            <div style="
                display:flex;
                justify-content:center;
                gap:8px;
                flex-wrap:wrap;
                padding:12px;
                margin-bottom:10px;
                background:#f8f9fa;
                border-radius:12px;
            ">
                <button
                    onclick="loadHousingShop('전체')"
                >
                    전체
                </button>

                <button
                    onclick="loadHousingShop('가구')"
                >
                    🪑 가구
                </button>

            
            </div>

            <p style="
                margin:0 0 12px;
                text-align:center;
                color:#667085;
            ">
                배경은 구매하지 않고 레벨에 따라 해금됩니다.
            </p>

            ${
                roomIsAdmin()
                    ?`
                        <button
                            onclick="
                                openAddHousingShopPopup()
                            "
                            style="
                                width:100%;
                                margin-bottom:12px;
                                padding:13px;
                                color:white;
                                background:#2eaf62;
                                border:0;
                                border-radius:10px;
                                font-weight:900;
                                cursor:pointer;
                            "
                        >
                            + 새 가구 등록
                        </button>
                    `
                    :''
            }

            <div
                id="housing-shop-items"
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fill,
                            minmax(140px,1fr)
                        );
                    gap:12px;
                    max-height:50vh;
                    padding:5px;
                    overflow-y:auto;
                "
            >
                불러오는 중...
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

        db.ref('housingShop').once('value').then(snapshot=>{
            const items=[];
            snapshot.forEach(child=>items.push({key:child.key,item:normalizeFurnitureItem(child.val())}));
            const savedImages=new Set(items.map(entry=>entry.item.img).filter(Boolean));
            Object.entries(DEFAULT_FURNITURE).forEach(([key,item])=>{if(!savedImages.has(item.img))items.push({key,item});});

            const visible=items.filter(({item})=>item.category!=='배경'&&(filterCategory==='전체'||item.category===filterCategory));
            const html=visible.map(({key,item})=>`
                    <div style="
                        padding:12px;
                        text-align:center;
                        background:white;
                        border:1px solid #d9dee8;
                        border-radius:12px;
                    ">

                        <div style="
                            color:#667085;
                            font-size:.78rem;
                        ">
                            ${
                                roomEscape(
                                    item.category
                                )
                            }
                        </div>

                        <img
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
                                margin:8px 0;
                                object-fit:contain;
                            "
                        >

                        <div style="
                            font-weight:900;
                        ">
                            ${
                                roomEscape(
                                    item.name
                                )
                            }
                        </div>

                        <div style="
                            margin:6px 0;
                            color:#946700;
                            font-weight:900;
                        ">
                            ${
                                parseInt(
                                    item.price,
                                    10
                                )||0
                            }C
                        </div>

                        <button
                            onclick="
                                buyHousingItem(
                                    '${key}'
                                )
                            "
                            style="
                                width:100%;
                                padding:8px;
                                background:#f4c542;
                                border:0;
                                border-radius:7px;
                                font-weight:900;
                                cursor:pointer;
                            "
                        >
                            구매하기
                        </button>

                        ${
                            roomIsAdmin()&&!DEFAULT_FURNITURE[key]
                                ?`
                                    <button
                                        onclick="
                                            deleteHousingShopItem(
                                                '${key}'
                                            )
                                        "
                                        style="
                                            width:100%;
                                            margin-top:5px;
                                            padding:6px;
                                            color:white;
                                            background:#dc4c4c;
                                            border:0;
                                            border-radius:7px;
                                            cursor:pointer;
                                        "
                                    >
                                        삭제
                                    </button>
                                `
                                :''
                        }

                    </div>
                `).join('');

            container.innerHTML=
                visible.length
                    ?html
                    :`
                        <p style="
                            grid-column:1/-1;
                            text-align:center;
                            color:#999;
                        ">
                            등록된 아이템이 없습니다.
                        </p>
                    `;
        }).catch(error=>{console.error('하우징 가구 불러오기 오류:',error);container.innerHTML='<p style="grid-column:1/-1;text-align:center;color:#c0392b;">가구를 불러오지 못했습니다.</p>';});
    };


    window.buyHousingItem=
    async function(itemKey){
        if (!window.canManageHousing()) return;
        const { owner, version } = window.housingView;

        let item=DEFAULT_FURNITURE[itemKey]||null;
        if(!item){const itemSnapshot=await db.ref(`housingShop/${itemKey}`).once('value');item=itemSnapshot.val();}
        item=item?normalizeFurnitureItem(item):null;
        if (!window.canManageHousing() || !window.isCurrentHousingView(owner, version)) return;

        if(!item){

            return alert(
                '존재하지 않는 아이템입니다.'
            );
        }

        if(item.category==='배경'){

            return alert(
                '배경은 레벨 해금 목록에서 선택해 주세요.'
            );
        }

        const price=
            Math.max(
                0,
                parseInt(
                    item.price,
                    10
                )||0
            );

        const charge=
            roomIsAdmin()
                ?0
                :price;

        const message=
            roomIsAdmin()
                ?`[${item.name}] 관리자 테스트 구매`
                :`[${item.name}]을 ${price}C에 구매하시겠습니까?`;

        if(!confirm(message)){
            return;
        }

        const inventoryKey=
            db.ref(
                `users/${window.myName}/housingInventory`
            )
            .push()
            .key;

        let insufficient=false;

        const result=
            await db.ref(
                `users/${window.myName}`
            )
            .transaction(user=>{

                if(!user){
                    return user;
                }

                const currentCoins=
                    parseInt(
                        user.roomCoins,
                        10
                    );

                if(!Number.isFinite(currentCoins)){

                    user.roomCoins=
                        START_COINS;

                    user.roomRewardedLevel=
                        roomLevel(user);
                }

                if(
                    !roomIsAdmin()&&
                    user.roomCoins<charge
                ){

                    insufficient=true;

                    return;
                }

                user.roomCoins=
                    (
                        parseInt(
                            user.roomCoins,
                            10
                        )||0
                    )-
                    charge;

                user.housingInventory=
                    user.housingInventory||{};

                user.housingInventory[
                    inventoryKey
                ]={
                    shopKey:
                        itemKey,

                    name:
                        item.name,

                    category:
                        item.category,

                    img:
                        item.img||
                        item.url||
                        '',

                    purchasedAt:
                        Date.now()
                };

                return user;
            });

        if(!result.committed){

            return alert(
                insufficient
                    ?'방꾸미기 코인이 부족합니다.'
                    :'구매 처리 중 오류가 발생했습니다.'
            );
        }

        if(charge>0){

            db.ref('roomCoinLogs')
            .push({
                name:
                    window.myName,

                amount:
                    -charge,

                reason:
                    `하우징 상점 구매: ${item.name}`,

                itemKey:
                    itemKey,

                timestamp:
                    Date.now(),

                time:
                    new Date()
                    .toLocaleString(
                        'ko-KR'
                    )
            });
        }

        alert(
            charge>0
                ?`구매 완료! ${charge}C를 사용했습니다.`
                :'관리자 테스트 구매가 완료되었습니다.'
        );

        if(
            typeof window
                .renderHousingInventory===
            'function'
        ){
            window.renderHousingInventory();
        }

        if (window.canManageHousing() && window.isCurrentHousingView(owner, version)) {
            window.renderMyRoom();
            window.openHousingShopPopup();
        }
    };

})();
