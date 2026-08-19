// js/point-shop.js
// 포인트 지급, 도감, 상점 및 인벤토리 관리 기능

// 상점 목록 렌더링
function renderShop() {
    const shopListEl = document.getElementById('shop-list');
    if (!shopListEl) return;
    
    // 예시 데이터 및 상점 UI 구현부
    shopListEl.innerHTML = `<p>상점 목록을 불러오는 중입니다...</p>`;
    
    db.ref('shop').once('value').then((snapshot) => {
        const items = snapshot.val() || {};
        let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:15px;">';
        
        for (let key in items) {
            let item = items[key];
            html += `
                <div style="background:#f8f9fa; border:1px solid #ddd; border-radius:15px; padding:15px; text-align:center;">
                    <h4>${item.name}</h4>
                    <p>가격: ${item.price} P</p>
                    <button onclick="buyItem('${key}')" style="background:var(--primary); color:white; border:none; border-radius:10px; padding:10px; width:100%;">구매하기</button>
                </div>
            `;
        }
        html += '</div>';
        shopListEl.innerHTML = html;
    });
}

// 아이템 구매 함수
function buyItem(itemKey) {
    if (!confirm("정말 이 아이템을 구매하시겠습니까?")) return;
    
    // 구매 로직 처리
    alert("아이템 구매 요청이 완료되었습니다!");
}

// 포인트 내역 및 도감 로드
function loadMyLogs() {
    const guideListEl = document.getElementById('guide-list');
    if (!guideListEl) return;
    
    db.ref('guides').once('value').then((snapshot) => {
        const guides = snapshot.val() || {};
        let html = '';
        for (let key in guides) {
            let g = guides[key];
            html += `
                <div style="background:white; border:1px solid #eee; border-radius:15px; padding:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <h4>${g.title}</h4>
                    <p>${g.desc}</p>
                </div>
            `;
        }
        guideListEl.innerHTML = html;
    });
}

// 일괄 지급 팝업 전체 선택/해제
function checkAllMulti(selectStatus) {
    const checkboxes = document.querySelectorAll('#multi-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = selectStatus);
}

// 포인트 일괄 지급 실행
function applyMultiScores() {
    const reason = document.getElementById('multi-reason').value;
    const pVal = parseInt(document.getElementById('multi-p').value) || 0;
    const eVal = parseInt(document.getElementById('multi-e').value) || 0;
    
    if (!reason) {
        alert("사유를 입력해 주세요.");
        return;
    }
    
    alert(`사유: [${reason}] 포인트(${pVal}P), 경험치(${eVal}E) 일괄 지급 로직실행`);
}
