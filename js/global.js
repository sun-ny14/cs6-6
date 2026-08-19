// js/global.js
// 공통으로 사용되는 유틸리티 함수 모음

function getTodayKST() { 
    const now = new Date(); 
    const krTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); 
    return krTime.getUTCFullYear() + "-" + String(krTime.getUTCMonth() + 1).padStart(2, '0') + "-" + String(krTime.getUTCDate()).padStart(2, '0'); 
}

function forceScreenDisplay(status) {
    const load = document.getElementById('loading-screen'), login = document.getElementById('login-screen'), app = document.getElementById('main-app');
    if(load) load.style.display = 'none';
    if(status === 'app') { if(login) login.style.display = 'none'; if(app) app.style.display = 'block'; }
    else { if(login) login.style.display = 'flex'; if(app) app.style.display = 'none'; }
}

function showTab(t) { 
    currentTab = t; 
    sessionStorage.setItem('activeTab', t); 
    
    document.querySelectorAll('.tab-content').forEach(s => {
        s.classList.remove('active');
        s.style.display = ''; 
    }); 
    
    document.querySelectorAll('.tab-menu button').forEach(b => b.classList.remove('active')); 
    document.getElementById('tab-'+t).classList.add('active'); 
    if(document.getElementById('btn-'+t)) document.getElementById('btn-'+t).classList.add('active'); 
    
    if(t==='points') loadMyLogs(); 
    if(t==='logs') renderCheckinBoard(); 
}

function openPopup(t,h,r=false) { 
    document.getElementById('pop-title').innerHTML=t; 
    document.getElementById('pop-content').innerHTML=h; 
    document.getElementById('common-overlay').style.display='flex'; 
    window.routineActive=r; 
}

function closePopup() { 
    if(window.routineActive && ++rIdx < routineItems.length) {
        document.getElementById('pop-content').innerText = `[루틴 ${rIdx+1}단계]\n${routineItems[rIdx]}`; 
    } else { 
        document.getElementById('common-overlay').style.display='none'; 
        rIdx = 0; 
    } 
}

function getAvatar(lv, selectedAnimal) {
    return "";
}
