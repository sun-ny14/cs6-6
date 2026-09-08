// js/point-shop.js - 상점 물품 관리, 구매 로직, 인벤토리 아이템 사용 및 리셋 쿠폰 통합 관리

if (typeof window.currentShopCat === 'undefined') window.currentShopCat = "전체";
if (typeof window.shopData === 'undefined') window.shopData = [];

const shopEscapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

window.changeShopCat = (cat) => { 
    window.currentShopCat = cat; 
    window.renderShop(); 
};

// 1. 상점 렌더링 (진열)
window.renderShop = function() {
    const shopDiv = document.getElementById('shop-list'); 
    if (!shopDiv) return;
    
    let html = "";
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        html += `<button onclick="openAddShopPopup()" style="background:var(--gold, #f1c40f); color:#2c3e50; font-weight:bold; margin-bottom:15px; width:100%; border:none; padding:15px; border-radius:10px; font-size:1.2rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">+ 새 물품 등록</button>`;
    }

    const categories = ["전체", "🍕 먹거리", "🎫 쿠폰", "🎲 뽑기", "✏️ 학용품", "✨ 기타"];
    html += `<div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">`;
    categories.forEach(c => {
        const isActive = (window.currentShopCat === c);
        html += `<button onclick="changeShopCat('${c}')" style="padding:10px 15px; border-radius:20px; border:none; font-weight:bold; cursor:pointer; white-space:nowrap; background:${isActive ? 'var(--primary, #3498db)' : '#eee'}; color:${isActive ? 'white' : '#333'}; box-shadow:${isActive ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'};">${c}</button>`;
    });
    html += `</div>`;

    let hasItems = false;

    if (window.shopData && window.shopData.length > 0) {
        window.shopData.forEach(child => {
            const k = child.key, item = child.val();
            if (window.currentShopCat !== "전체" && item.cat !== window.currentShopCat) return;
            hasItems = true;
            
            const isSoldOut = item.isSoldOut === true || (item.stock !== null && item.stock <= 0 && item.stock !== -1);
            let stockDisplay = (item.stock !== null && item.stock !== undefined && item.stock !== -1) ? `<div style="font-size:12px; color:#555; margin-bottom: 8px;">(남은 수량: ${shopEscapeHtml(item.stock)}개)</div>` : "";
            if (isSoldOut) {
                stockDisplay = `<div style="font-size:12px; color:red; margin-bottom: 8px; font-weight: bold;">🚫 품절된 상품입니다</div>`;
            }

            let btnHtml = isSoldOut 
                ? `<button disabled style="background-color: #cccccc; color: #666666; cursor: not-allowed; border: none; padding: 10px; border-radius: 5px; width: 100%; font-weight: bold;">품절 🚫</button>` 
                : `<button onclick="buyItem('${shopEscapeHtml(k)}')" style="background-color: #4CAF50; color: white; border: none; padding: 10px; border-radius: 5px; width: 100%; cursor: pointer; font-weight: bold;">구매하기</button>`;
            
            let adminBtnHtml = (typeof isAdmin !== 'undefined' && isAdmin) 
                ? `<button onclick="openEditShopPopup('${k}')" style="background-color: #ff9800; color: white; border: none; padding: 8px; border-radius: 5px; width: 100%; cursor: pointer; font-weight: bold; margin-top: 8px;">⚙️ 수정/삭제</button>` : "";

            let limitText = (item.limit > 0) ? `최대 ${shopEscapeHtml(item.limit)}회 구매` : '무제한 구매';

            html += `
                <div class="shop-card" style="border: 1px solid #e0e0e0; padding: 15px; margin: 10px; border-radius: 10px; display: inline-block; width: 220px; vertical-align: top; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; background-color: #ffffff;">
                    <div style="font-size:12px; color:#999; margin-bottom:5px;">${shopEscapeHtml(item.cat || '미분류')}</div>
                    <h3 style="margin-top: 5px; margin-bottom: 5px; font-size: 18px; color: #333;">${shopEscapeHtml(item.name)}</h3>
                    ${stockDisplay}
                    <p style="font-size: 18px; font-weight: bold; color: #2196F3; margin: 10px 0;">💰 ${shopEscapeHtml(item.price)} P</p>
                    <p style="font-size: 12px; color: #888; margin-bottom: 15px;">🔄 ${limitText}</p>
                    <div>
                        ${btnHtml}
                        ${adminBtnHtml}
                    </div>
                </div>`;
        });
    }
    
    if (!hasItems) {
        html += `<div style="text-align: center; padding: 40px; color: #888; font-size: 1.2rem;">해당 카테고리에 등록된 물품이 없습니다. 텅~ 💨</div>`;
    }
    shopDiv.innerHTML = html;
};

// 2. 물품 구매 로직
window.buyItem = async function(k) {
    try {
        const result = await window.callSecure('purchasePointShop', { itemKey:k });
        alert(`✅ [${result.name}] 구매 완료! 남은 포인트: ${result.points}P`);
    } catch (err) {
        console.error("구매 처리 오류:", err);
        alert(err?.message || "구매 중 오류가 발생했습니다.");
    }
};

// 3. 관리자: 새 물품 등록 팝업창 연동
window.openAddShopPopup = function() { 
    let h = `<h3>📦 새 물품</h3>
        상품명: <input type="text" id="add-item-name" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
        가격: <input type="number" id="add-item-price" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
        제한(1인당): <input type="number" id="add-item-limit" value="0" placeholder="0이면 무제한" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
        재고: <input type="number" id="add-item-stock" placeholder="빈칸이면 무제한" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
        카테고리: <select id="add-item-cat" style="width:100%; padding:8px; margin:5px 0 15px 0;">
            <option value="🍕 먹거리">🍕 먹거리</option>
            <option value="🎫 쿠폰">🎫 쿠폰</option>
            <option value="🎲 뽑기">🎲 뽑기</option>
            <option value="✏️ 학용품">✏️ 학용품</option>
            <option value="✨ 기타">✨ 기타</option>
        </select>
        <button onclick="saveNewItem()" style="background:var(--primary, #3498db); color:white; margin-top: 10px; width:100%; padding:12px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">등록</button>`; 
    if (typeof openPopup === 'function') openPopup("물품 추가", h); 
};

window.saveNewItem = function() { 
    const n = document.getElementById('add-item-name').value;
    const p = parseInt(document.getElementById('add-item-price').value);
    const l = parseInt(document.getElementById('add-item-limit').value) || 0;
    const c = document.getElementById('add-item-cat').value;
    const s = document.getElementById('add-item-stock').value; 
    const stockVal = s !== "" ? parseInt(s) : null; 

    if(n && !isNaN(p)) {
        db.ref('shop').push({ cat: c, name: n, price: p, limit: l, stock: stockVal }).then(() => {
            alert("✅ 성공적으로 등록되었습니다!");
            if (typeof closePopup === 'function') closePopup();
        }); 
    } else {
        alert("상품명과 올바른 가격을 입력해 주세요!");
    }
};

// 4. 관리자: 물품 수정 및 삭제 팝업창 연동 (스크롤 및 버튼 고정형 UI 적용)
window.openEditShopPopup = function(k) {
    db.ref('shop/' + k).once('value', snap => {
        const i = snap.val(); 
        if(!i) return;
        const stockVal = (i.stock !== undefined && i.stock !== null) ? i.stock : "";

        // 💡 [개선] 내부 입력폼은 스크롤이 되도록 하고, 버튼은 하단에 고정하여 밖으로 튀어나가지 않도록 수정
        let h = `
            <div style="display:flex; flex-direction:column; max-height:65vh;">
                <div style="overflow-y:auto; padding-right:5px; flex:1; text-align:left;">
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">상품명:</label>
                    <input type="text" id="edit-shop-name" value="${shopEscapeHtml(i.name)}" style="width:100%; padding:10px; margin-bottom:12px; font-size:1.1rem; border:2px solid #ccc; border-radius:8px; box-sizing:border-box;">
                    
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">가격:</label>
                    <input type="number" id="edit-shop-price" value="${shopEscapeHtml(i.price)}" style="width:100%; padding:10px; margin-bottom:12px; font-size:1.1rem; border:2px solid #3498db; border-radius:8px; box-sizing:border-box;">
                    
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">제한(1인당):</label>
                    <input type="number" id="edit-shop-limit" value="${shopEscapeHtml(i.limit || 0)}" style="width:100%; padding:10px; margin-bottom:12px; font-size:1.1rem; border:2px solid #ccc; border-radius:8px; box-sizing:border-box;">
                    
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">남은 재고:</label>
                    <input type="number" id="edit-shop-stock" value="${shopEscapeHtml(stockVal)}" placeholder="빈칸이면 무제한" style="width:100%; padding:10px; margin-bottom:12px; font-size:1.1rem; border:2px solid #ccc; border-radius:8px; box-sizing:border-box;">
                    
                    <label style="display:block; margin:10px 0; padding:12px; background:#fff5f5; border:1px solid #ffcccc; border-radius:8px; cursor:pointer;">
                        <input type="checkbox" id="edit-shop-soldout" ${i.isSoldOut ? 'checked' : ''} style="transform:scale(1.3); margin-right:10px;">
                        <b>🚫 수동 품절 처리 (체크 시 즉시 품절)</b>
                    </label>
                    
                    <label style="font-weight:bold; display:block; margin-bottom:5px; margin-top:10px;">카테고리:</label>
                    <select id="edit-shop-cat" style="width:100%; padding:10px; margin-bottom:10px; font-size:1.1rem; border:2px solid #ccc; border-radius:8px; box-sizing:border-box;">
                        <option value="🍕 먹거리" ${i.cat==='🍕 먹거리'?'selected':''}>🍕 먹거리</option>
                        <option value="🎫 쿠폰" ${i.cat==='🎫 쿠폰'?'selected':''}>🎫 쿠폰</option>
                        <option value="🎲 뽑기" ${i.cat==='🎲 뽑기'?'selected':''}>🎲 뽑기</option>
                        <option value="✏️ 학용품" ${i.cat==='✏️ 학용품'?'selected':''}>✏️ 학용품</option>
                        <option value="✨ 기타" ${i.cat==='✨ 기타'?'selected':''}>✨ 기타</option>
                    </select>
                </div>
                
                <div style="display:flex; gap:10px; margin-top:20px; padding-top:10px; border-top:1px solid #eee; flex-shrink:0;">
                    <button onclick="saveEditShop('${k}')" style="flex:1; background:var(--primary, #3498db); color:white; padding:14px; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer;">저장</button>
                    <button onclick="deleteShopItem('${k}')" style="flex:1; background:var(--red, #e74c3c); color:white; padding:14px; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer;">삭제</button>
                </div>
            </div>`;
            
        if (typeof openPopup === 'function') openPopup("보급품 관리", h);
    });
};

window.saveEditShop = function(k) { 
    const n = document.getElementById('edit-shop-name').value;
    const p = parseInt(document.getElementById('edit-shop-price').value);
    const l = parseInt(document.getElementById('edit-shop-limit').value) || 0;
    const c = document.getElementById('edit-shop-cat').value;
    const sOut = document.getElementById('edit-shop-soldout').checked; 
    const s = document.getElementById('edit-shop-stock').value; 
    const stockVal = s !== "" ? parseInt(s) : null; 

    db.ref('shop/'+k).update({ name: n, price: p, limit: l, cat: c, isSoldOut: sOut, stock: stockVal }).then(() => {
        alert("✅ 수정 완료!");
        if (typeof closePopup === 'function') closePopup();
    }); 
};

window.deleteShopItem = function(k) { 
    if(confirm("정말로 삭제하시겠습니까?")) {
        db.ref('shop/'+k).remove().then(() => {
            alert("✅ 삭제되었습니다.");
            if (typeof closePopup === 'function') closePopup();
        }); 
    }
};

// 5. 관리자: 특정 학생의 특정 아이템 구매 한도 초기화 함수
window.resetUserItemLimit = async function(userName) {
    const itemName = prompt(`${userName} 학생의 구매 한도를 리셋할 '상품명'을 정확히 입력하세요.\n(주의: 띄어쓰기까지 상점에 등록된 이름과 똑같아야 합니다.)`);
    if (!itemName) return;

    if (!confirm(`${userName} 용사의 [${itemName}] 구매 기록을 초기화하시겠습니까?\n과거 구매 내역(연대기)은 보존되며, 상점에서 다시 구매할 수 있게 됩니다.`)) return;

    const ordersSnap = await db.ref('orders').once('value');
    let resetCount = 0;
    const updates = {};

    ordersSnap.forEach(child => {
        const o = child.val();
        if (o.user === userName && o.item === itemName) {
            updates[`orders/${child.key}/item`] = `${itemName} (한도리셋)`;
            updates[`orders/${child.key}/limitReset`] = true;
            resetCount++;
        }
    });

    if (resetCount > 0) {
        await db.ref().update(updates);
        alert(`✅ 완료! ${userName} 용사의 [${itemName}] 한도가 초기화되었습니다. (적용 횟수: ${resetCount}건)`);
        if (typeof closePopup === 'function') closePopup();
    } else {
        alert(`⚠️ 해당 학생이 [${itemName}]을(를) 구매한 기록을 찾을 수 없습니다. 이름을 다시 확인해 주세요.`);
    }
};

// 6. 품절 상품 환불 처리 함수
window.refundSoldOutItem = async function(orderKey, itemName, price) {
    if(!confirm(`[품절 안내] ${itemName} 물품은 현재 품절되었습니다.\n${price}P를 환불받으시겠습니까?`)) return;
    
    await addScore(myName, price, 0, `[품절] ${itemName} 환불`);
    await db.ref('orders/' + orderKey).remove();
    alert(`✅ ${price}P 환불이 완료되었습니다! (연대기 확인 가능)`);
};

// 7. 관리자: 단일 주문 승인 (리셋 쿠폰 자동 처리 연동)
window.approveSingleItem = async function(key) {
    if (typeof window.canManageShopRequests !== 'function' ||
        !window.canManageShopRequests()) {
        alert('상점 역할 학생과 선생님만 요청을 승인할 수 있습니다.');
        return;
    }

    const order=(await db.ref('orders/'+key).once('value')).val();
    if(!order)return alert('주문 정보를 찾을 수 없습니다.');
    const user=String(order.user||''), item=String(order.item||'');
    if(confirm(`${user} 용사의 [${item}] 1개를 승인하시겠습니까?`)) {
        await window.callSecure('manageShopOrder',{orderKey:key,action:'approve'});
        alert("✅ 개별 승인 완료!");
    }
};

// 8. 관리자: 주문 일괄 승인 (리셋 쿠폰 포함)
window.approveUserAll = async function(keyStr, user) {
    if (typeof window.canManageShopRequests !== 'function' ||
        !window.canManageShopRequests()) {
        alert('상점 역할 학생과 선생님만 요청을 승인할 수 있습니다.');
        return;
    }

    if(confirm(`${user} 용사의 모든 사용 요청을 승인하시겠습니까?`)) {
        const keys = keyStr.split(',').filter(Boolean);
        for (const key of keys) await window.callSecure('manageShopOrder',{orderKey:key,action:'approve'});
        alert("✅ 일괄 승인 및 자동 리셋, 연대기 기록까지 완벽하게 처리되었습니다!");
    }
};

// 9. 학생 인벤토리 아이템 사용 (리셋 쿠폰 팝업 분기 처리)
window.useInventoryItem = function(orderKey, itemName) {
    if(itemName.includes('리셋') || itemName.includes('초기화')) {
        db.ref('orders').once('value', snap => {
            let boughtItems = new Set();
            snap.forEach(c => {
                const o = c.val();
                if(o.user === myName && o.item && !o.item.includes('리셋') && !o.item.includes('초기화')) {
                    boughtItems.add(o.item.replace(' (한도리셋)', ''));
                }
            });

            if(boughtItems.size === 0) {
                return alert("아직 구매한 다른 상품이 없어 리셋할 항목이 없습니다!");
            }

            let h = `
                <div style="text-align:center;">
                    <h3 style="margin-top:0;">🔄 어떤 상품을 다시 구매하고 싶나요?</h3>
                    <p style="color:#666; font-size:1rem;">리셋할 상품을 아래에서 골라주세요.<br>(내가 과거에 샀던 물건만 표시됩니다)</p>
                    <select id="reset-target-item" style="width:100%; padding:15px; font-size:1.2rem; border-radius:10px; margin-bottom:20px; border:2px solid var(--primary, #3498db);">
            `;
            boughtItems.forEach(item => {
                h += `<option value="${item}">${item}</option>`;
            });
            h += `  </select>
                    <button onclick="submitResetRequest('${orderKey}', '${itemName}')" style="width:100%; padding:15px; background:var(--gold, #f1c40f); color:var(--dark, #333); border:none; border-radius:10px; font-weight:bold; font-size:1.2rem; cursor:pointer;">총사령관에게 승인 요청하기</button>
                </div>`;
            if (typeof openPopup === 'function') {
                openPopup("마법의 리셋 쿠폰 사용", h);
            }
        });
    } else {
        if(confirm(`[${itemName}] 아이템을 사용하시겠습니까?\n(선생님의 승인 후 최종 처리됩니다)`)) {
            window.callSecure('requestOrderUse',{orderKey}).then(() => {
                alert("사용 요청이 전송되었습니다!");
            });
        }
    }
};

// 10. 리셋 쿠폰 최종 요청 전송
window.submitResetRequest = function(orderKey, couponName) {
    const targetEl = document.getElementById('reset-target-item');
    if (!targetEl) return;
    const target = targetEl.value;
    if(!target) return alert("상품을 선택해주세요!");
    
    window.callSecure('requestOrderUse',{orderKey,resetTarget:target}).then(() => {
        alert(`✅ [${target}] 리셋 요청 전송 완료!\n선생님 승인 즉시 다시 구매할 수 있게 됩니다.`);
        if (typeof closePopup === 'function') closePopup();
    });
};

// 11. 관리자: 단일 주문 거절 및 포인트 자동 환불
window.rejectSingleItem = async function(key) {
    if (typeof window.canManageShopRequests !== 'function' ||
        !window.canManageShopRequests()) {
        alert('상점 역할 학생과 선생님만 요청을 거절할 수 있습니다.');
        return;
    }

    const order=(await db.ref('orders/'+key).once('value')).val();
    if(!order)return alert('주문 정보를 찾을 수 없습니다.');
    const user=String(order.user||''), item=String(order.item||'');
    if(confirm(`${user} 용사의 [${item}] 요청을 거절하고 포인트를 환불하시겠습니까?`)) {
        await window.callSecure('manageShopOrder',{orderKey:key,action:'reject'});
        alert(`✅ 거절 및 환불 처리가 완료되었습니다.`);
    }
};

// 로그인 후 상점 실시간 데이터 연결
window.shopRef = null;
window.shopValueHandler = null;

window.stopShopListener = function() {
    if (window.shopRef && window.shopValueHandler) {
        window.shopRef.off(
            'value',
            window.shopValueHandler
        );
    }

    window.shopRef = null;
    window.shopValueHandler = null;
};

window.startShopListener = function() {
    window.stopShopListener();

    if (!auth.currentUser) {
        return;
    }

    window.shopData = [];

    const shopRef = db.ref('shop');

    const valueHandler = function(snapshot) {
        const loadedItems = [];

        snapshot.forEach(child => {
            loadedItems.push(child);
        });

        window.shopData = loadedItems;

        console.log(
            '상점 상품 불러오기 완료:',
            window.shopData.length
        );

        if (typeof window.renderShop === 'function') {
            window.renderShop();
        }
    };

    window.shopRef = shopRef;
    window.shopValueHandler = valueHandler;

    shopRef.on(
        'value',
        valueHandler,
        function(error) {
            console.error(
                '상점 상품 불러오기 실패:',
                error
            );

            window.shopData = [];

            if (typeof window.renderShop === 'function') {
                window.renderShop();
            }
        }
    );
};

// Firebase 로그인 상태가 확인된 후 상점 연결
auth.onAuthStateChanged(function(user) {
    if (user) {
        window.startShopListener();
    } else {
        window.stopShopListener();
        window.shopData = [];
    }
});
// 12. 관리자: 상점 주문 및 포인트 연대기(orders) 데이터 실시간 렌더링 함수
window.loadOrderRecords = function() {
    db.ref('orders').on('value', snap => {
        const orderListEl = document.getElementById('admin-order-list'); // 👈 HTML 상의 주문 목록 테이블 tbody ID
        if (!orderListEl) return;

        if (!snap.exists()) {
            orderListEl.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px; color:#888;'>주문 및 사용 내역이 없습니다.</td></tr>";
            return;
        }

        let html = "";
        snap.forEach(child => {
            const key = child.key;
            const item = child.val();
            
            let statusColor = item.status === '완료' ? '#27ae60' : '#e65100';
            let timeFormatted = item.time ? new Date(item.time).toLocaleString('ko-KR') : (item.timeStr || '-');

            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px; font-weight:bold;">${shopEscapeHtml(item.user || '')}</td>
                    <td style="padding:10px;">${shopEscapeHtml(item.item || '')}</td>
                    <td style="padding:10px; font-weight:bold; color:${statusColor};">${shopEscapeHtml(item.status || '대기중')}</td>
                    <td style="padding:10px; color:#666; font-size:0.9rem;">${shopEscapeHtml(timeFormatted)}</td>
                    <td style="padding:10px;">
                        <button onclick="approveSingleItem('${shopEscapeHtml(key)}')" style="padding:5px 10px; background:var(--primary, #3498db); color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; margin-right:5px;">승인</button>
                        <button onclick="rejectSingleItem('${shopEscapeHtml(key)}')" style="padding:5px 10px; background:var(--red, #e74c3c); color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">거절</button>
                    </td>
                </tr>
            `;
        });

        orderListEl.innerHTML = html;
    });
};
