(function () {
    'use strict';
    const admin = window.isVerifiedAdmin;
    const report = error => alert(error.message || '저장하지 못했습니다. 다시 시도해 주세요.');
    const oldBuy = window.buyItem;
    window.buyItem = async function (key, ...args) {
        if (admin()) return oldBuy(key,...args);
        try { const r=await secureStudentAction('buy',{itemKey:key}); alert(r.message); } catch(e) { report(e); }
    };
    window.submitCheckIn = async function () {
        if (window.isCheckingIn) return;
        const input=document.getElementById('checkin-pass');
        const password=input?.value.trim() || '';
        if (!/^\d{4}$/.test(password)) return alert('등교 암호 4자리를 입력해 주세요.');
        window.isCheckingIn=true;
        const button=document.getElementById('checkin-btn');
        if(button)button.disabled=true;
        try { const r=await secureStudentAction('checkin',{password}); input.value=''; alert(r.message); }
        catch(e) { report(e); }
        finally { window.isCheckingIn=false; if(button)button.disabled=false; }
    };
    const oldRewards=window.syncHousingRewards;
    window.syncHousingRewards=async function(name) {
        if(admin())return oldRewards(name);
        if(name===window.myName) await secureStudentAction('housingRewards');
        return (await db.ref(`users/${name}`).once('value')).val();
    };
    const oldHousingBuy=window.buyHousingItem;
    window.buyHousingItem=async function(key) {
        if(admin())return oldHousingBuy(key);
        if(!window.canManageHousing())return;
        if(!confirm('이 가구를 방꾸미기 코인으로 구매할까요?'))return;
        try {
            const r=await secureStudentAction('housingBuy',{itemKey:key});
            alert(`${r.message} 남은 코인: ${r.roomCoins}C`);
            await window.renderMyRoom();
            window.renderHousingInventory();
        } catch(e) { report(e); }
    };
    const oldUse=window.useInventoryItem;
    window.useInventoryItem=async function(key,name) {
        if(admin() || /리셋|초기화/.test(name))return oldUse(key,name);
        if(!confirm('선생님께 아이템 사용을 요청할까요?'))return;
        try { alert((await secureStudentAction('useItem',{orderKey:key})).message); } catch(e) { report(e); }
    };
    const oldReset=window.submitResetRequest;
    window.submitResetRequest=async function(key,name) {
        if(admin())return oldReset(key,name);
        const target=document.getElementById('reset-target-item')?.value;
        try { alert((await secureStudentAction('useItem',{orderKey:key,target})).message); window.closePopup(); } catch(e) { report(e); }
    };
    const oldReaction=window.sendRoomReaction;
    const oldPlace=window.placeOrApplyHousingItem;
    window.placeOrApplyHousingItem=async function(img,type) {
        if(admin())return oldPlace(img,type);
        try {
            if(type==='배경')await secureStudentAction('roomPlace',{img,type});
            else {
                const items=(await db.ref(`users/${window.myName}/housingInventory`).once('value')).val() || {};
                const entry=Object.entries(items).find(([,item])=>item.img===img && item.category===type);
                if(!entry)throw new Error('보관함에서 가구를 선택해 주세요.');
                await secureStudentAction('roomPlace',{itemKey:entry[0],type});
            }
            window.renderMyRoom();
        } catch(e){report(e);}
    };
    const oldBackground=window.applyUnlockedHousingBackground;
    window.applyUnlockedHousingBackground=async function(img,...args) {
        if(admin())return oldBackground(img,...args);
        return window.placeOrApplyHousingItem(img,'배경');
    };
    window.sendRoomReaction=async function(target,type) {
        if(admin())return oldReaction(target,type);
        try {
            const r=await secureStudentAction('reaction',{target,type});
            alert(r.message);
            const room=(await db.ref(`rooms/${target}`).once('value')).val();
            window.renderRoomSocial(room || {});
        } catch(e) { report(e); }
    };
    // Client guards improve navigation. Database rules remain the authority.
    const oldShow=window.showTab;
    window.showTab=function(tab,...args) {
        if(['admin','management','blackboard-admin'].includes(tab) && !admin())tab='main';
        if(tab==='cleaning' && !window.canUseCleaningTab())tab='main';
        return oldShow(tab,...args);
    };
    for(const name of ['initSettings','renderManagementSub','initBlackboardAdmin','openAddShopPopup','openEditShopPopup','openBulkPointPopup','openCheckinEditModal','openLogEditPopup']) {
        const original=window[name];
        if(typeof original!=='function')continue;
        window[name]=function(...args){ if(!admin())return; return original.apply(this,args); };
    }
    const originalApprove=window.approveSingleItem;
    window.approveSingleItem=async function(key,user,item){
        if(admin())return originalApprove(key,user,item);
        if(!window.canManageShopRequests())return;
        if(!confirm(`${user} 용사의 [${item}] 요청을 승인할까요?`))return;
        try{alert((await secureStudentAction('approveOrder',{orderKey:key})).message);}catch(e){report(e);}
    };
    const originalApproveAll=window.approveUserAll;
    window.approveUserAll=async function(keys,user){
        if(admin())return originalApproveAll(keys,user);
        if(!window.canManageShopRequests())return;
        if(!confirm(`${user} 용사의 모든 사용 요청을 승인할까요?`))return;
        try{
            for(const key of keys.split(',').filter(Boolean))await secureStudentAction('approveOrder',{orderKey:key});
            alert('선택한 요청을 승인했습니다.');
        }catch(e){report(e);}
    };
    const originalReject=window.rejectSingleItem;
    window.rejectSingleItem=async function(key,user,item){
        if(admin())return originalReject(key,user,item);
        if(!window.canManageShopRequests())return;
        if(!confirm(`${user} 용사의 [${item}] 요청을 거절하고 포인트를 환불할까요?`))return;
        try{alert((await secureStudentAction('rejectOrder',{orderKey:key})).message);}catch(e){report(e);}
    };
})();
