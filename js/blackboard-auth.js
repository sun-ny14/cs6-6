(function () {
    'use strict';
    const limit = 30 * 60 * 1000;
    let lastActivity = Date.now();
    let signingOut = false;
    auth.onAuthStateChanged(() => { lastActivity = Date.now(); });
    async function expire() {
        if (!auth.currentUser || signingOut || Date.now() - lastActivity < limit) return;
        signingOut = true;
        try { await auth.signOut(); }
        catch (error) { console.error('전자칠판 자동 로그아웃 실패:', error.code); }
        finally { signingOut = false; }
    }
    for (const event of ['pointerdown', 'keydown', 'input']) {
        document.addEventListener(event, () => {
            if (auth.currentUser && Date.now() - lastActivity >= limit) expire();
            else lastActivity = Date.now();
        }, { passive: true });
    }
    setInterval(expire, 15000);
    document.addEventListener('visibilitychange', expire);
})();
