// Read-only diagnosis. Do not display identities, tokens, or database contents.
(function () {
    'use strict';
    const set = (id, value) => { document.getElementById(`check-${id}`).textContent = value; };
    const state = { connected: false, http: false, auth: null, read: '' };
    function summarize() {
        document.getElementById('summary').textContent = state.connected
            ? state.auth === false ? '서버와 연결됐지만 이 창에는 로그인되어 있지 않습니다.'
                : state.read === 'denied' ? '서버 연결은 되지만 로그인 계정의 읽기 권한이 거부됐습니다.'
                : state.read === 'ok' ? '서버 연결과 로그인 후 읽기가 정상입니다. 구매 오류가 계속되면 저장 시점의 추가 오류 확인이 필요합니다.'
                : '서버 실시간 연결은 확인됐습니다. 로그인과 설정 읽기를 확인하고 있습니다.'
            : state.http ? 'HTTPS 응답은 받았지만 실시간 DB 연결은 아직 확인되지 않았습니다. 이 결과를 캡처해 주세요.'
                : '서버 연결이 확인되지 않았습니다. 위 항목의 결과를 캡처해 주세요.';
    }
    set('origin', location.origin);
    set('online', navigator.onLine ? '온라인 표시 (인터넷·Firebase 연결을 보장하지는 않음)' : '오프라인 표시');
    if (typeof firebase === 'undefined' || typeof db === 'undefined' || typeof auth === 'undefined') {
        set('sdk', '불러오기 또는 초기화 실패');
        document.getElementById('summary').textContent = 'Firebase 프로그램을 시작하지 못했습니다. Console의 첫 오류를 함께 확인해야 합니다.';
        return;
    }
    set('sdk', '초기화 완료');
    set('realtime', '연결 대기 중');
    const connection = db.ref('.info/connected');
    const changed = snapshot => {
        state.connected = snapshot.val() === true;
        set('realtime', state.connected ? '연결됨' : '연결되지 않음');
        summarize();
    };
    connection.on('value', changed, error => {
        set('realtime', `확인 실패: ${error.code || error.name || 'unknown'}`); summarize();
    });
    const stopAuth = auth.onAuthStateChanged(async user => {
        state.auth = !!user;
        set('auth', user ? '로그인됨' : '로그인 안 됨');
        if (!user) { set('read', '로그인 후 확인 가능'); summarize(); return; }
        set('read', '읽기 확인 중');
        let timer;
        try {
            await Promise.race([
                db.ref('settings/housingEnabled').once('value'),
                new Promise((_, reject) => { timer = setTimeout(() => reject({ code: 'timeout' }), 12000); })
            ]);
            state.read = 'ok'; set('read', '읽기 성공');
        } catch (error) {
            state.read = /permission/i.test(error.code || '') ? 'denied' : 'failed';
            set('read', `읽기 확인 실패: ${error.code || error.name || 'unknown'}`);
        } finally { clearTimeout(timer); summarize(); }
    });
    const controller = new AbortController();
    const httpTimer = setTimeout(() => controller.abort(), 12000);
    set('https', '응답 확인 중');
    // Public display metadata only. A 401 also establishes that HTTPS reached the server.
    fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/blackboardDisplay/publishedAt.json`, {
        signal: controller.signal, cache: 'no-store', credentials: 'omit'
    }).then(response => {
        state.http = true;
        set('https', `서버 응답 수신: HTTP ${response.status}${response.status === 401 ? ' (공개 읽기 제한)' : ''}`);
    }).catch(error => {
        set('https', error.name === 'AbortError' ? '12초 내 응답 확인 불가' : `응답 확인 실패: ${error.name || 'unknown'}`);
    }).finally(() => { clearTimeout(httpTimer); summarize(); });
    window.addEventListener('pagehide', () => {
        connection.off('value', changed); stopAuth(); controller.abort(); clearTimeout(httpTimer);
    }, { once: true });
})();
