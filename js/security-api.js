(function () {
    'use strict';
    window.isVerifiedAdmin = () => Boolean(auth.currentUser?.emailVerified &&
        auth.currentUser.email === 'ksosuny@cberi.go.kr' &&
        auth.currentUser.providerData.some(p => p.providerId === 'google.com'));
    const call = firebase.app().functions('asia-northeast3').httpsCallable('studentAction');
    const migrate = firebase.app().functions('asia-northeast3').httpsCallable('migratePublicData');
    window.migratePublicDataOnce=()=>migrate({}).then(result=>result.data);
    const running = new Map();
    window.secureStudentAction = function (action, data = {}) {
        const uid = auth.currentUser?.uid;
        if (!uid) return Promise.reject(new Error('다시 로그인해 주세요.'));
        const signature = JSON.stringify([uid,action,data]);
        if (running.has(signature)) return running.get(signature);
        const storageKey = `secure-request:${signature}`;
        let requestId;
        try { requestId = localStorage.getItem(storageKey); } catch (_) {}
        requestId ||= crypto.randomUUID();
        // Persist before sending: an uncertain network result can reuse its receipt after a reload.
        try { localStorage.setItem(storageKey,requestId); }
        catch (_) { return Promise.reject(new Error('중복 구매 방지를 위해 브라우저 저장소 사용을 허용해 주세요.')); }
        const job = call({ ...data,action,requestId }).then(result => {
            localStorage.removeItem(storageKey);
            return result.data;
        }).catch(error => {
            if (!/unavailable|deadline-exceeded|internal|unknown|cancelled/.test(error.code || 'unknown')) localStorage.removeItem(storageKey);
            throw error;
        }).finally(() => running.delete(signature));
        running.set(signature,job);
        return job;
    };
})();
