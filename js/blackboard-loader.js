// js/blackboard-loader.js
// blackboard.html에 있던 인라인 <script>를 분리했습니다. CSP가 인라인 스크립트를
// 막는 환경(nonce/hash 기반 정책)에서도 동작하도록 외부 파일로 둡니다.
//
// blackboard-share.js는 전자칠판이 Firebase 자료를 받아오는 데 필요한 핵심
// 스크립트라, 로드에 실패하면 전자칠판이 그냥 "불러오는 중" 상태로 멈춰버린다.
// 예전엔 무조건 1.2초를 기다렸다가 에러 처리 없이 한 번만 끼워 넣어서, 그 사이
// 네트워크가 느리거나 실패하면 조용히 멈췄다. 이제 곧바로 불러오고, 실패하면
// 간격을 늘려가며 다시 시도한다.
(function () {
    'use strict';
    const SRC = 'js/blackboard-share.js?v=20261005-share-shared-users-1';
    let attempt = 0;

    function load() {
        const publisher = document.createElement('script');
        publisher.src = SRC;
        publisher.onerror = function () {
            publisher.remove();
            attempt += 1;
            const delay = Math.min(1500 * attempt, 15000);
            console.warn(`전자칠판 자료 연결 스크립트 로드 실패, ${delay}ms 후 재시도합니다.`);
            window.setTimeout(load, delay);
        };
        document.body.appendChild(publisher);
    }

    load();
})();
