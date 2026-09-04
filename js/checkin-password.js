// Daily password writes belong to the teacher; other windows only read.
(function (root) {
    'use strict';
    const core = root.CheckinPasswordCore;
    const AUTO_ROTATION_ENABLED = false;
    const STABLE_MS = 3000;
    let offset = 0, connected = false, signedIn = false, writer = false, offsetReady = false;
    let connectedAt = 0, retryAt = 0, failures = 0, blocked = false, generation = 0;
    let timer, pending, latestSettings = null, lastPublished = '', lastError = '';
    const fingerprint = settings => JSON.stringify(core.forDisplay(settings));
    const now = () => Date.now() + offset;
    const available = () => signedIn && connected && offsetReady && latestSettings !== null;
    const canWrite = () => available() && writer && !blocked && Date.now() >= connectedAt + STABLE_MS;
    function unavailable(message = 'Firebase 연결이 안정된 뒤 다시 시도해 주세요.') {
        const error = new Error(message); error.code = 'checkin/unavailable'; return error;
    }
    function status(message) {
        const element = document.getElementById('checkin-password-status');
        if (element) element.textContent = message;
    }
    function randomInt(limit) {
        const range = 4294967296 - (4294967296 % limit);
        const bytes = new Uint32Array(1);
        do { root.crypto.getRandomValues(bytes); } while (bytes[0] >= range);
        return bytes[0] % limit;
    }
    function schedule() {
        clearTimeout(timer);
        if (!available() || !writer || blocked) return;
        const wait = Math.max(connectedAt + STABLE_MS, retryAt) - Date.now();
        timer = setTimeout(refresh, wait > 0 ? wait : core.untilMidnight(now()) + 25);
    }
    function recordFailure(error) {
        const code = String(error?.code || error?.message || 'unknown');
        failures += 1;
        retryAt = Date.now() + Math.min(
    3000 * (2 ** Math.min(failures - 1, 3)),
    30000
);
        blocked = /permission|denied|unauthorized/i.test(code);
        status(
    blocked
        ? '암호 저장 권한이 없습니다. 관리자 계정으로 다시 로그인해 주세요.'
        : '암호 동기화를 다시 시도하고 있습니다…'
);
        // Report a changed failure once; don't print the same stack on every reconnect.
        if (lastError !== code) console.warn('등교 암호 갱신 대기:', code);
        lastError = code;
    }
    async function ensureCurrent() {
        if (!available()) throw unavailable();
        const session = generation;
        if (!writer) {
            const snapshot = await db.ref('settings').once('value');
            if (session !== generation || !available()) throw unavailable();
            const settings = snapshot.val() || {};
            if (!core.valid(settings.password) || settings.passwordDate !== core.today(now())) {
                throw unavailable('오늘의 등교 암호가 아직 준비되지 않았습니다. 선생님께 확인해 주세요.');
            }
            return settings;
        }
        if (!canWrite()) throw unavailable();
        return core.ensureCurrent(db, now, randomInt, () => session === generation && canWrite());
    }
    async function publish(settings) {
        const session = generation;
        if (!canWrite()) throw unavailable();
        await core.publish(db, settings, () => session === generation && canWrite());
    }
    function refresh() {
        if (!AUTO_ROTATION_ENABLED) return Promise.resolve();
        if (!available() || !writer || blocked) return Promise.resolve();
        if (pending) return pending;
        if (Date.now() < Math.max(connectedAt + STABLE_MS, retryAt)) { schedule(); return Promise.resolve(); }
        const current = latestSettings;
        const isCurrent = core.valid(current?.password) && current.passwordDate === core.today(now());
        if (isCurrent && fingerprint(current) === lastPublished) { schedule(); return Promise.resolve(); }
        const session = generation;
        const job = Promise.resolve().then(async () => {
            if (session !== generation || !canWrite()) return;
            const settings = isCurrent ? current : await ensureCurrent();
            if (session !== generation || !canWrite()) return;
            const key = fingerprint(settings);
            if (key !== lastPublished) await publish(settings);
            if (session !== generation) return;
            lastPublished = key; failures = 0; retryAt = 0; lastError = '';
            updateInput(latestSettings || settings);
        }).catch(error => {
            if (session === generation) recordFailure(error);
        }).finally(() => {
            if (pending === job) pending = null;
            schedule();
        });
        pending = job;
        return job;
    }
    function updateInput(settings) {
        const input = document.getElementById('conf-pass');
        if (!input) return;
        const edited = input.dataset.savedPassword !== undefined && input.value !== input.dataset.savedPassword;
        if (!edited) {
            input.value = String(settings.password || '');
            input.dataset.savedPassword = String(settings.password || '');
        }
        if (lastError) return;
        status(settings.passwordDate === core.today(now())
            ? '수동 갱신 모드 · 시스템 저장을 누르면 전자칠판에도 적용됩니다.'
            : writer ? '오늘의 등교 암호를 입력하고 시스템 저장을 눌러주세요.' : '선생님이 오늘의 등교 암호를 준비하고 있습니다.');
    }
    root.CheckinPassword = { now, randomInt, ensureCurrent, refresh, updateInput, publish };
    db.ref('.info/serverTimeOffset').on('value', snapshot => {
        offset = Number(snapshot.val()) || 0; offsetReady = true; refresh();
    });
    db.ref('.info/connected').on('value', snapshot => {
        if (!AUTO_ROTATION_ENABLED) return;
        const next = snapshot.val() === true;
        if (next && !connected) connectedAt = Date.now();
        connected = next;
        // Reconnect never resets the failure backoff.
        if (connected) refresh(); else {
            clearTimeout(timer);
            status('Firebase 연결을 기다리고 있습니다. 연결 전에는 암호를 변경하지 않습니다.');
        }
    });
    let stopSettings = () => {};
    auth.onAuthStateChanged(user => {
        stopSettings(); generation += 1; signedIn = !!user; clearTimeout(timer);
        writer = !!user && typeof adminEmail !== 'undefined' &&
            String(user.email || '').trim().toLowerCase() === String(adminEmail || '').trim().toLowerCase();
        latestSettings = null; lastPublished = ''; failures = 0; retryAt = 0; blocked = false; lastError = '';
        if (!user) return;
        const session = generation;
        const ref = db.ref('settings');
        const receive = snapshot => {
            if (session !== generation) return;
            latestSettings = snapshot.val() || {};
            updateInput(latestSettings); refresh();
        };
        ref.on('value', receive, error => {
            if (session === generation && AUTO_ROTATION_ENABLED) recordFailure(error);
        });
        stopSettings = () => ref.off('value', receive);
        refresh();
    });
    // Local clock check only: no request before readiness, while disconnected or in backoff.
    setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refresh();
    });
    root.addEventListener('focus', refresh);
    root.addEventListener('pageshow', refresh);
})(window);
