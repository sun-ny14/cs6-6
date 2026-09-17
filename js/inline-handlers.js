// js/inline-handlers.js
// index.html의 onclick="..." 인라인 핸들러를 이 파일로 옮겼습니다.
// 인라인 스크립트/이벤트 속성은 브라우저나 학교 보안 프로그램이 붙이는
// Content-Security-Policy(nonce 기반)에 의해 막힐 수 있어서, 외부 스크립트
// 파일에서 addEventListener로 붙이는 방식으로 바꿔야 CSP와 무관하게 동작합니다.
// 이 파일은 다른 모든 스크립트가 로드된 뒤 마지막에 실행됩니다.

function bindClick(id,handler){
    const el=document.getElementById(id);
    if(el)el.addEventListener('click',handler);
}

function bindChange(id,handler){
    const el=document.getElementById(id);
    if(el)el.addEventListener('change',handler);
}

function openBlackboardWindow(){
    window.open('blackboard.html','_blank','fullscreen=yes');
}

function toggleSidebar(){
    const sidebar=document.getElementById('sidebar-menu');
    const toggleBtn=document.getElementById('sidebar-toggle-btn');

    if(sidebar&&toggleBtn){
        sidebar.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');

        toggleBtn.innerText=
            sidebar.classList.contains('collapsed')?'▶':'◀';
    }
}

bindClick('pop-close-btn',()=>closePopup());
bindClick('point-popup-close-btn',()=>closePointPopup());
bindClick('point-apply-btn',()=>submitPointPopupCustom());

bindClick('login-btn',()=>handleLogin());

bindClick('sidebar-toggle-btn',()=>toggleSidebar());

bindClick('btn-main',()=>showTab('main'));
bindClick('btn-shop',()=>{showTab('shop');renderShop();});
bindClick('btn-student-checkin',()=>showTab('student-checkin'));
bindClick('btn-assignments',()=>{showTab('assignments');initAssignmentsTab();});
bindClick('btn-points',()=>showTab('points'));
bindClick('btn-housing',()=>showTab('housing'));
bindClick('btn-attendance-admin',()=>showTab('attendance-admin'));
bindClick('btn-blackboard-admin',()=>{showTab('blackboard-admin');initBlackboardAdmin();});
bindClick('btn-class-ops',()=>openClassOpsEntry());
bindClick('btn-cleaning',()=>{showTab('cleaning');renderRoleCleaning();});
bindClick('btn-admin',()=>{showTab('admin');initSettings();});

bindClick('home-board-open-btn',openBlackboardWindow);
bindClick('home-notice-board-link',openBlackboardWindow);
bindClick('home-task-tab-link',()=>{showTab('assignments');initAssignmentsTab();});
bindClick('home-shop-tab-link',()=>{showTab('shop');renderShop();});
bindClick('home-clean-tab-link',()=>{showTab('cleaning');renderRoleCleaning();});

bindClick('checkin-btn',()=>submitCheckIn());

bindChange('checkin-date-filter',()=>refreshCheckinManagement());
bindClick('checkin-refresh-btn',()=>refreshCheckinManagement());
bindClick('checkin-exclusion-btn',()=>openExclusionPopup());
bindClick('checkin-monthly-calendar-btn',()=>openMonthlyCalendar());

bindClick('btn-add-point-guide',()=>openPointGuideModal());

bindClick('bb-admin-open-btn',openBlackboardWindow);

bindClick('class-ops-change-password-btn',()=>{
    window.classOpsChangePassword&&window.classOpsChangePassword();
});
bindClick('class-ops-lock-btn',()=>{
    window.lockClassJournal&&window.lockClassJournal();
});
bindClick('class-ops-sub-journal',()=>window.switchClassOpsSub('journal'));
bindClick('class-ops-sub-grades',()=>window.switchClassOpsSub('grades'));
bindClick('class-ops-sub-budget',()=>window.switchClassOpsSub('budget'));

bindClick('housing-toggle-btn',()=>toggleHousing());
bindClick('housing-purchase-history-button',()=>openHousingPurchaseHistory());
bindClick('housing-shop-button',()=>openHousingShopPopup());
bindClick('housing-guestbook-button',()=>toggleRoomGuestbook());

bindClick('seat-builder-toggle-btn',()=>toggleSeatBuilder());
bindClick('seat-generate-inputs-btn',()=>generateSeatInputs());
bindClick('seat-save-settings-btn',()=>saveSeatSettings());

bindClick('checkin-password-random-btn',()=>generateRandomPassword());

bindClick('settings-save-btn',()=>saveSettings());
bindClick('gifts-save-btn',()=>saveGifts());
bindClick('bulk-reg-btn',()=>bulkReg());
