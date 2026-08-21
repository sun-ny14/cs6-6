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
// 포인트 및 일괄 지급 관련 통합 관리 코드

// 1. 새로운 형태의 플로팅 일괄 지급 팝업 열기
function openPointBulkPopup(t='', p='', e='') {
    let h = `
        <div style="position:sticky; top:0; background:white; padding-bottom:15px; border-bottom:3px solid var(--gold); z-index:10;">
            <input type="text" id="pop-bulk-reason" value="${t}" placeholder="지급 사유를 입력하세요" style="width:100%; padding:12px; margin-bottom:10px; font-size:1.2rem; box-sizing:border-box;">
            <div style="display:flex; gap:15px; justify-content:center; align-items:center; background:#f9f9f9; padding:10px; border-radius:12px;">
                <div style="text-align:center;">
                    <span style="display:block; font-weight:bold; color:var(--primary); font-size:1rem;">일괄 P</span>
                    <input type="number" id="all-p-input" value="${p}" oninput="applyToAll('p')" style="width:100px; height:50px; text-align:center; font-size:1.4rem; border:2px solid var(--primary); border-radius:8px;">
                </div>
                <div style="text-align:center;">
                    <span style="display:block; font-weight:bold; color:var(--purple); font-size:1rem;">일괄 E</span>
                    <input type="number" id="all-e-input" value="${e}" oninput="applyToAll('e')" style="width:100px; height:50px; text-align:center; font-size:1.4rem; border:2px solid var(--purple); border-radius:8px;">
                </div>
            </div>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="toggleAllCheckboxes(true)" style="flex:1; background:var(--dark); color:white; padding:10px; font-size:1.1rem; border:none; border-radius:8px; cursor:pointer;">전체 선택</button>
                <button onclick="toggleAllCheckboxes(false)" style="flex:1; background:#95a5a6; color:white; padding:10px; font-size:1.1rem; border:none; border-radius:8px; cursor:pointer;">선택 해제</button>
            </div>
        </div>
        
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:15px; margin-top:20px;">`;

    // currentUsers 배열을 순회하며 학생별 체크박스 및 개별 P/E 입력창 생성
    if (typeof currentUsers !== 'undefined') {
        currentUsers.forEach(u => {
            if(u.name !== "총사령관") {
                h += `
                <div style="background:#fff; border:2px solid #eee; border-radius:15px; padding:12px; text-align:center; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <label style="display:block; cursor:pointer; margin-bottom:8px;">
                        <input type="checkbox" class="student-select" data-name="${u.name}" checked style="width:20px; height:20px;">
                        <div style="font-weight:bold; font-size:1.2rem; margin-top:5px;">${u.no||u.number||''} ${u.name}</div>
                    </label>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; justify-content:center; gap:5px;">
                            <span style="color:var(--primary); font-weight:bold; font-size:0.9rem; width:20px;">P</span>
                            <input type="number" class="pop-bulk-p" value="${p}" style="width:85px; height:45px; text-align:center; font-size:1.3rem; border:2px solid #3498db; border-radius:8px;">
                        </div>
                        <div style="display:flex; align-items:center; justify-content:center; gap:5px;">
                            <span style="color:var(--purple); font-weight:bold; font-size:0.9rem; width:20px;">E</span>
                            <input type="number" class="pop-bulk-e" value="${e}" style="width:85px; height:45px; text-align:center; font-size:1.3rem; border:2px solid #9b59b6; border-radius:8px;">
                        </div>
                    </div>
                </div>`;
            }
        });
    }

    // 공통 팝업 영역에 주입
    const popBody = document.getElementById('point-pop-body');
    const popTitle = document.getElementById('point-pop-title');
    const popup = document.getElementById('point-popup');
    const applyBtn = document.getElementById('point-apply-btn');

    if (popTitle) popTitle.innerHTML = `✨ 일괄 포인트 및 경험치 지급`;
    if (popBody) popBody.innerHTML = h + `</div>`;
    
    if (applyBtn) {
        applyBtn.style.display = 'block';
        applyBtn.onclick = () => {
            const r = document.getElementById('pop-bulk-reason').value;
            if(!r) return alert("지급 사유를 입력해주세요!");
            
            const cbs = document.querySelectorAll('.student-select');
            const ps = document.querySelectorAll('.pop-bulk-p');
            const es = document.querySelectorAll('.pop-bulk-e');
            
            cbs.forEach((cb, i) => {
                if(cb.checked) {
                    // addScore 함수가 전역에 정의되어 있다고 가정
                    if (typeof addScore === 'function') {
                        addScore(cb.dataset.name, parseInt(ps[i].value)||0, parseInt(es[i].value)||0, r);
                    }
                }
            });
            alert("성공적으로 반영되었습니다! ✨");
            closePointPopup();
        };
    }

    if (popup) popup.style.display = 'flex';
}

// 2. 구형/기타 호출을 위한 호환용 함수 연결 (플로팅 버튼 등에서 openMultiPopup을 호출할 때 이 함수가 실행되도록 연결)
function openMultiPopup(t='', p='', e='') {
    openPointBulkPopup(t, p, e);
}

// 3. 보조 유틸리티 함수들
function toggleAllCheckboxes(s) { 
    document.querySelectorAll('.student-select').forEach(cb => cb.checked = s); 
}

function applyToAll(type) { 
    const inputEl = document.getElementById('all-'+type+'-input');
    if (!inputEl) return;
    const val = inputEl.value; 
    document.querySelectorAll('.pop-bulk-'+type).forEach(input => input.value = val); 
}

function closePointPopup() { 
    const popup = document.getElementById('point-popup');
    if (popup) popup.style.display = 'none'; 
}
