// js/point-shop.js - 상점 물품 관리, 구매 로직, 인벤토리, 승인 및 관리자 기능 통합 전체 코드

if (typeof window.currentShopCat === 'undefined') window.currentShopCat = "전체";
if (typeof window.shopData === 'undefined') window.shopData = [];

window.changeShopCat = (cat) => { window.currentShopCat = cat; window.renderShop(); };

// 상점 렌더링
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
            
            const isSoldOut = item.isSoldOut === true || (item.stock !== null && item.stock <= 0);
            let btnHtml = isSoldOut ? `<button disabled style="background:#ccc; padding:10px; width:100%; border-radius:5px; border:none;">품절 🚫</button>` : `<button onclick="buyItem('${k}', '${item.name}', ${item.price}, ${item.limit || 0})" style="background:#4CAF50; color:white; padding:10px; width:100%; border-radius:5px; border:none; cursor:pointer;">구매하기</button>`;
            let adminBtnHtml = (typeof isAdmin !== 'undefined' && isAdmin) ? `<button onclick="openEditShopPopup('${k}')" style="background:#ff9800; color:white; margin-top:8px; padding:8px; width:100%; border-radius:5px; border:none; cursor:pointer;">⚙️ 수정/삭제</button>` : "";

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

// 구매 로직
window.buyItem = async function(k, n, p, l) {
    try {
        const sn = await db.ref('users/' + myName).once('value');
        if (!sn.exists()) return alert("사용자 정보를 찾을 수 없습니다.");
        const myPoints = sn.val().points || 0;
        
        if (!isAdmin && myPoints < 0) return alert("현재 포인트가 마이너스 상태입니다!");
        if (!isAdmin && myPoints < p) return alert("포인트 부족!");

        const itemSnap = await db.ref('shop/' + k).once('value');
        const itemData = itemSnap.val();
        if (itemData && itemData.stock !== undefined && itemData.stock <= 0) return alert("품절입니다.");

        if (!isAdmin && l > 0) {
            const ordersSnap = await db.ref('orders').once('value');
            let count = 0;
            ordersSnap.forEach(child => {
                const o = child.val();
                if (o.user === myName && o.item === n && (!o.item.includes('(한도리셋)'))) count++;
            });
            if (count >= l) return alert(`최대 ${l}번까지만 구매 가능합니다!`);
        }

        await db.ref('users/' + myName).update({ points: myPoints - p });
        if (itemData && itemData.stock !== undefined && itemData.stock > 0) {
            await db.ref('shop/' + k).update({ stock: itemData.stock - 1 });
        }
        await db.ref('orders').push({ user: myName, item: n, price: p, time: new Date().getTime(), status: "대기" });
        alert(`✅ [${n}] 구매 완료!`);
    } catch (err) {
        console.error("구매 처리 오류:", err);
        alert("구매 중 오류가 발생했습니다.");
    }
};

// 관리자용: 새 물품 등록 팝업 오픈
window.openAddShopPopup = function() {
    const title = prompt("등록할 물품 이름을 입력하세요:");
    if (!title) return;
    const price = parseInt(prompt("가격을 입력하세요 (숫자):", "1000"));
    if (isNaN(price)) return alert("올바른 숫자를 입력하세요.");
    const cat = prompt("카테고리를 입력하세요 (예: 🍕 먹거리, 🎫 쿠폰, 🎲 뽑기, ✏️ 학용품, ✨ 기타):", "🍕 먹거리");
    const stock = parseInt(prompt("재고 수량을 입력하세요 (무제한은 빈칸 또는 -1):", "10"));
    const limit = parseInt(prompt("1인당 구매 제한 횟수를 입력하세요 (제한 없으면 0):", "1"));

    db.ref('shop').push({
        name: title,
        price: price,
        cat: cat || "✨ 기타",
        stock: isNaN(stock) ? -1 : stock,
        limit: isNaN(limit) ? 0 : limit
    }).then(() => {
        alert("✨ 새 물품이 등록되었습니다!");
    });
};

// 관리자용: 물품 수정 및 삭제 팝업 오픈
window.openEditShopPopup = function(k) {
    db.ref('shop/' + k).once('value').then(snap => {
        const item = snap.val();
        if (!item) return;

        const action = prompt(`[${item.name}] 물품 관리\n1. 수정\n2. 삭제\n(번호를 입력하세요: 1 또는 2)`, "1");
        if (action === "2") {
            if (confirm(`정말 "${item.name}" 물품을 삭제하시겠습니까?`)) {
                db.ref('shop/' + k).remove().then(() => alert("🗑️ 삭제되었습니다."));
            }
            return;
        } else if (action === "1") {
            const newName = prompt("새 물품 이름:", item.name);
            const newPrice = parseInt(prompt("새 가격:", item.price));
            const newStock = parseInt(prompt("새 재고:", item.stock !== undefined ? item.stock : 10));
            
            if (!newName || isNaN(newPrice)) return alert("잘못된 입력입니다.");
            
            db.ref('shop/' + k).update({
                name: newName,
                price: newPrice,
                stock: isNaN(newStock) ? -1 : newStock
            }).then(() => alert("✏️ 수정되었습니다!"));
        }
    });
};

// 한도 리셋
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
    else { alert("기록 없음."); }
};

// 인벤토리 아이템 사용 신청
window.useInventoryItem = function(orderKey, itemName) {
    if (confirm(`[${itemName}]을(를) 사용하시겠습니까? 선생님께 승인 요청이 전송됩니다.`)) {
        db.ref('orders/' + orderKey).update({ status: '사용요청' }).then(() => {
            alert("⏳ 사용 요청이 완료되었습니다. 선생님의 승인을 기다려주세요!");
        });
    }
};

// 관리자: 단일 승인
window.approveSingleItem = function(key, user, item) {
    db.ref('orders/' + key).remove().then(() => {
        alert(`✅ [${user}]님의 [${item}] 사용이 승인(처리)되었습니다.`);
    });
};

// 관리자: 일괄 승인
window.approveUserAll = function(keysStr, user) {
    if (!keysStr) return;
    const keys = keysStr.split(',');
    const updates = {};
    keys.forEach(k => {
        updates[`orders/${k}`] = null; // 데이터 삭제 처리
    });
    db.ref().update(updates).then(() => {
        alert(`✅ [${user}]님의 요청 건들이 모두 일괄 승인 처리되었습니다.`);
    });
};

// 실시간 주문, 인벤토리, 승인 및 포인트 연대기 리스너
function initShopDataListeners() {
    db.ref('shop').on('value', (s) => { 
        window.shopData = []; 
        s.forEach(c => window.shopData.push(c)); 
        window.renderShop(); 
    });
    
    // 포인트 연대기 데이터 연동 (history 경로)
    db.ref('history').on('value', snap => {
        let historyHtml = "";
        snap.forEach(c => {
            const h = c.val();
            historyHtml = `<div style="padding:10px; border-bottom:1px solid #eee; font-size:1.1rem;">📅 [${h.date || '최근'}] <b>${h.user || '용사'}</b>: ${h.reason || '활동'} (${h.p > 0 ? '+' + h.p : h.p}P)</div>` + historyHtml;
        });
        const historyEl = document.getElementById('point-history-list');
        if (historyEl) historyEl.innerHTML = historyHtml || "<p style='color:#666;'>포인트 연대기 기록이 없습니다.</p>";
    });

    db.ref('orders').on('value', snap => {
        let uH = "", wH = "", adminH = ""; 
        let myUnused = {}, myWaiting = {}, adminWaiting = {}; 

        snap.forEach(c => {
            const o = c.val(), key = c.key;
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

        for (let item in myUnused) {
            const orderKey = myUnused[item][0];
            uH += `<div class="list-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                    <span>${item} <b>x${myUnused[item].length}</b></span>
                    <button onclick="useInventoryItem('${orderKey}', '${item}')" style="padding:6px 12px; background:#3498db; color:white; border:none; border-radius:5px; cursor:pointer;">사용</button></div>`;
        }
        for (let item in myWaiting) {
            wH += `<div class="list-item" style="padding:10px; border-bottom:1px solid #eee;">${item} <b>x${myWaiting[item]}</b> ⏳ 승인대기</div>`;
        }
        for (let user in adminWaiting) {
            let userKeys = [];
            let individualListH = "";
            for (let item in adminWaiting[user]) {
                adminWaiting[user][item].forEach(key => {
                    userKeys.push(key);
                    individualListH += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed #eee;"><span>👉 ${item}</span> <button onclick="approveSingleItem('${key}', '${user}', '${item}')" style="padding:4px 8px; background:#2ecc71; color:white; border:none; border-radius:4px; cursor:pointer;">승인</button></div>`;
                });
            }
            adminH += `<div style="background:#fdfefe; border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:10px;"><h4 style="margin:0 0 10px 0; color:#2c3e50;">🧑‍🎓 ${user} 용사 요청</h4> ${individualListH} <button onclick="approveUserAll('${userKeys.join(',')}', '${user}')" style="margin-top:10px; width:100%; padding:8px; background:#e74c3c; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">전체 일괄 승인</button></div>`;
        }
        
        const unusedEl = document.getElementById('inv-unused');
        if (unusedEl && unusedEl.querySelector('.list')) unusedEl.querySelector('.list').innerHTML = uH || "<p style='color:#666; padding:10px;'>보관함이 비었습니다.</p>";
        const waitingEl = document.getElementById('inv-waiting');
        if (waitingEl && waitingEl.querySelector('.list')) waitingEl.querySelector('.list').innerHTML = wH || "<p style='color:#666; padding:10px;'>대기 중인 항목이 없습니다.</p>"; 
        const adminOrderEl = document.getElementById('order-list');
        if (adminOrderEl) adminOrderEl.innerHTML = adminH || "<p style='color:#666;'>요청 없음</p>";
    });
}

document.addEventListener("DOMContentLoaded", initShopDataListeners);
if (typeof db !== 'undefined') initShopDataListeners();
