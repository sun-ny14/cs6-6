// js/main.js - 용사들 탭 메인 화면 및 메이플스토리 감성 카드 렌더링 통합 파일

window.loadUsers = function() {
    db.ref('users').once('value').then(snap => {
        let users = []; 
        snap.forEach(c => { 
            let u = c.val() || {}; 
            u.name = c.key; 
            users.push(u); 
        });
        
        // 💡 [핵심 차별점] 학생 계정(로그인한 본인)일 경우, 무조건 배열의 맨 앞으로 끌어올립니다!
        // 관리자(선생님)일 경우는 기존 번호순(no) 또는 이름순으로 정렬합니다.
        currentUsers = users.sort((a, b) => {
            if (typeof myName !== 'undefined' && myName) {
                if (a.name === myName) return -1; // 내 카드를 최상단으로
                if (b.name === myName) return 1;
            }
            return (a.no || 99) - (b.no || 99);
        });
        
        let h = ""; 
        currentUsers.forEach(u => { 
            if (u.name === "총사령관") return; 
            
            const isMe = (typeof myName !== 'undefined' && u.name === myName);
            const title = u.selectedAnimal ? `${u.selectedAnimal} ` : "";
            
            // 메이플 감성 아바타 불러오기
            const avatarHtml = (typeof window.getAvatar === 'function') 
                ? window.getAvatar(u.lv || 1, u.selectedAnimal) 
                : `<div style="width:100%; height:100%; background:#ddd; border-radius:50%;"></div>`;
            
            // 💡 [디자인 차별점] 내 카드일 경우 황금빛 테두리와 배경, 'MY' 배지로 특별하게 강조
            const cardBg = isMe ? '#fffdf0' : '#ffffff';
            const cardBorder = isMe ? '3px solid #f1c40f' : '2px solid #e0e0e0';
            const shadowStyle = isMe ? '0 6px 15px rgba(241, 196, 15, 0.3)' : '0 3px 8px rgba(0,0,0,0.08)';

            h += `
                <div class="hero-card" onclick="openUserHistory('${u.name}')" 
                     style="background-color: ${cardBg} !important; 
                            border: ${cardBorder} !important; 
                            border-radius: 16px !important; 
                            padding: 22px 15px !important; 
                            box-shadow: ${shadowStyle} !important; 
                            display: flex !important; 
                            flex-direction: column !important; 
                            align-items: center !important; 
                            cursor: pointer !important;
                            position: relative !important;
                            box-sizing: border-box !important;
                            transition: transform 0.2s ease, box-shadow 0.2s ease;"
                            onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.12)'"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='${shadowStyle}'">
                    
                    ${isMe ? '<div style="position: absolute; top: 12px; right: 15px; background: #f1c40f; color: #fff; font-size: 0.8rem; font-weight: bold; padding: 3px 8px; border-radius: 20px;">MY</div>' : ''}
                    
                    <div style="width: 110px !important; height: 110px !important; min-width: 110px !important; min-height: 110px !important; margin-bottom: 12px !important; display: flex !important; justify-content: center !important; align-items: center !important; border-radius: 50% !important; background-color: #f8f9fa !important; border: 2px solid #eee !important; overflow: hidden !important;">
                        ${avatarHtml}
                    </div>
                    
                    <span style="font-size: 1rem !important; color: #7f8c8d !important; font-weight: bold !important; margin-bottom: 4px !important;">${title}</span>
                    <b style="font-size: 1.3rem !important; color: #2c3e50 !important; margin-bottom: 8px !important; text-align: center !important;">
                        ${isMe ? '⭐ ' : ''}LV.${u.lv || 1} ${u.name}
                    </b>
                    <span style="color: #3498db !important; font-weight: bold !important; font-size: 1.2rem !important; background: #ebf5fb !important; padding: 4px 12px !important; border-radius: 20px !important;">💰 ${u.points || 0}P</span>
                </div>`; 
        }); 
        
        const gridEl = document.getElementById('hero-grid');
        if (gridEl) {
            gridEl.style.display = 'grid';
            gridEl.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
            gridEl.style.gap = '20px';
            gridEl.style.padding = '10px';
            gridEl.style.backgroundColor = 'transparent'; 
            gridEl.innerHTML = h;
        }
    });
};

// 앱 초기화 시 자동으로 loadUsers 실행 보장
document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadUsers === 'function') loadUsers();
});