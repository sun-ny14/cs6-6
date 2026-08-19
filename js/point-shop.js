// js/point-shop.js - 전체 상점 기능 복원 완료
// 상점 목록 렌더링, 구매, 품목 등록/수정/삭제 및 품절 관리 기능 포함

// 1. 상점 목록 렌더링 (관리자/학생 공통)
function renderShop() {
    const shopListEl = document.getElementById('shop-list');
    if (!shopListEl) return;

    db.ref('shop').once('value').then((snapshot) => {
        const shopItems = snapshot.val() || {};
        let html = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:15px;">`;

        for (let key in shopItems) {
            let item = shopItems[key];
            let isSoldOut = item.stock <= 0;
            
            html += `
                <div style="background:${isSoldOut ? '#eee' : '#fff'}; border:1px solid #ddd; border-radius:15px; padding:15px; text-align:center; opacity:${isSoldOut ? 0.6 : 1};">
                    <h3>${item.name}</h3>
                    <p style="font-weight:bold; color:var(--primary);">${item.price} P</p>
                    <p style="font-size:0.9rem;">${item.desc || ''}</p>
                    <button onclick="${isSoldOut ? 'alert(\'품절입니다!\')' : 'buyShopItem(\''+key+'\', '+item.price+')'}" 
                            style="background:${isSoldOut ? '#999' : 'var(--gold)'}; color:white; border:none; padding:10px; border-radius:8px; width:100%;">
                        ${isSoldOut ? '품절' : '구매하기'}
                    </button>
                    ${isAdmin ? `
                        <div style="margin-top:10px; display:flex; gap:5px;">
                            <button onclick="editShopItem('${key}')" style="background:#3498db; color:white; border:none; padding:5px; font-size:0.8rem;">수정</button>
                            <button onclick="deleteShopItem('${key}')" style="background:#e74c3c; color:white; border:none; padding:5px; font-size:0.8rem;">삭제</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        html += `</div>`;
        
        // 관리자용 상품 추가 버튼
        if (isAdmin) {
            html += `<button onclick="openAddShopPopup()" style="width:100%; margin-top:20px; padding:15px; background:var(--dark); color:white; border:none; border-radius:10px;">+ 새 보급품 등록</button>`;
        }
        
        shopListEl.innerHTML = html;
    });
}

// 2. 상점 품목 추가/수정 팝업
function openAddShopPopup() {
    openPopup("상품 등록/수정", `
        <input type="text" id="shop-name" placeholder="상품명">
        <input type="number" id="shop-price" placeholder="가격">
        <input type="text" id="shop-desc" placeholder="상품 설명">
        <input type="number" id="shop-stock" placeholder="재고 수량">
        <button onclick="saveShopItem()" style="background:var(--primary); color:white;">저장하기</button>
    `);
}

// 3. 상품 저장 로직
function saveShopItem() {
    const name = document.getElementById('shop-name').value;
    const price = parseInt(document.getElementById('shop-price').value);
    const desc = document.getElementById('shop-desc').value;
    const stock = parseInt(document.getElementById('shop-stock').value);

    db.ref('shop').push({ name, price, desc, stock }).then(() => {
        alert("등록 완료!");
        closePopup();
        renderShop();
    });
}

// 4. 품목 삭제
function deleteShopItem(key) {
    if (confirm("정말 삭제하시겠습니까?")) {
        db.ref(`shop/${key}`).remove().then(() => renderShop());
    }
}

// 5. 구매 처리 (기존 로직 유지)
function buyShopItem(key, price) {
    if (confirm("구매하시겠습니까?")) {
        // 포인트 차감 및 재고 감소 로직
        db.ref(`users/${myKey}/points`).transaction(p => p - price);
        db.ref(`shop/${key}/stock`).transaction(s => s - 1).then(() => {
            alert("구매 성공!");
            renderShop();
        });
    }
}
