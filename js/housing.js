// js/housing.js - 용사의 방 렌더링, 가구 배치, 크기/반전 편집, 하우징 상점 및 친구 방 방문/방명록 통합 관리

// 1. 관리자용 하우징 시스템 ON/OFF 토글
window.toggleHousing = function() {
    if (!isAdmin) return;
    const newState = !window.isHousingEnabled;
    db.ref('settings/housingEnabled').set(newState).then(() => {
        alert(newState ? "🟢 용사의 방 시스템이 [켜짐] 상태가 되었습니다." : "🔴 용사의 방 시스템이 [꺼짐] 상태가 되었습니다.");
    });
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
    const container = document.getElementById('my-room-container'); 
    if (!container) return;
    
    db.ref('settings/defaultBg').once('value').then(defaultSnap => {
        const defaultBg = defaultSnap.val() || window.currentDefaultBg || '#d7ccc8'; 
        
        db.ref(`users/${myName}/myRoom`).once('value', snap => {
            const room = snap.val() || {}; 
            const myBg = room.background;
            
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
                    div.style.cursor = 'grab';
                    div.title = "드래그: 이동 / 더블클릭(길게누르기): 크기 조절 및 삭제";
                    
                    const flipStyle = o.flipX ? 'transform: scaleX(-1);' : '';
                    
                    div.innerHTML = `<img src="${o.img}" style="width:100%; height:100%; object-fit:contain; image-rendering:pixelated; pointer-events:none; background:transparent; ${flipStyle}">`;
                    
                    div.ondblclick = (e) => {
                        e.stopPropagation();
                        openItemEditor(key, o.type, currentW, currentH, o.flipX);
                    };

                    let pressTimer;
                    let isDragging = false;

                    const startDrag = function(e) {
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
                            if (!isDragging && isTouch) openItemEditor(key, o.type, currentW, currentH, o.flipX);
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
                            if (newX > (640 - currentW)) newX = (640 - currentW); 
                            if (newY > (480 - currentH)) newY = (480 - currentH);
                            
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
                            db.ref(`users/${myName}/myRoom/objects/${key}`).update({x: finalX, y: finalY});
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
        });
    });
};

// 5. 아이템 크기 조절, 반전 및 삭제 팝업
window.openItemEditor = function(key, type, currentW, currentH, isFlipped) {
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
    db.ref(`users/${myName}/myRoom/objects/${key}`).update({
        flipX: !currentFlipState
    }).then(() => {
        renderMyRoom(); 
        if (typeof closePopup === 'function') closePopup(); 
    });
};

window.resizeRoomItem = function(key, newW, newH, limitW, limitH, dir) {
    if (dir === 'up' && (newW > limitW || newH > limitH)) return alert("해당 아이템을 더 이상 크게 만들 수 없습니다!");
    if (dir === 'down' && (newW < limitW || newH < limitH)) return alert("해당 아이템을 더 이상 작게 만들 수 없습니다!");
    db.ref(`users/${myName}/myRoom/objects/${key}`).update({w: Math.round(newW), h: Math.round(newH)}).then(() => {
        renderMyRoom(); 
        if (typeof closePopup === 'function') closePopup(); 
    });
};

window.deleteRoomItem = function(key) {
    if (confirm("정말 방에서 이 아이템을 치우시겠습니까?")) {
        db.ref(`users/${myName}/myRoom/objects/${key}`).remove().then(() => {
            renderMyRoom(); 
            if (typeof closePopup === 'function') closePopup();
        });
    }
};

// 6. 내 하우징 보관함 로드 및 배치
window.renderHousingInventory = function() {
    const list = document.getElementById('housing-inventory-list');
    if (!list) return;

    db.ref(`users/${myName}/housingInventory`).once('value', snap => {
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
            const k = child.key; const item = child.val();
            if (filterCat !== '전체' && item.category !== filterCat) return;
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
            <option value="인물">👤 인물</option>
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
    alert("가구나 인물을 움직이면 실시간으로 자동 저장됩니다! 🏠✨");
};

// 8. 친구 방 방문 및 반응/방명록 시스템
window.visitFriendRoom = function(targetUser) {
    db.ref(`users/${targetUser}/myRoom`).once('value', snap => {
        const room = snap.val() || {};
        
        db.ref('settings/defaultBg').once('value').then(defaultSnap => {
            const defaultBg = defaultSnap.val() || window.currentDefaultBg || '#d7ccc8';
            const bgImg = room.background || defaultBg;
            
            let objectsHtml = "";
            if (room.objects) {
                Object.keys(room.objects).forEach(key => {
                    const o = room.objects[key];
                    let isPerson = (o.type && (o.type.includes('인물') || o.type.includes('사람')));
                    let currentW = o.w || (isPerson ? 64 : 48);
                    let currentH = o.h || (isPerson ? 96 : 48);
                    const flipStyle = o.flipX ? 'transform: scaleX(-1);' : '';
                    
                    objectsHtml += `<div style="position:absolute; left:${o.x||0}px; top:${o.y||0}px; width:${currentW}px; height:${currentH}px; pointer-events:none;">
                        <img src="${o.img}" loading="lazy" decoding="async" style="width:100%; height:100%; object-fit:contain; image-rendering:pixelated; background:transparent; ${flipStyle}">
                    </div>`;
                });
            }

            const likes = room.likes || 0;
            const hearts = room.hearts || 0;

            let guestbookHtml = `
                <div style="margin-top:20px; text-align:left; background:#f8f9fa; padding:15px; border-radius:15px; border:2px solid #e9ecef;">
                    <h4 style="margin:0 0 10px 0; color:#495057;">📝 방문 기록</h4>
                    <div style="max-height:150px; overflow-y:auto; padding-right:5px;">
            `;
            
            if (room.guestbook) {
                Object.values(room.guestbook).reverse().forEach(e => {
                    guestbookHtml += `
                        <div style="padding:8px 0; border-bottom:1px solid #eee; font-size:0.95rem; display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#333; font-weight:bold;">${e.text}</span>
                            <small style="color:#999; font-size:0.8rem;">${e.time}</small>
                        </div>`;
                });
            } else {
                guestbookHtml += `<p style="color:#aaa; margin:10px 0; font-size:0.9rem; text-align:center;">아직 방문 기록이 없습니다. 첫 번째로 반응을 남겨보세요! ✨</p>`;
            }
            
            guestbookHtml += `
                    </div>
                </div>`;

            let h = `
                <div style="text-align:center;">
                    <h3 style="margin-top:0;">${targetUser} 용사의 방 🏰</h3>
                    <div style="position: relative; width: 100%; max-width: 640px; height: 480px; border: 4px solid #5d4037; border-radius: 15px; background-image: url('${bgImg}'); background-size: 100% 100%; background-position: center; overflow: hidden; margin: 0 auto; margin-bottom: 20px;">
                        ${objectsHtml}
                    </div>
                    
                    <div style="display:flex; justify-content:center; gap:15px; margin-bottom:10px;">
                        <button onclick="sendRoomReaction('${targetUser}', 'likes')" style="flex:1; padding:15px; background:var(--primary, #3498db); color:white; border:none; border-radius:10px; font-size:1.2rem; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                            👍 멋져요! (${likes})
                        </button>
                        <button onclick="sendRoomReaction('${targetUser}', 'hearts')" style="flex:1; padding:15px; background:var(--red, #e74c3c); color:white; border:none; border-radius:10px; font-size:1.2rem; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                            ❤️ 귀여워요! (${hearts})
                        </button>
                    </div>

                    ${guestbookHtml}
                </div>
            `;
            if (typeof openPopup === 'function') openPopup(`${targetUser}의 방 구경하기`, h);
        });
    });
};

window.sendRoomReaction = function(targetUser, type) {
    if (targetUser === myName) {
        return alert("자신의 방에는 반응을 남길 수 없습니다! 😅");
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const reactionRef = db.ref(`users/${targetUser}/myRoom/reactions_${type}/${myName}/${todayStr}`);
    
    reactionRef.once('value', snap => {
        if (snap.exists()) {
            return alert("오늘 이미 이 반응을 남기셨습니다! 내일 다시 응원해주세요. 😉");
        }

        const countRef = db.ref(`users/${targetUser}/myRoom/${type}`);
        countRef.once('value', countSnap => {
            const currentCount = countSnap.val() || 0;
            
            countRef.set(currentCount + 1);
            reactionRef.set(true); 
            
            const reactionText = type === 'likes' ? '👍 멋져요' : '❤️ 귀여워요';
            const timeStr = new Date().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            db.ref(`users/${targetUser}/myRoom/guestbook`).push({
                user: myName,
                text: `💌 ${myName} 용사가 ${reactionText}를 보냈습니다!`,
                time: timeStr
            }).then(() => {
                alert("오늘의 반응을 성공적으로 기록했습니다! ✨");
                visitFriendRoom(targetUser); 
            });
        });
    });
};