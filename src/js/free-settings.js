/* Flowspace free customization layer.
 * Local-only settings: no paid plan, API key, remote assets, or network dependency.
 */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const face = () => $('#clockFaceStyle')?.value || 'classic';

  function applyFreeSettings() {
    document.body.dataset.clockFace = face();
    const date = $('#date');
    const greeting = $('#greeting');
    if (date) date.style.display = $('#showDate')?.checked === false ? 'none' : '';
    if (greeting) greeting.style.display = $('#showGreeting')?.checked === false ? 'none' : '';
  }

  const originalSnapshot = window.snapshotSettings;
  if (typeof originalSnapshot === 'function') {
    window.snapshotSettings = function () {
      const data = originalSnapshot.apply(this, arguments);
      data.clockFaceStyle = face();
      data.showDate = $('#showDate')?.checked !== false;
      data.showGreeting = $('#showGreeting')?.checked !== false;
      return data;
    };
  }

  const originalSave = window.autoSaveSettings;
  if (typeof originalSave === 'function') {
    window.autoSaveSettings = function () {
      applyFreeSettings();
      return originalSave.apply(this, arguments);
    };
  }

  ['clockFaceStyle', 'showDate', 'showGreeting'].forEach((id) => {
    const el = $('#' + id);
    if (!el) return;
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'change', () => {
      applyFreeSettings();
      if (typeof window.autoSaveSettings === 'function') window.autoSaveSettings();
    });
  });

  // Restore and apply immediately; the existing settings loader populates these controls first.
  try {
    const saved = JSON.parse(localStorage.getItem('settings') || '{}');
    if ($('#clockFaceStyle') && saved.clockFaceStyle) $('#clockFaceStyle').value = saved.clockFaceStyle;
    if ($('#showDate') && typeof saved.showDate === 'boolean') $('#showDate').checked = saved.showDate;
    if ($('#showGreeting') && typeof saved.showGreeting === 'boolean') $('#showGreeting').checked = saved.showGreeting;
  } catch (_) {}
  applyFreeSettings();
})();
