// js/point-shop.js
// 상점 물품 관리, 구매 로직, 한도 리셋, 인벤토리 및 사용 요청 승인 관리 통합 전체 코드

if (typeof window.currentShopCat === 'undefined') window.currentShopCat = "전체";
if (typeof window.shopData === 'undefined') window.shopData = [];

window.changeShopCat = (cat) => { window.currentShopCat = cat; window.renderShop(); };

// 상점 렌더링
window.renderShop = function() {
    const shopDiv = document.getElementById('shop-list'); 
    if (!shopDiv) return;
    
    let html = "";
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        html += `<button onclick="openAddShopPopup()" style="background:var(--gold); color:var(--dark); font-weight:bold; margin-bottom:15px; width:100%; border:none; padding:15px; border-radius:10px; font-size:1.2rem; cursor:pointer;">+ 새 물품 등록</button>`;
    }

    const categories = ["전체", "🍕 먹거리", "🎫 쿠폰", "🎲 뽑기", "✏️ 학용품", "✨ 기타"];
    html += `<div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto;">`;
    categories.forEach(c => {
        const isActive = (window.currentShopCat === c);
        html += `<button onclick="changeShopCat('${c}')" style="padding:10px 15px; border-radius:20px; border:none; background:${isActive ? 'var(--primary)' : '#eee'}; color:${isActive ? 'white' : '#333'};">${c}</button>`;
    });
    html += `</div>`;

    if (window.shopData && window.shopData.length > 0) {
        window.shopData.forEach(child => {
            const k = child.key, item = child.val();
            if (window.currentShopCat !== "전체" && item.cat !== window.currentShopCat) return;
            
            const isSoldOut = item.isSoldOut === true || (item.stock !== null && item.stock <= 0);
            let btnHtml = isSoldOut ? `<button disabled style="background:#ccc; padding:10px; width:100%; border-radius:5px;">품절 🚫</button>` : `<button onclick="buyItem('${k}', '${item.name}', ${item.price}, ${item.limit})" style="background:#4CAF50; color:white; padding:10px; width:100%; border-radius:5px; cursor:pointer;">구매하기</button>`;
            let adminBtnHtml = (typeof isAdmin !== 'undefined' && isAdmin) ? `<button onclick="openEditShopPopup('${k}')" style="background:#ff9800; color:white; margin-top:8px; padding:8px; width:100%; border-radius:5px;">⚙️ 수정/삭제</button>` : "";

            html += `
                <div class="shop-card" style="border:1px solid #ddd; padding:15px; margin:10px; border-radius:10px; display:inline-block; width:220px; background:white; text-align:center;">
                    <div style="font-size:12px; color:#999;">${item.cat || '미분류'}</div>
                    <h3 style="margin:5px 0;">${item.name}</h3>
                    <p style="font-weight:bold; color:#2196F3; margin:10px 0;">💰 ${item.price} P</p>
                    ${btnHtml} ${adminBtnHtml}
                </div>`;
        });
    }
    shopDiv.innerHTML = html || `<div style="text-align:center; padding:40px;">등록된 물품이 없습니다.</div>`;
};

// 구매 로직
window.buyItem = async function(k, n, p, l) {
    const sn = await db.ref('users/' + myName).once('value');
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
            if (o.user === myName && o.item === n && !o.item.includes('(한도리셋)')) count++;
        });
        if (count >= l) return alert(`최대 ${l}번까지만 구매 가능합니다!`);
    }

    await db.ref('users/' + myName).update({ points: myPoints - p });
    if (itemData && itemData.stock !== undefined && itemData.stock > 0) await db.ref('shop/' + k).update({ stock: itemData.stock - 1 });
    await db.ref('orders').push({ user: myName, item: n, price: p, time: new Date().getTime(), status: "요청" });
    alert(`✅ [${n}] 구매 완료!`);
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

// 실시간 주문/승인 관리
function initShopDataListeners() {
    db.ref('shop').on('value', (s) => { window.shopData = []; s.forEach(c => window.shopData.push(c)); window.renderShop(); });
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

        let shopMap = {};
        if (window.shopData) window.shopData.forEach(s => shopMap[s.val().name] = s.val());

        for (let item in myUnused) {
            const orderKey = myUnused[item][0];
            uH += `<div class="list-item" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                    <span>${item} <b>x${myUnused[item].length}</b></span>
                    <button onclick="useInventoryItem('${orderKey}', '${item}')" style="padding:5px 10px;">사용</button></div>`;
        }
        for (let item in myWaiting) {
            wH += `<div class="list-item" style="padding:10px;">${item} <b>x${myWaiting[item]}</b> ⏳ 승인대기</div>`;
        }
        for (let user in adminWaiting) {
            let userKeys = [];
            let individualListH = "";
            for (let item in adminWaiting[user]) {
                adminWaiting[user][item].forEach(key => {
                    userKeys.push(key);
                    individualListH += `<div style="padding:10px; border:1px solid #ddd;">👉 ${item} <button onclick="approveSingleItem('${key}', '${user}', '${item}')">승인</button></div>`;
                });
            }
            adminH += `<div style="background:#fff; padding:15px; margin-bottom:10px;">🧑‍🎓 ${user} 용사 요청 ${individualListH} <button onclick="approveUserAll('${userKeys.join(',')}', '${user}')">일괄 승인</button></div>`;
        }
        
        const unusedEl = document.getElementById('inv-unused');
        if (unusedEl && unusedEl.querySelector('.list')) unusedEl.querySelector('.list').innerHTML = uH || "비었음";
        const waitingEl = document.getElementById('inv-waiting');
        if (waitingEl && waitingEl.querySelector('.list')) waitingEl.querySelector('.list').innerHTML = wH || "비었음"; 
        const adminOrderEl = document.getElementById('order-list');
        if (adminOrderEl) adminOrderEl.innerHTML = adminH || "요청 없음";
    });
}

document.addEventListener("DOMContentLoaded", initShopDataListeners);
if (typeof db !== 'undefined') initShopDataListeners();
