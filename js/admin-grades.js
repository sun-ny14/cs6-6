// js/admin-grades.js - 성적 관리, 평가 시스템, 학급 운영비 및 예산 관리 통합 파일

// 학급관리 메인 탭 라우터 (서브 탭 전환 제어)
window.renderManagementSub = function(subType) {
    const subContentEl = document.getElementById('management-sub-container');
    if (!subContentEl) return;

    const gradesButton = document.getElementById('sub-btn-grades');
    const budgetButton = document.getElementById('sub-btn-budget');
    if (gradesButton) gradesButton.classList.toggle('active', subType === 'grades');
    if (budgetButton) budgetButton.classList.toggle('active', subType === 'budget');

    if (subType === 'grades') {
        subContentEl.innerHTML = `
            <div class="card stack">
                <h2>📝 성적 및 평가 관리</h2>
                <p>학생들의 성적과 수행평가 기록을 관리하는 공간입니다.</p>
                <div class="chip-group" id="grades-subject-buttons">
                </div>
                <div id="grades-content-area"></div>
            </div>
        `;
        if (typeof loadSubjectGrades === 'function') {
            loadSubjectGrades(typeof currentGradeSubject !== 'undefined' ? currentGradeSubject : '국어');
        }
    } else {
        subContentEl.innerHTML = `
            <div class="card stack">
                <div class="panel-head">
                    <h2>💰 학급 운영비 및 예산 관리</h2>
                    <div class="panel-head-actions">
                        <button class="btn btn--primary" onclick="openAddBudgetPopup()">+ 내역 추가 / 예산 설정</button>
                    </div>
                </div>
                <div id="budget-summary" class="well strong">
                    예산 정보 불러오는 중...
                </div>
                <div class="table-wrap">
                    <table class="table table--num">
                        <thead>
                            <tr>
                                <th>날짜</th>
                                <th>쇼핑몰</th>
                                <th>용도</th>
                                <th>금액</th>
                                <th>관리</th>
                            </tr>
                        </thead>
                        <tbody id="budget-list">
                            <tr><td colspan='5' class="center muted">내역을 불러오는 중입니다...</td></tr>
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
            const activeClass = (sub === currentGradeSubject) ? ' active' : '';
            btnHtml += `<button class="chip-toggle${activeClass}" onclick="loadSubjectGrades('${sub}')">${sub}</button>`;
        });
        btnContainer.innerHTML = btnHtml;
    }

    const contentArea = document.getElementById('grades-content-area');
    if (!contentArea) return;

    db.ref('grades/' + subject).once('value', snap => {
        let html = `
            <div class="panel-head">
                <h3>📘 ${subject} 평가 목록</h3>
                <div class="panel-head-actions">
                    <button class="btn btn--good btn--sm" onclick="openNewGradePopup('${subject}', 'perf')">+ 수행평가 추가</button>
                    <button class="btn btn--outline btn--sm" onclick="openNewGradePopup('${subject}', 'score')">+ 일반평가 추가</button>
                </div>
            </div>
            <div class="stack stack--sm">
        `;

        let assessments = [];
        snap.forEach(child => { assessments.push({ key: child.key, ...child.val() }); });
        assessments.reverse();

        if (assessments.length === 0) {
            html += `<div class="empty"><strong>등록된 평가가 없습니다.</strong><span>오른쪽 위의 [+ 추가] 버튼을 이용해 주세요.</span></div>`;
        } else {
            assessments.forEach(a => {
                const typeIcon = a.type === 'perf' ? '📋 수행' : '💯 일반';
                const typeClass = a.type === 'perf' ? 'card--good' : 'card--accent';
                html += `
                    <div onclick="openGradeEditor('${subject}', '${a.key}')" class="card ${typeClass} row row--between" style="cursor:pointer;">
                        <span><strong>${typeIcon}</strong> &nbsp;|&nbsp; <b>${a.title}</b></span>
                        <small class="muted">${a.date}</small>
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
            // 이름만 나열돼 종이 출석부와 눈으로 대조해야 했던 부분입니다.
            // 번호를 함께 싣고 번호순으로 세우며, 선생님 계정은 학생 행에서 뺍니다.
            let users = [];
            userSnap.forEach(u => {
                const value = u.val() || {};
                const name = String(value.name || u.key || '').trim();

                if (!name || name === '총사령관' || name.includes('선생님')) return;

                const no = parseInt(value.no ?? value.number, 10);

                users.push({
                    key: u.key,
                    no: Number.isFinite(no) && no > 0 ? no : null
                });
            });

            users.sort((a, b) =>
                (a.no ?? 999) - (b.no ?? 999) ||
                String(a.key).localeCompare(String(b.key), 'ko')
            );

            let h = `
                <div class="stack">
                    <h3>
                        ${data.title} <small class="muted small">(${data.type === 'perf' ? '수행평가' : '일반평가'})</small>
                    </h3>
                    <div class="scroll-y" style="max-height:400px;">
                        <div class="table-wrap">
                        <table class="table center">
                            <thead>
                                <tr>
                                    <th style="width:14%;">번호</th>
                                    <th style="width:34%;">이름</th>
                                    <th>${data.type === 'perf' ? '결과 <small>(더블클릭으로 변경)</small>' : '점수 입력'}</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            let scores = data.scores || {};

            users.forEach((student, index) => {
                const u = student.key;
                const no = student.no ?? '–';
                let val = scores[u] || (data.type === 'perf' ? '매우잘함◎' : '');

                if (data.type === 'perf') {
                    let stateClass = val.includes('매우') ? 'btn--good' : (val.includes('보통') ? 'btn--warn' : 'btn--outline');
                    h += `
                        <tr>
                            <td class="num muted">${no}</td>
                            <td class="strong">${u}</td>
                            <td>
                                <button id="grade-${u}" class="btn btn--block ${stateClass}" ondblclick="togglePerfGrade('${u}')">
                                    ${val}
                                </button>
                            </td>
                        </tr>
                    `;
                } else {
                    h += `
                        <tr>
                            <td class="num muted">${no}</td>
                            <td class="strong">${u}</td>
                            <td>
                                <input type="number" id="grade-${u}" class="score-input input--num" value="${val}" tabindex="${index + 1}" oninput="calcAvg()" placeholder="점수">
                            </td>
                        </tr>
                    `;
                }
            });

            h += `</tbody></table></div></div>`;

            if (data.type === 'score') {
                h += `<div class="well row row--end strong">평균: <span id="score-average" class="num">0.0점</span></div>`;
            }

            h += `
                <div class="btn-row">
                    <button class="btn btn--primary btn--lg" style="flex:2;" onclick="saveGrades('${subject}', '${key}', '${data.type}')">💾 성적 저장하기</button>
                    <button class="btn btn--danger btn--lg" style="flex:1;" onclick="deleteGrade('${subject}', '${key}')">🗑️ 삭제</button>
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

    el.classList.remove('btn--good', 'btn--warn', 'btn--outline');
    if (el.innerText.includes('매우잘함')) {
        el.innerText = '잘함○';
        el.classList.add('btn--outline');
    } else if (el.innerText.includes('잘함')) {
        el.innerText = '보통△';
        el.classList.add('btn--warn');
    } else {
        el.innerText = '매우잘함◎';
        el.classList.add('btn--good');
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
// 삭제 대상은 해당 평가의 전체 학생 점수입니다.
// 삭제 전 값을 보관해 되돌리기로 복원합니다.
window.deleteGrade = function(subject, key) {
    db.ref(`grades/${subject}/${key}`).once('value', snap => {
        const before = snap.val();
        if (!before) return;

        db.ref(`grades/${subject}/${key}`).remove().then(() => {
            if (typeof closePopup === 'function') closePopup();
            loadSubjectGrades(subject);

            const message = `${String(before.title || '평가')} 기록을 삭제했습니다.`;

            if (typeof window.showUndoBar === 'function') {
                window.showUndoBar(message, async () => {
                    await db.ref(`grades/${subject}/${key}`).set(before);
                    loadSubjectGrades(subject);
                }, 12);
            } else {
                alert(message);
            }
        });
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
            h += `<tr>
                    <td>${item.date}</td>
                    <td>${item.mall}</td>
                    <td>${item.purpose}</td>
                    <td><span class="badge badge--bad">${parseInt(item.amount).toLocaleString()}원</span></td>
                    <td><button class="btn btn--quiet btn--xs" onclick="deleteBudget('${child.key}')">삭제</button></td>
                  </tr>`;
        });

        window.totalSpentCache = totalSpent;
        const budgetListEl = document.getElementById('budget-list');

        if (budgetListEl) {
            budgetListEl.innerHTML = h || "<tr><td colspan='5' class='center muted'>내역이 없습니다.</td></tr>";
        }
        updateBudgetSummaryUI();
    });
};

window.updateBudgetSummaryUI = function() {
    const budgetSummaryEl = document.getElementById('budget-summary');
    if (budgetSummaryEl) {
        const spent = window.totalSpentCache || 0;
        budgetSummaryEl.innerHTML = `총 예산: ${(window.totalBudget || 0).toLocaleString()}원 | 사용액: ${spent.toLocaleString()}원 | <span class="badge badge--info">현재 잔액: ${((window.totalBudget || 0) - spent).toLocaleString()}원</span>`;
    }
};

window.openAddBudgetPopup = function() {
    let h = `<h3>🧾 운영비 내역 추가</h3>
            <div class="stack stack--sm">
            <div class="field"><span class="field-label">날짜</span><input type="date" id="bg-date" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="field"><span class="field-label">쇼핑몰</span><input type="text" id="bg-mall" placeholder="예: 쿠팡, 다이소"></div>
            <div class="field"><span class="field-label">용도</span><input type="text" id="bg-purpose" placeholder="예: 창의적 체험활동 재료"></div>
            <div class="field"><span class="field-label">금액</span><input type="number" id="bg-amount" placeholder="숫자만 입력"></div>
            <button class="btn btn--primary btn--block" onclick="saveBudget()">저장하기</button>
            <hr class="divider">
            <span class="small strong muted">총 예산 변경:</span>
            <input type="number" id="bg-total-setting" value="${window.totalBudget}">
            <button class="btn btn--block" onclick="updateTotalBudget()">총 예산 수정</button>
            </div>`;

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
