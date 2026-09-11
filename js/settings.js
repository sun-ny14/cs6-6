// js/settings.js - 설정 탭 및 관리자 시스템 전체 통합 코드

function settingsEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function settingsCleanSeatName(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized.split(/\s+/).pop() : '';
}

window.initSettings = function() {
    loadSystemSettings();
    loadStudentAdminList();
    loadGiftsSetting();
    loadSeatSettings();
    renderCurrentSeatingView();
};

// 좌석 배치 설정
window.generateSeatInputs = function() {
    const colsEl = document.getElementById('seat-cols');
    const rowsEl = document.getElementById('seat-rows');

    if (!colsEl || !rowsEl) return;

    const cols = parseInt(colsEl.value);
    const rows = parseInt(rowsEl.value);

    if (!cols || !rows || cols <= 0 || rows <= 0) {
        alert("올바른 가로, 세로 칸 수를 입력해주세요!");
        return;
    }

    const container = document.getElementById('seat-input-container');
    if (!container) return;

    db.ref('seatLayoutData/layout').once('value', snap => {
        const currentLayout = snap.val() || {};

        let html = `
            <div class="grid" style="grid-template-columns:repeat(${cols},1fr);">
        `;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const seatKey = `${r}_${c}`;
                const posId = `${r}-${c}`;
                const rawName =
                    currentLayout[posId] ||
                    currentLayout[seatKey] ||
                    "";

                const savedName = settingsCleanSeatName(rawName);

                html += `
                    <div class="well field center">
                        <label class="field-label">
                            ${r + 1}행 ${c + 1}열
                        </label>

                        <input
                            type="text"
                            id="seat-input-${seatKey}"
                            value="${settingsEscape(savedName)}"
                            placeholder="이름 입력"
                            class="input--num"
                        >
                    </div>
                `;
            }
        }

        html += `</div>`;
        container.innerHTML = html;
    });
};

window.saveSeatSettings = async function() {
    const colsEl = document.getElementById('seat-cols');
    const rowsEl = document.getElementById('seat-rows');

    if (!colsEl || !rowsEl) return;

    const cols = parseInt(colsEl.value);
    const rows = parseInt(rowsEl.value);

    if (!cols || !rows) {
        alert("가로와 세로 칸 수를 올바르게 입력해주세요!");
        return;
    }

    const newLayout = {};

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const seatKey = `${r}_${c}`;
            const posId = `${r}-${c}`;
            const input =
                document.getElementById(`seat-input-${seatKey}`);

            if (input && input.value.trim()) {
                const cleanName =
                    settingsCleanSeatName(input.value);

                newLayout[posId] = cleanName;
            }
        }
    }

    await db.ref('seatLayoutData').set({
        config: {
            cols: cols,
            rows: rows
        },
        layout: newLayout
    });

    window.currentLayout = newLayout;
    window.currentRows = rows;
    window.currentCols = cols;

    alert("🪑 좌석 배치 설정과 이름들이 영구 저장되었습니다! ✨");

    if (typeof renderCurrentSeatingView === 'function') {
        renderCurrentSeatingView();
    }

    if (typeof generateNewLayout === 'function') {
        generateNewLayout();
    }
};

window.loadSeatSettings = async function() {
    const snap =
        await db.ref('seatLayoutData').once('value');

    const colsEl =
        document.getElementById('seat-cols');

    const rowsEl =
        document.getElementById('seat-rows');

    const container =
        document.getElementById('seat-input-container');

    if (snap.exists()) {
        const data = snap.val();
        const config = data.config || {};

        window.currentLayout = data.layout || {};
        window.currentCols =
            parseInt(config.cols) || 5;

        window.currentRows =
            parseInt(config.rows) || 6;

        if (colsEl) {
            colsEl.value = config.cols || '';
        }

        if (rowsEl) {
            rowsEl.value = config.rows || '';
        }

        if (config.cols && config.rows) {
            generateSeatInputs();
        }
    } else {
        if (colsEl) colsEl.value = '5';
        if (rowsEl) rowsEl.value = '6';

        if (container) {
            container.innerHTML = `
                <div class="empty">
                    <span>
                        설정된 좌석 배치가 없습니다.
                        크기 입력 후 '표 만들기'를 눌러주세요.
                    </span>
                </div>
            `;
        }
    }
};

function toggleSeatBuilder() {
    const section =
        document.getElementById('seat-builder-section');

    if (!section) return;

    if (
        section.style.display === 'none' ||
        section.style.display === ''
    ) {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
}

// 현재 좌석 배치 화면
window.renderCurrentSeatingView = async function() {
    const viewContainer =
        document.getElementById('current-seating-view');

    if (!viewContainer) return;

    const seatSnap =
        await db.ref('seatLayoutData').once('value');

    if (!seatSnap.exists()) {
        viewContainer.innerHTML = `
            <div class="empty">
                <span>
                    설정된 좌석 배치가 없습니다.
                    아래 '표 만들기'를 통해 설정해 주세요.
                </span>
            </div>
        `;
        return;
    }

    const seatData = seatSnap.val();

    const config =
        seatData.config || {
            cols: 5,
            rows: 6
        };

    const layout = seatData.layout || {};

    let html = `
        <div class="grid" style="grid-template-columns:repeat(${config.cols},1fr);">
    `;

    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            const posId = `${r}-${c}`;
            const seatKey = `${r}_${c}`;

            const rawStudentName =
                layout[posId] ||
                layout[seatKey] ||
                "";

            let studentDisplay = '';
            let cellClass = 'seat-cell';

            if (rawStudentName) {
                const studentName =
                    settingsCleanSeatName(rawStudentName);

                studentDisplay = `
                    <div class="seat-name">
                        ${settingsEscape(studentName)}
                    </div>
                `;
            } else {
                cellClass += ' is-empty';
            }

            html += `
                <div class="${cellClass}">
                    ${studentDisplay}
                </div>
            `;
        }
    }

    html += `</div>`;
    viewContainer.innerHTML = html;
};

// 학생 명단 및 역할 관리
window.loadStudentAdminList = function() {
    db.ref('users').on('value', snap => {
        const listEl =
            document.getElementById('student-admin-list');

        if (!listEl) return;

        if (!snap.exists()) {
            listEl.innerHTML = `
                <div class="empty">
                    <span>등록된 용사가 없습니다.</span>
                </div>
            `;
            return;
        }

        const usersArr = [];

        snap.forEach(c => {
            const user = {
                name: c.key,
                ...c.val()
            };

            if (user.name === '총사령관') return;
            usersArr.push(user);
        });

        usersArr.sort(
            (a, b) =>
                parseInt(a.no || 0) -
                parseInt(b.no || 0)
        );

        if (typeof currentUsers !== 'undefined') {
            currentUsers = usersArr;
        }

        window.renderAdminList();
    });
};

window.renderAdminList = function() {
    const listEl =
        document.getElementById('student-admin-list');

    if (!listEl) return;

    let h = "";

    const targetArr =
        typeof currentUsers !== 'undefined' &&
        currentUsers.length > 0
            ? currentUsers
            : [];

    targetArr.forEach(u => {
        if (
            u.name === '총사령관' ||
            u.isAdmin === true ||
            String(u.role || '').trim() === '관리자' ||
            (
                typeof adminEmail !== 'undefined' &&
                String(u.email || '').trim().toLowerCase() ===
                    String(adminEmail || '').trim().toLowerCase()
            )
        ) return;

        const currentRole =
            u.role ||
            (u.isHelper ? '상점' : '일반');

        h += `
            <tr>
                <td>
                    <input
                        type="number"
                        class="input--num input--sm"
                        value="${u.no || ''}"
                        onchange="updateNo('${u.name}',this.value)"
                    >
                </td>

                <td class="strong nowrap">
                    ${u.name}
                </td>

                <td>
                    <select
                        onchange="updateUserRole('${u.name}',this.value)"
                    >
                        <option
                            value="일반"
                            ${currentRole === '일반' ? 'selected' : ''}
                        >
                            &#128100; 일반
                        </option>

                        <option
                            value="상점"
                            ${currentRole === '상점' ? 'selected' : ''}
                        >
                            &#128722; 상점
                        </option>

                        <option
                            value="청소"
                            ${currentRole === '청소' ? 'selected' : ''}
                        >
                            &#129529; 청소
                        </option>
                    </select>
                </td>

                <td>
                    <div class="row-actions">
                        <button
                            class="btn btn--danger btn--xs"
                            onclick="confirmDeleteStudent('${u.name}')"
                        >
                            제거
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    listEl.innerHTML = h
        ? `
            <div class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>번호</th>
                            <th>이름</th>
                            <th>역할</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${h}
                    </tbody>
                </table>
            </div>
        `
        : `
            <div class="empty">
                <span>용사가 없습니다.</span>
            </div>
        `;
};

window.updateNo = function(name, value) {
    db.ref('users/' + name).update({
        no: parseInt(value) || 0
    });
};

// 학기 초에 여러 명의 역할을 연속으로 바꾸는 작업이라,
// 한 명 바꿀 때마다 확인창을 띄우면 흐름이 끊깁니다.
// 대신 직전 역할을 들고 되돌리기 바를 띄웁니다.
window.updateUserRole = function(
    userName,
    newRole
) {
    db.ref(`users/${userName}`).once('value', snapshot => {
        const before = snapshot.val() || {};

        const previous = {
            role: before.role ?? null,
            isHelper: before.isHelper ?? null
        };

        db.ref(`users/${userName}`)
            .update({
                role: newRole,
                isHelper: newRole === '상점'
            })
            .then(() => {
                const roleIcon =
                    newRole === '상점'
                        ? '🛍️'
                        : newRole === '청소'
                        ? '🧹'
                        : '👤';

                const message =
                    `${userName} · ${roleIcon} ${newRole} 로 바꿨습니다.`;

                if (typeof window.showUndoBar === 'function') {
                    window.showUndoBar(message, async () => {
                        await db.ref(`users/${userName}`).update(previous);

                        if (typeof renderAdminList === 'function') {
                            renderAdminList();
                        }
                    });
                } else {
                    alert(message);
                }
            });
    });
};

window.confirmDeleteStudent = function(userName) {
    const firstCheck = confirm(
        `⚠️ 경고: [${userName}] 용사를 정말 제명하시겠습니까?`
    );

    if (!firstCheck) return;

    const secondCheck = confirm(
        `🚨 최종 확인: 삭제된 데이터는 복구할 수 없습니다. ` +
        `정말로 [${userName}] 용사를 삭제하시겠습니까?`
    );

    if (secondCheck) {
        db.ref(`users/${userName}`)
            .remove()
            .then(() => {
                alert(
                    `🗑️ [${userName}] 용사가 제명되었습니다.`
                );
            });
    }
};

// 시스템 설정
window.saveSettings = async function() {
    const passInput = document.getElementById('conf-pass');
    const password = passInput.value.trim();
    if (!window.CheckinPasswordCore.valid(password)) {
        alert('등교 암호는 숫자 4자리로 입력해 주세요.');
        return;
    }
    const otherSettings = {
        lateTime: document.getElementById('conf-late').value,
        closeTime: document.getElementById('conf-close').value,
        routineText: document.getElementById('conf-routine')?.value || ''
    };
    try {
        const baseline = String(passInput.dataset.savedPassword ?? '');
        const passwordWasEdited = password !== baseline;
        const now = window.CheckinPassword.now();

        const settingsRef = db.ref('settings');
        const current = (await settingsRef.once('value')).val() || {};
        const updates = { ...otherSettings };

        // 암호가 실제로 바뀐 경우에만 암호 필드를 갱신한다. /settings 전체
        // transaction을 없애 학교망에서 반복되던 disconnect 오류를 줄인다.
        if (passwordWasEdited || !window.CheckinPasswordCore.valid(current.password)) {
            const passwordSettings = window.CheckinPasswordCore.manual(current, password, now);
            updates.password = passwordSettings.password;
            updates.passwordDate = passwordSettings.passwordDate;
            updates.passwordRevision = passwordSettings.passwordRevision;
            updates.passwordUpdatedAt = passwordSettings.passwordUpdatedAt;
        }

        await settingsRef.update(updates);
        const saved = { ...current, ...updates };
        await window.CheckinPassword.publish(saved);

        passInput.value = String(saved.password);
        passInput.dataset.savedPassword = String(saved.password);
        alert('💾 시스템 설정과 전자칠판 암호가 저장되었습니다!');
    } catch (error) {
        console.error('시스템 설정 저장 실패:', error);
        alert(error.message || '설정을 저장하지 못했습니다. 연결 후 다시 시도해 주세요.');
    }
};

window.loadSystemSettings = async function() {
    const snap =
        await db.ref('settings').once('value');

    if (!snap.exists()) return;

    const data = snap.val();

    const passEl =
        document.getElementById('conf-pass');

    const lateEl =
        document.getElementById('conf-late');

    const closeEl =
        document.getElementById('conf-close');

    const routineEl =
        document.getElementById('conf-routine');

    if (passEl) {
        passEl.value = String(data.password || '');
        passEl.dataset.savedPassword = passEl.value;
    }
    if (lateEl) lateEl.value = data.lateTime || '';
    if (closeEl) closeEl.value = data.closeTime || '';
    if (routineEl) {
        routineEl.value = data.routineText || '';
    }
};

window.generateRandomPassword = function() {
    const randomPw = window.CheckinPasswordCore.generate(
        document.getElementById('conf-pass')?.value, window.CheckinPassword.randomInt
    );

    const passInput =
        document.getElementById('conf-pass');

    if (passInput) {
        passInput.value = randomPw;

        alert(
            `🎲 새로운 난수 암호 생성됨: ${randomPw}\n` +
            `'시스템 저장'을 눌러야 적용됩니다.`
        );
    }
};

// 레벨업 보상 설정
window.saveGifts = async function() {
    const giftsText =
        document.getElementById('conf-gifts').value;

    const listArr =
        giftsText
            .split('\n')
            .map(item => item.trim())
            .filter(item => item);

    await db.ref('settings').update({
        giftList: listArr,
        'gifts/listText': giftsText
    });

    alert("🎁 레벨업 보상 목록이 저장되었습니다!");
};

window.loadGiftsSetting = async function() {
    const snap =
        await db.ref('settings').once('value');

    if (!snap.exists()) return;

    const data = snap.val();

    const textVal =
        data.gifts?.listText ||
        (
            data.giftList
                ? data.giftList.join('\n')
                : ''
        );

    const giftsEl =
        document.getElementById('conf-gifts');

    if (giftsEl) {
        giftsEl.value = textVal;
    }
};

// 학생 일괄 등록
window.bulkReg = function() {
    const rawText =
        document.getElementById('bulk-in')
            .value
            .trim();

    if (!rawText) {
        alert("⚠️ 등록할 학생 명단을 입력해주세요.");
        return;
    }

    const lines = rawText.split('\n');

    const parsed = lines
        .map(line => {
            const parts = line.split(',');

            return {
                name: parts[0] ? parts[0].trim() : "",
                email: parts[1] ? parts[1].trim() : ""
            };
        })
        .filter(entry => entry.name);

    const count = parsed.length;

    if (count > 0) {
        // 이미 있는 학생은 번호와 이메일만 갱신하고
        // points / exp / lv 는 기존 값을 유지합니다.
        db.ref('users').once('value', snapshot => {
            const existing = snapshot.val() || {};
            const updates = {};

            let created = 0;
            let updated = 0;

            parsed.forEach((entry, index) => {
                const no = index + 1;

                if (existing[entry.name]) {
                    updates[`${entry.name}/no`] = no;
                    updates[`${entry.name}/name`] = entry.name;

                    if (entry.email) {
                        updates[`${entry.name}/email`] = entry.email;
                    }

                    updated++;
                } else {
                    updates[entry.name] = {
                        name: entry.name,
                        email: entry.email || "미등록",
                        points: 0,
                        exp: 0,
                        lv: 1,
                        no: no
                    };

                    created++;
                }
            });

            db.ref('users')
                .update(updates)
                .then(() => {
                    alert(
                        `✅ 명단을 반영했습니다.\n\n` +
                        `· 새로 등록 ${created}명\n` +
                        `· 이미 있던 학생 ${updated}명 — 번호와 이메일만 갱신했고 ` +
                        `포인트·경험치·레벨은 그대로 두었습니다.`
                    );

                    document.getElementById('bulk-in').value = "";

                    if (
                        typeof renderAdminList === 'function'
                    ) {
                        renderAdminList();
                    }
                });
        });
    } else {
        alert(
            "⚠️ 올바른 형식(이름,이메일)으로 입력해주세요."
        );
    }
};
