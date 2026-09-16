// js/class-ops.js
// "학급 운영" 탭: 학급일지 · 성적 관리 · 운영비를 잠금 하나로 묶어 전환한다.
// 잠금 화면 자체(#class-ops-lock-area, PIN 입력)는 js/class-journal.js가 그대로 그린다.
// 이 파일은 잠금이 풀린 뒤 세 서브탭 중 무엇을 보여줄지만 담당한다.
(function () {
    'use strict';

    window.classOpsActiveSub = window.classOpsActiveSub || 'journal';

    window.openClassOpsEntry = function () {
        if (window.isAdmin !== true) {
            alert('관리자만 학급 운영을 사용할 수 있습니다.');
            return;
        }
        showTab('class-ops');
    };

    function setSubnavActive(name) {
        ['journal', 'grades', 'budget'].forEach(key => {
            document.getElementById(`class-ops-sub-${key}`)?.classList.toggle('active', key === name);
        });
    }

    function applySub(name) {
        window.classOpsActiveSub = name;
        setSubnavActive(name);
        const journalPane = document.getElementById('class-journal-container');
        const managePane = document.getElementById('management-sub-container');
        if (journalPane) journalPane.hidden = name !== 'journal';
        if (managePane) managePane.hidden = name === 'journal';

        if (name === 'journal' && typeof window.renderClassJournalPane === 'function') {
            window.renderClassJournalPane();
        } else if ((name === 'grades' || name === 'budget') && typeof window.renderManagementSub === 'function') {
            window.renderManagementSub(name);
        }
    }

    // 잠긴 상태에서 서브탭 버튼을 눌러도 잠금 화면이 우선이므로, 원하던 서브탭만
    // 기억해뒀다가 잠금이 풀리는 순간 그 화면으로 바로 이동시킨다.
    window.switchClassOpsSub = function (name) {
        if (!['journal', 'grades', 'budget'].includes(name)) return;
        window.classOpsActiveSub = name;
        if (typeof window.isClassOpsUnlocked === 'function' && window.isClassOpsUnlocked()) {
            applySub(name);
        } else {
            setSubnavActive(name);
        }
    };

    // 탭에 들어올 때마다 호출: 풀려 있으면 원하던 서브탭을, 잠겨 있으면 잠금 화면을 보여준다.
    window.initClassOpsPane = function () {
        const unlocked = typeof window.isClassOpsUnlocked === 'function' && window.isClassOpsUnlocked();
        if (unlocked) {
            applySub(window.classOpsActiveSub || 'journal');
        } else if (typeof window.lockClassJournal === 'function') {
            window.lockClassJournal();
        }
    };

    // class-journal.js가 잠금 해제/재잠금 시 호출하는 훅.
    window.classOpsOnUnlock = function () {
        applySub(window.classOpsActiveSub || 'journal');
    };
    window.classOpsOnLock = function () {
        const managePane = document.getElementById('management-sub-container');
        if (managePane) managePane.hidden = true;
    };
})();
