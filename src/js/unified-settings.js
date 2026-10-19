/* Flowspace unified settings bridge.
 * Applies every Customize dashboard control immediately, restores persisted values,
 * and keeps settings shared across Home, Focus, Ambient and fullscreen modes.
 */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const ids = [
    'settingsUserName','format','seconds','clockZoom','clockBrightness','clockFaceStyle',
    'showDate','showGreeting','timerStyle','dashboardQuoteMode','fullscreenQuoteMode',
    'fullscreenEditingBarToggle','quoteSize','focusLen','dailyGoal','breakLen','longLen',
    'streakMinLen','streakRequireGoal','streakFreezeToggle','dim','blur'
  ];

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }

  function restoreUnifiedSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('settings') || '{}') || {}; } catch (_) {}
    ids.forEach((id) => {
      const el = $('#' + id);
      if (!el || !Object.prototype.hasOwnProperty.call(saved, id)) return;
      if (el.type === 'checkbox') el.checked = Boolean(saved[id]);
      else if (saved[id] != null) el.value = String(saved[id]);
    });
    if (saved.fullscreenEditingBar !== undefined && $('#fullscreenEditingBarToggle')) {
      $('#fullscreenEditingBarToggle').value = saved.fullscreenEditingBar ? 'true' : 'false';
    }
    const app = window.appState;
    if (app && app.settings && app.settings.streak) {
      const streak = app.settings.streak;
      if (saved.streakMinLen !== undefined) streak.minimumMinutes = clamp(saved.streakMinLen, 1, 720, 30);
      if (saved.streakRequireGoal !== undefined) streak.requireDailyGoal = Boolean(saved.streakRequireGoal);
      if (saved.streakFreezeToggle !== undefined) streak.freezeEnabled = Boolean(saved.streakFreezeToggle);
    }
  }

  function applyClockFace() {
    const style = $('#clockFaceStyle')?.value || 'classic';
    document.body.dataset.clockFace = style;
    ['#clock', '#ambientClock'].forEach((selector) => {
      const el = $(selector);
      if (el) el.dataset.clockFace = style;
    });
  }

  function applyDateGreeting() {
    const date = $('#date');
    const greeting = $('#greeting');
    if (date) date.style.display = $('#showDate')?.checked === false ? 'none' : '';
    if (greeting) greeting.style.display = $('#showGreeting')?.checked === false ? 'none' : '';
  }

  function applyWallpaper() {
    const dim = clamp($('#dim')?.value, 0, 75, 15);
    const blur = clamp($('#blur')?.value, 0, 12, 0);
    document.documentElement.style.setProperty('--wallpaper-dim', String(dim / 100));
    const shade = $('#shade');
    const bg = $('#bg');
    if (shade) shade.style.backgroundColor = 'rgba(0,0,0,' + (dim / 100) + ')';
    if (bg) bg.style.filter = 'blur(' + blur + 'px)';
    if ($('#hudDim') && Number($('#hudDim').value) !== dim) $('#hudDim').value = String(dim);
    if ($('#hudDimVal')) $('#hudDimVal').textContent = dim + '%';
  }

  function syncStreakSettings() {
    const app = window.appState;
    if (!app || !app.settings) return;
    app.settings.streak = app.settings.streak || {};
    app.settings.streak.minimumMinutes = clamp($('#streakMinLen')?.value, 1, 720, 30);
    app.settings.streak.requireDailyGoal = Boolean($('#streakRequireGoal')?.checked);
    app.settings.streak.freezeEnabled = Boolean($('#streakFreezeToggle')?.checked);
    if (typeof window.saveAppData === 'function') window.saveAppData();
    if (typeof window.refreshStatistics === 'function') window.refreshStatistics();
  }

  function applyAll({save = false} = {}) {
    applyClockFace();
    applyDateGreeting();
    applyWallpaper();
    const quoteSize = clamp($('#quoteSize')?.value, 10, 48, 16);
    document.documentElement.style.setProperty('--quote-size', quoteSize + 'px');
    if ($('#quoteSizeValue')) $('#quoteSizeValue').textContent = quoteSize + 'px';

    if (typeof window.applyClockAppearance === 'function') window.applyClockAppearance();
    else if (typeof window.applyClockZoom === 'function') window.applyClockZoom();
    if (typeof window.tick === 'function') window.tick();
    if (typeof window.renderQuote === 'function') window.renderQuote();
    if (typeof window.renderTimer === 'function') window.renderTimer();
    if (typeof window.updateGreeting === 'function') window.updateGreeting();
    if (typeof window.updateFullscreenEditingBar === 'function') window.updateFullscreenEditingBar();
    if (typeof window.updateStats === 'function') window.updateStats();

    if (save) {
      syncStreakSettings();
      if (typeof window.autoSaveSettings === 'function') window.autoSaveSettings();
      else {
        try { localStorage.setItem('settings', JSON.stringify(snapshot())); } catch (_) {}
      }
    }
  }

  function snapshot() {
    let value = {};
    if (typeof window.snapshotSettings === 'function') {
      try { value = window.snapshotSettings() || {}; } catch (_) {}
    }
    value.clockFaceStyle = $('#clockFaceStyle')?.value || 'classic';
    value.showDate = $('#showDate')?.checked !== false;
    value.showGreeting = $('#showGreeting')?.checked !== false;
    value.streakMinLen = clamp($('#streakMinLen')?.value, 1, 720, 30);
    value.streakRequireGoal = Boolean($('#streakRequireGoal')?.checked);
    value.streakFreezeToggle = Boolean($('#streakFreezeToggle')?.checked);
    value.fullscreenEditingBar = $('#fullscreenEditingBarToggle')?.value === 'true';
    return value;
  }

  // Preserve the original save implementation while ensuring all newer controls are included.
  const originalSnapshot = window.snapshotSettings;
  if (typeof originalSnapshot === 'function') {
    window.snapshotSettings = function () {
      const value = originalSnapshot.apply(this, arguments) || {};
      value.clockFaceStyle = $('#clockFaceStyle')?.value || 'classic';
      value.showDate = $('#showDate')?.checked !== false;
      value.showGreeting = $('#showGreeting')?.checked !== false;
      value.streakMinLen = clamp($('#streakMinLen')?.value, 1, 720, 30);
      value.streakRequireGoal = Boolean($('#streakRequireGoal')?.checked);
      value.streakFreezeToggle = Boolean($('#streakFreezeToggle')?.checked);
      return value;
    };
  }

  // One delegated listener means new/future settings controls work without separate handlers.
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (!el || !el.closest('#settingsPanel') || !ids.includes(el.id)) return;
    applyAll({save: true});
  });
  document.addEventListener('change', (event) => {
    const el = event.target;
    if (!el || !el.closest('#settingsPanel') || !ids.includes(el.id)) return;
    applyAll({save: true});
  });

  // Keep fullscreen HUD controls and the Customize panel synchronized both ways.
  ['hudClockSize','hudClockBright','hudDim'].forEach((id) => {
    const el = $('#' + id);
    if (!el) return;
    el.addEventListener('input', () => {
      const pair = id === 'hudClockSize' ? 'clockZoom' : id === 'hudClockBright' ? 'clockBrightness' : 'dim';
      const target = $('#' + pair);
      if (target) target.value = el.value;
      applyAll({save: true});
    });
  });

  restoreUnifiedSettings();
  applyAll();
})();
