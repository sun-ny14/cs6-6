// js/admin-grades.js - 성적 관리, 평가 시스템, 학급 운영비 및 예산 관리 통합 파일

// 학급관리 메인 탭 라우터 (서브 탭 전환 제어)
window.renderManagementSub = function(subType) {
    const subContentEl = document.getElementById('management-sub-container');
    if (!subContentEl) return;

    const gradesButton = document.getElementById('sub-btn-grades');
    const budgetButton = document.getElementById('sub-btn-budget');
    if (gradesButton) {
        gradesButton.style.background = subType === 'grades' ? 'var(--primary, #3498db)' : '#ddd';
        gradesButton.style.color = subType === 'grades' ? 'white' : '#333';
    }
    if (budgetButton) {
        budgetButton.style.background = subType === 'budget' ? 'var(--primary, #3498db)' : '#ddd';
        budgetButton.style.color = subType === 'budget' ? 'white' : '#333';
    }

    if (subType === 'grades') {
        subContentEl.innerHTML = `
            <div class="card" style="margin-bottom: 20px;">
                <h2>📝 성적 및 평가 관리</h2>
                <p>학생들의 성적과 수행평가 기록을 관리하는 공간입니다.</p>
                <div style="text-align:center; margin:15px 0;">
                    <div id="grades-subject-buttons" style="display:flex; flex-wrap:nowrap; overflow-x:auto; justify-content:center; gap:5px; padding: 6px; background: #f1f3f5; border-radius: 8px;">
                    </div>
                </div>
                <div id="grades-content-area" style="margin-top:15px;"></div>
            </div>
        `;
        if (typeof loadSubjectGrades === 'function') {
            loadSubjectGrades(typeof currentGradeSubject !== 'undefined' ? currentGradeSubject : '국어');
        }
    } else {
        subContentEl.innerHTML = `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="margin:0;">💰 학급 운영비 및 예산 관리</h2>
                    <button onclick="openAddBudgetPopup()" style="background:var(--primary, #3498db); color:white; padding:8px 15px; border-radius:8px; border:none; font-weight:bold; cursor:pointer;">+ 내역 추가 / 예산 설정</button>
                </div>
                <div id="budget-summary" style="font-size:1.1rem; font-weight:bold; margin-bottom:15px; padding:10px; background:#f8f9fa; border-radius:8px; border:1px solid #dee2e6;">
                    예산 정보 불러오는 중...
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left;">
                        <thead>
                            <tr style="background:#f1f3f5; border-bottom:2px solid #ccc;">
                                <th style="padding:10px;">날짜</th>
                                <th style="padding:10px;">쇼핑몰</th>
                                <th style="padding:10px;">용도</th>
                                <th style="padding:10px;">금액</th>
                                <th style="padding:10px;">관리</th>
                            </tr>
                        </thead>
                        <tbody id="budget-list">
                            <tr><td colspan='5' style='padding:20px; text-align:center; color:#888;'>내역을 불러오는 중입니다...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        if (typeof initBudgetManager === 'function') {
            initBudgetManager();
        }
    }
};

window.renderGradesMain = function() {
    renderManagementSub('grades');
};


// ==========================================
// 1. 성적 및 평가 관리 시스템
// ==========================================

const SUBJECTS = ['국어', '수학', '사회', '과학', '미술', '도덕', '음악', '체육', '실과'];
let currentGradeSubject = '국어';

// 선택한 과목의 '평가 목록' 불러오기
window.loadSubjectGrades = function(subject) {
    currentGradeSubject = subject;
    
    const btnContainer = document.getElementById('grades-subject-buttons');
    if (btnContainer) {
        let btnHtml = '';
        SUBJECTS.forEach(sub => {
            const isActive = (sub === currentGradeSubject) ? 'background:var(--primary, #3498db); color:white; font-weight:bold;' : 'background:white; color:#333; border:1px solid #ccc;';
            btnHtml += `<button onclick="loadSubjectGrades('${sub}')" style="padding:8px 14px; font-size:1.1rem; border:none; border-radius:6px; cursor:pointer; min-width:65px; font-weight:bold; transition:0.1s; ${isActive}">${sub}</button>`;
        });
        btnContainer.innerHTML = btnHtml;
    }

    const contentArea = document.getElementById('grades-content-area');
    if (!contentArea) return;

    db.ref('grades/' + subject).once('value', snap => {
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:2px solid #ccc; padding-bottom:10px;">
                <h3 style="margin:0;">📘 ${subject} 평가 목록</h3>
                <div>
                    <button onclick="openNewGradePopup('${subject}', 'perf')" style="padding:6px 12px; font-size:0.88rem; background:#43a047; color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer; margin-right:5px;">+ 수행평가 추가</button>
                    <button onclick="openNewGradePopup('${subject}', 'score')" style="padding:6px 12px; font-size:0.88rem; background:#1e88e5; color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">+ 일반평가 추가</button>
                </div>
            </div>
            <div style="display:grid; gap:10px;">
        `;

        let assessments = [];
        snap.forEach(child => { assessments.push({ key: child.key, ...child.val() }); });
        assessments.reverse(); 

        if (assessments.length === 0) {
            html += `<div style="text-align:center; color:#666; padding:25px; border:2px dashed #ccc; border-radius:10px; background:#f9f9f9; font-size:0.95rem;">등록된 평가가 없습니다. 오른쪽 위의 [+ 추가] 버튼을 이용해 주세요.</div>`;
        } else {
            assessments.forEach(a => {
                const typeIcon = a.type === 'perf' ? '📋 수행' : '💯 일반';
                const typeColor = a.type === 'perf' ? '#43a047' : '#1e88e5';
                html += `
                    <div onclick="openGradeEditor('${subject}', '${a.key}')" style="padding:12px; background:white; border:1px solid #ddd; border-left:5px solid ${typeColor}; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <span><strong style="color:${typeColor};">${typeIcon}</strong> &nbsp;|&nbsp; <b>${a.title}</b></span>
                        <small style="color:#888;">${a.date}</small>
                    </div>
                `;
            });
        }
        html += `</div>`;
        contentArea.innerHTML = html;
    });
};

// 새 평가 만들기 (제목 입력)
window.openNewGradePopup = function(subject, type) {
    const title = prompt(`[${subject}] 평가의 제목을 입력하세요.\n(예: 1단원 덧셈과 뺄셈, 시 낭송하기 등)`);
    if (!title) return;

    const key = db.ref(`grades/${subject}`).push().key;
    db.ref(`grades/${subject}/${key}`).set({
        title: title,
        type: type,
        date: new Date().toISOString().split('T')[0],
        scores: {}
    }).then(() => {
        openGradeEditor(subject, key);
    });
};

// 평가 입력 창 (DB 등록 순서 100% 보장)
window.openGradeEditor = function(subject, key) {
    db.ref(`grades/${subject}/${key}`).once('value', snap => {
        const data = snap.val();
        if (!data) return;
        
        db.ref('users').once('value', userSnap => {
            let users = [];
            userSnap.forEach(u => {
                users.push(u.key); 
            });

            let h = `
                <div style="text-align:left;">
                    <h3 style="margin-top:0; border-bottom:2px solid #eee; padding-bottom:10px;">
                        ${data.title} <small style="color:#666; font-size:0.9rem;">(${data.type === 'perf' ? '수행평가' : '일반평가'})</small>
                    </h3>
                    <div style="max-height:400px; overflow-y:auto; padding-right:5px;">
                        <table style="width:100%; border-collapse:collapse; text-align:center;">
                            <thead style="background:#f1f3f5; position:sticky; top:0; z-index:2;">
                                <tr>
                                    <th style="padding:10px; border:1px solid #ccc; width:40%;">이름</th>
                                    <th style="padding:10px; border:1px solid #ccc;">${data.type === 'perf' ? '결과 <small>(더블클릭으로 변경)</small>' : '점수 입력'}</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            let scores = data.scores || {};

            users.forEach((u, index) => {
                let val = scores[u] || (data.type === 'perf' ? '매우잘함◎' : '');
                
                if (data.type === 'perf') {
                    let color = val.includes('매우') ? 'var(--dark, #333)' : (val.includes('보통') ? '#e65100' : '#1976d2');
                    h += `
                        <tr>
                            <td style="padding:10px; border:1px solid #ccc; font-weight:bold;">${u}</td>
                            <td style="padding:0; border:1px solid #ccc; background:white;">
                                <button id="grade-${u}" ondblclick="togglePerfGrade('${u}')" style="width:100%; height:100%; min-height:45px; padding:10px; background:transparent; border:none; font-size:1.1rem; cursor:pointer; font-weight:bold; color:${color}; transition:0.2s;">
                                    ${val}
                                </button>
                            </td>
                        </tr>
                    `;
                } else {
                    h += `
                        <tr>
                            <td style="padding:10px; border:1px solid #ccc; font-weight:bold;">${u}</td>
                            <td style="padding:10px; border:1px solid #ccc; background:white;">
                                <input type="number" id="grade-${u}" class="score-input" value="${val}" tabindex="${index + 1}" oninput="calcAvg()" placeholder="점수" style="width:80%; padding:8px; border:1px solid #ccc; border-radius:5px; text-align:center; font-size:1.1rem;">
                            </td>
                        </tr>
                    `;
                }
            });

            h += `</tbody></table></div>`;
            
            if (data.type === 'score') {
                h += `<div style="text-align:right; margin-top:15px; padding-right:10px; font-weight:bold; font-size:1.2rem; background:#e3f2fd; padding:10px; border-radius:8px;">평균: <span id="score-average" style="color:#1e88e5;">0.0점</span></div>`;
            }

            h += `
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button onclick="saveGrades('${subject}', '${key}', '${data.type}')" style="flex:2; padding:15px; background:var(--primary, #3498db); color:white; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">💾 성적 저장하기</button>
                    <button onclick="deleteGrade('${subject}', '${key}')" style="flex:1; padding:15px; background:var(--red, #e74c3c); color:white; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.1);">🗑️ 삭제</button>
                </div>
            </div>`;
            
            if (typeof openPopup === 'function') openPopup("평가 기록", h);
            if (data.type === 'score') setTimeout(calcAvg, 100); 
        });
    });
};

// 수행평가 더블클릭 순환 로직
window.togglePerfGrade = function(u) {
    if (window.getSelection) window.getSelection().removeAllRanges();
    
    const el = document.getElementById(`grade-${u}`);
    if (!el) return;
    
    if (el.innerText.includes('매우잘함')) {
        el.innerText = '잘함○';
        el.style.color = '#1976d2'; 
    } else if (el.innerText.includes('잘함')) {
        el.innerText = '보통△';
        el.style.color = '#e65100'; 
    } else {
        el.innerText = '매우잘함◎';
        el.style.color = 'var(--dark, #333)'; 
    }
};

// 일반평가 실시간 평균 계산기
window.calcAvg = function() {
    let sum = 0; let count = 0;
    document.querySelectorAll('.score-input').forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
            sum += val;
            count++;
        }
    });
    const avg = count === 0 ? 0 : (sum / count).toFixed(1);
    const avgEl = document.getElementById('score-average');
    if (avgEl) avgEl.innerText = avg + '점';
};

// 성적 DB 저장
window.saveGrades = function(subject, key, type) {
    let scores = {};
    db.ref('users').once('value', snap => {
        snap.forEach(child => {
            const u = child.key;
            const el = document.getElementById(`grade-${u}`);
            if (el) {
                scores[u] = type === 'perf' ? el.innerText.trim() : (el.value ? parseFloat(el.value) : '');
            }
        });
        db.ref(`grades/${subject}/${key}/scores`).set(scores).then(() => {
            alert("성적 데이터가 안전하게 저장되었습니다! ✅");
            if (typeof closePopup === 'function') closePopup();
            loadSubjectGrades(subject); 
        });
    });
};

// 평가 기록 삭제
window.deleteGrade = function(subject, key) {
    if (!confirm("⚠️ 이 평가 기록을 완전히 삭제하시겠습니까? (복구 불가)")) return;
    db.ref(`grades/${subject}/${key}`).remove().then(() => {
        alert("삭제 완료되었습니다.");
        if (typeof closePopup === 'function') closePopup();
        loadSubjectGrades(subject);
    });
};


// ==========================================
// 2. 학급 운영비 및 예산 관리 시스템
// ==========================================

if (typeof window.totalBudget === 'undefined') {
    window.totalBudget = 0;
}

// 예산 데이터 실시간 불러오기 및 렌더링
window.initBudgetManager = function() {
    db.ref('settings/budgetTotal').on('value', s => { 
        window.totalBudget = s.val() || 0; 
        updateBudgetSummaryUI();
    });

    db.ref('budgetRecords').on('value', snap => {
        let h = "";
        let totalSpent = 0;
        
        snap.forEach(child => {
            const item = child.val();
            totalSpent += parseInt(item.amount || 0);
            h += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px;">${item.date}</td>
                    <td style="padding:10px;">${item.mall}</td>
                    <td style="padding:10px;">${item.purpose}</td>
                    <td style="padding:10px; font-weight:bold; color:var(--red, #e74c3c);">${parseInt(item.amount).toLocaleString()}원</td>
                    <td style="padding:10px;"><button onclick="deleteBudget('${child.key}')" style="padding:5px 10px; font-size:0.8rem; background:#eee; border:none; border-radius:4px; cursor:pointer;">삭제</button></td>
                  </tr>`;
        });
        
        window.totalSpentCache = totalSpent;
        const budgetListEl = document.getElementById('budget-list');

        if (budgetListEl) {
            budgetListEl.innerHTML = h || "<tr><td colspan='5' style='padding:20px; text-align:center; color:#888;'>내역이 없습니다.</td></tr>";
        }
        updateBudgetSummaryUI();
    });
};

window.updateBudgetSummaryUI = function() {
    const budgetSummaryEl = document.getElementById('budget-summary');
    if (budgetSummaryEl) {
        const spent = window.totalSpentCache || 0;
        budgetSummaryEl.innerHTML = `총 예산: ${(window.totalBudget || 0).toLocaleString()}원 | 사용액: ${spent.toLocaleString()}원 | <span style="color:var(--primary, #3498db)">현재 잔액: ${((window.totalBudget || 0) - spent).toLocaleString()}원</span>`;
    }
};

window.openAddBudgetPopup = function() {
    let h = `<h3>🧾 운영비 내역 추가</h3>
            날짜: <input type="date" id="bg-date" value="${new Date().toISOString().split('T')[0]}" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
            쇼핑몰: <input type="text" id="bg-mall" placeholder="예: 쿠팡, 다이소" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
            용도: <input type="text" id="bg-purpose" placeholder="예: 창의적 체험활동 재료" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
            금액: <input type="number" id="bg-amount" placeholder="숫자만 입력" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
            <button onclick="saveBudget()" style="background:var(--primary, #3498db); color:white; width:100%; margin-top:10px; padding:12px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">저장하기</button>
            <hr style="margin:20px 0; border:0; border-top:1px solid #ddd;">
            <small style="font-weight:bold; color:#555;">총 예산 변경:</small><br>
            <input type="number" id="bg-total-setting" value="${window.totalBudget}" style="width:100%; padding:8px; margin:5px 0 10px 0;"><br>
            <button onclick="updateTotalBudget()" style="background:#333; color:white; width:100%; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">총 예산 수정</button>`;
    
    if (typeof openPopup === 'function') {
        openPopup("운영비 등록", h);
    }
};

window.updateTotalBudget = function() {
    const val = parseInt(document.getElementById('bg-total-setting').value);
    if (isNaN(val)) return alert("올바른 숫자를 입력해주세요!");
    
    db.ref('settings').update({ budgetTotal: val }).then(() => {
        alert("✅ 총 예산이 수정되었습니다!");
        if (typeof closePopup === 'function') closePopup();
    });
};

window.saveBudget = function() {
    const date = document.getElementById('bg-date').value;
    const mall = document.getElementById('bg-mall').value;
    const purpose = document.getElementById('bg-purpose').value;
    const amount = document.getElementById('bg-amount').value;
    
    if (date && mall && purpose && amount) {
        db.ref('budgetRecords').push({ 
            date, 
            mall, 
            purpose, 
            amount: parseInt(amount) 
        }).then(() => { 
            alert("✅ 저장되었습니다."); 
            if (typeof closePopup === 'function') closePopup(); 
        });
    } else {
        alert("⚠️ 모든 항목을 입력해주세요.");
    }
};

window.deleteBudget = function(key, title) {
    if (confirm("정말로 이 내역을 삭제하시겠습니까?")) {
        db.ref('budgetRecords/' + key).remove().then(() => {
            alert("🗑️ 삭제되었습니다.");
        });
    }
};
