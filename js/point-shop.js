// js/point-shop.js
// 6-6반 상점 및 포인트 도감 관리 전체 기능

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

    // 관리자 전용 새 물품 등록 버튼
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        html += `<button onclick="openAddShopPopup()" style="background:var(--gold); color:var(--dark); font-weight:bold; margin-bottom:15px; width:100%; border:none; padding:15px; border-radius:10px; font-size:1.2rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">+ 새 물품 등록</button>`;
    }

    // 카테고리 탭 생성
    const categories = ["전체", "🍕 먹거리", "🎫 쿠폰", "🎲 뽑기", "✏️ 학용품", "✨ 기타"];
    html += `<div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">`;
    categories.forEach(c => {
        const isActive = (currentShopCat === c);
        html += `<button onclick="changeShopCat('${c}')" style="padding: 10px 15px; border-radius: 20px; border: none; font-weight: bold; cursor: pointer; white-space: nowrap; background: ${isActive ? 'var(--primary)' : '#eee'}; color: ${isActive ? 'white' : '#333'}; box-shadow: ${isActive ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'};">${c}</button>`;
    });
    html += `</div>`;

    let hasItems = false; 

    if (window.shopData) {
        window.shopData.forEach(child => {
            const k = child.key;          
            const item = child.val();   
            
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

// ==========================================
// 3. 도감 관리 관련 함수들 (선생님 원본 유지)
// ==========================================

window.openAddGuidePopup = function() {
    let h = `<h3 style="margin-top:0;">📜 새 도감 등록</h3>
             항목명: <input type="text" id="add-guide-title" placeholder="예: 숙제 완료"><br>
             지급 P: <input type="number" id="add-guide-p" value="0"><br>
             지급 E: <input type="number" id="add-guide-e" value="0"><br>
             <button onclick="saveNewGuide()" style="background:var(--primary); color:white; margin-top:15px; padding:15px; border-radius:10px; border:none; width:100%; font-weight:bold; font-size:1.2rem; cursor:pointer;">등록하기</button>`;
    openPopup("도감 추가", h);
};

window.saveNewGuide = function() {
    const t = document.getElementById('add-guide-title').value;
    const p = parseInt(document.getElementById('add-guide-p').value) || 0;
    const e = parseInt(document.getElementById('add-guide-e').value) || 0;
    if(t) db.ref('pointGuide').push({title: t, p: p, e: e}).then(() => { alert("도감에 성공적으로 등록되었습니다!"); closePopup(); });
};

window.deleteGuideItem = function(key) {
    if(confirm("정말 삭제하시겠습니까?")) {
        db.ref('pointGuide/' + key).remove().then(() => {
            alert("항목이 삭제되었습니다.");
        });
    }
};

// ==========================================
// 4. 상점 물품 추가/수정/삭제 관리 함수들 (선생님 원본 유지)
// ==========================================

window.openAddShopPopup = function() { 
    let h = `<h3>📦 새 물품</h3>
            상품명: <input type="text" id="add-item-name"><br>
            가격: <input type="number" id="add-item-price"><br>
            제한: <input type="number" id="add-item-limit" value="0" placeholder="0이면 무제한"><br>
            재고: <input type="number" id="add-item-stock" placeholder="빈칸이면 무제한(품절 안 됨)"><br>
            카테고리: <select id="add-item-cat"><option value="🍕 먹거리">🍕 먹거리</option><option value="🎫 쿠폰">🎫 쿠폰</option><option value="🎲 뽑기">🎲 뽑기</option><option value="✏️ 학용품">✏️ 학용품</option><option value="✨ 기타">✨ 기타</option></select><br>
            <button onclick="saveNewItem()" style="background:var(--primary); color:white; margin-top: 15px; padding:10px; border:none; border-radius:5px; width:100%; font-weight:bold; cursor:pointer;">등록</button>`; 
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
                    <button onclick="saveEditShop('${key}')" style="flex:1; background:var(--primary); color:white; padding:10px; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">저장</button>
                    <button onclick="deleteShopItem('${key}')" style="flex:1; background:var(--red); color:white; padding:10px; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">삭제</button>
                </div>`;
        openPopup("보급품 관리", h);
    });
};

window.saveEditShop = function(key) {
    const name = document.getElementById('edit-shop-name').value;
    const price = parseInt(document.getElementById('edit-shop-price').value) || 0;
    const limit = parseInt(document.getElementById('edit-shop-limit').value) || 0;
    const stockInput = document.getElementById('edit-shop-stock').value;
    const stock = stockInput !== "" ? parseInt(stockInput) : null;
    const isSoldOut = document.getElementById('edit-shop-soldout').checked;
    const cat = document.getElementById('edit-shop-cat').value;

    db.ref('shop/' + key).update({
        name: name,
        price: price,
        limit: limit,
        stock: stock,
        isSoldOut: isSoldOut,
        cat: cat
    }).then(() => {
        alert("수정되었습니다!");
        closePopup();
    });
};

window.deleteShopItem = function(key) {
    if(confirm("정말 이 물품을 삭제하시겠습니까?")) {
        db.ref('shop/' + key).remove().then(() => {
            alert("물품이 삭제되었습니다.");
            closePopup();
        });
    }
};

// 5. 파이어베이스 데이터 실시간 동기화 리스너
document.addEventListener("DOMContentLoaded", () => {
    if (typeof db !== 'undefined') {
        db.ref('shop').on('value', (snapshot) => {
            window.shopData = [];
            snapshot.forEach((childSnapshot) => {
                window.shopData.push(childSnapshot);
            });
            if (typeof window.renderShop === 'function') {
                window.renderShop();
            }
        });
    }
});
