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
                <div class="panel-head">
                    <h2>📝 성적 및 평가 관리</h2>
                    <div class="panel-head-actions">
                        <button class="btn btn--outline btn--sm" onclick="exportGradesExcel()">📊 엑셀로 내보내기</button>
                    </div>
                </div>
                <p>학생 결과를 한 번 눌러 4단계로 바꿉니다. 빈칸은 아직 평가하지 않은 상태입니다.</p>
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
const gradeEscapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);
const PERF_STATES=['','매우 잘함','잘함','노력 요함'];
const normalizePerfGrade=value=>{
    const text=String(value??'').trim().replace(/[◎○△]/g,'').replace(/\s/g,'');
    if(text==='매우잘함')return '매우 잘함';
    if(text==='잘함')return '잘함';
    if(text==='노력요함'||text==='보통')return '노력 요함';
    return '';
};
const perfStateClass=value=>({
    '매우 잘함':'grade-state--excellent','잘함':'grade-state--good',
    '노력 요함':'grade-state--effort','':'grade-state--empty'
})[value]||'grade-state--empty';

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
                    <button class="btn btn--good btn--sm" onclick="openNewGradePopup('${subject}', 'perf')">+ 수행평가 만들기</button>
                    <button class="btn btn--outline btn--sm" onclick="openNewGradePopup('${subject}', 'score')">+ 단원평가 만들기</button>
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
                const typeIcon = a.type === 'perf' ? '📋 수행' : '💯 단원';
                const typeClass = a.type === 'perf' ? 'card--good' : 'card--accent';
                html += `
                    <div onclick="openGradeEditor('${subject}', '${a.key}')" class="card ${typeClass} row row--between" style="cursor:pointer;">
                        <span><strong>${typeIcon}</strong> &nbsp;|&nbsp; ${a.unit?`<span class="muted">[${gradeEscapeHtml(a.unit)}]</span> `:''}<b>${gradeEscapeHtml(a.title)}</b></span>
                        <small class="muted">${a.date}</small>
                    </div>
                `;
            });
        }
        html += `</div>`;
        contentArea.innerHTML = html;
    });
};

// 새 평가를 먼저 열고 제목은 같은 창 안에서 바로 입력한다.
window.openNewGradePopup = function(subject, type) {
    const key = db.ref(`grades/${subject}`).push().key;
    const draft={
        title:`${subject} 새 평가`,
        type: type === 'score' ? 'score' : 'perf',
        unit: '',
        date: typeof window.getTodayKST==='function'
            ?window.getTodayKST():new Date().toISOString().split('T')[0],
        scores: {}
    };
    openGradeEditor(subject,key,draft);
};

// 기존 점수형 평가는 유지하고, 새 수행평가는 한 화면에서 원클릭 4단계로 입력한다.
window.openGradeEditor = async function(subject, key, draft=null) {
    try {
        const gradeSnap=draft?null:await db.ref(`grades/${subject}/${key}`).once('value');
        const data=draft||gradeSnap.val();
        if(!data)return alert('평가를 찾을 수 없습니다.');
        const unique=new Map();
        const cached=Array.isArray(window.currentUsers)?window.currentUsers:[];
        let roster=cached.map(value=>({key:value.__firebaseKey||value.name,value}));
        if(!roster.length){
            const rosterSnap=await db.ref('users').once('value');
            roster=[];
            rosterSnap.forEach(child=>{roster.push({key:child.key,value:child.val()||{}});});
        }
        roster.forEach(({key:studentKey,value})=>{
            const name=String(value.name||studentKey||'').trim();
            if(!name||name==='총사령관'||name.includes('선생님'))return;
            const no=parseInt(value.no??value.number,10);
            unique.set(name,{key:studentKey,name,no:Number.isFinite(no)&&no>0?no:null});
        });
        const users=Array.from(unique.values()).sort((a,b)=>
            (a.no??999)-(b.no??999)||a.name.localeCompare(b.name,'ko'));
        const scores=data.scores||{};
        let h=`<div class="grade-editor stack">
            <div class="grade-editor-head">
                <label class="field"><span class="field-label">평가 제목</span>
                    <input id="grade-editor-title" class="input" type="text" maxlength="80"
                        value="${gradeEscapeHtml(data.title)}" placeholder="평가 제목을 입력하세요"></label>
                <label class="field"><span class="field-label">단원</span>
                    <input id="grade-editor-unit" class="input" type="text" maxlength="40"
                        value="${gradeEscapeHtml(data.unit||'')}" placeholder="예: 2단원 소수의 곱셈"></label>
                <span class="muted small">${gradeEscapeHtml(subject)} · ${data.type==='perf'?'수행평가 · 4단계 평가':'단원평가 · 점수 평가'} · ${gradeEscapeHtml(data.date||'')}</span>
            </div>
            <p class="muted small">${data.type==='perf'
                ?'학생 결과를 한 번 누를 때마다 빈칸 → 매우 잘함 → 잘함 → 노력 요함 순서로 바뀝니다.'
                :'점수를 입력해 주세요. 빈칸은 미평가입니다.'}</p>
            <div class="grade-student-grid">`;
        users.forEach((student,index)=>{
            const u=student.key,no=student.no??'–';
            const label=`<span class="grade-student-name"><small class="num muted">${gradeEscapeHtml(no)}</small> ${gradeEscapeHtml(student.name)}</span>`;
            if(data.type==='perf'){
                const val=normalizePerfGrade(scores[u]);
                h+=`<div class="grade-student-card">${label}
                    <button type="button" class="grade-state ${perfStateClass(val)}"
                        data-grade-student="${gradeEscapeHtml(u)}" data-grade-value="${gradeEscapeHtml(val)}"
                        onclick="togglePerfGrade(decodeURIComponent('${encodeURIComponent(u)}'))">${val||'빈칸 · 미평가'}</button>
                    </div>`;
            }else{
                const val=Object.prototype.hasOwnProperty.call(scores,u)?scores[u]:'';
                h+=`<div class="grade-student-card">${label}
                    <input type="number" data-grade-student="${gradeEscapeHtml(u)}" class="score-input input--num"
                        value="${gradeEscapeHtml(val)}" tabindex="${index+1}" oninput="calcAvg()" placeholder="미평가">
                    </div>`;
            }
        });
        h+='</div>';
        if(data.type==='score')h+='<div class="well row row--end strong">평균: <span id="score-average" class="num">0.0점</span></div>';
        h+=`<div class="btn-row">
            <button class="btn btn--primary btn--lg" style="flex:2" onclick="saveGrades('${subject}','${key}','${data.type}','${data.date}')">💾 평가 저장</button>
            <button class="btn btn--outline btn--lg" style="flex:1" onclick="${draft?'closePopup()':`deleteGrade('${subject}','${key}')`}">${draft?'취소':'🗑️ 삭제'}</button>
            </div></div>`;
        if(typeof openPopup==='function')openPopup('평가 기록',h);
        if(data.type==='score')setTimeout(calcAvg,100);
    }catch(error){
        console.error('평가 입력창 로딩 오류:',error);
        alert(error?.message||'평가를 불러오지 못했습니다.');
    }
};

// 한 번 클릭할 때마다 미평가 포함 4단계로 이동한다.
window.togglePerfGrade = function(u) {
    const el=Array.from(document.querySelectorAll('.grade-state'))
        .find(button=>button.dataset.gradeStudent===u);
    if (!el) return;
    const next=PERF_STATES[(PERF_STATES.indexOf(el.dataset.gradeValue)+1)%PERF_STATES.length];
    el.dataset.gradeValue=next;
    el.textContent=next||'빈칸 · 미평가';
    el.className=`grade-state ${perfStateClass(next)}`;
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
window.saveGrades = function(subject, key, type, date) {
    const title=String(document.getElementById('grade-editor-title')?.value||'').trim();
    if(!title)return alert('평가 제목을 입력해 주세요.');
    const unit=String(document.getElementById('grade-editor-unit')?.value||'').trim();
    const scores={};
    document.querySelectorAll('.grade-editor [data-grade-student]').forEach(el=>{
        const name=el.dataset.gradeStudent;
        scores[name]=type==='perf' ? el.dataset.gradeValue||''
            :el.value ? Number(el.value) : '';
    });
    const savedDate=String(date||(
        typeof window.getTodayKST==='function'?window.getTodayKST():new Date().toISOString().split('T')[0]
    ));
    db.ref(`grades/${subject}/${key}`).update({title,type,unit,date:savedDate,scores}).then(() => {
            alert("성적 데이터가 안전하게 저장되었습니다! ✅");
            if (typeof closePopup === 'function') closePopup();
            loadSubjectGrades(subject); 
        }).catch(error=>{
            console.error('성적 저장 오류:',error);
            alert(error?.message||'성적을 저장하지 못했습니다.');
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

// 과목별 시트, 시트 안에서는 단원별로 묶어서 평가·학생 결과를 정리한 엑셀 파일을 내려받는다.
window.exportGradesExcel = async function() {
    if (typeof XLSX === 'undefined') {
        alert('엑셀 내보내기 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
        return;
    }
    const roster = (Array.isArray(window.currentUsers) ? window.currentUsers : [])
        .map(u => ({ name: String(u?.name || '').trim(), no: parseInt(u?.no ?? u?.number, 10) }))
        .filter(u => u.name && u.name !== '총사령관' && !u.name.includes('선생님'))
        .sort((a, b) => (Number.isFinite(a.no) ? a.no : 999) - (Number.isFinite(b.no) ? b.no : 999) || a.name.localeCompare(b.name, 'ko'));

    const workbook = XLSX.utils.book_new();
    let hadAnyData = false;

    for (const subject of SUBJECTS) {
        const snap = await db.ref('grades/' + subject).once('value');
        const assessments = [];
        snap.forEach(child => { assessments.push({ key: child.key, ...child.val() }); });
        if (!assessments.length) continue;
        hadAnyData = true;

        const byUnit = new Map();
        assessments.forEach(a => {
            const unit = String(a.unit || '').trim() || '(단원 미지정)';
            if (!byUnit.has(unit)) byUnit.set(unit, []);
            byUnit.get(unit).push(a);
        });

        const rows = [];
        Array.from(byUnit.keys()).sort((a, b) => a.localeCompare(b, 'ko')).forEach(unit => {
            rows.push([`[단원] ${unit}`]);
            byUnit.get(unit)
                .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
                .forEach(a => {
                    const kind = a.type === 'perf' ? '수행평가' : '단원평가';
                    rows.push([`${gradeEscapeHtml(a.title)} (${kind} · ${a.date || ''})`]);
                    rows.push(['번호', '이름', a.type === 'perf' ? '결과' : '점수']);
                    const scores = a.scores || {};
                    roster.forEach(student => {
                        const raw = scores[student.name];
                        const value = a.type === 'perf'
                            ? String(raw || '')
                            : (raw === '' || raw === undefined ? '' : Number(raw));
                        rows.push([Number.isFinite(student.no) ? student.no : '', student.name, value]);
                    });
                    rows.push([]);
                });
        });

        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 14 }];
        // 시트 이름은 31자 제한과 일부 특수문자 제약이 있어 과목명을 그대로 써도 안전하다.
        XLSX.utils.book_append_sheet(workbook, sheet, subject);
    }

    if (!hadAnyData) {
        alert('내보낼 성적 데이터가 없습니다.');
        return;
    }
    const today = typeof window.getTodayKST === 'function' ? window.getTodayKST() : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `성적_${today}.xlsx`);
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

        // 등록한 순서(키 순서)가 아니라 날짜 기준 최신순으로 정리한다.
        const items = [];
        snap.forEach(child => { items.push({ key: child.key, ...child.val() }); });
        items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

        items.forEach(item => {
            totalSpent += parseInt(item.amount || 0);
            const attachments = Array.isArray(item.attachments) ? item.attachments : [];
            const attachmentsHtml = attachments.length
                ? `<div class="row-actions">${attachments.map(file =>
                    `<a href="${gradeEscapeHtml(file.url)}" target="_blank" rel="noopener" class="btn btn--quiet btn--xs">📎 ${gradeEscapeHtml(file.name || '파일')}</a>`
                  ).join('')}</div>`
                : '';
            h += `<tr>
                    <td>${item.date}</td>
                    <td>${item.mall}</td>
                    <td>${item.purpose}${attachmentsHtml}</td>
                    <td><span class="badge badge--bad">${parseInt(item.amount).toLocaleString()}원</span></td>
                    <td><button class="btn btn--quiet btn--xs" onclick="deleteBudget('${item.key}')">삭제</button></td>
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
            <div class="field"><span class="field-label">영수증·첨부파일 (선택, 파일당 8MB 이하)</span>
                <input type="file" id="bg-receipts" accept="image/*,application/pdf" multiple></div>
            <p id="bg-save-status" class="muted small"></p>
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

window.saveBudget = async function() {
    const date = document.getElementById('bg-date').value;
    const mall = document.getElementById('bg-mall').value;
    const purpose = document.getElementById('bg-purpose').value;
    const amount = document.getElementById('bg-amount').value;
    const fileInput = document.getElementById('bg-receipts');
    const statusEl = document.getElementById('bg-save-status');

    if (!(date && mall && purpose && amount)) {
        alert("⚠️ 모든 항목을 입력해주세요.");
        return;
    }

    const files = Array.from(fileInput?.files || []);
    const oversized = files.find(file => file.size > 8 * 1024 * 1024);
    if (oversized) {
        alert(`⚠️ [${oversized.name}] 파일이 8MB를 넘습니다. 더 작은 파일로 올려주세요.`);
        return;
    }

    const recordRef = db.ref('budgetRecords').push();
    try {
        await recordRef.set({ date, mall, purpose, amount: parseInt(amount) });

        if (files.length) {
            if (!window.storage) {
                if (statusEl) statusEl.textContent = '내역은 저장됐지만, 파일 저장(Storage)이 아직 설정되지 않아 첨부는 건너뛰었습니다.';
            } else {
                if (statusEl) statusEl.textContent = `첨부파일 업로드 중… (0/${files.length})`;
                const attachments = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const fileRef = window.storage.ref(`budgetReceipts/${recordRef.key}/${Date.now()}_${file.name}`);
                    await fileRef.put(file);
                    const url = await fileRef.getDownloadURL();
                    attachments.push({ name: file.name, url, path: fileRef.fullPath });
                    if (statusEl) statusEl.textContent = `첨부파일 업로드 중… (${i + 1}/${files.length})`;
                }
                await recordRef.update({ attachments });
            }
        }

        alert("✅ 저장되었습니다.");
        if (typeof closePopup === 'function') closePopup();
    } catch (error) {
        console.error('운영비 저장 오류:', error);
        alert(error?.message || '저장하지 못했습니다.');
    }
};

window.deleteBudget = function(key, title) {
    if (confirm("정말로 이 내역을 삭제하시겠습니까?")) {
        db.ref('budgetRecords/' + key).remove().then(() => {
            alert("🗑️ 삭제되었습니다.");
        });
    }
};
