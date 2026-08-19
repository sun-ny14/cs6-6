// js/point-shop.js
// 6-6반 용사 본부 상점 기능 (카테고리, 재고, 품절, 관리자 수정/삭제 기능 포함)

let currentShopCat = "전체";

// 1. 카테고리 변경 함수
window.changeShopCat = function(cat) {
    currentShopCat = cat;
    window.renderShop();
};

// 2. 상점 목록 렌더링 함수
window.renderShop = function() {
    const shopDiv = document.getElementById('shop-list'); 
    if (!shopDiv) return;
    
    let html = "";

    // 관리자인 경우 새 물품 등록 버튼 표시
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        html += `<button onclick="openAddShopPopup()" style="background:var(--gold); color:var(--dark); font-weight:bold; margin-bottom:15px; width:100%; border:none; padding:15px; border-radius:10px; font-size:1.2rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">+ 새 물품 등록</button>`;
    }

    // 상점 카테고리 목록 탭 생성
    const categories = ["전체", "🍕 먹거리", "🎫 쿠폰", "🎲 뽑기", "✏️ 학용품", "✨ 기타"];
    html += `<div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">`;
    categories.forEach(c => {
        const isActive = (currentShopCat === c);
        html += `<button onclick="changeShopCat('${c}')" style="padding: 10px 15px; border-radius: 20px; border: none; font-weight: bold; cursor: pointer; white-space: nowrap; background: ${isActive ? 'var(--primary)' : '#eee'}; color: ${isActive ? 'white' : '#333'}; box-shadow: ${isActive ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'};">${c}</button>`;
    });
    html += `</div>`;

    let hasItems = false; 

    // 파이어베이스에서 불러온 상점 데이터(window.shopData) 순회
    if (window.shopData) {
        window.shopData.forEach(child => {
            const k = child.key;          
            const item = child.val();   
            
            // 선택된 카테고리가 '전체'가 아니고 아이템 카테고리와 다르면 건너뜀
            if (currentShopCat !== "전체" && item.cat !== currentShopCat) return;
            hasItems = true; 
            
            // 품절 판단 로직 (재고가 0이거나 수동 품절 체크박스 확인)
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

            // 관리자 전용 수정/삭제 버튼
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

// 3. 파이어베이스에서 상점 데이터를 실시간으로 가져와 window.shopData에 담고 화면을 그려주는 리스너
document.addEventListener("DOMContentLoaded", () => {
    if (typeof db !== 'undefined') {
        db.ref('shop').on('value', (snapshot) => {
            window.shopData = [];
            snapshot.forEach((childSnapshot) => {
                window.shopData.push(childSnapshot);
            });
            // 상점 화면이 그려져 있는 상태라면 데이터 갱신 시 실시간 반영
            if (typeof window.renderShop === 'function') {
                window.renderShop();
            }
        });
    }
});
