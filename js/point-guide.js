// js/point-guide.js
// 6-6반 포인트 도감 관리 전용 기능 (학생 조회 가능 및 관리자 기능 분리)

// 1. 도감 데이터 실시간 동기화 및 렌더링 리스너
function initPointGuideListener() {
    if (typeof db === 'undefined') return;
    
    db.ref('pointGuide').on('value', snap => {
        const guideListEl = document.getElementById('guide-list');
        if (!guideListEl) return;

        let h = "";
        let addH = "";

        // 관리자 전용 새 도감 등록 버튼 및 타이틀 안내 설정
        if (typeof isAdmin !== 'undefined' && isAdmin) {
            addH = `<button onclick="openAddGuidePopup()" style="background:var(--gold); color:var(--dark); font-weight:bold; margin-bottom:20px; width:100%; border:none; padding:20px; border-radius:12px; font-size:1.3rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">+ 새 도감 기준 등록</button>`;
            const guideTitle = document.querySelector('#tab-points h2');
            if (guideTitle) guideTitle.innerHTML = `📜 포인트 도감 <small style="font-size:1rem; color:#666;">(클릭 시 일괄 지급)</small>`;
        } else {
            const guideTitle = document.querySelector('#tab-points h2');
            if (guideTitle) guideTitle.innerHTML = `📜 포인트 도감`;
        }

        snap.forEach(c => {
            const g = c.val();
            let delBtn = "";
            
            // 관리자에게만 개별 삭제 버튼 표시
            if (typeof isAdmin !== 'undefined' && isAdmin) {
                delBtn = `<button onclick="event.stopPropagation(); deleteGuideItem('${c.key}')" style="margin-top:15px; width:100%; background:var(--red); color:white; border:none; border-radius:10px; padding:12px; font-size:1.2rem; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">🗑️ 삭제</button>`;
            }
            
            h += `
                <div class="hero-card" onclick="openMultiPopup('${g.title}', ${g.p}, ${g.e})" style="display:flex; flex-direction:column; justify-content:center; cursor:pointer; background:white; padding:22px; border-radius:15px; box-shadow:0 4px 10px rgba(0,0,0,0.06); text-align:center;">
                    <b style="font-size:1.3rem; margin-bottom:8px; color:var(--dark);">${g.title}</b>
                    <span style="color:var(--primary); font-weight:800; font-size:1.2rem;">${g.p}P / ${g.e}E</span>
                    ${delBtn}
                </div>
            `;
        });

        // 학생과 관리자 모두 도감 영역이 화면에 표시되도록 설정
        if (guideListEl.parentElement) {
            guideListEl.parentElement.style.display = 'block';
        }
        guideListEl.innerHTML = addH + h;
    });
}

// 2. 새 도감 등록 팝업 창 열기 함수 (관리자 전용)
window.openAddGuidePopup = function() {
    let h = `<h3 style="margin-top:0; font-size:1.5rem;">📜 새 도감 등록</h3>
             항목명: <input type="text" id="add-guide-title" placeholder="예: 숙제 완료" style="font-size:1.2rem; padding:10px; width:100%; box-sizing:border-box; margin-bottom:12px;"><br>
             지급 P: <input type="number" id="add-guide-p" value="0" style="font-size:1.2rem; padding:10px; width:100%; box-sizing:border-box; margin-bottom:12px;"><br>
             지급 E: <input type="number" id="add-guide-e" value="0" style="font-size:1.2rem; padding:10px; width:100%; box-sizing:border-box; margin-bottom:18px;"><br>
             <button onclick="saveNewGuide()" style="background:var(--primary); color:white; margin-top:10px; padding:16px; border-radius:10px; border:none; width:100%; font-weight:bold; font-size:1.3rem; cursor:pointer;">등록하기</button>`;
    openPopup("도감 추가", h);
};

// 3. 새 도감 데이터베이스 저장 함수
window.saveNewGuide = function() {
    const t = document.getElementById('add-guide-title').value;
    const p = parseInt(document.getElementById('add-guide-p').value) || 0;
    const e = parseInt(document.getElementById('add-guide-e').value) || 0;
    
    if(t) {
        db.ref('pointGuide').push({title: t, p: p, e: e}).then(() => { 
            alert("도감에 성공적으로 등록되었습니다!"); 
            closePopup(); 
        });
    } else {
        alert("항목명을 입력해 주세요!");
    }
};

// 4. 도감 항목 삭제 함수 (관리자 전용)
window.deleteGuideItem = function(key) {
    if(confirm("정말 이 도감 항목을 삭제하시겠습니까?")) {
        db.ref('pointGuide/' + key).remove().then(() => {
            alert("항목이 삭제되었습니다.");
        });
    }
};

// 도감 리스너 실행 바인딩
document.addEventListener("DOMContentLoaded", () => {
    initPointGuideListener();
});
if (typeof db !== 'undefined') {
    initPointGuideListener();
}
