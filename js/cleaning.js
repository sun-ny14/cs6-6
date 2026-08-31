// js/cleaning.js
// 1인 1역 / 청소 독립 확인 시스템
// 이 파일의 전체 내용을 기존 js/cleaning.js와 교체하세요.

(function () {
    'use strict';

    const STATUS_ROOT = 'classManagement/cleaningStatus';
    const SETTINGS_ROOT = 'settings';

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

    function ensureCleaningStyle() {
        if (document.getElementById('cleaning-system-v2-style')) return;

        const style = document.createElement('style');
        style.id = 'cleaning-system-v2-style';
        style.textContent = `
            #tab-cleaning .cleaning-system-v2 {
                max-width: 1180px;
                margin: 0 auto;
                padding: 12px 8px 34px;
                color: #1b2b48;
                font-size: 17px;
            }
            #tab-cleaning .cleaning-page-title {
                margin: 4px 0 18px;
                color: #182844;
                font-size: clamp(25px, 2.2vw, 34px);
                font-weight: 950;
                text-align: center;
            }
            #tab-cleaning .cleaning-sub-tabs {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
                padding: 7px;
                background: #edf0f3;
                border-radius: 16px;
            }
            #tab-cleaning .cleaning-sub-tab {
                min-height: 54px;
                padding: 11px 16px;
                color: #4f5d72;
                background: transparent;
                border: 0;
                border-radius: 11px;
                font-size: 18px;
                font-weight: 900;
                cursor: pointer;
            }
            #tab-cleaning .cleaning-sub-tab.is-active {
                color: #18345e;
                background: #fff;
                box-shadow: 0 3px 12px rgba(24, 40, 68, .10);
            }
            #tab-cleaning .cleaning-info-box {
                margin-bottom: 18px;
                padding: 16px 18px;
                color: #415069;
                background: #f6f8fb;
                border: 1px solid #dfe4eb;
                border-radius: 14px;
                font-size: 16px;
                line-height: 1.6;
            }
            #tab-cleaning .cleaning-section {
                margin-top: 20px;
                padding: 20px;
                background: #fff;
                border: 1px solid #dfe4eb;
                border-radius: 18px;
                box-shadow: 0 7px 22px rgba(24, 40, 68, .06);
            }
            #tab-cleaning .cleaning-section-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 16px;
            }
            #tab-cleaning .cleaning-section h3 {
                margin: 0;
                color: #182844;
                font-size: 22px;
                font-weight: 950;
            }
            #tab-cleaning .role-edit-list {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
                gap: 12px;
            }
            #tab-cleaning .role-edit-row {
                display: grid;
                grid-template-columns: 92px minmax(0, 1fr);
                gap: 10px 12px;
                align-items: center;
                padding: 14px;
                background: #fbfcfe;
                border: 1px solid #e1e6ed;
                border-radius: 14px;
            }
            #tab-cleaning .role-edit-name {
                overflow: hidden;
                color: #1f3151;
                font-size: 18px;
                font-weight: 900;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #tab-cleaning .role-edit-input {
                width: 100%;
                min-height: 46px;
                padding: 10px 12px;
                border: 1px solid #cfd6df;
                border-radius: 10px;
                font-size: 17px;
            }
            #tab-cleaning .role-cleaning-check {
                grid-column: 2;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: #536078;
                font-size: 15px;
                font-weight: 800;
            }
            #tab-cleaning .role-cleaning-check input {
                width: 20px;
                height: 20px;
            }
            #tab-cleaning .cleaning-primary-button,
            #tab-cleaning .task-status-button {
                min-height: 48px;
                padding: 10px 18px;
                color: #fff;
                background: #27538a;
                border: 0;
                border-radius: 11px;
                font-size: 17px;
                font-weight: 900;
                cursor: pointer;
            }
            #tab-cleaning .cleaning-primary-button:disabled,
            #tab-cleaning .task-status-button:disabled {
                cursor: not-allowed;
                opacity: .5;
            }
            #tab-cleaning .role-status-columns {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }
            #tab-cleaning .role-status-group {
                min-width: 0;
                padding: 16px;
                background: #f8fafc;
                border: 1px solid #e0e5ec;
                border-radius: 15px;
            }
            #tab-cleaning .role-status-group.is-done {
                background: #effaf2;
                border-color: #aedbbb;
            }
            #tab-cleaning .role-status-group h4 {
                margin: 0 0 12px;
                font-size: 19px;
                font-weight: 950;
            }
            #tab-cleaning .task-card-list {
                display: grid;
                gap: 10px;
            }
            #tab-cleaning .task-card {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                min-height: 78px;
                padding: 13px 14px;
                background: #fff;
                border: 1px solid #dfe4eb;
                border-radius: 12px;
            }
            #tab-cleaning .task-card-copy {
                min-width: 0;
            }
            #tab-cleaning .task-card-name {
                display: block;
                color: #1d3152;
                font-size: 18px;
                font-weight: 950;
            }
            #tab-cleaning .task-card-role {
                display: block;
                margin-top: 4px;
                overflow: hidden;
                color: #69758a;
                font-size: 15px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #tab-cleaning .task-status-button.is-done {
                color: #176a35;
                background: #dff5e5;
                border: 1px solid #78c18e;
            }
            #tab-cleaning .my-role-card {
                padding: 26px;
                text-align: center;
                background: linear-gradient(150deg, #fff9dc, #f6ebbb);
                border: 1px solid #d9c578;
                border-radius: 20px;
            }
            #tab-cleaning .my-role-label {
                color: #725c18;
                font-size: 16px;
                font-weight: 900;
            }
            #tab-cleaning .my-role-name {
                display: block;
                margin: 8px 0 20px;
                color: #182844;
                font-size: clamp(25px, 3vw, 34px);
                font-weight: 950;
            }
            #tab-cleaning .seat-grid {
                display: grid;
                grid-template-columns: repeat(var(--seat-cols), minmax(130px, 1fr));
                gap: 12px;
                overflow-x: auto;
                padding: 4px;
            }
            #tab-cleaning .seat-card {
                position: relative;
                min-height: 142px;
                padding: 28px 12px 14px;
                text-align: center;
                background: #f7f8fa;
                border: 2px solid #d9dee5;
                border-radius: 16px;
            }
            #tab-cleaning .seat-card.is-empty {
                min-height: 90px;
                opacity: .45;
                background: #f2f3f5;
            }
            #tab-cleaning .seat-card.is-cleaner {
                background: #fff9df;
                border-color: #d9bd4e;
            }
            #tab-cleaning .seat-card.is-done {
                background: #eaf8ee;
                border-color: #65b47c;
            }
            #tab-cleaning .seat-number {
                position: absolute;
                top: 7px;
                left: 8px;
                color: #7c8798;
                font-size: 13px;
                font-weight: 800;
            }
            #tab-cleaning .seat-name {
                display: block;
                color: #1d3152;
                font-size: 19px;
                font-weight: 950;
            }
            #tab-cleaning .seat-role {
                display: block;
                min-height: 38px;
                margin: 7px 0 10px;
                color: #6b7587;
                font-size: 14px;
                line-height: 1.35;
            }
            #tab-cleaning .seat-card button {
                width: 100%;
                min-height: 42px;
                padding: 8px 7px;
                color: #fff;
                background: #28704b;
                border: 0;
                border-radius: 9px;
                font-size: 15px;
                font-weight: 900;
                cursor: pointer;
            }
            #tab-cleaning .seat-card button.is-done {
                color: #176a35;
                background: #d7f0de;
                border: 1px solid #72bc87;
            }
            #tab-cleaning .seat-state-text {
                display: block;
                min-height: 42px;
                padding: 10px 4px;
                color: #7a8494;
                font-size: 14px;
                font-weight: 800;
            }
            #tab-cleaning .cleaning-empty {
                padding: 28px 16px;
                color: #788497;
                background: #f7f8fa;
                border: 1px dashed #cdd4dd;
                border-radius: 13px;
                font-size: 17px;
                text-align: center;
            }
            @media (max-width: 720px) {
                #tab-cleaning .cleaning-system-v2 { font-size: 16px; }
                #tab-cleaning .cleaning-sub-tab { font-size: 16px; }
                #tab-cleaning .cleaning-section { padding: 15px; }
                #tab-cleaning .cleaning-section-head {
                    align-items: stretch;
                    flex-direction: column;
                }
                #tab-cleaning .role-edit-list,
                #tab-cleaning .role-status-columns {
                    grid-template-columns: 1fr;
                }
                #tab-cleaning .task-card {
                    align-items: stretch;
                    flex-direction: column;
                }
                #tab-cleaning .seat-grid {
                    grid-template-columns: repeat(var(--seat-cols), minmax(112px, 1fr));
                }
            }
        `;

        document.head.appendChild(style);
    }

    function renderSubTabs() {
        const rolesActive = window.cleaningSubTab === 'roles';

        return `
            <nav class="cleaning-sub-tabs" aria-label="1인 1역 및 청소 메뉴">
                <button type="button"
                    class="cleaning-sub-tab${rolesActive ? ' is-active' : ''}"
                    data-cleaning-subtab="roles">
                    1인 1역
                </button>
                <button type="button"
                    class="cleaning-sub-tab${rolesActive ? '' : ' is-active'}"
                    data-cleaning-subtab="cleaning">
                    청소 확인
                </button>
            </nav>
        `;
    }

    function renderRoleTaskCard(item, done, admin) {
        return `
            <article class="task-card">
                <div class="task-card-copy">
                    <strong class="task-card-name">${escapeHtml(item.name)}</strong>
                    <span class="task-card-role">${escapeHtml(item.role)}</span>
                </div>
                ${admin ? `
                    <button type="button"
                        class="task-status-button${done ? ' is-done' : ''}"
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
                    <div class="cleaning-info-box">
                        선생님이 역할을 적어 둔 학생에게만 1인 1역이 표시됩니다.
                    </div>
                    <div class="cleaning-empty">현재 부여된 1인 1역이 없습니다.</div>
                `;
            }

            const done = Boolean(data.statuses[mine.name] && data.statuses[mine.name].roleDone);
            const cleaner = isCleaningStudent(mine.name, mine.role, data.cleaningAssignments);

            return `
                <div class="cleaning-info-box">
                    맡은 역할을 마친 뒤 아래 버튼을 눌러 주세요.
                    ${cleaner ? '청소 담당자는 청소 확인 탭도 확인해 주세요.' : ''}
                </div>
                <article class="my-role-card">
                    <span class="my-role-label">${escapeHtml(loginName)}의 1인 1역</span>
                    <strong class="my-role-name">${escapeHtml(mine.role)}</strong>
                    <button type="button"
                        class="task-status-button${done ? ' is-done' : ''}"
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
                <div class="role-edit-row" data-role-row data-student-name="${escapeHtml(student.name)}">
                    <strong class="role-edit-name">${escapeHtml(student.name)}</strong>
                    <input type="text"
                        class="role-edit-input"
                        value="${escapeHtml(role)}"
                        placeholder="역할이 없으면 비워 두세요"
                        maxlength="40">
                    <label class="role-cleaning-check">
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
            <div class="cleaning-info-box">
                역할을 입력한 학생만 학생 화면과 완료 현황에 표시됩니다.
                역할이 없는 학생은 입력칸을 비워 두세요. 청소 담당 학생은 체크 표시를 함께 설정합니다.
            </div>
            <section class="cleaning-section">
                <div class="cleaning-section-head">
                    <h3>학생별 역할 설정</h3>
                    <button type="button" class="cleaning-primary-button" data-save-roles>
                        역할 설정 저장
                    </button>
                </div>
                <div class="role-edit-list">
                    ${editRows || '<div class="cleaning-empty">등록된 학생이 없습니다.</div>'}
                </div>
            </section>
        ` : `
            <div class="cleaning-info-box">
                학생들의 1인 1역 수행 여부를 확인한 뒤 완료 처리해 주세요.
            </div>
        `;

        return `
            ${roleSettings}
            <section class="cleaning-section">
                <div class="cleaning-section-head">
                    <h3>오늘의 1인 1역 현황</h3>
                    <span>${escapeHtml(data.today)}</span>
                </div>
                <div class="role-status-columns">
                    <div class="role-status-group">
                        <h4>미완료 ${incomplete.length}명</h4>
                        <div class="task-card-list">
                            ${incomplete.map(item => renderRoleTaskCard(item, false, true)).join('') ||
                                '<div class="cleaning-empty">미완료 학생이 없습니다.</div>'}
                        </div>
                    </div>
                    <div class="role-status-group is-done">
                        <h4>완료 ${complete.length}명</h4>
                        <div class="task-card-list">
                            ${complete.map(item => renderRoleTaskCard(item, true, true)).join('') ||
                                '<div class="cleaning-empty">완료한 학생이 없습니다.</div>'}
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
                <div class="cleaning-info-box">
                    설정에 저장된 좌석 배치도를 그대로 불러옵니다.
                </div>
                <div class="cleaning-empty">
                    배치된 좌석 정보가 없습니다. 설정 탭에서 좌석을 먼저 배치해 주세요.
                </div>
            `;
        }

        const seatCards = data.seatInfo.seats.map(seat => {
            if (!seat.name) {
                return `
                    <div class="seat-card is-empty">
                        <span class="seat-number">${seat.row + 1}-${seat.col + 1}</span>
                        <span class="seat-state-text">빈자리</span>
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

            let action = '<span class="seat-state-text">청소 담당 아님</span>';

            if (canClick) {
                action = `
                    <button type="button"
                        class="${done ? 'is-done' : ''}"
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
                    <span class="seat-state-text">
                        ${done ? '청소 완료' : '청소 미완료'}
                    </span>
                `;
            }

            return `
                <article class="seat-card${(cleaner || data.checker) ? ' is-cleaner' : ''}${done ? ' is-done' : ''}">
                    <span class="seat-number">${seat.row + 1}-${seat.col + 1}</span>
                    <strong class="seat-name">${escapeHtml(seat.name)}</strong>
                    <span class="seat-role">${escapeHtml(role || '1인 1역 미지정')}</span>
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
            <div class="cleaning-info-box">
                ${data.checker
                    ? '각 학생의 자리를 확인한 뒤 자리 청소 확인 버튼을 눌러 주세요.'
                    : '청소 담당으로 지정된 학생은 자기 자리에서 청소 완료를 누를 수 있습니다.'}
                ${data.checker ? `현재 ${doneCount}/${cleanerNames.length}명 확인 완료` : ''}
            </div>
            <section class="cleaning-section">
                <div class="cleaning-section-head">
                    <h3>오늘의 청소 확인</h3>
                    <span>${escapeHtml(data.today)}</span>
                </div>
                <div class="seat-grid" style="--seat-cols:${data.seatInfo.cols}">
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

        ensureCleaningStyle();
        container.innerHTML = `
            <div class="cleaning-system-v2">
                <h2 class="cleaning-page-title">1인 1역 및 청소 확인</h2>
                ${renderSubTabs()}
                <div class="cleaning-empty">정보를 불러오는 중입니다.</div>
            </div>
        `;

        const today = getTodayKey();

        Promise.all([
            db.ref(SETTINGS_ROOT).once('value'),
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
                <div class="cleaning-system-v2">
                    <h2 class="cleaning-page-title">1인 1역 및 청소 확인</h2>
                    ${renderSubTabs()}
                    <div class="cleaning-sub-content">${content}</div>
                </div>
            `;

            bindCleaningEvents(container);
        }).catch(error => {
            console.error('1인 1역/청소 데이터 로딩 오류:', error);
            container.innerHTML = `
                <div class="cleaning-system-v2">
                    <h2 class="cleaning-page-title">1인 1역 및 청소 확인</h2>
                    ${renderSubTabs()}
                    <div class="cleaning-empty">
                        정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                    </div>
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
            const settingsSnapshot = await db.ref(SETTINGS_ROOT).once('value');
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

            await db.ref(`${STATUS_ROOT}/${today}/${name}`).update({
                [field]:Boolean(newStatus),
                [`${field}At`]:serverTimestamp,
                [`${field}By`]:loginName
            });

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
