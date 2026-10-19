/* Compact dashboard and reliable Pomodoro timer patch.
 * Loaded after the page UI so it can keep the existing controls while fixing their behavior.
 */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  // Make the home dashboard compact without changing the fixed wallpaper.
  // Fullscreen size is a real layout zoom: the timer grows while supporting text,
  // spacing and controls scale down to preserve room and avoid overlap.
  const compactCss = document.createElement('style');
  compactCss.id = 'flowspace-compact-home-and-timer';
  compactCss.textContent = `
    .main { height: calc(100vh - 124px); overflow-y: auto; overflow-x: hidden; align-items: flex-start; padding: 8px 16px 68px; scrollbar-width: thin; }
    .center { flex: 0 0 auto; }
    body[data-view="focus"] .main, body[data-view="ambient"] .main { align-items: center; }
    #homeView { padding-top: 2px; }
    #homeView .greeting { font-size: clamp(16px, 1.6vw, 21px); line-height: 1.25; }
    #homeView .date { margin-top: 3px; font-size: 10px; letter-spacing: 1.3px; }
    #homeView .clock { margin: 8px 0 7px; gap: 6px; }
    #homeView .digit { width: clamp(38px, 6.2vw, 76px); height: clamp(52px, 7.2vw, 84px); border-radius: 8px; font-size: clamp(36px, 5.8vw, 64px); letter-spacing: -2px; }
    #homeView .colon { font-size: clamp(28px, 4vw, 46px); }
    #homeView .ampm { font-size: 11px; margin-bottom: 7px; }
    #homeView .subline { font-size: 12px; margin: 6px 0 8px; }
    #homeView .task { margin: 0 auto 9px; gap: 6px; }
    #homeView .task input { padding: 9px 14px; font-size: 13px; }
    #homeView .task button { padding: 8px 14px; font-size: 12px; }
    #homeView .homeStatsGrid { width: min(440px, 92vw); margin-top: 8px; gap: 6px; }
    #homeView .homeStatCard { padding: 7px 10px; border-radius: 10px; }
    #homeView .homeStatTop { font-size: 9px; letter-spacing: .4px; margin-bottom: 2px; }
    #homeView .homeStatMain { font-size: 14px; }
    #homeView .homeStatProgress { height: 4px; margin-top: 5px; }
    #homeView .quote { font-size: 12px; line-height: 1.4; margin: 9px auto 0; max-width: 500px; }
    #focusView { padding-top: 16px; }
    #focusView .timerVisual { margin: 8px auto; max-width: 94vw; }
    body.immersive-fullscreen #focusView .timerVisual { margin: var(--focus-timer-margin, 8px) auto; }
    body.immersive-fullscreen #focusView .timerVisual .timerRead {
      font-size: var(--focus-timer-font-size, clamp(90px, 15vw, 190px)) !important;
      line-height: 1.02; letter-spacing: -.035em;
    }
    body.immersive-fullscreen #focusView .timerVisual .gauge,
    body.immersive-fullscreen #focusView .timerVisual .pie {
      width: var(--focus-timer-diameter, 220px) !important;
      height: var(--focus-timer-diameter, 220px) !important;
    }
    body.immersive-fullscreen #focusView .timerVisual .gauge span { font-size: var(--focus-gauge-label-size, 34px) !important; }
    body.immersive-fullscreen #focusView .timerVisual .pie + div { font-size: var(--focus-gauge-label-size, 34px) !important; }
    body.immersive-fullscreen #focusView #sessionInfo { font-size: var(--focus-support-font, 14px); margin: var(--focus-support-margin, 8px) 0; }
    body.immersive-fullscreen #focusView #sessionLabel { font-size: var(--focus-label-font, 20px); line-height: 1.2; }
    body.immersive-fullscreen #focusView .focusGoal { gap: var(--focus-support-gap, 10px); margin: var(--focus-support-margin, 8px) 0; }
    body.immersive-fullscreen #focusView .goalBadge { font-size: var(--focus-support-small-font, 13px); padding: var(--focus-badge-pad-y, 9px) var(--focus-badge-pad-x, 18px); }
    body.immersive-fullscreen #focusView .motivation { font-size: var(--focus-motivation-font, 18px); margin: var(--focus-support-margin, 8px) auto; max-width: 84vw; line-height: 1.35; }
    body.immersive-fullscreen #focusView .controls { gap: var(--focus-support-gap, 10px); }
    body.immersive-fullscreen #focusView .controls button { font-size: var(--focus-support-font, 14px); padding: var(--focus-button-pad-y, 10px) var(--focus-button-pad-x, 22px); }
    body.immersive-fullscreen #focusView > .row { font-size: var(--focus-support-small-font, 12px); margin-top: var(--focus-support-margin, 8px) !important; gap: var(--focus-support-gap, 10px); }
    #sessionInfo { margin: 8px 0 14px; }
    @media (max-width: 650px) {
      .main { height: calc(100vh - 116px); padding: 6px 10px 62px; }
      #homeView .clock { gap: 4px; }
      #homeView .digit { width: clamp(31px, 10vw, 55px); height: clamp(45px, 13vw, 65px); font-size: clamp(30px, 9vw, 45px); }
      #homeView .colon { font-size: 26px; }
      #homeView .homeStatsGrid { width: min(390px, 96vw); gap: 5px; }
      #homeView .homeStatCard { padding: 7px 8px; }
      #homeView .homeStatMain { font-size: 13px; }
      .bottom { bottom: 8px; }
    }
  `;
  document.head.appendChild(compactCss);

  // These bindings are global lexical declarations from the existing inline UI script.
  if (typeof dur === 'function') {
    dur = function () {
      const field = kind === 'longBreak' ? '#longLen' : kind === 'break' ? '#breakLen' : '#focusLen';
      const fallback = kind === 'longBreak' ? 15 : kind === 'break' ? 5 : 25;
      return (Number($(field)?.value) || fallback) * 60;
    };
  }

  let focusSecBuffer = 0;
  let sessionFocusSeconds = 0;
  let sessionStartedAt = Date.now();

  function flushFocusTime() {
    const seconds = Math.floor(focusSecBuffer);
    focusSecBuffer -= seconds;
    if (seconds > 0 && kind === 'focus' && window.Stats?.recordFocusProgress) {
      window.Stats.recordFocusProgress(seconds, false, sessionFocusSeconds);
    }
  }

  function applyFocusZoomLayout() {
    const focus = $('#focusView');
    if (!focus) return;
    const rawZoom = Number($('#hudClockSize')?.value || $('#clockZoom')?.value || 100);
    const zoom = Math.max(0.6, Math.min(1.8, rawZoom / 100));
    const width = Math.max(320, window.innerWidth || 1280);
    const height = Math.max(320, window.innerHeight || 800);
    const supportScale = Math.max(0.65, Math.min(1.18, 1.18 - ((zoom - 0.6) * 0.46)));
    const timerFont = Math.max(42, Math.min(height * 0.29, Math.min(width * 0.20, height * 0.18 * zoom)));
    const timerDiameter = Math.max(100, Math.min(height * 0.48, Math.min(width * 0.68, 220 * zoom)));
    focus.style.setProperty('--focus-timer-zoom', String(zoom));
    focus.style.setProperty('--focus-timer-font-size', timerFont + 'px');
    focus.style.setProperty('--focus-timer-diameter', timerDiameter + 'px');
    focus.style.setProperty('--focus-gauge-label-size', Math.max(18, timerDiameter * 0.16) + 'px');
    focus.style.setProperty('--focus-timer-margin', Math.max(2, 10 * supportScale) + 'px');
    focus.style.setProperty('--focus-support-scale', String(supportScale));
    focus.style.setProperty('--focus-support-font', Math.max(11, 14 * supportScale) + 'px');
    focus.style.setProperty('--focus-support-small-font', Math.max(10, 12 * supportScale) + 'px');
    focus.style.setProperty('--focus-label-font', Math.max(13, 20 * supportScale) + 'px');
    focus.style.setProperty('--focus-motivation-font', Math.max(12, 18 * supportScale) + 'px');
    focus.style.setProperty('--focus-support-margin', Math.max(3, 10 * supportScale) + 'px');
    focus.style.setProperty('--focus-support-gap', Math.max(4, 10 * supportScale) + 'px');
    focus.style.setProperty('--focus-badge-pad-y', Math.max(4, 9 * supportScale) + 'px');
    focus.style.setProperty('--focus-badge-pad-x', Math.max(7, 18 * supportScale) + 'px');
    focus.style.setProperty('--focus-button-pad-y', Math.max(6, 10 * supportScale) + 'px');
    focus.style.setProperty('--focus-button-pad-x', Math.max(10, 22 * supportScale) + 'px');
  }
  window.addEventListener('resize', applyFocusZoomLayout, { passive: true });
  window.addEventListener('orientationchange', applyFocusZoomLayout, { passive: true });
  const originalSetClockZoom = setClockZoom;
  setClockZoom = function (newZoom) {
    originalSetClockZoom(newZoom);
    applyFocusZoomLayout();
  };

  const focusIslamicQuotes = [
    '“Indeed, with hardship comes ease.” — Qur’an 94:5',
    '“My Lord, increase me in knowledge.” — Qur’an 20:114',
    '“And whoever relies upon Allah—then He is sufficient for him.” — Qur’an 65:3'
  ];
  updateMotivation = function () {
    const el = $('#motivation');
    if (!el) return;
    const completed = Number(window.Stats?.getRawStatistics?.()?.lifetime?.completedSessions || 0);
    el.textContent = focusIslamicQuotes[completed % focusIslamicQuotes.length];
  };

  // Make the requested Islamic quote the initial fullscreen preference once;
  // users can subsequently change it from Settings without being overridden.
  try {
    if (!localStorage.getItem('flowspace_fullscreen_quote_pref_v1')) {
      const quoteMode = $('#fullscreenQuoteMode');
      if (quoteMode) quoteMode.value = 'islamic';
      localStorage.setItem('flowspace_fullscreen_quote_pref_v1', '1');
      if (typeof autoSaveSettings === 'function') autoSaveSettings();
    }
  } catch (_) {}

  // Avoid showing the exact same Islamic quote in both the motivation line and the fullscreen footer.
  try {
    if (typeof fullscreenQuoteIndex !== 'undefined' && typeof getQuoteModeForContext === 'function' && getQuoteModeForContext('fullscreen') === 'islamic') {
      const completed = Number(window.Stats?.getRawStatistics?.()?.lifetime?.completedSessions || 0);
      fullscreenQuoteIndex = (completed + 1) % islamicQuotes.length;
      if (typeof renderQuote === 'function') renderQuote();
    }
  } catch (_) {}

  // Make sure the dim setting is applied on startup as well as from the HUD.
  const initialDim = Math.max(0, Math.min(85, Number($('#dim')?.value ?? 15))) / 100;
  document.documentElement.style.setProperty('--wallpaper-dim', String(initialDim));
  if ($('#shade')) $('#shade').style.background = 'rgba(0,0,0,' + initialDim + ')';

  const originalRenderTimer = renderTimer;
  renderTimer = function (fullStats = false) {
    originalRenderTimer(fullStats);
    applyFocusZoomLayout();
    const label = $('#sessionLabel');
    const info = $('#sessionInfo');
    const startBtn = $('#startBtn');
    if (label) {
      label.textContent = kind === 'longBreak' ? 'Time for a longer recharge.' :
        kind === 'break' ? 'Time to recharge.' :
        mode === 'stopwatch' ? 'Stopwatch' :
        mode === 'countdown' ? 'Countdown' : 'Time to focus.';
    }
    if (info) {
      info.textContent = mode === 'stopwatch' ? 'Elapsed time' :
        kind === 'longBreak' ? `Long break · After session ${Math.max(1, session - 1)}` :
        kind === 'break' ? `Short break · After session ${Math.max(1, session - 1)}` :
        `Focus session · Session ${session}`;
    }
    if (startBtn) startBtn.textContent = running ? 'Pause' :
      kind === 'longBreak' ? 'Start long break' :
      kind === 'break' ? 'Start break' :
      mode === 'countdown' ? 'Start countdown' :
      mode === 'stopwatch' ? 'Start stopwatch' : 'Start focus';
  };

  const originalSyncMiniTimer = syncMiniTimer;
  syncMiniTimer = function () {
    originalSyncMiniTimer();
    if ($('#miniTimerModeLabel') && kind === 'longBreak') {
      $('#miniTimerModeLabel').textContent = 'Long break';
      $('#miniTimerModeLabel').classList.add('break');
    }
    if ($('#miniTimerSession') && kind === 'longBreak') {
      $('#miniTimerSession').textContent = `Long break · After session ${Math.max(1, session - 1)}`;
    }
  };

  start = function () {
    if (running) { stop(); return; }
    if (mode !== 'stopwatch' && remaining <= 0) remaining = dur();
    running = true;
    if (interval) clearInterval(interval);
    lastTickTime = Date.now();
    endAt = Date.now() + (mode === 'stopwatch' ? 0 : remaining * 1000);
    const base = elapsed;
    const started = Date.now();
    interval = setInterval(() => {
      const now = Date.now();
      const deltaSec = Math.min(2, Math.max(0, (now - lastTickTime) / 1000));
      lastTickTime = now;

      if (kind === 'focus') {
        focusSecBuffer += deltaSec;
        sessionFocusSeconds += deltaSec;
        if (focusSecBuffer >= 5) flushFocusTime();
      }

      if (mode === 'stopwatch') {
        elapsed = base + (Date.now() - started) / 1000;
      } else {
        remaining = Math.max(0, (endAt - Date.now()) / 1000);
        if (remaining <= 0) { finish(); return; }
      }
      renderTimer(false);
    }, 250);
    renderTimer(true);
  };

  stop = function () {
    running = false;
    if (interval) { clearInterval(interval); interval = null; }
    flushFocusTime();
    renderTimer(true);
  };

  finish = function () {
    if (interval) { clearInterval(interval); interval = null; }
    running = false;
    flushFocusTime();

    if (kind === 'focus') {
      if (mode === 'pomodoro' && window.Stats?.recordFocusProgress) {
        window.Stats.recordFocusProgress(0, true, sessionFocusSeconds);
      }
      if (mode === 'pomodoro') {
        $('#motivation').textContent = '🎉 Focus session complete. Take a short break—you earned it.';
        const completedSession = session;
        session += 1;
        sessionFocusSeconds = 0;
        sessionStartedAt = Date.now();
        if ($('#breaksOn')?.checked) {
          kind = completedSession % 4 === 0 ? 'longBreak' : 'break';
          remaining = dur();
          renderTimer(true);
          if ($('#autoBreak')?.checked) start();
          return;
        }
        kind = 'focus';
        remaining = dur();
      } else {
        $('#motivation').textContent = 'Timer complete. Take a breath before your next task.';
        remaining = dur();
      }
    } else {
      kind = 'focus';
      remaining = dur();
      sessionFocusSeconds = 0;
      sessionStartedAt = Date.now();
      $('#motivation').textContent = 'Break finished. Ready for another focused round?';
    }
    renderTimer(true);
  };

  $('#startBtn')?.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    start();
  }, true);

  $('#resetBtn')?.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    stop();
    focusSecBuffer = 0;
    sessionFocusSeconds = 0;
    sessionStartedAt = Date.now();
    elapsed = 0;
    kind = 'focus';
    remaining = dur();
    renderTimer(true);
  }, true);

  $('#skipBtn')?.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    stop();
    focusSecBuffer = 0;
    sessionFocusSeconds = 0;
    if (kind === 'focus' && mode === 'pomodoro' && $('#breaksOn')?.checked) {
      kind = session % 4 === 0 ? 'longBreak' : 'break';
    } else {
      kind = 'focus';
    }
    remaining = dur();
    renderTimer(true);
  }, true);

  $$('[data-mode]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopImmediatePropagation();
      const targetMode = button.dataset.mode;
      if (targetMode === mode) return;
      if (running) {
        pendingSwitchMode = targetMode;
        const modal = $('#timerRunningModal');
        if (modal) modal.style.display = 'flex';
        return;
      }
      mode = targetMode;
      kind = 'focus';
      elapsed = 0;
      focusSecBuffer = 0;
      sessionFocusSeconds = 0;
      remaining = mode === 'stopwatch' ? 0 : dur();
      $$('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
      renderTimer(true);
    }, true);
  });

  $('#stopAndSwitchBtn')?.addEventListener('click', (event) => {
    if (!pendingSwitchMode) return;
    event.stopImmediatePropagation();
    const modal = $('#timerRunningModal');
    if (modal) modal.style.display = 'none';
    stop();
    mode = pendingSwitchMode;
    pendingSwitchMode = null;
    kind = 'focus';
    elapsed = 0;
    focusSecBuffer = 0;
    sessionFocusSeconds = 0;
    remaining = mode === 'stopwatch' ? 0 : dur();
    $$('[data-mode]').forEach((item) => item.classList.toggle('active', item.dataset.mode === mode));
    renderTimer(true);
  }, true);

  // Keep the motivation text Islamic even when the saved settings are loaded.
  try {
    if ($('#motivation') && /Start small\. Stay with it\. Future you will be glad you did\./i.test($('#motivation').textContent)) {
      $('#motivation').textContent = focusIslamicQuotes[0];
    }
  } catch (_) {}

  // Render compact state and labels immediately on website and in the Electron renderer.
  renderTimer(true);
  applyFocusZoomLayout();
  window.addEventListener('flowspace-focus-zoom', applyFocusZoomLayout);
})();
