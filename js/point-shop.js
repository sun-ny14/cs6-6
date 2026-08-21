// js/point-shop.js - 상점 물품 관리, 구매 로직, 한도 리셋

if (typeof window.currentShopCat === 'undefined') window.currentShopCat = "전체";
if (typeof window.shopData === 'undefined') window.shopData = [];

window.changeShopCat = (cat) => { window.currentShopCat = cat; window.renderShop(); };

// 1. 상점 렌더링 (진열)
window.renderShop = function() {
    const shopDiv = document.getElementById('shop-list'); 
    if (!shopDiv) return;
    
    let html = "";
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        html += `<button onclick="openAddShopPopup()" style="background:var(--gold, #f1c40f); color:#2c3e50; font-weight:bold; margin-bottom:15px; width:100%; border:none; padding:15px; border-radius:10px; font-size:1.2rem; cursor:pointer;">+ 새 물품 등록</button>`;
    }

    const categories = ["전체", "🍕 먹거리", "🎫 쿠폰", "🎲 뽑기", "✏️ 학용품", "✨ 기타"];
    html += `<div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto;">`;
    categories.forEach(c => {
        const isActive = (window.currentShopCat === c);
        html += `<button onclick="changeShopCat('${c}')" style="padding:10px 15px; border-radius:20px; border:none; background:${isActive ? '#3498db' : '#eee'}; color:${isActive ? 'white' : '#333'}; cursor:pointer;">${c}</button>`;
    });
    html += `</div>`;

    if (window.shopData && window.shopData.length > 0) {
        window.shopData.forEach(child => {
            const k = child.key, item = child.val();
            if (window.currentShopCat !== "전체" && item.cat !== window.currentShopCat) return;
            
            const isSoldOut = item.isSoldOut === true || (item.stock !== null && item.stock <= 0 && item.stock !== -1);
            let btnHtml = isSoldOut 
                ? `<button disabled style="background:#ccc; padding:10px; width:100%; border-radius:5px; border:none;">품절 🚫</button>` 
                : `<button onclick="buyItem('${k}', '${item.name}', ${item.price}, ${item.limit || 0})" style="background:#4CAF50; color:white; padding:10px; width:100%; border-radius:5px; border:none; cursor:pointer;">구매하기</button>`;
            
            let adminBtnHtml = isAdmin 
                ? `<button onclick="openEditShopPopup('${k}')" style="background:#ff9800; color:white; margin-top:8px; padding:8px; width:100%; border-radius:5px; border:none; cursor:pointer;">⚙️ 수정/삭제</button>` : "";

            html += `
                <div class="shop-card" style="border:1px solid #ddd; padding:15px; margin:10px; border-radius:10px; display:inline-block; width:220px; background:white; text-align:center; vertical-align:top;">
                    <div style="font-size:12px; color:#999;">${item.cat || '미분류'}</div>
                    <h3 style="margin:5px 0; font-size:1.3rem;">${item.name}</h3>
                    <p style="font-weight:bold; color:#2196F3; margin:10px 0; font-size:1.2rem;">💰 ${item.price} P</p>
                    ${btnHtml} ${adminBtnHtml}
                </div>`;
        });
    }
    shopDiv.innerHTML = html || `<div style="text-align:center; padding:40px;">등록된 물품이 없습니다.</div>`;
};

// 2. 물품 구매 로직
window.buyItem = async function(k, n, p, l) {
    try {
        const sn = await db.ref('users/' + myName).once('value');
        if (!sn.exists()) return alert("사용자 정보를 찾을 수 없습니다.");
        const myPoints = sn.val().points || 0;
        
        if (!isAdmin && myPoints < 0) return alert("현재 포인트가 마이너스 상태입니다!");
        if (!isAdmin && myPoints < p) return alert("포인트 부족!");

        const itemSnap = await db.ref('shop/' + k).once('value');
        const itemData = itemSnap.val();
        if (itemData && itemData.stock !== undefined && itemData.stock <= 0 && itemData.stock !== -1) return alert("품절입니다.");

        // 한도 체크
        if (!isAdmin && l > 0) {
            const ordersSnap = await db.ref('orders').once('value');
            let count = 0;
            ordersSnap.forEach(child => {
                const o = child.val();
                if (o.user === myName && o.item === n && (!o.item.includes('(한도리셋)'))) count++;
            });
            if (count >= l) return alert(`최대 ${l}번까지만 구매 가능합니다!`);
        }

        // 포인트 차감 및 주문(인벤토리) 등록
        await db.ref('users/' + myName).update({ points: myPoints - p });
        if (itemData && itemData.stock !== undefined && itemData.stock > 0) {
            await db.ref('shop/' + k).update({ stock: itemData.stock - 1 });
        }
        // 상태를 '대기'로 저장하여 학생의 미사용 보관함에 표시되게 함
        await db.ref('orders').push({ user: myName, item: n, price: p, time: new Date().getTime(), status: "대기" });
        alert(`✅ [${n}] 구매 완료! 인벤토리를 확인하세요.`);
    } catch (err) {
        console.error("구매 처리 오류:", err);
        alert("구매 중 오류가 발생했습니다.");
    }
};

// 3. 관리자: 새 물품 등록
window.openAddShopPopup = function() {
    const title = prompt("등록할 물품 이름을 입력하세요:");
    if (!title) return;
    const price = parseInt(prompt("가격을 입력하세요 (숫자):", "1000"));
    if (isNaN(price)) return alert("올바른 숫자를 입력하세요.");
    const cat = prompt("카테고리를 입력하세요 (예: 🍕 먹거리, 🎫 쿠폰, 🎲 뽑기, ✏️ 학용품, ✨ 기타):", "🍕 먹거리");
    const stock = parseInt(prompt("재고 수량을 입력하세요 (무제한은 -1):", "10"));
    const limit = parseInt(prompt("1인당 구매 제한 횟수 (제한 없으면 0):", "1"));

    db.ref('shop').push({
        name: title, price: price, cat: cat || "✨ 기타",
        stock: isNaN(stock) ? -1 : stock, limit: isNaN(limit) ? 0 : limit
    }).then(() => alert("✨ 새 물품이 등록되었습니다!"));
};

// 4. 관리자: 물품 수정 및 삭제
window.openEditShopPopup = function(k) {
    db.ref('shop/' + k).once('value').then(snap => {
        const item = snap.val();
        if (!item) return;

        const action = prompt(`[${item.name}] 관리\n1. 수정\n2. 삭제\n(번호를 입력하세요: 1 또는 2)`, "1");
        if (action === "2") {
            if (confirm(`정말 "${item.name}" 물품을 삭제하시겠습니까?`)) {
                db.ref('shop/' + k).remove().then(() => alert("🗑️ 삭제되었습니다."));
            }
        } else if (action === "1") {
            const newName = prompt("새 물품 이름:", item.name);
            const newPrice = parseInt(prompt("새 가격:", item.price));
            const newStock = parseInt(prompt("새 재고 (무제한은 -1):", item.stock !== undefined ? item.stock : 10));
            
            if (!newName || isNaN(newPrice)) return alert("잘못된 입력입니다.");
            
            db.ref('shop/' + k).update({
                name: newName, price: newPrice, stock: isNaN(newStock) ? -1 : newStock
            }).then(() => alert("✏️ 수정되었습니다!"));
        }
    });
};

// 5. 관리자: 학생 구매 한도 초기화 (선생님 전용)
window.resetUserItemLimit = async function(userName) {
    const itemName = prompt(`${userName} 학생의 구매 한도를 리셋할 '상품명'을 정확히 입력하세요.`);
    if (!itemName) return;
    const ordersSnap = await db.ref('orders').once('value');
    const updates = {}; let resetCount = 0;
    ordersSnap.forEach(c => {
        if (c.val().user === userName && c.val().item === itemName) {
            updates[`orders/${c.key}/item`] = `${itemName} (한도리셋)`;
            resetCount++;
        }
    });
    if (resetCount > 0) { await db.ref().update(updates); alert(`✅ ${resetCount}건 초기화 완료!`); }
    else { alert("구매 기록이 없습니다."); }
};

// 실시간 데이터 변경 감지 리스너 (상점 렌더링 전용)
db.ref('shop').on('value', (s) => { 
    window.shopData = []; 
    s.forEach(c => window.shopData.push(c)); 
    window.renderShop(); 
});
