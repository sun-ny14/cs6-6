// js/point-shop.js
// 6-6반 상점, 인벤토리, 그리고 사용 요청 승인 관리 통합 전체 기능

// 전역 변수 안전하게 초기화
if (typeof window.currentShopCat === 'undefined') {
    window.currentShopCat = "전체";
}
if (typeof window.shopData === 'undefined') {
    window.shopData = [];
}

// 1. 카테고리 변경 함수
window.changeShopCat = function(cat) {
    window.currentShopCat = cat;
    window.renderShop();
};

// 2. 상점 목록 렌더링 함수
window.renderShop = function() {
    const shopDiv = document.getElementById('shop-list'); 
    if (!shopDiv) return;
    
    let html = "";

    // 관리자 전용 새 물품 등록 버튼
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        html += `<button onclick="openAddShopPopup()" style="background:var(--gold); color:var(--dark); font-weight:bold; margin-bottom:15px; width:100%; border:none; padding:15px; border-radius:10px; font-size:1.2rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">+ 새 물품 등록</button>`;
    }

    // 카테고리 탭 생성
    const categories = ["전체", "🍕 먹거리", "🎫 쿠폰", "🎲 뽑기", "✏️ 학용품", "✨ 기타"];
    html += `<div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">`;
    categories.forEach(c => {
        const isActive = (window.currentShopCat === c);
        html += `<button onclick="changeShopCat('${c}')" style="padding: 10px 15px; border-radius: 20px; border: none; font-weight: bold; cursor: pointer; white-space: nowrap; background: ${isActive ? 'var(--primary)' : '#eee'}; color: ${isActive ? 'white' : '#333'}; box-shadow: ${isActive ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'};">${c}</button>`;
    });
    html += `</div>`;

    let hasItems = false; 

    if (window.shopData && window.shopData.length > 0) {
        window.shopData.forEach(child => {
            const k = child.key;          
            const item = child.val();   
            
            if (window.currentShopCat !== "전체" && item.cat !== window.currentShopCat) return;
            hasItems = true; 
            
            const isSoldOut = item.isSoldOut === true || (item.stock !== null && item.stock <= 0);
            
            let btnHtml = "";
            let stockDisplay = "";

            if (isSoldOut) {
                stockDisplay = `<div style="font-size:12px; color:red; margin-bottom: 8px; font-weight: bold;">🚫 품절된 상품입니다</div>`;
                btnHtml = `<button disabled style="background-color: #cccccc; color: #666666; cursor: not-allowed; border: none; padding: 10px; border-radius: 5px; width: 100%; font-weight: bold;">품절 🚫</button>`;
            } else {
                stockDisplay = (item.stock !== null) ? `<div style="font-size:12px; color:#555; margin-bottom: 8px;">(남은 수량: ${item.stock}개)</div>` : "";
                btnHtml = `<button onclick="buyItem('${k}', '${item.name}', ${item.price}, ${item.limit})" style="background-color: #4CAF50; color: white; border: none; padding: 10px; border-radius: 5px; width: 100%; cursor: pointer; font-weight: bold;">구매하기</button>`;
            }

            let adminBtnHtml = (typeof isAdmin !== 'undefined' && isAdmin) ? `<button onclick="openEditShopPopup('${k}')" style="background-color: #ff9800; color: white; border: none; padding: 8px; border-radius: 5px; width: 100%; cursor: pointer; font-weight: bold; margin-top: 8px;">⚙️ 수정/삭제</button>` : "";
            let limitText = (item.limit > 0) ? `최대 ${item.limit}회 구매` : '무제한 구매';

            html += `
                <div class="shop-card" style="border: 1px solid #e0e0e0; padding: 15px; margin: 10px; border-radius: 10px; display: inline-block; width: 220px; vertical-align: top; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center; background-color: #ffffff;">
                    <div style="font-size:12px; color:#999; margin-bottom:5px;">${item.cat || '미분류'}</div>
                    <h3 style="margin-top: 5px; margin-bottom: 5px; font-size: 18px; color: #333;">${item.name}</h3>
                    ${stockDisplay}
                    <p style="font-size: 18px; font-weight: bold; color: #2196F3; margin: 10px 0;">💰 ${item.price} P</p>
                    <p style="font-size: 12px; color: #888; margin-bottom: 15px;">🔄 ${limitText}</p>
                    <div>
                        ${btnHtml}
                        ${adminBtnHtml}
                    </div>
                </div>
            `;
        });
    }
    
    if (!hasItems) {
        html += `<div style="text-align: center; padding: 40px; color: #888; font-size: 1.2rem;">해당 카테고리에 등록된 물품이 없습니다. 텅~ 💨</div>`;
    }
    shopDiv.innerHTML = html;
};

// 3. 상점 물품 추가/수정/삭제 관리 함수들
window.openAddShopPopup = function() { 
    let h = `<h3>📦 새 물품</h3>
            상품명: <input type="text" id="add-item-name"><br>
            가격: <input type="number" id="add-item-price"><br>
            제한: <input type="number" id="add-item-limit" value="0" placeholder="0이면 무제한"><br>
            재고: <input type="number" id="add-item-stock" placeholder="빈칸이면 무제한(품절 안 됨)"><br>
            카테고리: <select id="add-item-cat"><option value="🍕 먹거리">🍕 먹거리</option><option value="🎫 쿠폰">🎫 쿠폰</option><option value="🎲 뽑기">🎲 뽑기</option><option value="✏️ 학용품">✏️ 학용품</option><option value="✨ 기타">✨ 기타</option></select><br>
            <button onclick="saveNewItem()" style="background:var(--primary); color:white; margin-top: 15px; padding:10px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; width:100%;">등록</button>`; 
    openPopup("물품 추가", h); 
};

window.saveNewItem = function() { 
    const n = document.getElementById('add-item-name').value;
    const p = parseInt(document.getElementById('add-item-price').value);
    const l = parseInt(document.getElementById('add-item-limit').value) || 0;
    const c = document.getElementById('add-item-cat').value;
    const s = document.getElementById('add-item-stock').value; 
    const stockVal = s !== "" ? parseInt(s) : null; 

    if(n && p) {
        db.ref('shop').push({cat:c, name:n, price:p, limit:l, stock: stockVal, isSoldOut: false}).then(()=>{
            alert("✅ 성공적으로 등록되었습니다!");
            closePopup();
        }); 
    } else {
        alert("상품명과 가격을 입력해 주세요!");
    }
};

window.openEditShopPopup = function(key) {
    db.ref('shop/' + key).once('value', snap => {
        const i = snap.val(); if(!i) return;
        const stockVal = (i.stock !== undefined && i.stock !== null) ? i.stock : "";

        let h = `<h3>🛍️ 물품 수정</h3>
                상품명: <input type="text" id="edit-shop-name" value="${i.name}"><br>
                가격: <input type="number" id="edit-shop-price" value="${i.price}"><br>
                제한(1인당): <input type="number" id="edit-shop-limit" value="${i.limit || 0}"><br>
                남은 재고: <input type="number" id="edit-shop-stock" value="${stockVal}" placeholder="빈칸이면 무제한"><br>
                상태: <label style="display:block; margin:10px 0; padding:10px; background:#fff5f5; border:1px solid #ffcccc; border-radius:8px;">
                    <input type="checkbox" id="edit-shop-soldout" ${i.isSoldOut ? 'checked' : ''} style="transform:scale(1.5); margin-right:10px;">
                    <b>🚫 수동 품절 처리 (체크 시 즉시 품절)</b>
                </label>
                카테고리: <select id="edit-shop-cat"><option value="🍕 먹거리" ${i.cat==='🍕 먹거리'?'selected':''}>🍕 먹거리</option><option value="🎫 쿠폰" ${i.cat==='🎫 쿠폰'?'selected':''}>🎫 쿠폰</option><option value="🎲 뽑기" ${i.cat==='🎲 뽑기'?'selected':''}>🎲 뽑기</option><option value="✏️ 학용품" ${i.cat==='✏️ 학용품'?'selected':''}>✏️ 학용품</option><option value="✨ 기타" ${i.cat==='✨ 기타'?'selected':''}>✨ 기타</option></select>
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button onclick="saveEditShop('${key}')" style="flex:1; background:var(--primary); color:white; padding:10px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">저장</button>
                    <button onclick="deleteShopItem('${key}')" style="flex:1; background:var(--red); color:white; padding:10px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">삭제</button>
                </div>`;
        openPopup("보급품 관리", h);
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

    db.ref('shop/'+k).update({name:n, price:p, limit:l, cat:c, isSoldOut:sOut, stock:stockVal}).then(()=>{
        alert("✅ 수정 완료!");
        closePopup();
    }); 
};

window.deleteShopItem = function(k) { 
    if(confirm("정말로 삭제하시겠습니까?")) {
        db.ref('shop/'+k).remove().then(()=>{
            alert("✅ 삭제되었습니다.");
            closePopup();
        }); 
    }
};

// 4. 상점 주문, 인벤토리, 및 사용 요청 승인 관리 리스너
function initShopDataListeners() {
    if (typeof db === 'undefined') return;

    // 상점 물품 실시간 동기화
    db.ref('shop').on('value', (snapshot) => {
        window.shopData = [];
        snapshot.forEach((childSnapshot) => {
            window.shopData.push(childSnapshot);
        });
        if (typeof window.renderShop === 'function') {
            window.renderShop();
        }
    });

    // 주문 및 인벤토리 / 사용 요청 관리 리스너
    db.ref('orders').on('value', snap => {
        let uH = "", wH = "", adminH = ""; 
        let myUnused = {}, myWaiting = {}, adminWaiting = {}; 

        snap.forEach(c => {
            const o = c.val(); const key = c.key;
            if (typeof myName !== 'undefined' && o.user === myName) {
                if (o.status === '대기' || o.status === '요청') {
                    if (!myUnused[o.item]) myUnused[o.item] = [];
                    myUnused[o.item].push(key);
                } else if (o.status === '사용요청') {
                    myWaiting[o.item] = (myWaiting[o.item] || 0) + 1;
                }
            }
            if ((typeof isAdmin !== 'undefined' && isAdmin || typeof isHelper !== 'undefined' && isHelper || (typeof myName !== 'undefined' && myName === "총사령관")) && o.status === '사용요청') {
                if (!adminWaiting[o.user]) adminWaiting[o.user] = {};
                if (!adminWaiting[o.user][o.item]) adminWaiting[o.user][o.item] = [];
                adminWaiting[o.user][o.item].push(key);
            }
        });

        let shopMap = {};
        if (window.shopData) {
            window.shopData.forEach(s => { shopMap[s.val().name] = s.val(); });
        }

        for (let item in myUnused) {
            const orderKey = myUnused[item][0]; 
            const shopItem = shopMap[item] || {};
            const isSoldOut = shopItem.isSoldOut === true || (shopItem.stock !== undefined && shopItem.stock <= 0);
            
            if (isSoldOut) {
                const price = shopItem.price || 0;
                uH += `<div class="list-item" style="display:flex; align-items:center; justify-content:space-between; background:#fff5f5; border-left:4px solid var(--red); padding:10px; margin-bottom:8px; border-radius:6px;">
                        <span><del>${item}</del> <b style="color:var(--red);">(품절)</b> <b>x${myUnused[item].length}</b></span>
                        <button onclick="refundItem('${orderKey}', '${item}', ${price})" style="padding:8px 12px; background:var(--red); color:white; border-radius:8px; border:none; font-weight:bold; cursor:pointer;">${price}P 환불</button>
                       </div>`;
            } else {
                uH += `<div class="list-item" style="display:flex; align-items:center; justify-content:space-between; padding:10px; margin-bottom:8px; border-radius:6px; background:#f9f9f9; border:1px solid #eee;">
                        <span>${item} <b>x${myUnused[item].length}</b></span>
                        <button onclick="useInventoryItem('${orderKey}', '${item}')" style="padding:8px 12px; background:var(--primary); color:white; border-radius:8px; border:none; font-weight:bold; cursor:pointer;">사용</button>
                       </div>`;
            }
        }

        for (let item in myWaiting) {
            wH += `<div class="list-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; margin-bottom:8px; border-radius:6px; background:#f9f9f9; border:1px solid #eee;">
                    <span>${item} <b>x${myWaiting[item]}</b></span>
                    <span style="color:#95a5a6; font-size:0.9rem; font-weight:bold;">⏳ 승인 대기중</span>
                   </div>`;
        }
        
        for (let user in adminWaiting) {
            let userKeys = [];
            let individualListH = "";
            for (let item in adminWaiting[user]) {
                adminWaiting[user][item].forEach(key => {
                    userKeys.push(key);
                    individualListH += `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding:15px; background:#f8f9fa; border-radius:8px; border:1px solid #ddd;">
                            <span style="font-size:1.3rem; color:#222; font-weight:900;">👉 ${item}</span>
                            <div style="display:flex; gap:8px;">
                                <button onclick="approveSingleItem('${key}', '${user}', '${item}')" style="padding:10px 18px; font-size:1.1rem; background:var(--primary); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">승인</button>
                                <button onclick="rejectSingleItem('${key}', '${user}', '${item}')" style="padding:10px 18px; font-size:1.1rem; background:var(--red); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">환불</button>
                            </div>
                        </div>`;
                });
            }
            
            adminH += `
                <div style="background:white; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); border-left:6px solid var(--primary); padding:18px; margin-bottom:15px;">
                    <div style="font-size:1.5rem; font-weight:900; color:#222; margin-bottom:12px; display:flex; align-items:center;">
                        🧑‍🎓 <span style="color:var(--primary); margin-left:8px;">${user}</span> <span style="font-size:1.1rem; color:#888; margin-left:5px; font-weight:normal;">용사의 요청</span>
                    </div>
                    
                    ${individualListH}
                    
                    <button onclick="approveUserAll('${userKeys.join(',')}', '${user}')" style="background:#333; color:white; width:100%; margin-top:15px; padding:15px; border:none; border-radius:8px; font-weight:bold; font-size:1.2rem; cursor:pointer;">
                        위 항목 전체 일괄 승인 ✨
                    </button>
                </div>`;
        }
        
        const unusedEl = document.getElementById('inv-unused');
        if (unusedEl && unusedEl.querySelector('.list')) unusedEl.querySelector('.list').innerHTML = uH || "비었음";
        
        const waitingEl = document.getElementById('inv-waiting');
        if (waitingEl && waitingEl.querySelector('.list')) waitingEl.querySelector('.list').innerHTML = wH || "비었음"; 
        
        const adminOrderEl = document.getElementById('order-list');
        if (adminOrderEl) adminOrderEl.innerHTML = adminH || "요청 없음";
        
        const adminOrderMgr = document.getElementById('admin-order-mgr');
        if (adminOrderMgr) {
            if ((typeof isAdmin !== 'undefined' && isAdmin) || (typeof isHelper !== 'undefined' && isHelper) || (typeof myName !== 'undefined' && myName === "총사령관")) {
                adminOrderMgr.style.display = 'block';
            } else {
                adminOrderMgr.style.display = 'none';
            }
        }
    });
}

// 자동 실행 바인딩
document.addEventListener("DOMContentLoaded", () => {
    initShopDataListeners();
});
if (typeof db !== 'undefined') {
    initShopDataListeners();
}
