// js/blackboard-tools.js - 전자칠판 하단 도구모음: 타이머 / 번호 뽑기 / 소음 측정기 / QR 코드
// 전자칠판 페이지는 로그인 없이 켜두는 화면이라, 이 도구들은 Firebase 데이터를
// 전혀 쓰지 않고 그 기기 안에서만 동작한다 (번호 뽑기도 이름이 아니라 번호만 사용).
(function(){
    'use strict';

    function injectStyles(){
        const style = document.createElement('style');
        style.textContent = `
            #bb-toolbar{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:14px;padding:16px;background:rgba(255,255,255,.9);backdrop-filter:blur(6px);box-shadow:0 -8px 30px rgba(24,40,68,.12);z-index:900;flex-wrap:wrap;}
            .bb-tool-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 22px;border:0;border-radius:16px;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 6px 16px rgba(24,40,68,.25);font-family:inherit;}
            .bb-tool-btn .bb-emoji{font-size:26px;}
            #bb-tool-timer-btn{background:#3498db;}
            #bb-tool-picker-btn{background:#8e44ad;}
            #bb-tool-noise-btn{background:#f39c12;}
            #bb-tool-qr-btn{background:#27ae60;}

            .bb-float-win{position:fixed;width:300px;background:#fff;border-radius:18px;box-shadow:0 20px 50px rgba(24,40,68,.3);overflow:hidden;z-index:950;display:none;}
            .bb-float-win.show{display:block;}
            .bb-float-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#182844;color:#fff;font-weight:900;cursor:move;user-select:none;}
            .bb-float-close{width:26px;height:26px;border:0;border-radius:8px;background:rgba(255,255,255,.15);color:#fff;font-weight:900;cursor:pointer;}
            .bb-float-body{padding:20px;text-align:center;color:#182844;font-family:"Pretendard","Noto Sans KR","Segoe UI",sans-serif;}

            .bb-timer-display{font-size:48px;font-weight:950;font-variant-numeric:tabular-nums;color:#3498db;margin-bottom:10px;}
            .bb-timer-presets{display:flex;gap:6px;justify-content:center;margin-bottom:12px;flex-wrap:wrap;}
            .bb-timer-presets button{padding:5px 10px;border:2px solid #3498db;border-radius:999px;background:#fff;color:#3498db;font-weight:800;cursor:pointer;font-size:12px;}
            .bb-timer-presets button.active{background:#3498db;color:#fff;}
            .bb-timer-controls{display:flex;gap:8px;justify-content:center;}
            .bb-timer-controls button{padding:8px 16px;border:0;border-radius:10px;font-weight:900;font-size:13px;cursor:pointer;}
            .bb-tc-start{background:#27ae60;color:#fff;}
            .bb-tc-reset{background:#eef1f6;color:#182844;}

            .bb-picker-reveal{font-size:44px;font-weight:950;margin:6px 0 14px;padding:20px;border-radius:16px;background:linear-gradient(135deg,#fdf0d5,#ffe6b3);color:#7a4b00;}
            .bb-picker-btn{padding:12px 30px;border:0;border-radius:14px;background:#8e44ad;color:#fff;font-weight:900;font-size:16px;cursor:pointer;margin-bottom:12px;width:100%;}
            .bb-picker-setup{display:flex;gap:6px;align-items:center;justify-content:center;margin-bottom:10px;font-size:13px;font-weight:800;}
            .bb-picker-setup input{width:56px;padding:5px;border:1px solid #dfe6f0;border-radius:8px;text-align:center;}
            .bb-picker-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;max-height:150px;overflow-y:auto;margin-bottom:8px;}
            .bb-picker-num{padding:6px 0;border-radius:8px;border:1px solid #dfe6f0;background:#fff;font-size:12px;font-weight:800;cursor:pointer;color:#182844;}
            .bb-picker-num.excluded{background:#f4f1f8;color:#c3c9d6;text-decoration:line-through;}
            .bb-picker-hint{font-size:11px;color:#8a94a8;font-weight:700;}

            .bb-db-toggle{display:inline-flex;border-radius:999px;background:#eef1f6;padding:4px;margin-bottom:16px;}
            .bb-db-toggle button{padding:6px 14px;border:0;border-radius:999px;background:transparent;font-weight:800;color:#8a94a8;cursor:pointer;font-size:12px;}
            .bb-db-toggle button.active{background:#f39c12;color:#fff;}
            .bb-db-number{font-size:44px;font-weight:950;color:#f39c12;}
            .bb-db-bar-track{height:16px;border-radius:999px;background:#eef1f6;overflow:hidden;margin-top:10px;}
            .bb-db-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#27ae60,#f39c12,#e74c3c);transition:width .15s ease;}
            .bb-db-light-view{display:none;}
            .bb-db-light-view .bb-light{width:90px;height:90px;border-radius:50%;margin:0 auto 10px;background:#27ae60;box-shadow:0 0 40px rgba(39,174,96,.5);transition:background .2s ease, box-shadow .2s ease;}
            .bb-db-light-label{font-size:15px;font-weight:900;color:#27ae60;}
            .bb-db-hint{font-size:11px;color:#8a94a8;font-weight:700;margin-top:10px;}

            .bb-qr-input{width:100%;box-sizing:border-box;padding:10px;border:2px solid #dfe6f0;border-radius:10px;font-size:14px;margin-bottom:10px;}
            .bb-qr-generate{padding:10px 20px;border:0;border-radius:12px;background:#27ae60;color:#fff;font-weight:900;font-size:14px;cursor:pointer;margin-bottom:14px;width:100%;}
            .bb-qr-image{width:180px;height:180px;border:6px solid #fff;box-shadow:0 8px 24px rgba(24,40,68,.2);border-radius:10px;display:none;}
            .bb-qr-copy{margin-top:14px;padding:8px 18px;border:2px solid #27ae60;border-radius:12px;background:#fff;color:#27ae60;font-weight:900;font-size:13px;cursor:pointer;}

            @media(max-width:640px){
                .bb-tool-btn{padding:8px 14px;font-size:12px;}
                .bb-tool-btn .bb-emoji{font-size:20px;}
                .bb-float-win{width:min(92vw,300px);}
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
    function setupTimer(){
        const win = createFloatWindow('bb-win-timer', '⏱️ 타이머', `
            <div class="bb-timer-display" id="bb-timer-display">05:00</div>
            <div class="bb-timer-presets">
                <button type="button" data-secs="60">1분</button>
                <button type="button" data-secs="180">3분</button>
                <button type="button" data-secs="300" class="active">5분</button>
                <button type="button" data-secs="600">10분</button>
            </div>
            <div class="bb-timer-controls">
                <button type="button" class="bb-tc-start" id="bb-timer-toggle">▶ 시작</button>
                <button type="button" class="bb-tc-reset" id="bb-timer-reset">↺ 초기화</button>
            </div>
        `);

        let totalSecs = 300, remaining = 300, tickHandle = null;
        const display = win.querySelector('#bb-timer-display');
        const toggleBtn = win.querySelector('#bb-timer-toggle');

        function format(secs){
            const m = Math.floor(secs / 60), s = secs % 60;
            return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }
        function renderTime(){ display.textContent = format(Math.max(0, remaining)); }

        function beep(){
            try{
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                [0, 300, 600].forEach(delay => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.frequency.value = 880;
                    osc.connect(gain); gain.connect(ctx.destination);
                    gain.gain.setValueAtTime(0.001, ctx.currentTime + delay / 1000);
                    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + delay / 1000 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.25);
                    osc.start(ctx.currentTime + delay / 1000);
                    osc.stop(ctx.currentTime + delay / 1000 + 0.3);
                });
            }catch(error){ console.warn('타이머 알림음 재생 실패:', error); }
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
                }
            }, 1000);
        }
        function pause(){ stopTick(); toggleBtn.textContent = '▶ 시작'; }

        toggleBtn.addEventListener('click', () => { tickHandle ? pause() : start(); });
        win.querySelector('#bb-timer-reset').addEventListener('click', () => {
            pause(); remaining = totalSecs; renderTime();
        });
        win.querySelectorAll('.bb-timer-presets button').forEach(btn => {
            btn.addEventListener('click', () => {
                win.querySelectorAll('.bb-timer-presets button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                pause();
                totalSecs = parseInt(btn.dataset.secs, 10) || 300;
                remaining = totalSecs;
                renderTime();
            });
        });

        document.getElementById('bb-tool-timer-btn').addEventListener('click', () => openWindow(win));
    }

    // ---------------------------------------------------------
    // 번호 뽑기 (이름 대신 번호만 사용 — Firebase 접근 불필요)
    // ---------------------------------------------------------
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
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(text);
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
            <button type="button" class="bb-tool-btn" id="bb-tool-timer-btn"><span class="bb-emoji">⏱️</span>타이머</button>
            <button type="button" class="bb-tool-btn" id="bb-tool-picker-btn"><span class="bb-emoji">🎲</span>번호 뽑기</button>
            <button type="button" class="bb-tool-btn" id="bb-tool-noise-btn"><span class="bb-emoji">🔊</span>소음계</button>
            <button type="button" class="bb-tool-btn" id="bb-tool-qr-btn"><span class="bb-emoji">🔗</span>QR 만들기</button>
        `;
        document.body.appendChild(bar);
    }

    function init(){
        injectStyles();
        injectToolbar();
        setupTimer();
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
