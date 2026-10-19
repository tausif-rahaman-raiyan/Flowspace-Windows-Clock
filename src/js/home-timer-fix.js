/* Compact dashboard and reliable Pomodoro timer patch.
 * Loaded after the page UI so it can keep the existing controls while fixing their behavior.
 */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  // Make the home dashboard compact without changing the fixed wallpaper.
  const compactCss = document.createElement('style');
  compactCss.id = 'flowspace-compact-home-and-timer';
  compactCss.textContent = `
    .main { height: calc(100vh - 124px); overflow-y: auto; overflow-x: hidden; align-items: flex-start; padding: 8px 16px 68px; scrollbar-width: thin; }
    .center { flex: 0 0 auto; }
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

  const originalRenderTimer = renderTimer;
  renderTimer = function (fullStats = false) {
    originalRenderTimer(fullStats);
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

  // Render compact state and labels immediately on website and in the Electron renderer.
  renderTimer(true);
})();
