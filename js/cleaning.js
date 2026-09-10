// js/cleaning.js
// 1인 1역 / 청소 독립 확인 시스템
// 이 파일의 전체 내용을 기존 js/cleaning.js와 교체하세요.

(function () {
    'use strict';

    const STATUS_ROOT = 'classManagement/cleaningStatus';
    const SETTINGS_ROOT = 'settings';
    const readableSettingsRoot = () => isCleaningAdmin() ? SETTINGS_ROOT : 'cleaningSettings';

    window.cleaningSubTab =
        window.cleaningSubTab ||
        sessionStorage.getItem('cleaningSubTab') ||
        'roles';

    function isCleaningAdmin() {
        const name = typeof myName !== 'undefined' ? myName : window.myName;

        return (
            (typeof isAdmin !== 'undefined' && isAdmin === true) ||
            window.isAdmin === true ||
            ['총사령관', '관리자1', '관리자2'].includes(name)
        );
    }

    function canCheckCleaning() {
        if (isCleaningAdmin()) return true;

        if (typeof window.canManageCleaningChecks === 'function') {
            return window.canManageCleaningChecks();
        }

        return String(window.currentUser && window.currentUser.role || '').trim() === '청소';
    }

    function getLoginName() {
        return String(
            typeof myName !== 'undefined'
                ? myName
                : (window.myName || '')
        ).trim();
    }

    function getTodayKey() {
        if (typeof window.getTodayKST === 'function') {
            return window.getTodayKST();
        }

        const now = new Date();
        const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        return koreanTime.toISOString().slice(0, 10);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function readRole(value) {
        if (typeof value === 'string') return value.trim();
        if (!value || typeof value !== 'object') return '';

        return String(
            value.role ||
            value.name ||
            value.title ||
            ''
        ).trim();
    }

    function isCleaningStudent(name, role, assignments) {
        const saved = assignments && assignments[name];

        return (
            saved === true ||
            saved === 'true' ||
            (saved && typeof saved === 'object' && saved.enabled === true) ||
            /청소|쓸기|닦기|분리수거|쓰레기|정리/.test(role)
        );
    }

    function getCurrentUsers() {
        const source =
            (typeof currentUsers !== 'undefined' && Array.isArray(currentUsers))
                ? currentUsers
                : (Array.isArray(window.currentUsers) ? window.currentUsers : []);

        return source.filter(user => {
            const name = String(user && (user.name || user.userName) || '');
            return name &&
                name !== '총사령관' &&
                !name.includes('관리자') &&
                !name.includes('선생님');
        });
    }

    function getSeatInformation(settings) {
        const globalLayout =
            (typeof currentLayout !== 'undefined' && currentLayout)
                ? currentLayout
                : window.currentLayout;

        const layout =
            globalLayout ||
            settings.currentLayout ||
            settings.seatLayout ||
            settings.seatingLayout ||
            settings.layout ||
            {};

        const rows = Number(
            (typeof currentRows !== 'undefined' && currentRows) ||
            window.currentRows ||
            settings.currentRows ||
            settings.seatRows ||
            settings.rows ||
            6
        ) || 6;

        const cols = Number(
            (typeof currentCols !== 'undefined' && currentCols) ||
            window.currentCols ||
            settings.currentCols ||
            settings.seatCols ||
            settings.cols ||
            6
        ) || 6;

        const seats = [];

        for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                const position = `${row}-${col}`;
                const raw = layout[position];
                const name = typeof raw === 'string'
                    ? raw.trim()
                    : String(raw && (raw.name || raw.studentName) || '').trim();

                seats.push({
                    position:position,
                    row:row,
                    col:col,
                    name:name
                });
            }
        }

        return { rows:rows, cols:cols, seats:seats };
    }

    function getStudentList(seats) {
        const map = new Map();

        getCurrentUsers().forEach(user => {
            const name = String(user.name || user.userName || '').trim();
            if (!name) return;

            map.set(name, {
                name:name,
                number:Number(user.number || user.no) || 9999
            });
        });

        seats.forEach(seat => {
            if (!seat.name || map.has(seat.name)) return;
            map.set(seat.name, { name:seat.name, number:9999 });
        });

        return Array.from(map.values()).sort((a, b) => {
            if (a.number !== b.number) return a.number - b.number;
            return a.name.localeCompare(b.name, 'ko');
        });
    }

    // 하위 탭·카드·상태 표시는 css/style.css의 디자인 시스템 클래스
    // (.seg, .card, .well, .list-item, .badge, .is-good/.is-warn 등)를 그대로 씁니다.

    function renderSubTabs() {
        const rolesActive = window.cleaningSubTab === 'roles';

        return `
            <nav class="seg" aria-label="1인 1역 및 청소 메뉴">
                <button type="button"
                    class="${rolesActive ? 'active' : ''}"
                    data-cleaning-subtab="roles">
                    1인 1역
                </button>
                <button type="button"
                    class="${rolesActive ? '' : 'active'}"
                    data-cleaning-subtab="cleaning">
                    청소 확인
                </button>
            </nav>
        `;
    }

    function renderRoleTaskCard(item, done, admin) {
        return `
            <article class="list-item">
                <div class="list-item-main">
                    <strong class="list-item-title">${escapeHtml(item.name)}</strong>
                    <span class="list-item-sub">${escapeHtml(item.role)}</span>
                </div>
                ${admin ? `
                    <button type="button"
                        class="btn btn--sm${done ? ' btn--good' : ''}"
                        data-status-name="${escapeHtml(item.name)}"
                        data-status-field="roleDone"
                        data-status-value="${done ? 'false' : 'true'}">
                        ${done ? '완료 취소' : '완료 처리'}
                    </button>
                ` : ''}
            </article>
        `;
    }

    function renderRoleView(data) {
        const admin = data.admin;
        const checker = data.checker;
        const loginName = data.loginName;
        const assigned = data.students
            .map(student => ({
                name:student.name,
                number:student.number,
                role:readRole(data.roles[student.name])
            }))
            .filter(item => item.role);

        if (!checker) {
            const mine = assigned.find(item => item.name === loginName);

            if (!mine) {
                return `
                    <div class="well">
                        선생님이 역할을 적어 둔 학생에게만 1인 1역이 표시됩니다.
                    </div>
                    <div class="empty"><span>현재 부여된 1인 1역이 없습니다.</span></div>
                `;
            }

            const done = Boolean(data.statuses[mine.name] && data.statuses[mine.name].roleDone);
            const cleaner = isCleaningStudent(mine.name, mine.role, data.cleaningAssignments);

            return `
                <div class="well">
                    맡은 역할을 마친 뒤 아래 버튼을 눌러 주세요.
                    ${cleaner ? '청소 담당자는 청소 확인 탭도 확인해 주세요.' : ''}
                </div>
                <article class="card card--accent center stack">
                    <span class="muted small">${escapeHtml(loginName)}의 1인 1역</span>
                    <h3>${escapeHtml(mine.role)}</h3>
                    <button type="button"
                        class="btn btn--lg${done ? ' btn--good' : ' btn--primary'}"
                        data-status-name="${escapeHtml(mine.name)}"
                        data-status-field="roleDone"
                        data-status-value="${done ? 'false' : 'true'}">
                        ${done ? '1인 1역 완료됨' : '1인 1역 완료'}
                    </button>
                </article>
            `;
        }

        const editRows = data.students.map(student => {
            const role = readRole(data.roles[student.name]);
            const cleaner = isCleaningStudent(
                student.name,
                role,
                data.cleaningAssignments
            );

            return `
                <div class="well stack stack--sm" data-role-row data-student-name="${escapeHtml(student.name)}">
                    <strong class="strong">${escapeHtml(student.name)}</strong>
                    <input type="text"
                        class="role-edit-input"
                        value="${escapeHtml(role)}"
                        placeholder="역할이 없으면 비워 두세요"
                        maxlength="40">
                    <label class="check-row">
                        <input type="checkbox" class="role-cleaner-input" ${cleaner ? 'checked' : ''}>
                        청소 담당 학생
                    </label>
                </div>
            `;
        }).join('');

        const incomplete = assigned.filter(item =>
            !(data.statuses[item.name] && data.statuses[item.name].roleDone)
        );
        const complete = assigned.filter(item =>
            data.statuses[item.name] && data.statuses[item.name].roleDone
        );

        const roleSettings = admin ? `
            <div class="well">
                역할을 입력한 학생만 학생 화면과 완료 현황에 표시됩니다.
                역할이 없는 학생은 입력칸을 비워 두세요. 청소 담당 학생은 체크 표시를 함께 설정합니다.
            </div>
            <section class="card">
                <div class="panel-head">
                    <h3>학생별 역할 설정</h3>
                    <button type="button" class="btn btn--primary" data-save-roles>
                        역할 설정 저장
                    </button>
                </div>
                <div class="grid grid--wide">
                    ${editRows || '<div class="empty"><span>등록된 학생이 없습니다.</span></div>'}
                </div>
            </section>
        ` : `
            <div class="well">
                학생들의 1인 1역 수행 여부를 확인한 뒤 완료 처리해 주세요.
            </div>
        `;

        return `
            ${roleSettings}
            <section class="card">
                <div class="panel-head">
                    <h3>오늘의 1인 1역 현황</h3>
                    <span class="muted">${escapeHtml(data.today)}</span>
                </div>
                <div class="grid grid--half">
                    <div class="well stack stack--sm">
                        <h4>미완료 ${incomplete.length}명</h4>
                        <div class="stack stack--sm">
                            ${incomplete.map(item => renderRoleTaskCard(item, false, true)).join('') ||
                                '<div class="empty"><span>미완료 학생이 없습니다.</span></div>'}
                        </div>
                    </div>
                    <div class="well card--good stack stack--sm">
                        <h4>완료 ${complete.length}명</h4>
                        <div class="stack stack--sm">
                            ${complete.map(item => renderRoleTaskCard(item, true, true)).join('') ||
                                '<div class="empty"><span>완료한 학생이 없습니다.</span></div>'}
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    function renderCleaningView(data) {
        const assignedSeatCount = data.seatInfo.seats.filter(seat => seat.name).length;

        if (!assignedSeatCount) {
            return `
                <div class="well">
                    설정에 저장된 좌석 배치도를 그대로 불러옵니다.
                </div>
                <div class="empty">
                    <span>배치된 좌석 정보가 없습니다. 설정 탭에서 좌석을 먼저 배치해 주세요.</span>
                </div>
            `;
        }

        const seatCards = data.seatInfo.seats.map(seat => {
            if (!seat.name) {
                return `
                    <div class="seat-cell is-empty">
                        <span class="seat-no">${seat.row + 1}-${seat.col + 1}</span>
                        <span class="seat-state">빈자리</span>
                    </div>
                `;
            }

            const role = readRole(data.roles[seat.name]);
            const cleaner = isCleaningStudent(
                seat.name,
                role,
                data.cleaningAssignments
            );
            const done = Boolean(
                data.statuses[seat.name] &&
                data.statuses[seat.name].cleanDone
            );
            const canClick = data.checker ||
                (cleaner && seat.name === data.loginName);

            let action = '<span class="seat-state muted">청소 담당 아님</span>';

            if (canClick) {
                action = `
                    <button type="button"
                        class="btn btn--sm${done ? ' btn--good' : ''}"
                        data-status-name="${escapeHtml(seat.name)}"
                        data-status-field="cleanDone"
                        data-status-value="${done ? 'false' : 'true'}">
                        ${data.checker
                            ? (done ? '자리 청소 확인 취소' : '자리 청소 확인')
                            : (done ? '청소 완료됨' : '청소 완료')}
                    </button>
                `;
            } else if (cleaner) {
                action = `
                    <span class="seat-state">
                        ${done ? '청소 완료' : '청소 미완료'}
                    </span>
                `;
            }

            const stateClass = (cleaner || data.checker)
                ? (done ? ' is-good' : ' is-warn')
                : '';

            return `
                <article class="seat-cell${stateClass}">
                    <span class="seat-no">${seat.row + 1}-${seat.col + 1}</span>
                    <strong class="seat-name">${escapeHtml(seat.name)}</strong>
                    <span class="seat-state small">${escapeHtml(role || '1인 1역 미지정')}</span>
                    ${action}
                </article>
            `;
        }).join('');

        const cleanerNames = data.seatInfo.seats
            .filter(seat => {
                if (!seat.name) return false;
                if (data.checker) return true;
                const role = readRole(data.roles[seat.name]);
                return isCleaningStudent(seat.name, role, data.cleaningAssignments);
            })
            .map(seat => seat.name);
        const doneCount = cleanerNames.filter(name =>
            data.statuses[name] && data.statuses[name].cleanDone
        ).length;

        return `
            <div class="well">
                ${data.checker
                    ? '각 학생의 자리를 확인한 뒤 자리 청소 확인 버튼을 눌러 주세요.'
                    : '청소 담당으로 지정된 학생은 자기 자리에서 청소 완료를 누를 수 있습니다.'}
                ${data.checker ? `현재 ${doneCount}/${cleanerNames.length}명 확인 완료` : ''}
            </div>
            <section class="card">
                <div class="panel-head">
                    <h3>오늘의 청소 확인</h3>
                    <span class="muted">${escapeHtml(data.today)}</span>
                </div>
                <div class="grid" style="grid-template-columns:repeat(${data.seatInfo.cols},minmax(130px,1fr));">
                    ${seatCards}
                </div>
            </section>
        `;
    }

    function bindCleaningEvents(container) {
        container.querySelectorAll('[data-cleaning-subtab]').forEach(button => {
            button.addEventListener('click', () => {
                window.switchCleaningSub(button.dataset.cleaningSubtab);
            });
        });

        container.querySelectorAll('[data-status-name]').forEach(button => {
            button.addEventListener('click', () => {
                window.toggleRoleCleaningStatus(
                    button.dataset.statusName,
                    button.dataset.statusField,
                    button.dataset.statusValue === 'true'
                );
            });
        });

        const saveButton = container.querySelector('[data-save-roles]');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                window.saveStudentRoleSettings(saveButton);
            });
        }
    }

    window.switchCleaningSub = function (subTab) {
        window.cleaningSubTab = subTab === 'cleaning' ? 'cleaning' : 'roles';
        sessionStorage.setItem('cleaningSubTab', window.cleaningSubTab);
        window.renderRoleCleaning();
    };

    window.renderRoleCleaning = function () {
        const container = document.getElementById('tab-cleaning');
        if (!container) return;

        container.innerHTML = `
            <header class="page-head">
                <div><h2>1인 1역 및 청소 확인</h2></div>
            </header>
            ${renderSubTabs()}
            <div class="empty"><span>정보를 불러오는 중입니다.</span></div>
        `;

        const today = getTodayKey();

        Promise.all([
            db.ref(readableSettingsRoot()).once('value'),
            db.ref(`${STATUS_ROOT}/${today}`).once('value')
        ]).then(([settingsSnapshot, statusSnapshot]) => {
            const settings = settingsSnapshot.val() || {};
            const roles = settings.studentRoles || {};
            const cleaningAssignments = settings.cleaningAssignments || {};
            const statuses = statusSnapshot.val() || {};
            const seatInfo = getSeatInformation(settings);
            const students = getStudentList(seatInfo.seats);
            const admin = isCleaningAdmin();
            const checker = canCheckCleaning();

            const data = {
                admin:admin,
                checker:checker,
                loginName:getLoginName(),
                today:today,
                settings:settings,
                roles:roles,
                cleaningAssignments:cleaningAssignments,
                statuses:statuses,
                seatInfo:seatInfo,
                students:students
            };

            const content = window.cleaningSubTab === 'cleaning'
                ? renderCleaningView(data)
                : renderRoleView(data);

            container.innerHTML = `
                <header class="page-head">
                    <div><h2>1인 1역 및 청소 확인</h2></div>
                </header>
                ${renderSubTabs()}
                ${content}
            `;

            bindCleaningEvents(container);
        }).catch(error => {
            console.error('1인 1역/청소 데이터 로딩 오류:', error);
            container.innerHTML = `
                <header class="page-head">
                    <div><h2>1인 1역 및 청소 확인</h2></div>
                </header>
                ${renderSubTabs()}
                <div class="empty">
                    <span>정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</span>
                </div>
            `;
            bindCleaningEvents(container);
        });
    };

    window.saveStudentRoleSettings = async function (button) {
        if (!isCleaningAdmin()) {
            alert('선생님만 역할을 설정할 수 있습니다.');
            return;
        }

        const rows = Array.from(document.querySelectorAll('#tab-cleaning [data-role-row]'));
        const updates = {};

        rows.forEach(row => {
            const name = String(row.dataset.studentName || '').trim();
            const role = String(row.querySelector('.role-edit-input')?.value || '').trim();
            const cleaner = Boolean(row.querySelector('.role-cleaner-input')?.checked);

            if (!name || /[.#$\[\]\/]/.test(name)) return;

            updates[`${SETTINGS_ROOT}/studentRoles/${name}`] = role || null;
            updates[`${SETTINGS_ROOT}/cleaningAssignments/${name}`] =
                cleaner ? true : null;
        });

        button.disabled = true;
        button.textContent = '저장 중...';

        try {
            await db.ref().update(updates);
            alert('학생별 역할 설정을 저장했습니다.');
            window.renderRoleCleaning();
        } catch (error) {
            console.error('역할 설정 저장 오류:', error);
            alert('역할 설정을 저장하지 못했습니다.');
            button.disabled = false;
            button.textContent = '역할 설정 저장';
        }
    };

    window.toggleRoleCleaningStatus = async function (name, field, newStatus) {
        const loginName = getLoginName();
        const admin = isCleaningAdmin();
        const checker = canCheckCleaning();

        if (!['roleDone', 'cleanDone'].includes(field)) return;
        if (!checker && name !== loginName) {
            alert('본인의 완료 상태만 변경할 수 있습니다.');
            return;
        }

        try {
            const settingsSnapshot = await db.ref(readableSettingsRoot()).once('value');
            const settings = settingsSnapshot.val() || {};
            const role = readRole((settings.studentRoles || {})[name]);
            const cleaner = isCleaningStudent(
                name,
                role,
                settings.cleaningAssignments || {}
            );

            if (field === 'roleDone' && !role) {
                alert('부여된 1인 1역이 없습니다.');
                return;
            }

            if (field === 'cleanDone' && !cleaner && !checker) {
                alert('청소 담당 학생만 청소 완료를 누를 수 있습니다.');
                return;
            }

            const today = getTodayKey();
            const serverTimestamp =
                typeof firebase !== 'undefined' &&
                firebase.database &&
                firebase.database.ServerValue
                    ? firebase.database.ServerValue.TIMESTAMP
                    : Date.now();

            const statusPath=`${STATUS_ROOT}/${today}/${name}`;
            const updates={
                [`${statusPath}/${field}`]:Boolean(newStatus),
                [`${statusPath}/${field}At`]:serverTimestamp,
                [`${statusPath}/${field}By`]:loginName
            };

            if(field==='cleanDone'){
                updates[`blackboardDisplay/data/cleaningRoot/${today}/${name}/cleanDone`]=Boolean(newStatus);
            }

            await db.ref().update(updates);

            window.renderRoleCleaning();
        } catch (error) {
            console.error('완료 상태 변경 오류:', error);
            alert('완료 상태를 변경하지 못했습니다.');
        }
    };

    // 기존 코드에서 toggleStatus를 호출하는 경우에도 새 날짜별 저장 방식을 사용합니다.
    window.toggleStatus = function (name, field, newStatus) {
        return window.toggleRoleCleaningStatus(name, field, newStatus);
    };
})();
