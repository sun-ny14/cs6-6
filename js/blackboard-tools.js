// js/blackboard-tools.js - 전자칠판 하단 도구모음: 타이머 / 번호 뽑기 / 소음 측정기 / QR 코드
// 전자칠판 페이지는 로그인 없이 켜두는 화면이라, 이 도구들은 Firebase 데이터를
// 전혀 쓰지 않고 그 기기 안에서만 동작한다 (번호 뽑기도 이름이 아니라 번호만 사용).
(function(){
    'use strict';

    function injectStyles(){
        const style = document.createElement('style');
        style.textContent = `
            #bb-toolbar{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:14px;padding:16px;background:rgba(255,255,255,.9);backdrop-filter:blur(6px);box-shadow:0 -8px 30px rgba(24,40,68,.12);z-index:900;flex-wrap:wrap;transition:transform .25s ease;}
            /* 손잡이는 도구모음의 자식으로 둬서, 접었다 펼 때 도구모음과 같이
               움직인다(접히면 화면 아래로 내려갔다가 딱 화면 하단에 걸린다). */
            #bb-toolbar-handle{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:8px 18px;border:0;border-radius:999px 999px 0 0;background:#182844;color:#fff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 -4px 14px rgba(24,40,68,.2);z-index:901;font-family:inherit;pointer-events:auto;}
            #bb-toolbar-handle .bb-handle-arrow{display:inline-block;transition:transform .25s ease;}
            body.bb-tools-collapsed #bb-toolbar{transform:translateY(100%);}
            body.bb-tools-collapsed #bb-toolbar .bb-tool-btn{visibility:hidden;}
            body.bb-tools-collapsed #bb-toolbar-handle .bb-handle-arrow{transform:rotate(180deg);}
            .bb-tool-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 22px;border:0;border-radius:16px;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 6px 16px rgba(24,40,68,.25);font-family:inherit;}
            .bb-tool-btn .bb-emoji{font-size:26px;}
            #bb-tool-timer-btn{background:#3498db;}
            #bb-tool-stopwatch-btn{background:#e74c3c;}
            #bb-tool-picker-btn{background:#8e44ad;}
            #bb-tool-noise-btn{background:#f39c12;}
            #bb-tool-qr-btn{background:#27ae60;}

            /* 모서리를 끌어서 선생님이 원하는 크기로 직접 조절할 수 있다.
               (QR코드처럼 멀리서 봐야 하는 창은 크게, 간단한 건 작게) */
            .bb-float-win{position:fixed;width:420px;min-width:320px;min-height:260px;max-width:90vw;max-height:85vh;background:#fff;border-radius:20px;box-shadow:0 20px 50px rgba(24,40,68,.3);overflow:auto;resize:both;z-index:950;display:none;}
            .bb-float-win.show{display:block;}
            .bb-float-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#182844;color:#fff;font-weight:900;font-size:17px;cursor:move;user-select:none;position:sticky;top:0;z-index:1;}
            .bb-float-close{width:34px;height:34px;border:0;border-radius:10px;background:rgba(255,255,255,.15);color:#fff;font-weight:900;cursor:pointer;font-size:16px;flex:none;}
            .bb-float-body{padding:30px;text-align:center;color:#182844;font-family:"Pretendard","Noto Sans KR","Segoe UI",sans-serif;}

            .bb-timer-display{font-size:68px;font-weight:950;font-variant-numeric:tabular-nums;color:#3498db;margin-bottom:16px;}
            .bb-timer-presets{display:flex;gap:6px;justify-content:center;margin-bottom:12px;flex-wrap:wrap;}
            .bb-timer-presets button{padding:9px 16px;border:2px solid #3498db;border-radius:999px;background:#fff;color:#3498db;font-weight:800;cursor:pointer;font-size:15px;}
            .bb-timer-presets button.active{background:#3498db;color:#fff;}
            .bb-timer-custom{display:flex;gap:8px;align-items:center;justify-content:center;margin:0 0 16px;padding:12px;border-radius:14px;background:#f2f6fb;flex-wrap:wrap;}
            .bb-timer-custom input{width:56px;padding:8px;border:2px solid #dfe6f0;border-radius:10px;text-align:center;font-size:16px;font-weight:800;font-family:inherit;}
            .bb-timer-custom span{font-weight:800;color:#40525f;font-size:14px;}
            .bb-timer-custom button{padding:9px 16px;border:0;border-radius:10px;background:#3498db;color:#fff;font-weight:900;font-size:14px;cursor:pointer;}
            .bb-timer-controls{display:flex;gap:8px;justify-content:center;}
            .bb-timer-controls button{padding:13px 22px;border:0;border-radius:12px;font-weight:900;font-size:16px;cursor:pointer;}
            .bb-tc-start{background:#27ae60;color:#fff;}
            .bb-tc-reset{background:#eef1f6;color:#182844;}

            .bb-stopwatch-display{font-size:60px;font-weight:950;font-variant-numeric:tabular-nums;color:#e74c3c;margin-bottom:14px;}
            .bb-stopwatch-controls{display:flex;gap:10px;justify-content:center;margin-bottom:16px;}
            .bb-stopwatch-controls button{padding:12px 18px;border:0;border-radius:12px;font-weight:900;font-size:15px;cursor:pointer;}
            .bb-sw-start{background:#27ae60;color:#fff;}
            .bb-sw-lap{background:#eef1f6;color:#182844;}
            .bb-sw-reset{background:#eef1f6;color:#182844;}
            .bb-stopwatch-laps{max-height:140px;overflow-y:auto;text-align:left;font-size:15px;font-weight:700;color:#40525f;}
            .bb-stopwatch-laps div{display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px dashed #eef1f6;}

            .bb-picker-reveal{font-size:56px;font-weight:950;margin:6px 0 18px;padding:26px;border-radius:18px;background:linear-gradient(135deg,#fdf0d5,#ffe6b3);color:#7a4b00;}
            .bb-picker-btn{padding:16px 30px;border:0;border-radius:16px;background:#8e44ad;color:#fff;font-weight:900;font-size:18px;cursor:pointer;margin-bottom:14px;width:100%;}
            .bb-picker-setup{display:flex;gap:8px;align-items:center;justify-content:center;margin-bottom:14px;font-size:15px;font-weight:800;}
            .bb-picker-setup input{width:70px;padding:8px;border:1px solid #dfe6f0;border-radius:10px;text-align:center;font-size:15px;}
            .bb-picker-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;max-height:200px;overflow-y:auto;margin-bottom:10px;}
            .bb-picker-num{padding:10px 0;border-radius:10px;border:1px solid #dfe6f0;background:#fff;font-size:14px;font-weight:800;cursor:pointer;color:#182844;}
            .bb-picker-num.excluded{background:#f4f1f8;color:#c3c9d6;text-decoration:line-through;}
            .bb-picker-hint{font-size:13px;color:#8a94a8;font-weight:700;}

            .bb-db-toggle{display:inline-flex;border-radius:999px;background:#eef1f6;padding:5px;margin-bottom:20px;}
            .bb-db-toggle button{padding:8px 18px;border:0;border-radius:999px;background:transparent;font-weight:800;color:#8a94a8;cursor:pointer;font-size:14px;}
            .bb-db-toggle button.active{background:#f39c12;color:#fff;}
            .bb-db-number{font-size:56px;font-weight:950;color:#f39c12;}
            .bb-db-bar-track{height:20px;border-radius:999px;background:#eef1f6;overflow:hidden;margin-top:14px;}
            .bb-db-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#27ae60,#f39c12,#e74c3c);transition:width .15s ease;}
            .bb-db-light-view{display:none;}
            .bb-db-light-view .bb-light{width:120px;height:120px;border-radius:50%;margin:0 auto 14px;background:#27ae60;box-shadow:0 0 50px rgba(39,174,96,.5);transition:background .2s ease, box-shadow .2s ease;}
            .bb-db-light-label{font-size:19px;font-weight:900;color:#27ae60;}
            .bb-db-hint{font-size:13px;color:#8a94a8;font-weight:700;margin-top:14px;}

            .bb-qr-input{width:100%;box-sizing:border-box;padding:14px;border:2px solid #dfe6f0;border-radius:12px;font-size:16px;margin-bottom:14px;}
            .bb-qr-generate{padding:14px 20px;border:0;border-radius:14px;background:#27ae60;color:#fff;font-weight:900;font-size:16px;cursor:pointer;margin-bottom:18px;width:100%;}
            /* 창을 크게 조절하면(학생들이 멀리서 걸어와 찍어야 할 때) QR 이미지도
               같이 커지게 고정 크기 대신 창 너비에 맞춘다. */
            .bb-qr-image{width:100%;max-width:440px;aspect-ratio:1/1;border:8px solid #fff;box-shadow:0 10px 30px rgba(24,40,68,.25);border-radius:16px;display:none;}
            .bb-qr-copy{margin-top:18px;padding:11px 20px;border:2px solid #27ae60;border-radius:14px;background:#fff;color:#27ae60;font-weight:900;font-size:15px;cursor:pointer;}

            @media(max-width:640px){
                .bb-tool-btn{padding:8px 14px;font-size:12px;}
                .bb-tool-btn .bb-emoji{font-size:20px;}
                .bb-float-win{width:min(92vw,420px);}
            }
        `;
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------
    // 플로팅 창 공통
    // ---------------------------------------------------------
    let openCount = 0;
    function createFloatWindow(id, title, bodyHtml){
        const win = document.createElement('div');
        win.className = 'bb-float-win';
        win.id = id;
        win.innerHTML = `
            <div class="bb-float-head" data-drag-handle>
                <span>${title}</span>
                <button class="bb-float-close" type="button">✕</button>
            </div>
            <div class="bb-float-body">${bodyHtml}</div>
        `;
        document.body.appendChild(win);

        const head = win.querySelector('[data-drag-handle]');
        let dragging = false, offX = 0, offY = 0;
        head.addEventListener('mousedown', event => {
            dragging = true;
            offX = event.clientX - win.offsetLeft;
            offY = event.clientY - win.offsetTop;
        });
        document.addEventListener('mousemove', event => {
            if (!dragging) return;
            // 창이 화면 밖으로 끌려나가 안 보이는 곳에 갇히지 않도록, 보이는
            // 화면 영역 안에서만 움직이게 가로/세로 둘 다 최대값도 함께 막는다.
            const maxLeft = Math.max(0, window.innerWidth - win.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - win.offsetHeight);
            win.style.left = Math.min(maxLeft, Math.max(0, event.clientX - offX)) + 'px';
            win.style.top = Math.min(maxTop, Math.max(0, event.clientY - offY)) + 'px';
        });
        document.addEventListener('mouseup', () => { dragging = false; });

        win.querySelector('.bb-float-close').addEventListener('click', () => {
            win.classList.remove('show');
        });
        return win;
    }

    function openWindow(win){
        if (!win.classList.contains('show')){
            openCount += 1;
            const offset = (openCount % 5) * 24;
            win.classList.add('show');
            const maxLeft = Math.max(0, window.innerWidth - win.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - win.offsetHeight);
            win.style.top = Math.min(maxTop, 70 + offset) + 'px';
            win.style.left = Math.min(maxLeft, 70 + offset) + 'px';
            return;
        }
        win.classList.add('show');
    }

    // ---------------------------------------------------------
    // 타이머
    // ---------------------------------------------------------
    // 타이머/번호뽑기 효과음은 전부 Web Audio로 직접 만든다(음원 파일 없이,
    // 이 기기 안에서만 재생).
    function playTone(ctx, freq, startAt, dur, peak){
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.001, startAt);
        gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
        osc.start(startAt);
        osc.stop(startAt + dur + 0.02);
    }

    function setupTimer(){
        const win = createFloatWindow('bb-win-timer', '⏱️ 타이머', `
            <div class="bb-timer-display" id="bb-timer-display">05:00</div>
            <div class="bb-timer-presets">
                <button type="button" data-secs="60">1분</button>
                <button type="button" data-secs="180">3분</button>
                <button type="button" data-secs="300" class="active">5분</button>
                <button type="button" data-secs="600">10분</button>
            </div>
            <div class="bb-timer-custom">
                <input type="number" id="bb-timer-custom-min" min="0" max="99" value="0" aria-label="분"><span>분</span>
                <input type="number" id="bb-timer-custom-sec" min="0" max="59" value="0" aria-label="초"><span>초</span>
                <button type="button" id="bb-timer-custom-apply">적용</button>
            </div>
            <div class="bb-timer-controls">
                <button type="button" class="bb-tc-start" id="bb-timer-toggle">▶ 시작</button>
                <button type="button" class="bb-tc-reset" id="bb-timer-reset">↺ 초기화</button>
            </div>
        `);

        let totalSecs = 300, remaining = 300, tickHandle = null;
        const display = win.querySelector('#bb-timer-display');
        const toggleBtn = win.querySelector('#bb-timer-toggle');
        const customMin = win.querySelector('#bb-timer-custom-min');
        const customSec = win.querySelector('#bb-timer-custom-sec');

        function format(secs){
            const m = Math.floor(secs / 60), s = secs % 60;
            return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }
        function renderTime(){ display.textContent = format(Math.max(0, remaining)); }

        function beep(){
            try{
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                [0, 300, 600].forEach(delay => playTone(ctx, 880, ctx.currentTime + delay / 1000, 0.25, 0.3));
            }catch(error){ console.warn('타이머 종료음 재생 실패:', error); }
        }

        // 남은 시간 10초부터 매초 짧은 틱 소리로 임박했음을 알린다.
        function tick10Warn(){
            try{
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                playTone(ctx, 1200, ctx.currentTime, 0.08, 0.2);
            }catch(error){ console.warn('타이머 임박음 재생 실패:', error); }
        }

        function stopTick(){ if (tickHandle){ clearInterval(tickHandle); tickHandle = null; } }
        function start(){
            if (tickHandle || remaining <= 0) return;
            toggleBtn.textContent = '⏸ 일시정지';
            tickHandle = setInterval(() => {
                remaining -= 1;
                renderTime();
                if (remaining <= 0){
                    stopTick();
                    toggleBtn.textContent = '▶ 시작';
                    beep();
                }else if (remaining <= 10){
                    tick10Warn();
                }
            }, 1000);
        }
        function pause(){ stopTick(); toggleBtn.textContent = '▶ 시작'; }

        function setTotal(secs){
            win.querySelectorAll('.bb-timer-presets button').forEach(b => b.classList.remove('active'));
            pause();
            totalSecs = Math.max(1, secs);
            remaining = totalSecs;
            renderTime();
        }

        toggleBtn.addEventListener('click', () => { tickHandle ? pause() : start(); });
        win.querySelector('#bb-timer-reset').addEventListener('click', () => {
            pause(); remaining = totalSecs; renderTime();
        });
        win.querySelectorAll('.bb-timer-presets button').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.add('active');
                setTotal(parseInt(btn.dataset.secs, 10) || 300);
            });
        });
        win.querySelector('#bb-timer-custom-apply').addEventListener('click', () => {
            const mins = Math.max(0, Math.min(99, parseInt(customMin.value, 10) || 0));
            const secs = Math.max(0, Math.min(59, parseInt(customSec.value, 10) || 0));
            const total = mins * 60 + secs;
            if (total <= 0) return;
            setTotal(total);
        });

        document.getElementById('bb-tool-timer-btn').addEventListener('click', () => openWindow(win));
    }

    // ---------------------------------------------------------
    // 스톱워치 (발표·활동 시간 재기, 기록 남기기)
    // ---------------------------------------------------------
    function setupStopwatch(){
        const win = createFloatWindow('bb-win-stopwatch', '⏳ 스톱워치', `
            <div class="bb-stopwatch-display" id="bb-sw-display">00:00.0</div>
            <div class="bb-stopwatch-controls">
                <button type="button" class="bb-sw-start" id="bb-sw-toggle">▶ 시작</button>
                <button type="button" class="bb-sw-lap" id="bb-sw-lap">⚑ 기록</button>
                <button type="button" class="bb-sw-reset" id="bb-sw-reset">↺ 초기화</button>
            </div>
            <div class="bb-stopwatch-laps" id="bb-sw-laps"></div>
        `);

        const display = win.querySelector('#bb-sw-display');
        const toggleBtn = win.querySelector('#bb-sw-toggle');
        const lapBtn = win.querySelector('#bb-sw-lap');
        const lapsEl = win.querySelector('#bb-sw-laps');

        let elapsedMs = 0, startedAt = 0, tickHandle = null, laps = [];

        function format(ms){
            const totalTenths = Math.floor(ms / 100);
            const tenths = totalTenths % 10;
            const totalSecs = Math.floor(totalTenths / 10);
            const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
            return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + tenths;
        }
        function renderTime(){ display.textContent = format(elapsedMs); }
        function renderLaps(){
            lapsEl.innerHTML = laps
                .map((ms, i) => `<div><span>${laps.length - i}번째</span><span>${format(ms)}</span></div>`)
                .join('');
        }

        function stopTick(){ if (tickHandle){ clearInterval(tickHandle); tickHandle = null; } }
        function start(){
            if (tickHandle) return;
            startedAt = Date.now() - elapsedMs;
            toggleBtn.textContent = '⏸ 정지';
            tickHandle = setInterval(() => {
                elapsedMs = Date.now() - startedAt;
                renderTime();
            }, 100);
        }
        function pause(){ stopTick(); toggleBtn.textContent = '▶ 시작'; }

        toggleBtn.addEventListener('click', () => { tickHandle ? pause() : start(); });
        lapBtn.addEventListener('click', () => {
            laps.unshift(elapsedMs);
            renderLaps();
        });
        win.querySelector('#bb-sw-reset').addEventListener('click', () => {
            pause();
            elapsedMs = 0;
            laps = [];
            renderTime();
            renderLaps();
        });

        document.getElementById('bb-tool-stopwatch-btn').addEventListener('click', () => openWindow(win));
    }

    // ---------------------------------------------------------
    // 번호 뽑기 (이름 대신 번호만 사용 — Firebase 접근 불필요)
    // ---------------------------------------------------------
    function playDrawSound(){
        try{
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            // 올라가는 3음 차임벨로 "짠!" 느낌을 낸다.
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                playTone(ctx, freq, ctx.currentTime + i * 0.09, 0.2, 0.25);
            });
        }catch(error){ console.warn('번호뽑기 효과음 재생 실패:', error); }
    }

    function setupPicker(){
        const win = createFloatWindow('bb-win-picker', '🎲 번호 뽑기', `
            <div class="bb-picker-reveal" id="bb-picker-reveal">?</div>
            <div class="bb-picker-setup">
                전체 인원 <input type="number" id="bb-picker-total" min="1" max="60">명
            </div>
            <div class="bb-picker-grid" id="bb-picker-grid"></div>
            <label class="bb-picker-hint"><input type="checkbox" id="bb-picker-auto-exclude" checked> 뽑힌 번호 자동 제외</label>
            <br><br>
            <button type="button" class="bb-picker-btn" id="bb-picker-draw">뽑기!</button>
        `);

        const STORAGE_KEY = 'bbPickerTotal';
        const totalInput = win.querySelector('#bb-picker-total');
        const grid = win.querySelector('#bb-picker-grid');
        const reveal = win.querySelector('#bb-picker-reveal');
        const autoExclude = win.querySelector('#bb-picker-auto-exclude');
        let excluded = new Set();

        function renderGrid(){
            const total = Math.max(1, Math.min(60, parseInt(totalInput.value, 10) || 25));
            let html = '';
            for (let i = 1; i <= total; i++){
                html += `<button type="button" class="bb-picker-num${excluded.has(i) ? ' excluded' : ''}" data-num="${i}">${i}</button>`;
            }
            grid.innerHTML = html;
            grid.querySelectorAll('.bb-picker-num').forEach(btn => {
                btn.addEventListener('click', () => {
                    const n = parseInt(btn.dataset.num, 10);
                    if (excluded.has(n)) excluded.delete(n); else excluded.add(n);
                    btn.classList.toggle('excluded');
                });
            });
        }

        try{
            const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
            totalInput.value = (Number.isFinite(saved) && saved > 0) ? saved : 25;
        }catch(error){ totalInput.value = 25; }

        totalInput.addEventListener('change', () => {
            excluded.clear();
            try{ localStorage.setItem(STORAGE_KEY, totalInput.value); }catch(error){}
            renderGrid();
        });

        win.querySelector('#bb-picker-draw').addEventListener('click', () => {
            const total = Math.max(1, Math.min(60, parseInt(totalInput.value, 10) || 25));
            const pool = [];
            for (let i = 1; i <= total; i++) if (!excluded.has(i)) pool.push(i);
            if (!pool.length){
                reveal.textContent = '뽑을 번호가 없어요';
                return;
            }
            const picked = pool[Math.floor(Math.random() * pool.length)];
            reveal.textContent = `🎉 ${picked}번`;
            playDrawSound();
            if (autoExclude.checked){
                excluded.add(picked);
                renderGrid();
            }
        });

        renderGrid();
        document.getElementById('bb-tool-picker-btn').addEventListener('click', () => openWindow(win));
    }

    // ---------------------------------------------------------
    // 소음 측정기 (마이크 권한은 이 창을 처음 열 때 한 번 요청)
    // ---------------------------------------------------------
    function setupNoise(){
        const win = createFloatWindow('bb-win-noise', '🔊 소음 측정기', `
            <div class="bb-db-toggle">
                <button type="button" class="active" data-mode="bar">숫자/막대</button>
                <button type="button" data-mode="light">신호등</button>
            </div>
            <div class="bb-db-bar-view">
                <div class="bb-db-number" id="bb-db-number">-</div>
                <div class="bb-db-bar-track"><div class="bb-db-bar-fill" id="bb-db-bar-fill"></div></div>
            </div>
            <div class="bb-db-light-view">
                <div class="bb-light" id="bb-db-light"></div>
                <div class="bb-db-light-label" id="bb-db-light-label">측정 대기 중</div>
            </div>
            <div class="bb-db-hint">이 창을 열면 마이크 사용 권한을 요청해요.</div>
        `);

        const numberEl = win.querySelector('#bb-db-number');
        const barFill = win.querySelector('#bb-db-bar-fill');
        const lightEl = win.querySelector('#bb-db-light');
        const lightLabel = win.querySelector('#bb-db-light-label');
        const barView = win.querySelector('.bb-db-bar-view');
        const lightView = win.querySelector('.bb-db-light-view');

        win.querySelectorAll('.bb-db-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                win.querySelectorAll('.bb-db-toggle button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const isBar = btn.dataset.mode === 'bar';
                barView.style.display = isBar ? 'block' : 'none';
                lightView.style.display = isBar ? 'none' : 'block';
            });
        });

        let analyser = null, dataArray = null, rafHandle = null, started = false;

        async function ensureMic(){
            if (started) return true;
            try{
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioCtx.createMediaStreamSource(stream);
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 1024;
                dataArray = new Uint8Array(analyser.frequencyBinCount);
                source.connect(analyser);
                started = true;
                return true;
            }catch(error){
                console.warn('마이크 접근 실패:', error);
                numberEl.textContent = '마이크 접근 실패';
                lightLabel.textContent = '마이크 권한을 확인해 주세요';
                return false;
            }
        }

        function levelLabel(level){
            if (level < 30) return { text: '조용해요', color: '#27ae60' };
            if (level < 60) return { text: '적당해요', color: '#f1c40f' };
            if (level < 80) return { text: '조금 시끄러워요', color: '#f39c12' };
            return { text: '너무 시끄러워요!', color: '#e74c3c' };
        }

        function tick(){
            if (!analyser) return;
            analyser.getByteTimeDomainData(dataArray);
            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++){
                const normalized = (dataArray[i] - 128) / 128;
                sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);
            const level = Math.min(100, Math.round(rms * 300));
            numberEl.textContent = level + '%';
            barFill.style.width = level + '%';
            const info = levelLabel(level);
            lightEl.style.background = info.color;
            lightEl.style.boxShadow = `0 0 40px ${info.color}88`;
            lightLabel.textContent = info.text;
            lightLabel.style.color = info.color;
            rafHandle = requestAnimationFrame(tick);
        }

        document.getElementById('bb-tool-noise-btn').addEventListener('click', async () => {
            openWindow(win);
            const ok = await ensureMic();
            if (ok && !rafHandle) tick();
        });
    }

    // ---------------------------------------------------------
    // QR 코드 만들기
    // ---------------------------------------------------------
    function setupQr(){
        const win = createFloatWindow('bb-win-qr', '🔗 QR 코드', `
            <input type="text" class="bb-qr-input" id="bb-qr-input" placeholder="주소(URL)나 텍스트를 입력하세요">
            <button type="button" class="bb-qr-generate" id="bb-qr-generate">QR 코드 생성</button>
            <br>
            <img class="bb-qr-image" id="bb-qr-image" alt="QR 코드">
            <br>
            <button type="button" class="bb-qr-copy" id="bb-qr-copy" style="display:none;">📋 이미지 복사</button>
        `);

        const img = win.querySelector('#bb-qr-image');
        const copyBtn = win.querySelector('#bb-qr-copy');

        win.querySelector('#bb-qr-generate').addEventListener('click', () => {
            const text = win.querySelector('#bb-qr-input').value.trim();
            if (!text){ img.style.display = 'none'; copyBtn.style.display = 'none'; return; }
            // 창을 크게 조절하면 이미지도 같이 커지므로(최대 440px 표시),
            // 흐려 보이지 않게 그보다 큰 해상도로 생성해 둔다.
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=' + encodeURIComponent(text);
            img.style.display = 'inline-block';
            copyBtn.style.display = 'inline-block';
        });

        copyBtn.addEventListener('click', async () => {
            if (!img.src){ alert('먼저 QR 코드를 생성해 주세요.'); return; }
            try{
                if (!navigator.clipboard || !window.ClipboardItem) throw new Error('clipboard-unsupported');
                const response = await fetch(img.src);
                const blob = await response.blob();
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                copyBtn.textContent = '✅ 복사됨!';
                setTimeout(() => { copyBtn.textContent = '📋 이미지 복사'; }, 1500);
            }catch(error){
                console.warn('QR 이미지 복사 실패:', error);
                alert('이 브라우저에서는 이미지 복사가 지원되지 않아요. 이미지를 길게 눌러(우클릭) 저장해 주세요.');
            }
        });

        document.getElementById('bb-tool-qr-btn').addEventListener('click', () => openWindow(win));
    }

    // ---------------------------------------------------------
    // 초기화
    // ---------------------------------------------------------
    function injectToolbar(){
        const bar = document.createElement('div');
        bar.id = 'bb-toolbar';
        bar.innerHTML = `
            <button type="button" id="bb-toolbar-handle"><span class="bb-handle-arrow">▾</span><span class="bb-handle-label">도구모음 접기</span></button>
            <button type="button" class="bb-tool-btn" id="bb-tool-timer-btn"><span class="bb-emoji">⏱️</span>타이머</button>
            <button type="button" class="bb-tool-btn" id="bb-tool-stopwatch-btn"><span class="bb-emoji">⏳</span>스톱워치</button>
            <button type="button" class="bb-tool-btn" id="bb-tool-picker-btn"><span class="bb-emoji">🎲</span>번호 뽑기</button>
            <button type="button" class="bb-tool-btn" id="bb-tool-noise-btn"><span class="bb-emoji">🔊</span>소음계</button>
            <button type="button" class="bb-tool-btn" id="bb-tool-qr-btn"><span class="bb-emoji">🔗</span>QR 만들기</button>
        `;
        document.body.appendChild(bar);
    }

    // 접힌/펼친 상태를 기기에 기억해 둔다. 처음 켰을 때는 접힌 상태로 시작해서
    // 평소 화면을 가리지 않다가, 선생님이 필요할 때 펼쳐 쓰는 방식이다.
    const COLLAPSE_STORAGE_KEY = 'bbToolbarCollapsed';
    function setupCollapse(){
        const handle = document.getElementById('bb-toolbar-handle');
        const label = handle.querySelector('.bb-handle-label');

        function applyState(collapsed){
            document.body.classList.toggle('bb-tools-collapsed', collapsed);
            label.textContent = collapsed ? '도구모음 펼치기' : '도구모음 접기';
            try{ localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0'); }catch(error){}
        }

        let collapsed = true;
        try{
            const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
            if (saved !== null) collapsed = saved === '1';
        }catch(error){}

        applyState(collapsed);
        handle.addEventListener('click', () => applyState(!document.body.classList.contains('bb-tools-collapsed')));
    }

    function init(){
        injectStyles();
        injectToolbar();
        setupCollapse();
        setupTimer();
        setupStopwatch();
        setupPicker();
        setupNoise();
        setupQr();
    }

    if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
