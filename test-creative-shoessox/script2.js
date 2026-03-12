(function () {
    'use strict';

    /* ─── Inject Loader CSS ─── */
    var loaderStyle = document.createElement('style');
    loaderStyle.textContent =
        '#loader{position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#0a0025;transition:opacity .4s ease}' +
        '#loader.hidden{opacity:0;pointer-events:none}' +
        '#loader img{width:120px;margin-bottom:24px}' +
        '#progressTrack{width:140px;height:3px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden}' +
        '#progressBar{height:100%;width:0%;background:#7ed957;border-radius:2px;transition:width .15s ease}';
    document.head.appendChild(loaderStyle);

    /* ─── Inject Loader HTML ─── */
    var loaderDiv = document.createElement('div');
    loaderDiv.id = 'loader';
    loaderDiv.innerHTML =
        '<img src="' + (window.trackingPath || './assets/') + 'logo.png" alt="Shoes &amp; Sox">' +
        '<div id="progressTrack"><div id="progressBar"></div></div>';
    document.body.insertBefore(loaderDiv, document.body.firstChild);

    /* ─── Canvas Setup (HiDPI) ─── */
    var canvas = document.getElementById('c');
    var ctx = canvas.getContext('2d');
    var GW = 640, GH = 960;
    canvas.width = GW;
    canvas.height = GH;

    // Crisp image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    function resize() {
        var vw = window.innerWidth, vh = window.innerHeight;
        var scale = Math.min(vw / GW, vh / GH);
        canvas.style.width = (GW * scale) + 'px';
        canvas.style.height = (GH * scale) + 'px';
    }
    window.addEventListener('resize', function () { resize(); if (endScreenBuilt) { endScreenBuilt = false; showEndOverlay(); } });
    resize();

    /* ─── Grid Cell Positions (from SVG export) ─── */
    var CW = 117.4, CH = 119, CR = 9;
    var XS = [56.4, 193.2, 331, 468.4];
    var YS = [198.1, 340.1, 480.8, 619.9];
    var CELLS = [];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) CELLS.push({ r: r, c: c, x: XS[c], y: YS[r], w: CW, h: CH });

    /* ─── Brand Data ─── */
    var BRANDS = ['adidas', 'asics', 'converse', 'new balance', 'nike', 'reebok', 'skechers', 'vans'];
    var BRAND_FILES = ['adidas.png', 'asics.png', 'converse.png', 'new-balance.png', 'nike.png', 'reebok.png', 'skechers.png', 'vans.png'];
    function brandSlug(b) { return b.replace(/ /g, '-'); }

    /* ─── Image Loading ─── */
    var images = {};
    var loaded = 0;
    var UNLOCK_BRANDS = ['adidas', 'asics', 'converse', 'new balance', 'nike', 'reebok', 'skechers', 'vans'];
    var END_CARDS = ['adidas', 'asics', 'converse', 'new balance', 'nike', 'reebok', 'skechers', 'vans'];
    var total = 5 + 6 + BRANDS.length + UNLOCK_BRANDS.length * 3 + 4; // base(5) + drawer/misc(6) + brand logos(8) + unlock boards+shoes+shadows(24) + audio(4) = 47

    var progressBar = document.getElementById('progressBar');
    function updateProgress() {
        if (progressBar) progressBar.style.width = (loaded / total * 100) + '%';
    }
    function loadImg(key, src) {
        var img = new Image();
        img.onload = function () { images[key] = img; loaded++; updateProgress(); if (loaded === total) init(); };
        img.onerror = function () { console.warn('Missing: ' + src); images[key] = null; loaded++; updateProgress(); if (loaded === total) init(); };
        img.src = src;
    }

    var base = window.trackingPath;//'https://creativehubiion.github.io/advertiser-creatives/finalbuildfiles/2026/Mar/shoesneakers/assets/';
    loadImg('bg', base + 'BG.png');
    loadImg('logo', base + 'logo.png');
    loadImg('startdim', base + 'start-dim.png');
    loadImg('startboard', base + 'start-board.png?v=' + Date.now());
    loadImg('congratsboard', base + 'congrats-board.png?v=' + Date.now());
    loadImg('drawer', base + 'drawer.png?v=' + Math.random());
    loadImg('endbg', base + 'end-card-bg.png');
    loadImg('drawerwin', base + 'drawer-window.png');
    loadImg('notch', base + 'notch.png');
    loadImg('notchup', base + 'notch-arrow-up.png');
    loadImg('notchdown', base + 'notch-arrow-down.png');
    for (var i = 0; i < BRANDS.length; i++) loadImg(BRANDS[i], base + 'brand-logos/' + BRAND_FILES[i]);
    for (var i = 0; i < UNLOCK_BRANDS.length; i++) {
        loadImg('unlock_' + UNLOCK_BRANDS[i], base + 'unlock-boards/' + brandSlug(UNLOCK_BRANDS[i]) + '.png');
        loadImg('shoe_' + UNLOCK_BRANDS[i], base + 'shoes-glow/' + brandSlug(UNLOCK_BRANDS[i]) + '.png?v=' + Math.random());
        loadImg('shoeshadow_' + UNLOCK_BRANDS[i], base + 'shoes-shadow/' + brandSlug(UNLOCK_BRANDS[i]) + '.png');
    }

    /* ─── Audio ─── */
    var audioCtx = null;
    var sndBuffers = {};
    var sndRawData = {};
    var sndVolumes = { merge: 1.8, card: 0.45, drawer: 0.15, error: 0.3 };
    var audioInited = false;
    var AUDIO_FILES = { merge: 'audio/merge-bloop.mp3', card: 'audio/card-notify.mp3', drawer: 'audio/drawer-sfx.mp3', error: 'audio/error.mp3' };
    var AUDIO_KEYS = ['merge', 'card', 'drawer', 'error'];

    // Pre-fetch audio data during loading (counts toward progress)
    for (var i = 0; i < AUDIO_KEYS.length; i++) {
        (function (key) {
            var url = base + AUDIO_FILES[key];
            fetch(url).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.arrayBuffer();
            }).then(function (arr) {
                sndRawData[key] = arr;
                loaded++; updateProgress(); if (loaded === total) init();
            }).catch(function (e) {
                console.error('Audio fetch error:', key, e);
                loaded++; updateProgress(); if (loaded === total) init();
            });
        })(AUDIO_KEYS[i]);
    }

    function initAudio() {
        if (audioInited) return;
        audioInited = true;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { console.error('AudioContext failed', e); return; }
        // Decode pre-fetched audio data
        for (var i = 0; i < AUDIO_KEYS.length; i++) {
            (function (key) {
                if (!sndRawData[key]) return;
                audioCtx.decodeAudioData(sndRawData[key]).then(function (buf) {
                    sndBuffers[key] = buf;
                    delete sndRawData[key];
                }).catch(function (e) {
                    console.error('Audio decode error:', key, e);
                });
            })(AUDIO_KEYS[i]);
        }
    }

    function playSound(key) {
        if (!audioCtx || !sndBuffers[key]) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        var src = audioCtx.createBufferSource();
        src.buffer = sndBuffers[key];
        var gain = audioCtx.createGain();
        gain.gain.value = sndVolumes[key] || 1;
        src.connect(gain);
        gain.connect(audioCtx.destination);
        src.start(0);
    }

    /* ─── Tracking ─── */
    var TRACKING_BASE_URL = window.trackingType;
    function fnfetchAPI(trackingURL) {
        fetch(trackingURL, { method: 'GET' })
            .then(function (response) { console.log('Tracking sent:', response.status); })
            .catch(function (error) { console.error('Tracking error:', error); });
    }

    function trackEvent(eventName) {
        var url = TRACKING_BASE_URL + eventName.replace(/ /g, '');
        console.log('[Tracking] ' + eventName);
        fnfetchAPI(url);
    }

    /* ─── Game State ─── */
    var board = [];       // 16 entries: brand index 0-7, or -1 if matched
    var state = 'loading';// loading | intro | playing | end
    var dragIdx = -1;     // cell index being dragged
    var dragX = 0, dragY = 0;
    var isDragging = false;
    var matchedCount = 0;
    var anims = [];
    var startTime = 0;
    var hintTarget = -1;  // cell index for hint glow
    var shoeCell = [];    // 16 entries: brand index if shoe revealed, -1 otherwise
    var introAlpha = 1;
    var endScrollY = 0;
    var hintActive = true; // show drag hint until first successful match
    var currentHintPair = [0, 2]; // current pair being hinted
    var hintPairIdx = 0;          // index in all-pairs list
    var hintCycleStart = 0;       // render timestamp when current hint pair started
    var hintDelayStart = 0;       // timestamp when matched pair completed (3s delay before next hint)

    /* ─── Drawer State ─── */
    var drawerOpen = false;
    var drawerAnim = 0;       // 0=closed, 1=fully open
    var drawerAnimStart = -1;
    var drawerAnimDir = 0;    // 1=opening, -1=closing
    var drawerAnimDur = 400;
    var drawerUnlocked = [];  // brand indices that have been unlocked
    var hasFirstShoe = false; // true once first shoe is revealed
    var drawerScrollX = 0;    // horizontal scroll offset for drawer slider
    var drawerDragStartX = -1;
    var drawerDragScrollStart = 0;
    var drawerIsDragging = false;

    /* ─── Board Generation (backtracking, no adjacent same brand) ─── */
    /* Row 1 Col 1 (index 0) and Row 1 Col 3 (index 2) always share the same brand */
    function generateBoard() {
        var grid = [];
        for (var rr = 0; rr < 4; rr++) { grid[rr] = []; for (var cc = 0; cc < 4; cc++) grid[rr][cc] = -1; }
        var counts = [2, 2, 2, 2, 2, 2, 2, 2];

        // Pre-place: pick a random brand for row0-col0 and row0-col2
        var hintBrand = Math.random() * 8 | 0;
        grid[0][0] = hintBrand;
        grid[0][2] = hintBrand;
        counts[hintBrand] = 0; // both instances used

        function valid(r, c, b) {
            if (c > 0 && grid[r][c - 1] === b) return false;
            if (r > 0 && grid[r - 1][c] === b) return false;
            return true;
        }

        function shuffle(a) {
            for (var i = a.length - 1; i > 0; i--) { var j = Math.random() * (i + 1) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; }
            return a;
        }

        function solve(idx) {
            if (idx === 16) return true;
            var r = idx / 4 | 0, c = idx % 4;
            // Skip pre-placed cells
            if (grid[r][c] >= 0) return solve(idx + 1);
            var avail = [];
            for (var i = 0; i < 8; i++) if (counts[i] > 0) avail.push(i);
            shuffle(avail);
            for (var k = 0; k < avail.length; k++) {
                var b = avail[k];
                if (valid(r, c, b)) {
                    grid[r][c] = b; counts[b]--;
                    if (solve(idx + 1)) return true;
                    grid[r][c] = -1; counts[b]++;
                }
            }
            return false;
        }

        solve(0);
        board = [];
        shoeCell = [];
        for (var rr = 0; rr < 4; rr++) for (var cc = 0; cc < 4; cc++) { board.push(grid[rr][cc]); shoeCell.push(-1); }
    }

    /* ─── Hint pair helpers ─── */
    function findHintPair() {
        return [0, 2];
    }

    function getAllPairs() {
        var pairs = [];
        var seen = {};
        for (var i = 0; i < 16; i++) {
            if (board[i] < 0) continue;
            if (seen[board[i]] !== undefined) {
                pairs.push([seen[board[i]], i]);
            } else {
                seen[board[i]] = i;
            }
        }
        return pairs;
    }

    /* ─── Coordinate Transform ─── */
    function toCanvas(cx, cy) {
        var rect = canvas.getBoundingClientRect();
        return { x: (cx - rect.left) * GW / rect.width, y: (cy - rect.top) * GH / rect.height };
    }

    function cellAt(px, py) {
        for (var i = 0; i < 16; i++) {
            var c = CELLS[i];
            if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h && board[i] >= 0) return i;
        }
        return -1;
    }

    /* ─── Drawing Helpers ─── */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawBrandInCell(x, y, w, h, brandIdx, logoScale, opts) {
        if (brandIdx < 0) return;
        opts = opts || {};
        var cx = x + w / 2, cy = y + h / 2;

        // Brand logo (high quality) - scaled independently from cell rect
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        var img = images[BRANDS[brandIdx]];
        if (img) {
            var pad = (brandIdx === 0) ? 22 : 10; // adidas gets more padding
            var mw = (w - pad * 2) * logoScale, mh = (h - pad * 2) * logoScale;
            var aspect = img.width / img.height;
            var dw, dh;
            if (aspect > mw / mh) { dw = mw; dh = mw / aspect; }
            else { dh = mh; dw = mh * aspect; }
            ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
        }

        // Yellow glow stroke for correct match target (cell rect stays at 1:1)
        if (opts.matchGlow) {
            ctx.save();
            ctx.shadowColor = '#ffdd00';
            ctx.shadowBlur = 18;
            ctx.strokeStyle = '#ffdd00';
            ctx.lineWidth = 3.5;
            roundRect(x, y, w, h, CR);
            ctx.stroke();
            ctx.restore();
        }
    }

    /* ─── Render Functions ─── */
    function render(time) {
        if (!startTime) startTime = time;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, GW, GH);

        if (state === 'end') {
            drawEndScreen(time);
        } else {
            drawGameScreen(time);
        }

        requestAnimationFrame(render);
    }

    function drawGameScreen(time) {
        // Background
        if (images.bg) ctx.drawImage(images.bg, 0, 0, GW, GH);

        // Determine hover target while dragging
        var hoverIdx = -1;   // any cell the drag is over (not the dragged cell)
        var isMatch = false;  // true if hover target is a correct match
        if (isDragging && dragIdx >= 0) {
            var ti = cellAt(dragX, dragY);
            if (ti >= 0 && ti !== dragIdx && board[ti] >= 0) {
                hoverIdx = ti;
                isMatch = (board[ti] === board[dragIdx]);
            }
        }

        // Draw revealed shoe cells
        for (var i = 0; i < 16; i++) {
            if (shoeCell[i] < 0) continue;
            var cell = CELLS[i];
            var brandName = BRANDS[shoeCell[i]];
            var shoeImg = images['shoe_' + brandName];
            if (shoeImg) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                var pad = 0;
                var mw = cell.w, mh = cell.h;
                var aspect = shoeImg.width / shoeImg.height;
                var dw, dh;
                if (aspect > mw / mh) { dw = mw; dh = mw / aspect; }
                else { dh = mh; dw = mh * aspect; }
                ctx.drawImage(shoeImg, cell.x + cell.w / 2 - dw / 2, cell.y + cell.h / 2 - dh / 2, dw, dh);
            }
        }

        // Determine if intro drag is active (hide source cell during drag/merge phases)
        var introDragPhase = false;

        // Activate next hint 3s after a matched hint pair
        if (!hintActive && hintDelayStart > 0 && state === 'playing') {
            if (time - hintDelayStart > 3000) {
                var pairs = getAllPairs();
                if (pairs.length > 0) {
                    currentHintPair = pairs[0];
                    hintActive = true;
                    hintCycleStart = time;
                }
                hintDelayStart = 0;
            }
        }

        var showingHint = (state === 'intro') || (state === 'playing' && hintActive && !isDragging);

        if (showingHint) {
            var animBase = (state === 'playing') ? (time - hintCycleStart) : time;
            var introRaw = (animBase / 2500) % 1;
            introDragPhase = (introRaw >= 0.1 && introRaw < 0.85);
        }

        // Draw grid cells
        for (var i = 0; i < 16; i++) {
            if (board[i] < 0) continue; // matched cells = invisible (grid rects are reference only)
            if (isDragging && dragIdx === i) continue; // draw separately as dragged
            if (introDragPhase && i === currentHintPair[0]) continue; // hide source cell during hint drag

            var cell = CELLS[i];
            ctx.save();

            if (hoverIdx === i && isMatch) {
                // Correct match target: scale up + yellow glowing stroke
                drawBrandInCell(cell.x, cell.y, cell.w, cell.h, board[i], 1.2, { matchGlow: true });
            }
            else if (hoverIdx === i) {
                // Wrong target: scale up noticeably
                drawBrandInCell(cell.x, cell.y, cell.w, cell.h, board[i], 1.18);
            }
            // Hint glow on intro/hint
            else if (showingHint && hintTarget === i) {
                var pulse = 0.5 + 0.5 * Math.sin(time / 300);
                ctx.shadowColor = 'rgba(0,255,180,' + pulse + ')';
                ctx.shadowBlur = 15 * pulse;
                drawBrandInCell(cell.x, cell.y, cell.w, cell.h, board[i], 1.0);
                ctx.shadowBlur = 0;
            }
            else {
                drawBrandInCell(cell.x, cell.y, cell.w, cell.h, board[i], 1.0);
            }
            ctx.restore();
        }

        // Dragged cell following pointer (semi-transparent)
        if (isDragging && dragIdx >= 0 && board[dragIdx] >= 0) {
            var cell = CELLS[dragIdx];
            var ox = dragX - cell.x - cell.w / 2;
            var oy = dragY - cell.y - cell.h / 2;
            ctx.save();
            ctx.translate(ox, oy);
            ctx.globalAlpha = 0.65;
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 18;
            ctx.shadowOffsetY = 6;
            drawBrandInCell(cell.x, cell.y, cell.w, cell.h, board[dragIdx], 1.1);
            ctx.restore();
        }

        // Animations
        var deferredOverlay = null; // for unlock/congrats to draw on top of everything
        for (var i = anims.length - 1; i >= 0; i--) {
            var a = anims[i];
            var elapsed = time - a.start;
            var p = Math.min(elapsed / a.duration, 1);

            if (a.type === 'match') {
                var cell = CELLS[a.cell];
                ctx.save();
                ctx.globalAlpha = 1 - p;
                ctx.shadowColor = '#00ffcc';
                ctx.shadowBlur = 40 * (1 - p);
                drawBrandInCell(cell.x, cell.y, cell.w, cell.h, a.brand, 1 + p * 0.4);
                ctx.restore();
            }

            if (a.type === 'unlockcard') {
                if (!a.soundPlayed && p > 0) { playSound('card'); a.soundPlayed = true; }
                deferredOverlay = { type: 'unlockcard', brand: a.brand, p: p };
            }

            if (a.type === 'addedtext') {
                // Hit-point style: pop in, float up, fade out
                var notchH = images.notch ? images.notch.height : 53;
                var drawerH = images.drawer ? images.drawer.height : 352;
                var slideY = drawerH * drawerAnim;
                var baseY = GH - slideY - notchH + 9;
                // Scale: quick pop in then shrink slightly
                var sc;
                if (p < 0.15) { sc = p / 0.15 * 1.2; }
                else if (p < 0.3) { sc = 1.2 - (p - 0.15) / 0.15 * 0.2; }
                else { sc = 1.0; }
                // Float up
                var floatY = baseY - 20 - p * 60;
                // Fade out in last 40%
                var alpha = p > 0.6 ? (1 - (p - 0.6) / 0.4) : 1;
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.font = 'bold 28px TheFuture,sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.translate(GW / 2, floatY);
                ctx.scale(sc, sc);
                ctx.fillStyle = '#fff';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 6;
                ctx.fillText('ADDED!', 0, 0);
                ctx.restore();
            }

            if (a.type === 'congratsboard') {
                deferredOverlay = { type: 'congratsboard', p: p };
            }

            if (p >= 1) {
                // When unlock card animation ends, reveal shoe in the drop cell
                if (a.type === 'unlockcard' && a.dropCell >= 0) {
                    shoeCell[a.dropCell] = a.brand;
                    if (drawerUnlocked.indexOf(a.brand) < 0) drawerUnlocked.push(a.brand);
                    hasFirstShoe = true;
                    anims.push({ type: 'addedtext', start: performance.now(), duration: 900 });
                }
                anims.splice(i, 1);
            }
        }

        // Intro overlay / persistent hint
        if (state === 'intro') {
            drawIntroOverlay(time, false);
        } else if (showingHint) {
            drawIntroOverlay(time, true);
        }

        // "DRAG THE LOGO" text below grid — only after first tap, pulse blink
        if (state === 'playing' && showingHint) {
            var pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time / 400));
            ctx.save();
            ctx.font = 'bold 30px Arial, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,' + pulse + ')';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('DRAG THE LOGOS TO MATCH!', GW / 2, 820);
            ctx.restore();
        }

        // Drawer
        if (hasFirstShoe && state === 'playing') drawDrawer(time);

        // Text badges removed

        // // DEBUG: skip to end screen button
        // ctx.save();
        // ctx.fillStyle='rgba(255,0,0,0.5)';
        // ctx.fillRect(580,10,50,30);
        // ctx.fillStyle='#fff';
        // ctx.font='bold 12px sans-serif';
        // ctx.textAlign='center';
        // ctx.textBaseline='middle';
        // ctx.fillText('END',605,25);
        // ctx.restore();


        // Deferred overlay popups (unlock card / congrats board) — on top of everything
        if (deferredOverlay) {
            var dp = deferredOverlay.p;
            // Compute spring scale
            var s;
            if (dp < 0.25) {
                var t = dp / 0.25;
                if (t < 0.4) { var u = t / 0.4; s = 1.09 * (1 - Math.pow(1 - u, 3)); }
                else { var u = (t - 0.4) / 0.6; s = 1.0 + 0.09 * Math.cos(u * Math.PI * 3) * Math.exp(-5 * u); }
            } else if (dp < 0.5) {
                s = 1;
            } else {
                var t = 1 - (dp - 0.5) / 0.5;
                if (t < 0.4) { var u = t / 0.4; s = 1.09 * (1 - Math.pow(1 - u, 3)); }
                else { var u = (t - 0.4) / 0.6; s = 1.0 + 0.09 * Math.cos(u * Math.PI * 3) * Math.exp(-5 * u); }
            }
            s = Math.max(0, s);

            // Dimmer
            ctx.save();
            ctx.globalAlpha = 0.8 * s;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, GW, GH);
            ctx.restore();

            if (deferredOverlay.type === 'unlockcard') {
                // Logo on top of dimmer
                if (images.logo) ctx.drawImage(images.logo, 176, 23);
                // Unlock card image
                var unlockImg = images['unlock_' + BRANDS[deferredOverlay.brand]];
                if (unlockImg) {
                    var iw = unlockImg.width, ih = unlockImg.height;
                    var dw = iw * s, dh = ih * s;
                    ctx.save();
                    ctx.globalAlpha = s;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(unlockImg, GW / 2 - dw / 2, GH / 2 - dh / 2, dw, dh);
                    ctx.restore();
                }
            } else if (deferredOverlay.type === 'congratsboard') {
                // Logo on top of dimmer
                if (images.logo) ctx.drawImage(images.logo, 176, 23);
                var congratsImg = images.congratsboard;
                if (congratsImg) {
                    ctx.save();
                    ctx.translate(GW / 2, GH / 2);
                    ctx.scale(s, s);
                    ctx.drawImage(congratsImg, -congratsImg.width / 2, -congratsImg.height / 2);
                    ctx.restore();
                }
            }
        }

        // Shoes&Sox logo at top (always topmost layer, unless deferred overlay is showing)
        if (!deferredOverlay && images.logo) {
            ctx.drawImage(images.logo, 176, 23);
        }
    }

    function drawDrawer(time) {
        // Update drawer animation
        if (drawerAnimDir !== 0 && drawerAnimStart > 0) {
            var elapsed = time - drawerAnimStart;
            var t = Math.min(elapsed / drawerAnimDur, 1);
            // Spring ease for opening
            if (t < 1) {
                if (drawerAnimDir === 1) {
                    // Opening: spring overshoot
                    if (t < 0.4) {
                        var u = t / 0.4;
                        drawerAnim = 1.06 * (1 - Math.pow(1 - u, 3));
                    } else {
                        var u = (t - 0.4) / 0.6;
                        drawerAnim = 1.0 + 0.06 * Math.cos(u * Math.PI * 3) * Math.exp(-5 * u);
                    }
                } else {
                    // Closing: ease-in
                    drawerAnim = 1 - t * t;
                }
            } else {
                drawerAnim = drawerAnimDir === 1 ? 1 : 0;
                drawerAnimDir = 0;
                if (drawerAnim === 0) drawerOpen = false;
            }
        }

        var drawerH = images.drawer ? images.drawer.height : 352;
        var notchH = images.notch ? images.notch.height : 53;
        var slideY = drawerH * drawerAnim;

        // Heavy dim behind drawer with centered hint text
        if (drawerAnim > 0) {
            ctx.save();
            ctx.globalAlpha = 0.85 * drawerAnim;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, GW, GH);
            ctx.restore();

            // Centered hint text
            if (drawerAnim > 0.8) {
                var textAlpha = Math.min(1, (drawerAnim - 0.8) / 0.2);
                var drawerH2 = images.drawer ? images.drawer.height : 352;
                var dy2 = GH - drawerH2 * drawerAnim;
                var centerY = dy2 / 2;
                ctx.save();
                ctx.globalAlpha = textAlpha;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fff';
                ctx.font = '500 26px TheFuture,sans-serif';
                ctx.fillText('The biggest brands, the best range.', GW / 2, centerY - 18);
                ctx.fillText('Tap any sneaker to shop now at Shoes & Sox.', GW / 2, centerY + 18);
                ctx.restore();
            }
        }

        // Drawer panel (slides up from bottom)
        if (drawerAnim > 0 && images.drawer) {
            var dy = GH - slideY;
            ctx.drawImage(images.drawer, 0, dy, 640, drawerH);

            // Horizontal slider of drawer windows
            var winW = 151, winH = 95;
            var gap = 14;
            var sliderPad = 20;
            var totalSliderW = drawerUnlocked.length * (winW + gap) - gap;
            var sliderY = dy + (drawerH - winH) / 2 + 4;

            // Clamp scroll
            var maxScroll = Math.max(0, totalSliderW - GW + sliderPad * 2);
            if (drawerScrollX < 0) drawerScrollX = 0;
            if (drawerScrollX > maxScroll) drawerScrollX = maxScroll;


            // Clip to drawer area
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, dy, GW, drawerH);
            ctx.clip();

            for (var i = 0; i < drawerUnlocked.length; i++) {
                var wx = sliderPad + i * (winW + gap) - drawerScrollX;
                var wy = sliderY;
                // Skip if off screen
                if (wx + winW < 0 || wx > GW) continue;
                // Drawer window PNG at original size
                if (images.drawerwin) ctx.drawImage(images.drawerwin, wx, wy);
                // Shoe inside the window
                var brandName = BRANDS[drawerUnlocked[i]];
                var shoeImg = images['shoeshadow_' + brandName];
                if (shoeImg) {
                    var pad = 8;
                    var mw = winW - pad * 2, mh = winH - pad * 2;
                    var aspect = shoeImg.width / shoeImg.height;
                    var dw, dh;
                    if (aspect > mw / mh) { dw = mw; dh = mw / aspect; }
                    else { dh = mh; dw = mh * aspect; }
                    ctx.drawImage(shoeImg, wx + winW / 2 - dw / 2, wy + winH / 2 - dh / 2, dw, dh);
                }
            }
            ctx.restore();
        }

        // Notch (always visible once first shoe revealed, at bottom center)
        if (images.notch) {
            var notchW = images.notch.width;
            var nx = (GW - notchW) / 2;
            var ny = GH - notchH - (slideY > 0 ? slideY - 9 : 0);

            // Mac dock bounce when closed
            var bounceY = 0;
            if (!drawerOpen && drawerAnimDir === 0) {
                // Continuous bounce: 1.5s cycle, ease-out jump up then fall back
                // Bounce happens in first 800ms, then rest for 1200ms
                var cycle = time % 2000;
                if (cycle < 800) {
                    var bt = cycle / 800;
                    if (bt < 0.3) {
                        var u = bt / 0.3;
                        bounceY = -12 * (1 - Math.pow(1 - u, 2));
                    } else if (bt < 0.5) {
                        var u = (bt - 0.3) / 0.2;
                        bounceY = -12 * (1 - u * u);
                    } else if (bt < 0.65) {
                        var u = (bt - 0.5) / 0.15;
                        bounceY = -4 * (1 - Math.pow(1 - u, 2));
                    } else if (bt < 0.8) {
                        var u = (bt - 0.65) / 0.15;
                        bounceY = -4 * (1 - u * u);
                    }
                }
            }

            // Draw drawer peeking below notch when bouncing
            if (bounceY < 0 && images.drawer) {
                var peekH = Math.abs(bounceY);
                var dImgH = images.drawer.height;
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, ny + notchH + bounceY, GW, peekH);
                ctx.clip();
                ctx.drawImage(images.drawer, 0, ny + notchH + bounceY, 640, dImgH);
                ctx.restore();
            }

            ctx.drawImage(images.notch, nx, ny + bounceY);

            // Arrow on notch
            var arrowImg = drawerOpen || drawerAnimDir === 1 ? images.notchdown : images.notchup;
            if (arrowImg) {
                var aw = arrowImg.width, ah = arrowImg.height;
                ctx.drawImage(arrowImg, nx + (notchW - aw) / 2, ny + (notchH - ah) / 2 + 8 + bounceY);
            }
        }
    }

    function drawIntroOverlay(time, skipBoard) {
        // ── Dark overlay using start dim PNG (only during intro, not persistent hint) ──
        if (!skipBoard && images.startdim) {
            ctx.drawImage(images.startdim, 0, 0, GW, GH);
        }

        // ── Drag hint: animate logo between current hint pair ──
        var pair = currentHintPair;
        if (pair) {
            var c0 = CELLS[pair[0]], c1 = CELLS[pair[1]];
            var brandIdx = board[pair[0]];
            var logoImg = images[BRANDS[brandIdx]];

            // 2.5s cycle: 0-0.1 pause, 0.1-0.7 drag, 0.7-0.85 merge flash, 0.85-1.0 pause+fade reset
            var animBase = skipBoard ? (time - hintCycleStart) : time;
            var raw = (animBase / 2500) % 1;

            if (logoImg) {
                var pad = (brandIdx === 0) ? 22 : 10;

                if (raw < 0.1) {
                    // Pause: both logos sitting in cells, source pulses gently
                    var pulse = 0.8 + 0.2 * Math.sin(time / 200);
                    // Source cell logo (pulsing)
                    ctx.save();
                    ctx.globalAlpha = pulse;
                    drawBrandInCell(c0.x, c0.y, c0.w, c0.h, brandIdx, 1.0);
                    ctx.restore();
                    // Target cell logo
                    drawBrandInCell(c1.x, c1.y, c1.w, c1.h, brandIdx, 1.0);

                } else if (raw < 0.7) {
                    // Dragging phase
                    var dt = (raw - 0.1) / 0.6;
                    var t = 1 - Math.pow(1 - dt, 3); // ease-out cubic

                    // Source cell empty during drag (logo picked up)

                    // Target cell glows as drag approaches
                    if (dt > 0.4) {
                        var glowAlpha = (dt - 0.4) / 0.6;
                        ctx.save();
                        ctx.shadowColor = '#ffdd00';
                        ctx.shadowBlur = 18 * glowAlpha;
                        ctx.strokeStyle = 'rgba(255,221,0,' + glowAlpha + ')';
                        ctx.lineWidth = 3.5;
                        roundRect(c1.x, c1.y, c1.w, c1.h, CR);
                        ctx.stroke();
                        ctx.restore();
                    }
                    // Target logo
                    var targetScale = 1.0 + (dt > 0.4 ? (dt - 0.4) / 0.6 * 0.2 : 0);
                    drawBrandInCell(c1.x, c1.y, c1.w, c1.h, brandIdx, targetScale);

                    // Dragged logo following path
                    var dx = c0.x + (c1.x - c0.x) * t;
                    var dy = c0.y + (c1.y - c0.y) * t;
                    ctx.save();
                    ctx.globalAlpha = 0.7;
                    ctx.shadowColor = 'rgba(0,0,0,0.35)';
                    ctx.shadowBlur = 18;
                    ctx.shadowOffsetY = 6;
                    drawBrandInCell(dx, dy, c0.w, c0.h, brandIdx, 1.1);
                    ctx.restore();

                } else if (raw < 0.85) {
                    // Merge flash
                    var mt = (raw - 0.7) / 0.15;
                    var flashAlpha = 1 - mt;
                    ctx.save();
                    ctx.globalAlpha = flashAlpha;
                    ctx.shadowColor = '#00ffcc';
                    ctx.shadowBlur = 40 * flashAlpha;
                    drawBrandInCell(c1.x, c1.y, c1.w, c1.h, brandIdx, 1 + mt * 0.3);
                    ctx.restore();

                } else {
                    // Fade reset pause — logos reappear
                    var ft = (raw - 0.85) / 0.15;
                    ctx.save();
                    ctx.globalAlpha = ft;
                    drawBrandInCell(c0.x, c0.y, c0.w, c0.h, brandIdx, 1.0);
                    drawBrandInCell(c1.x, c1.y, c1.w, c1.h, brandIdx, 1.0);
                    ctx.restore();
                }
            }
        }

        // ── Instruction panel (start board PNG, centered on canvas) ──
        if (!skipBoard && images.startboard) {
            var sw = images.startboard.width, sh = images.startboard.height;
            ctx.drawImage(images.startboard, (GW - sw) / 2, (GH - sh) / 2);
        }
    }

    var endScreenBuilt = false;

    function showEndOverlay() {
        if (endScreenBuilt) return;
        endScreenBuilt = true;

        var overlay = document.getElementById('endOverlay');
        var wrap = document.getElementById('carouselWrap');
        var strip = document.getElementById('carouselStrip');
        var ctaEl = document.getElementById('endCta');

        // Match canvas sizing
        var rect = canvas.getBoundingClientRect();
        var scale = rect.width / GW;
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.top = rect.top + 'px';

        // Carousel position
        wrap.style.left = '0px';
        wrap.style.top = (222 * scale) + 'px';
        wrap.style.width = rect.width + 'px';
        wrap.style.height = (540 * scale) + 'px';

        // Build card strip (doubled for seamless loop)
        var cardW = 387 * scale;
        var cardH = 540 * scale;
        var cardGap = 20 * scale;
        strip.style.gap = cardGap + 'px';
        var cardSrc = [];
        for (var i = 0; i < END_CARDS.length; i++) cardSrc.push(base + 'end-cards/' + brandSlug(END_CARDS[i]) + '.png');
        // Double the cards
        var allSrc = cardSrc.concat(cardSrc);
        for (var i = 0; i < allSrc.length; i++) {
            var img = document.createElement('img');
            img.src = allSrc[i];
            img.style.width = cardW + 'px';
            img.style.height = cardH + 'px';
            strip.appendChild(img);
        }

        // Exact offset for one set of cards (7 cards + 7 gaps) for seamless loop
        var oneSetW = END_CARDS.length * cardW + END_CARDS.length * cardGap;
        // Inject dynamic keyframe with exact pixel value
        var styleEl = document.createElement('style');
        styleEl.textContent = '@keyframes slideCards{from{-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0)}to{-webkit-transform:translate3d(-' + oneSetW + 'px,0,0);transform:translate3d(-' + oneSetW + 'px,0,0)}}';
        document.head.appendChild(styleEl);
        strip.style.animation = 'slideCards 20s linear infinite';

        // CTA
        ctaEl.src = base + 'end-screen-cta.png?v=' + Math.random();
        ctaEl.style.left = (110 * scale) + 'px';
        ctaEl.style.top = (809 * scale) + 'px';
        ctaEl.style.width = (421 * scale) + 'px';
        ctaEl.onclick = function () { window.open(window.landingPageUrl, '_blank'); };

        // Play Again button
        var playBtn = document.getElementById('playAgainBtn');
        playBtn.style.fontSize = (19 * scale) + 'px';
        playBtn.style.left = '0px';
        playBtn.style.width = rect.width + 'px';
        playBtn.style.top = (((809 + 101 + 960) / 2 - 17) * scale) + 'px';
        playBtn.onclick = function () {
            hideEndOverlay();
            trackEvent('PlayAgain');
            endScreenBuilt = false;
            document.getElementById('carouselStrip').innerHTML = '';
            matchedCount = 0;
            drawerUnlocked = [];
            hasFirstShoe = false;
            drawerOpen = false;
            drawerAnim = 0;
            drawerAnimDir = 0;
            drawerScrollX = 0;
            hintActive = true;
            currentHintPair = [0, 2];
            hintPairIdx = 0;
            hintCycleStart = 0;
            hintDelayStart = 0;
            generateBoard();
            state = 'intro';
        };

        overlay.classList.add('active');
    }

    function hideEndOverlay() {
        document.getElementById('endOverlay').classList.remove('active');
    }

    function drawEndScreen(time) {
        // Background + logo on canvas
        if (images.endbg) ctx.drawImage(images.endbg, 0, 0, GW, GH);
        if (images.logo) ctx.drawImage(images.logo, 176, 23);

        // Carousel + CTA via CSS overlay
        showEndOverlay();
    }

    /* ─── Input Handling ─── */
    function getPos(e) {
        var t = e.touches ? e.touches[0] : e;
        if (!t && e.changedTouches) t = e.changedTouches[0];
        return toCanvas(t.clientX, t.clientY);
    }

    var introTouchStart = null; // track touch start pos for intro tap detection

    function onDown(e) {
        e.preventDefault();
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        var pos = getPos(e);

        if (state === 'intro') {
            introTouchStart = pos;
            return;
        }

        if (state === 'end') {
            // Any tap goes to website
            window.open(window.landingPageUrl, '_blank');
            return;
        }


        // // DEBUG: skip to end
        // if(state==='playing' && pos.x>=580 && pos.x<=630 && pos.y>=10 && pos.y<=40){
        //   state='end'; return;
        // }

        if (state !== 'playing') return;

        // Check notch tap
        if (hasFirstShoe && images.notch) {
            var notchW = images.notch.width, notchH = images.notch.height;
            var drawerH = images.drawer ? images.drawer.height : 352;
            var slideY = drawerH * drawerAnim;
            var nx = (GW - notchW) / 2;
            var ny = GH - notchH - (slideY > 0 ? slideY - 9 : 0);
            if (pos.x >= nx && pos.x <= nx + notchW && pos.y >= ny && pos.y <= ny + notchH) {
                playSound('drawer');
                if (!drawerOpen && drawerAnimDir !== 1) {
                    drawerOpen = true;
                    drawerAnimDir = 1;
                    drawerAnimStart = performance.now();
                    trackEvent('DrawerOpen');
                } else if (drawerOpen || drawerAnimDir === 1) {
                    drawerAnimDir = -1;
                    drawerAnimStart = performance.now();
                    trackEvent('DrawerClosed');
                }
                return;
            }
            // Check drawer area drag/tap
            if (drawerOpen && drawerAnim > 0.9) {
                var drawerH = images.drawer ? images.drawer.height : 352;
                var slideY = drawerH * drawerAnim;
                var dy = GH - slideY;
                if (pos.y >= dy && pos.y <= GH) {
                    drawerIsDragging = true;
                    drawerDragStartX = pos.x;
                    drawerDragScrollStart = drawerScrollX;
                    return;
                }
            }
        }

        var ci = cellAt(pos.x, pos.y);
        if (ci >= 0) {
            dragIdx = ci;
            isDragging = true;
            dragX = pos.x;
            dragY = pos.y;
            trackEvent(BRANDS[board[ci]] + 'Dragged');
        }
    }

    function onMove(e) {
        e.preventDefault();
        var pos = getPos(e);
        if (drawerIsDragging) {
            drawerScrollX = drawerDragScrollStart - (pos.x - drawerDragStartX);
            return;
        }
        if (!isDragging) return;
        dragX = pos.x;
        dragY = pos.y;
    }

    function onUp(e) {
        e.preventDefault();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        // Intro: only transition on tap (not swipe)
        if (state === 'intro' && introTouchStart) {
            var pos;
            try { pos = getPos(e); } catch (ex) { introTouchStart = null; return; }
            var dx = pos.x - introTouchStart.x, dy = pos.y - introTouchStart.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            introTouchStart = null;
            if (dist < 20) { // only count as tap if finger barely moved
                initAudio();
                if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
                state = 'playing';
                // User first interaction has happened, fire Start play tracking
                trackEvent('StartPlayable');
            }
            return;
        }
        // Drawer slider release — if barely moved, treat as tap on shoe
        if (drawerIsDragging) {
            drawerIsDragging = false;
            var pos;
            try { pos = getPos(e); } catch (ex) { return; }
            var dragDist = Math.abs(pos.x - drawerDragStartX);
            if (dragDist < 10) {
                // Tap — check which shoe was tapped
                var winW = 151, winH = 95, gap = 14, sliderPad = 20;
                var drawerH = images.drawer ? images.drawer.height : 352;
                var slideY = drawerH * drawerAnim;
                var dy = GH - slideY;
                var sliderY = dy + (drawerH - winH) / 2 + 4;
                for (var i = 0; i < drawerUnlocked.length; i++) {
                    var wx = sliderPad + i * (winW + gap) - drawerScrollX;
                    if (pos.x >= wx && pos.x <= wx + winW && pos.y >= sliderY && pos.y <= sliderY + winH) {
                        var brandName = BRANDS[drawerUnlocked[i]];
                        var shoeUrls = {
                            'adidas': 'https://shoesandsox.com.au/products/gazelle-indr-ps-g-powder-plum-lucid-pink-gum?utm_source=programmatic&utm_medium=iion&utm_campaign=sneaker-month',
                            'nike': 'https://shoesandsox.com.au/products/air-max-bia-ps-b-black-university-red-white?utm_source=programmatic&utm_medium=iion&utm_campaign=sneaker-month',
                            'skechers': 'https://shoesandsox.com.au/products/infinite-heart-colour-lovin-youth-lavender-blue-multi?utm_source=programmatic&utm_medium=iion&utm_campaign=sneaker-month',
                            'new balance': 'https://shoesandsox.com.au/products/327-el-pre-school-white-stone?utm_source=programmatic&utm_medium=iion&utm_campaign=sneaker-month',
                            'asics': 'https://shoesandsox.com.au/products/contend-9-grade-school-white-saba-blue?utm_source=programmatic&utm_medium=iion&utm_campaign=sneaker-month',
                            'vans': 'https://shoesandsox.com.au/products/old-skool-youth-black-white?utm_source=programmatic&utm_medium=iion&utm_campaign=sneaker-month',
                            'converse': 'https://shoesandsox.com.au/products/chuck-taylor-astar-hi-yth-white?utm_source=programmatic&utm_medium=iion&utm_campaign=sneaker-month',
                            'reebok': 'https://shoesandsox.com.au/products/club-c-white-glen-green-vector-blue?utm_source=programmatic&utm_medium=iion&utm_campaign=sneaker-month'
                        };
                        trackEvent(brandName + 'ClickedFromDrawer');
                        window.open(window.landingPageUrl, '_blank');
                        return;
                    }
                }
            }
            return;
        }
        if (!isDragging || dragIdx < 0) { isDragging = false; return; }

        var pos;
        try { pos = getPos(e); } catch (ex) { pos = { x: dragX, y: dragY }; }

        var dropIdx = cellAt(pos.x, pos.y);

        if (dropIdx >= 0 && dropIdx !== dragIdx) {
            if (board[dropIdx] === board[dragIdx]) {
                var brand = board[dragIdx];
                var now = performance.now();

                playSound('merge');
                // Deactivate hint only when the hinted pair is matched
                if (hintActive &&
                    ((dragIdx === currentHintPair[0] && dropIdx === currentHintPair[1]) ||
                        (dragIdx === currentHintPair[1] && dropIdx === currentHintPair[0]))) {
                    hintActive = false;
                    hintDelayStart = performance.now();
                }
                trackEvent(BRANDS[brand] + 'Dropped');
                anims.push({ type: 'match', cell: dragIdx, brand: brand, start: now, duration: 500 });
                anims.push({ type: 'match', cell: dropIdx, brand: brand, start: now, duration: 500 });
                anims.push({ type: 'unlockcard', brand: brand, dropCell: dropIdx, start: now + 300, duration: 2200, soundPlayed: false });

                board[dragIdx] = -1;
                board[dropIdx] = -1;
                matchedCount++;

                if (matchedCount === 8) {
                    trackEvent('PlayableComplete');
                    // Show congrats board after unlock card animates out (2500ms), then go to end screen
                    setTimeout(function () {
                        anims.push({ type: 'congratsboard', start: performance.now(), duration: 2200 });
                    }, 2700);
                    setTimeout(function () { state = 'end'; }, 5200);
                }
            } else {
                playSound('error');
            }
        }

        isDragging = false;
        dragIdx = -1;
    }

    /* ─── Init ─── */
    function init() {
        var loader = document.getElementById('loader');
        loader.classList.add('hidden');
        setTimeout(function () { loader.parentNode.removeChild(loader); }, 400);
        // Ensure custom fonts are loaded before rendering
        document.fonts.ready.then(function () { requestAnimationFrame(render); });

        generateBoard();
        state = 'intro';

        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        canvas.addEventListener('touchend', onUp, { passive: false });

        requestAnimationFrame(render);
    }

})();