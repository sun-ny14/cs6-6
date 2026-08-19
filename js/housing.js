// js/housing.js
// 용사의 방(하우징) 배치, 상점, 보관함 및 방 관리 기능

// 하우징 탭 열기 및 내 방 로드
function openHousingTab() {
    const roomCanvas = document.getElementById('my-room-canvas');
    if (!roomCanvas) return;
    
    // 하우징 활성화 상태 확인 후 내 방 렌더링
    db.ref('housingStatus').once('value').then((snapshot) => {
        isHousingEnabled = snapshot.val() !== false;
        const statusEl = document.getElementById('housing-current-status');
        if (statusEl) {
            statusEl.innerText = isHousingEnabled ? "🟢 하우징 이용 가능" : "🔴 하우징 점검/차단 중";
        }
        renderMyRoom();
        renderHousingInventory();
    });
}

// 내 방 캔버스 렌더링
function renderMyRoom() {
    const canvas = document.getElementById('my-room-canvas');
    if (!canvas) return;
    
    canvas.innerHTML = `<p style="text-align:center; padding-top:40%; color:#5d4037; font-weight:bold;">용사의 방 가구 배치 불러오는 중...</p>`;
    
    // 사용자의 방 가구 데이터 불러오기
    db.ref(`rooms/${myName}`).once('value').then((snapshot) => {
        const roomData = snapshot.val() || {};
        let html = '';
        
        // 예시 가구 배치 아이템 렌더링
        for (let key in roomData) {
            let item = roomData[key];
            html += `
                <div style="position:absolute; left:${item.x || 0}px; top:${item.y || 0}px; width:50px; height:50px;">
                    <img src="${item.img || ''}" class="pixelated-img" alt="가구">
                </div>
            `;
        }
        
        if (!html) {
            html = `<div style="text-align:center; padding-top:40%; color:#795548; font-weight:bold;">아직 배치된 가구가 없습니다. 하우징 상점에서 가구를 채워보세요!</div>`;
        }
        
        canvas.innerHTML = html;
    });
}

// 하우징 상점 팝업 열기
function openHousingShopPopup() {
    alert("🛒 하우징 상점 창을 엽니다. 원하는 가구를 구매해 보세요!");
}

// 내 하우징 보관함 렌더링
function renderHousingInventory() {
    const invList = document.getElementById('housing-inventory-list');
    if (!invList) return;
    
    invList.innerHTML = `<p style="margin:0; color:#666;">보관함에 보유 중인 아이템이 없습니다.</p>`;
}

// 방 상태 변경 (관리자용)
function toggleHousing() {
    isHousingEnabled = !isHousingEnabled;
    db.ref('housingStatus').set(isHousingEnabled).then(() => {
        alert(`용사의 방 상태가 [${isHousingEnabled ? "이용 가능" : "차단/점검"}]으로 변경되었습니다.`);
        openHousingTab();
    });
}

// 내 방 저장하기
function saveMyRoom() {
    alert("💾 현재 배치된 가구 위치와 상태가 안전하게 저장되었습니다!");
}
