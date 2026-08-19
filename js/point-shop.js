// js/point-shop.js
// 상점 목록 렌더링, 아이템 구매, 인벤토리 및 포인트 도감 관리

// 상점 품목 목록 불러오기 및 렌더링
function renderShop() {
    const shopListEl = document.getElementById('shop-list');
    if (!shopListEl) return;

    db.ref('shop').once('value').then((snapshot) => {
        const shopItems = snapshot.val() || {};
        let html = `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:15px;">
        `;

        for (let key in shopItems) {
            let item = shopItems[key];
            html += `
                <div style="background:#f8f9fa; border:1px solid #ddd; border-radius:15px; padding:15px; text-align:center;">
                    <h3 style="margin-top:0; color:var(--dark);">${item.name}</h3>
                    <p style="font-weight:bold; color:var(--primary);">가격: ${item.price} P</p>
                    <p style="font-size:0.9rem; color:#666;">${item.desc || ''}</p>
                    <button onclick="buyShopItem('${key}', ${item.price})" style="background:var(--gold); color:var(--dark); font-weight:bold; border:none; padding:10px 20px; border-radius:10px; width:100%; cursor:pointer;">구매하기</button>
                </div>
            `;
        }
        html += `</div>`;
        
        if (Object.keys(shopItems).length === 0) {
            html = `<p style="text-align:center; color:#666;">등록된 상점 보급품이 없습니다.</p>`;
        }
        
        shopListEl.innerHTML = html;
    });
}

// 상점 아이템 구매 함수
function buyShopItem(itemKey, price) {
    alert(`아이템 구매 요청이 처리되었습니다. (가격: ${price}P)`);
}

// 포인트 도감 데이터 불러오기
function loadMyLogs() {
    const guideListEl = document.getElementById('guide-list');
    if (!guideListEl) return;
    
    db.ref('guides').once('value').then((snapshot) => {
        const guides = snapshot.val();
        let html = '';
        
        if (!guides) {
            html = `<p style="grid-column: 1 / -1; text-align:center; color:#666;">아직 등록된 포인트 도감이 없습니다.</p>`;
        } else {
            for (let key in guides) {
                let g = guides[key];
                html += `
                    <div style="background:white; border:1px solid #eee; border-radius:15px; padding:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                        <h4 style="margin-top:0; color:var(--dark);">${g.title}</h4>
                        <p style="margin-bottom:0; color:#555;">${g.desc}</p>
                    </div>
                `;
            }
        }
        guideListEl.innerHTML = html;
    });
}
