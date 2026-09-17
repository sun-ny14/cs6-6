// js/blackboard-loader.js
// blackboard.html에 있던 인라인 <script>를 분리했습니다. CSP가 인라인 스크립트를
// 막는 환경(nonce/hash 기반 정책)에서도 동작하도록 외부 파일로 둡니다.
window.setTimeout(function () {
    const publisher = document.createElement('script');
    publisher.src = 'js/blackboard-share.js?v=20260914-attendance-split-1';
    document.body.appendChild(publisher);
}, 1200);
