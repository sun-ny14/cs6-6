// Shared by the browser and the scheduled function. No credentials are stored here.
(function (root) {
    'use strict';
    const DAY = 86400000;
    const KST = 9 * 3600000;
    const valid = value => /^\d{4}$/.test(String(value ?? ''));
    const today = timestamp => new Date(timestamp + KST).toISOString().slice(0, 10);
    const revision = value => Math.max(0, Number.isSafeInteger(value) ? value : 0);

    function generate(previous, randomInt) {
        const old = Number(previous);
        const exclude = valid(previous) && old >= 1000 && old <= 9999;
        let value = 1000 + randomInt(exclude ? 8999 : 9000);
        if (exclude && value >= old) value += 1;
        return String(value);
    }

    function rotate(current, timestamp, randomInt) {
        const settings = current || {};
        const day = today(timestamp);
        if (valid(settings.password) && /^\d{4}-\d{2}-\d{2}$/.test(settings.passwordDate || '') && settings.passwordDate >= day) return;
        return { ...settings, password: generate(settings.password, randomInt),
            passwordDate: day, passwordRevision: revision(settings.passwordRevision) + 1,
            passwordUpdatedAt: timestamp };
    }

    function manual(current, password, timestamp) {
        if (!valid(password)) throw new Error('등교 암호는 숫자 4자리로 입력해 주세요.');
        const settings = current || {};
        if (settings.passwordDate > today(timestamp)) throw new Error('시간 동기화 후 다시 저장해 주세요.');
        return { ...settings, password: String(password), passwordDate: today(timestamp),
            passwordRevision: revision(settings.passwordRevision) + 1, passwordUpdatedAt: timestamp };
    }

    function forDisplay(settings) {
        if (!valid(settings?.password) || !/^\d{4}-\d{2}-\d{2}$/.test(settings?.passwordDate || '')) return null;
        return { password: String(settings.password), date: settings.passwordDate,
            revision: revision(settings.passwordRevision), updatedAt: Number(settings.passwordUpdatedAt) || 0 };
    }

    function newerDisplay(current, incoming) {
        if (!incoming) return;
        if (current?.date > incoming.date) return;
        if (current?.date === incoming.date && revision(current.revision) >= incoming.revision) return;
        return incoming;
    }

    async function publish(database, settings, canWrite = () => true) {
        const incoming = forDisplay(settings);
        if (!incoming) return;
        if (!canWrite()) throw new Error('checkin/unavailable');
        // A sibling of data, so normal board publications cannot overwrite this value.
        await database.ref('blackboardDisplay/checkinPassword')
            .transaction(current => canWrite() ? newerDisplay(current, incoming) : undefined, undefined, false);
        if (!canWrite()) throw new Error('checkin/unavailable');
    }

    async function ensureCurrent(database, now, randomInt, canWrite = () => true) {
        if (!canWrite()) throw new Error('checkin/unavailable');
        const ref = database.ref('settings');
        const snapshot = await ref.once('value');
        let settings = snapshot.val() || {};
        if (valid(settings.password) && settings.passwordDate === today(now())) return settings;
        if (!canWrite()) throw new Error('checkin/unavailable');
        const result = await ref.transaction(current => canWrite() ? rotate(current, now(), randomInt) : undefined, undefined, false);
        if (!canWrite()) throw new Error('checkin/unavailable');
        settings = result.snapshot.val() || {};
        if (!valid(settings.password) || settings.passwordDate !== today(now())) {
            throw new Error('오늘의 등교 암호를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
        return settings;
    }

    const api = { today, valid, generate, rotate, manual, forDisplay, newerDisplay, publish, ensureCurrent,
        untilMidnight: timestamp => DAY - ((timestamp + KST) % DAY) };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.CheckinPasswordCore = api;
})(typeof window !== 'undefined' ? window : null);
