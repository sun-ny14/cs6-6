// js/blackboard-clock-worker.js
// 전자칠판 탭이 백그라운드로 밀려나면(다른 창을 클릭해서 가려지는 등) 브라우저가
// 메인 스레드의 setInterval/setTimeout을 크게 늦춘다 — 그래서 마우스가 화면을
// 벗어나 있으면 시계와 교시 전환이 멈춰 보였다. Worker는 이 억제 대상이 아니라서
// 여기서 1초마다 틱을 만들어 메인 스레드로 보내고, 메인 스레드는 그 신호를 받을
// 때만 다시 그린다.
setInterval(() => postMessage('tick'), 1000);
