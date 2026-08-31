// js/blackboard-admin.js

(function () {
    'use strict';

    const PERIODS = [
        '아침', '1교시', '2교시', '3교시', '4교시',
        '점심시간', '청소시간', '5교시', '6교시'
    ];

    const DEFAULTS = {
        '아침': { startTime:'08:00', endTime:'09:00', subject:'아침' },
        '1교시': { startTime:'09:00', endTime:'09:40', subject:'1교시' },
        '2교시': { startTime:'09:50', endTime:'10:30', subject:'2교시' },
        '3교시': { startTime:'10:40', endTime:'11:20', subject:'3교시' },
        '4교시': { startTime:'11:30', endTime:'12:10', subject:'4교시' },
        '점심시간': { startTime:'12:10', endTime:'13:00', subject:'점심시간' },
        '청소시간': { startTime:'13:00', endTime:'13:20', subject:'청소시간' },
        '5교시': { startTime:'13:20', endTime:'14:00', subject:'5교시' },
        '6교시': { startTime:'14:10', endTime:'14:50', subject:'6교시' }
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isClassPeriod(periodName) {
        return /^\d교시$/.test(periodName);
    }

    function bindLearningNoteControls(container) {
        container.querySelectorAll('.bb-learning-toggle').forEach(input => {
            const sync = () => {
                const note = container.querySelector(
                    `.bb-learning-note[data-period="${input.dataset.period}"]`
                );
                if (note) note.style.display = input.checked ? 'block' : 'none';
            };

            input.addEventListener('change', sync);
            sync();
        });
    }

    window.initBlackboardAdmin = async function () {
        const container = document.getElementById('bb-schedule-form-container');
        if (!container) return;

        container.innerHTML = '<div style="padding:20px;text-align:center;">전자칠판 설정을 불러오는 중입니다.</div>';

        try {
            const [scheduleSnapshot, noticeSnapshot] = await Promise.all([
                db.ref('blackboard/schedule').once('value'),
                db.ref('blackboard/notice').once('value')
            ]);

            const schedule = scheduleSnapshot.val() || {};
            const notice = noticeSnapshot.val() || '';

            container.innerHTML = `
                <section style="background:#fff8dc;border:2px solid #f1c40f;padding:18px;border-radius:12px;">
                    <label for="bb-notice" style="display:block;font-weight:900;margin-bottom:10px;color:#7d6608;">📢 전자칠판 공지사항</label>
                    <textarea id="bb-notice" rows="3" placeholder="아침 전자칠판 맨 위에 표시할 공지사항을 작성하세요." style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #d4ac0d;border-radius:8px;font:inherit;">${escapeHtml(notice)}</textarea>
                </section>
            `;

            PERIODS.forEach(periodName => {
                const defaults = DEFAULTS[periodName];
                const saved = schedule[periodName] || {};
                const periodData = {
                    ...defaults,
                    ...saved,
                    subject:saved.subject || defaults.subject,
                    startTime:saved.startTime || defaults.startTime,
                    endTime:saved.endTime || defaults.endTime
                };
                const classPeriod = isClassPeriod(periodName);
                const box = document.createElement('section');

                box.style.cssText = 'background:#f8f9fa;padding:18px;border-radius:12px;border:1px solid #dfe4ea;display:flex;flex-direction:column;gap:12px;';
                box.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                        <strong style="font-size:1.15rem;color:#22324a;">📌 ${periodName}</strong>
                        <input type="text" class="bb-subject" data-period="${periodName}" value="${escapeHtml(periodData.subject || defaults.subject)}" placeholder="과목명" style="padding:9px;width:190px;border-radius:7px;border:1px solid #bcc5d0;">
                    </div>
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                        <label>시작</label>
                        <input type="time" class="bb-start" data-period="${periodName}" value="${escapeHtml(periodData.startTime || '')}" style="padding:8px;border-radius:7px;border:1px solid #bcc5d0;">
                        <label>종료</label>
                        <input type="time" class="bb-end" data-period="${periodName}" value="${escapeHtml(periodData.endTime || '')}" style="padding:8px;border-radius:7px;border:1px solid #bcc5d0;">
                        ${classPeriod ? `
                            <label style="margin-left:auto;font-weight:800;display:flex;align-items:center;gap:7px;">
                                <input type="checkbox" class="bb-moving" data-period="${periodName}" ${periodData.isMovingClass ? 'checked' : ''}>
                                이동수업
                            </label>
                        ` : ''}
                    </div>
                    <textarea class="bb-action" data-period="${periodName}" rows="2" placeholder="이 시간에 추가로 표시할 안내 문구" style="width:100%;box-sizing:border-box;padding:10px;border-radius:7px;border:1px solid #bcc5d0;font:inherit;">${escapeHtml(periodData.action || '')}</textarea>
                    ${classPeriod ? `
                        <div style="border-top:1px dashed #cbd3dc;padding-top:12px;">
                            <label style="font-weight:900;display:flex;align-items:center;gap:8px;cursor:pointer;">
                                <input type="checkbox" class="bb-learning-toggle" data-period="${periodName}" ${periodData.showLearningNote ? 'checked' : ''}>
                                📖 배움공책 표시
                            </label>
                            <textarea class="bb-learning-note" data-period="${periodName}" rows="4" placeholder="전자칠판에 표시할 배움공책 내용을 적으세요." style="display:none;width:100%;box-sizing:border-box;margin-top:10px;padding:11px;border:2px solid #8e44ad;border-radius:8px;font:inherit;">${escapeHtml(periodData.learningNote || '')}</textarea>
                        </div>
                    ` : ''}
                `;

                container.appendChild(box);
            });

            bindLearningNoteControls(container);
        } catch (error) {
            console.error('전자칠판 설정 로딩 실패:', error);
            container.innerHTML = '<div style="padding:20px;color:#c0392b;">전자칠판 설정을 불러오지 못했습니다.</div>';
        }
    };

    window.saveBlackboardScheduleFromForm = async function () {
        const container = document.getElementById('bb-schedule-form-container');
        if (!container) return;

        const newScheduleData = {};

        PERIODS.forEach(periodName => {
            const find = selector => container.querySelector(
                `${selector}[data-period="${periodName}"]`
            );
            const subjectInput = find('.bb-subject');
            const startInput = find('.bb-start');
            const endInput = find('.bb-end');
            const actionInput = find('.bb-action');
            const movingInput = find('.bb-moving');
            const learningToggle = find('.bb-learning-toggle');
            const learningNote = find('.bb-learning-note');

            newScheduleData[periodName] = {
                subject:String(subjectInput?.value || periodName).trim(),
                startTime:String(startInput?.value || '').trim(),
                endTime:String(endInput?.value || '').trim(),
                action:String(actionInput?.value || '').trim(),
                isMovingClass:Boolean(movingInput?.checked),
                showLearningNote:Boolean(learningToggle?.checked),
                learningNote:String(learningNote?.value || '').trim()
            };
        });

        const notice = String(
            document.getElementById('bb-notice')?.value || ''
        ).trim();

        try {
            await db.ref('blackboard').update({
                schedule:newScheduleData,
                notice:notice
            });
            alert('전자칠판 공지와 시간표를 저장했습니다. 열린 전자칠판에도 바로 반영됩니다.');
        } catch (error) {
            console.error('전자칠판 설정 저장 실패:', error);
            alert('전자칠판 설정을 저장하지 못했습니다.');
        }
    };
})();
