/**
 * Flowspace v3.0.0 — Core Logic, Data Model & JavaScript Architecture
 * Offline-first, central state, drift-free timestamp timer, single source of truth.
 */

(function (root) {
  'use strict';

  const FLOWSPACE_VERSION = 3;
  const STORAGE_KEY = 'flowspace_data_v3';
  const LEGACY_STORAGE_KEY = 'flowStudy';
  const SYNC_CHANNEL_NAME = 'flowspace_sync';

  // --- Central Global State (Section 3) ---
  const appState = {
    version: FLOWSPACE_VERSION,
    settings: {
      dailyGoalMinutes: 120,
      streak: {
        enabled: true,
        minimumMinutes: 30,
        requireDailyGoal: false,
        freezeEnabled: true,
        maxFreezeCharges: 2,
        maxFreezeDaysPerMonth: 2
      },
      weeklyGoal: {
        enabled: true,
        studyDays: 5,
        focusMinutes: 600
      },
      timer: {
        defaultMode: 'pomodoro',
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreaks: true,
        breaksEnabled: true
      },
      clock: {
        format: '12h',
        showSeconds: true,
        zoom: 100,
        brightness: 100
      },
      sounds: {
        enabled: true,
        volume: 0.35,
        current: 'none'
      },
      appearance: {
        wallpaperDim: 0.15,
        wallpaperBlur: 0,
        quoteModeDashboard: 'english',
        quoteModeFullscreen: 'english',
        quoteSize: 16
      }
    },
    ui: {
      currentView: 'home',
      activeStreakTab: 'calendar',
      calendarYear: new Date().getFullYear(),
      calendarMonth: new Date().getMonth(),
      selectedDayKey: null
    }
  };

  // --- Central Statistics Structure (Section 7) ---
  let statistics = {
    lifetime: {
      focusSeconds: 0,
      sessionCount: 0,
      completedSessions: 0,
      studyDays: 0
    },
    streak: {
      current: 0,
      best: 0,
      lastCalculatedDate: null,
      freezesAvailable: 2,
      freezesUsedTotal: 0
    },
    days: {},
    sessions: [],
    achievements: {}
  };

  // --- Timestamp-Driven Timer State (Section 4) ---
  const timerState = {
    mode: 'pomodoro',       // 'pomodoro' | 'countdown' | 'stopwatch'
    kind: 'focus',          // 'focus' | 'break' | 'longBreak'
    running: false,
    startedAt: null,
    pausedAt: null,
    accumulatedFocusSeconds: 0,
    remainingSeconds: 25 * 60,
    totalSeconds: 25 * 60,
    sessionCount: 1,
    pomodoroCycle: 1,
    intervalId: null,
    sessionId: null,
    lastTickAt: null
  };

  let activeSession = null;

  // --- Date Utilities (Section 8) ---
  function formatDateKey(date = new Date()) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseDateKey(key) {
    if (!key || typeof key !== 'string') return new Date();
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function getPreviousDateKey(dateKey) {
    const date = parseDateKey(dateKey);
    return formatDateKey(addDays(date, -1));
  }

  function todayKey() {
    return formatDateKey(new Date());
  }

  // --- Session Data Record Factory (Section 5) ---
  function createSessionRecord({ mode, kind, plannedSeconds }) {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    return {
      id,
      mode: mode || 'pomodoro',
      kind: kind || 'focus',
      plannedSeconds: plannedSeconds || 1500,
      actualSeconds: 0,
      startedAt: new Date().toISOString(),
      endedAt: null,
      pausedSeconds: 0,
      pauseCount: 0,
      completed: false,
      cancelled: false,
      abandoned: false,
      source: 'main',
      dateKey: todayKey()
    };
  }

  // --- Daily Statistics Factory (Section 6) ---
  function createDailyStats(dateKey) {
    return {
      date: dateKey,
      focusSeconds: 0,
      sessionCount: 0,
      completedSessions: 0,
      cancelledSessions: 0,
      abandonedSessions: 0,
      goalCompleted: false,
      streakEligible: false,
      frozen: false,
      freezeUsed: false,
      firstSessionAt: null,
      lastSessionAt: null
    };
  }

  // --- Streak Eligibility (Section 9) ---
  function isDayStreakEligible(dateKey) {
    const day = statistics.days[dateKey];
    if (!day) return false;
    if (day.frozen) return true; // Streak freezes count as eligible without adding fake time

    const minimumMinutes = appState.settings.streak.minimumMinutes || 30;
    const minutes = (day.focusSeconds || 0) / 60;

    if (appState.settings.streak.requireDailyGoal) {
      return !!day.goalCompleted;
    }
    return minutes >= minimumMinutes;
  }

  // --- Daily Goal Calculation (Section 10) ---
  function getDailyGoalSeconds() {
    return (appState.settings.dailyGoalMinutes || 120) * 60;
  }

  function calculateDailyGoal(dateKey = todayKey()) {
    const day = statistics.days[dateKey];
    const goalSeconds = getDailyGoalSeconds();
    if (!day) {
      return {
        seconds: 0,
        goalSeconds,
        percentage: 0,
        completed: false,
        remainingSeconds: goalSeconds
      };
    }
    const seconds = day.focusSeconds || 0;
    const percentage = goalSeconds > 0
      ? Math.min(100, Math.round((seconds / goalSeconds) * 100))
      : 100;

    return {
      seconds,
      goalSeconds,
      percentage,
      completed: seconds >= goalSeconds,
      remainingSeconds: Math.max(0, goalSeconds - seconds)
    };
  }

  // --- Session Recording & Lifetime Aggregation (Sections 11 & 12) ---
  function recordSession(session) {
    if (!session || !session.id) return;

    // Guard duplicate sessions (Section 58)
    const existingIndex = statistics.sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      statistics.sessions[existingIndex] = session;
    } else {
      statistics.sessions.push(session);
    }

    const dateKey = session.dateKey || todayKey();
    if (!statistics.days[dateKey]) {
      statistics.days[dateKey] = createDailyStats(dateKey);
    }

    const day = statistics.days[dateKey];
    day.sessionCount++;
    day.focusSeconds += (session.actualSeconds || 0);

    if (session.completed) day.completedSessions++;
    if (session.cancelled) day.cancelledSessions++;
    if (session.abandoned) day.abandonedSessions++;

    if (!day.firstSessionAt) {
      day.firstSessionAt = session.startedAt;
    }
    day.lastSessionAt = session.endedAt || new Date().toISOString();

    const goal = calculateDailyGoal(dateKey);
    day.goalCompleted = goal.completed;
    day.streakEligible = isDayStreakEligible(dateKey);

    refreshStatistics();
  }

  function recalculateLifetimeStats() {
    let focusSeconds = 0;
    let sessionCount = 0;
    let completedSessions = 0;
    let studyDays = 0;

    Object.values(statistics.days).forEach(day => {
      focusSeconds += (day.focusSeconds || 0);
      sessionCount += (day.sessionCount || 0);
      completedSessions += (day.completedSessions || 0);
      if (isDayStreakEligible(day.date)) {
        studyDays++;
      }
    });

    statistics.lifetime = {
      focusSeconds: Math.round(focusSeconds),
      sessionCount,
      completedSessions,
      studyDays
    };
  }

  // --- Current Streak Calculation (Section 13) ---
  function calculateCurrentStreak() {
    const today = new Date();
    let currentDate = today;
    let streak = 0;
    const todayK = formatDateKey(today);

    // If today is not yet eligible, check if yesterday was eligible to keep streak alive
    if (!isDayStreakEligible(todayK)) {
      currentDate = addDays(currentDate, -1);
      const yesterdayK = formatDateKey(currentDate);
      if (!isDayStreakEligible(yesterdayK)) {
        return 0;
      }
    }

    // Step backwards through continuous eligible days
    let safetyCounter = 0;
    while (safetyCounter < 5000) {
      safetyCounter++;
      const key = formatDateKey(currentDate);
      if (!isDayStreakEligible(key)) {
        break;
      }
      streak++;
      currentDate = addDays(currentDate, -1);
    }

    return streak;
  }

  // --- Best Streak Calculation (Section 14) ---
  function calculateBestStreak() {
    const keys = Object.keys(statistics.days).sort();
    let best = 0;
    let current = 0;
    let previousKey = null;

    for (const key of keys) {
      if (!isDayStreakEligible(key)) {
        current = 0;
        previousKey = key;
        continue;
      }

      if (previousKey && getPreviousDateKey(key) === previousKey) {
        current++;
      } else {
        current = 1;
      }

      best = Math.max(best, current);
      previousKey = key;
    }

    // Ensure best streak is at least as large as current active streak
    const currentActive = calculateCurrentStreak();
    return Math.max(best, currentActive);
  }

  function recalculateStreakStats() {
    statistics.streak.current = calculateCurrentStreak();
    statistics.streak.best = calculateBestStreak();
    statistics.streak.lastCalculatedDate = todayKey();
    if (typeof statistics.streak.freezesAvailable !== 'number') {
      statistics.streak.freezesAvailable = appState.settings.streak.maxFreezeCharges || 2;
    }
    saveAppData();
  }

  // --- Streak Freeze System (Sections 16 & 17) ---
  function canUseStreakFreeze(dateKey) {
    const settings = appState.settings.streak;
    if (!settings.freezeEnabled) return false;
    if ((statistics.streak.freezesAvailable || 0) <= 0) return false;
    
    // Cannot freeze if day already has study minutes or is today with time
    const day = statistics.days[dateKey];
    if (day && day.focusSeconds > 0) return false;
    if (day && day.frozen) return false; // already frozen

    // Do not freeze future dates
    const d = parseDateKey(dateKey);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    if (d > now) return false;

    return true;
  }

  function useStreakFreeze(dateKey) {
    if (!canUseStreakFreeze(dateKey)) {
      return false;
    }

    if (!statistics.days[dateKey]) {
      statistics.days[dateKey] = createDailyStats(dateKey);
    }

    const day = statistics.days[dateKey];
    day.frozen = true;
    day.freezeUsed = true;
    day.streakEligible = true;

    statistics.streak.freezesAvailable = Math.max(0, (statistics.streak.freezesAvailable || 0) - 1);
    statistics.streak.freezesUsedTotal = (statistics.streak.freezesUsedTotal || 0) + 1;

    refreshStatistics();
    broadcastDataChange();
    return true;
  }

  function rechargeStreakFreeze() {
    const max = appState.settings.streak.maxFreezeCharges || 2;
    if ((statistics.streak.freezesAvailable || 0) < max) {
      statistics.streak.freezesAvailable = (statistics.streak.freezesAvailable || 0) + 1;
      saveAppData();
    }
  }

  // --- Weekly & Monthly Statistics (Sections 18 & 19) ---
  function getWeekRange(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    start.setHours(0, 0, 0, 0);

    const end = addDays(start, 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  function calculateWeeklyStats(date = new Date()) {
    const { start } = getWeekRange(date);
    const result = {
      focusSeconds: 0,
      studyDays: 0,
      goalCompletedDays: 0,
      sessions: 0
    };

    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const key = formatDateKey(d);
      const day = statistics.days[key];
      if (!day) continue;

      result.focusSeconds += (day.focusSeconds || 0);
      result.sessions += (day.sessionCount || 0);
      if (isDayStreakEligible(key)) result.studyDays++;
      if (day.goalCompleted) result.goalCompletedDays++;
    }
    return result;
  }

  function calculateMonthlyStats(year, month) {
    const result = {
      year,
      month,
      focusSeconds: 0,
      studyDays: 0,
      goalCompletedDays: 0,
      sessions: 0,
      averageDailySeconds: 0
    };

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      const key = formatDateKey(new Date(year, month, dayNumber));
      const day = statistics.days[key];
      if (!day) continue;

      result.focusSeconds += (day.focusSeconds || 0);
      result.sessions += (day.sessionCount || 0);
      if (isDayStreakEligible(key)) result.studyDays++;
      if (day.goalCompleted) result.goalCompletedDays++;
    }

    if (result.studyDays > 0) {
      result.averageDailySeconds = Math.round(result.focusSeconds / result.studyDays);
    }
    return result;
  }

  function getMonthlyArchive(count = 6) {
    const result = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const stats = calculateMonthlyStats(d.getFullYear(), d.getMonth());
      result.push(stats);
    }
    return result;
  }

  // --- Calendar Day Status (Section 35) ---
  function getCalendarDayStatus(dateKey) {
    const day = statistics.days[dateKey];
    if (!day) return 'empty';
    if (day.frozen) return 'frozen';
    if (day.goalCompleted) return 'goal';
    if (day.streakEligible) return 'active';
    if ((day.focusSeconds || 0) > 0) return 'partial';
    return 'empty';
  }

  // --- Achievements System (Sections 30, 31 & 32) ---
  const ACHIEVEMENTS = {
    first_session: {
      id: 'first_session',
      title: 'First Step',
      description: 'Complete your first focus session.',
      icon: '🌱'
    },
    streak_3: {
      id: 'streak_3',
      title: '3 Day Fire',
      description: 'Maintain a 3-day focus streak.',
      icon: '🔥'
    },
    streak_7: {
      id: 'streak_7',
      title: 'One Week Warrior',
      description: 'Maintain a 7-day focus streak.',
      icon: '🔥'
    },
    streak_30: {
      id: 'streak_30',
      title: '30 Day Focus Legend',
      description: 'Maintain a 30-day focus streak.',
      icon: '💎'
    },
    focus_10h: {
      id: 'focus_10h',
      title: '10 Hour Milestone',
      description: 'Reach 10 hours of logged focus time.',
      icon: '⏱️'
    },
    focus_100h: {
      id: 'focus_100h',
      title: 'Centurion 100h',
      description: 'Reach 100 hours of logged focus time.',
      icon: '🏆'
    },
    daily_goal_7: {
      id: 'daily_goal_7',
      title: 'Goal Crusher',
      description: 'Complete your daily focus goal on 7 different days.',
      icon: '🎯'
    }
  };

  function unlockAchievement(id) {
    if (!ACHIEVEMENTS[id]) return false;
    if (!statistics.achievements) statistics.achievements = {};
    if (statistics.achievements[id]) return false;

    statistics.achievements[id] = {
      unlockedAt: new Date().toISOString()
    };
    saveAppData();

    if (typeof root.showAchievementToast === 'function') {
      root.showAchievementToast(ACHIEVEMENTS[id]);
    }
    return true;
  }

  function evaluateAchievements() {
    const lifetime = statistics.lifetime || {};
    const streak = statistics.streak || {};

    if ((lifetime.completedSessions || 0) >= 1) {
      unlockAchievement('first_session');
    }
    if ((streak.best || 0) >= 3) {
      unlockAchievement('streak_3');
    }
    if ((streak.best || 0) >= 7) {
      unlockAchievement('streak_7');
    }
    if ((streak.best || 0) >= 30) {
      unlockAchievement('streak_30');
    }
    if ((lifetime.focusSeconds || 0) >= 10 * 3600) {
      unlockAchievement('focus_10h');
    }
    if ((lifetime.focusSeconds || 0) >= 100 * 3600) {
      unlockAchievement('focus_100h');
    }

    // Check count of goal-completed days
    const goalDaysCount = Object.values(statistics.days || {}).filter(d => d.goalCompleted).length;
    if (goalDaysCount >= 7) {
      unlockAchievement('daily_goal_7');
    }
  }

  // --- Goal Completion Check & Event (Sections 28 & 29) ---
  function checkDailyGoalCompletion() {
    const today = todayKey();
    const goal = calculateDailyGoal(today);
    if (!goal.completed) return false;

    const day = statistics.days[today];
    if (day && !day.goalCompleted) {
      day.goalCompleted = true;
      rechargeStreakFreeze();
      unlockAchievement('daily_goal_7');
      if (typeof root.showGoalCompletionToast === 'function') {
        root.showGoalCompletionToast(goal);
      }
      saveAppData();
    }
    return true;
  }

  // --- Central Recalculation Pipeline (Section 59) ---
  function refreshStatistics() {
    recalculateLifetimeStats();
    recalculateStreakStats();
    checkDailyGoalCompletion();
    evaluateAchievements();
    saveAppData();
    if (typeof root.renderAllViews === 'function') {
      root.renderAllViews();
    }
  }

  // --- Timestamp-Driven Session Engine (Sections 20, 21, 22, 23, 24, 25, 26) ---
  function startFocusSession() {
    if (timerState.running) return;

    timerState.running = true;
    timerState.startedAt = Date.now();
    timerState.lastTickAt = Date.now();

    if (!timerState.sessionId) {
      const session = createSessionRecord({
        mode: timerState.mode,
        kind: timerState.kind,
        plannedSeconds: timerState.totalSeconds
      });
      timerState.sessionId = session.id;
      activeSession = session;
    }

    if (timerState.intervalId) clearInterval(timerState.intervalId);
    timerState.intervalId = setInterval(updateTimer, 250);

    savePendingSession();
    broadcastTimerState();
  }

  function updateTimer() {
    if (!timerState.running) return;

    const now = Date.now();
    // Guard against negative delta or system sleep jumps
    const rawElapsed = (now - (timerState.lastTickAt || now)) / 1000;
    const elapsed = Math.max(0, Math.min(5, rawElapsed));
    timerState.lastTickAt = now;

    if (timerState.mode === 'stopwatch') {
      timerState.remainingSeconds = (timerState.remainingSeconds || 0) + elapsed;
    } else {
      timerState.remainingSeconds = Math.max(0, timerState.remainingSeconds - elapsed);
    }

    if (timerState.kind === 'focus') {
      timerState.accumulatedFocusSeconds += elapsed;
      if (activeSession) {
        activeSession.actualSeconds += elapsed;
      }
    }

    // Mid-session save pending state for crash protection every few seconds
    if (Math.random() < 0.05) {
      savePendingSession();
    }

    // Update timer UI (250ms rule - Section 61)
    if (typeof root.renderTimerDisplayOnly === 'function') {
      root.renderTimerDisplayOnly();
    }

    if (timerState.mode !== 'stopwatch' && timerState.remainingSeconds <= 0) {
      finishTimerSession();
    }
  }

  function pauseFocusSession() {
    if (!timerState.running) return;

    timerState.running = false;
    timerState.pausedAt = Date.now();
    if (timerState.intervalId) {
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    }

    if (activeSession) {
      activeSession.pauseCount = (activeSession.pauseCount || 0) + 1;
    }

    savePendingSession();
    broadcastTimerState();
    if (typeof root.renderTimerDisplayOnly === 'function') {
      root.renderTimerDisplayOnly();
    }
  }

  function resumeFocusSession() {
    if (timerState.running) return;
    timerState.running = true;
    timerState.lastTickAt = Date.now();
    timerState.pausedAt = null;

    if (timerState.intervalId) clearInterval(timerState.intervalId);
    timerState.intervalId = setInterval(updateTimer, 250);

    broadcastTimerState();
    if (typeof root.renderTimerDisplayOnly === 'function') {
      root.renderTimerDisplayOnly();
    }
  }

  function finishTimerSession() {
    if (timerState.intervalId) {
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    }
    timerState.running = false;

    if (activeSession) {
      activeSession.completed = true;
      activeSession.endedAt = new Date().toISOString();
      activeSession.actualSeconds = Math.max(0, Math.round(activeSession.actualSeconds || 0));
      recordSession(activeSession);
    }

    clearPendingSession();
    activeSession = null;
    timerState.sessionId = null;

    handleTimerCompletion();
    broadcastTimerState();
  }

  function cancelTimerSession() {
    if (timerState.intervalId) {
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    }
    timerState.running = false;

    if (activeSession) {
      activeSession.cancelled = true;
      activeSession.endedAt = new Date().toISOString();
      activeSession.actualSeconds = Math.max(0, Math.round(activeSession.actualSeconds || 0));
      // Cancelled sessions preserve the focus seconds accrued (Section 25)
      if (activeSession.actualSeconds > 10) {
        recordSession(activeSession);
      }
    }

    clearPendingSession();
    activeSession = null;
    timerState.sessionId = null;

    resetTimerDefaults();
    broadcastTimerState();
  }

  function resetTimerDefaults() {
    timerState.running = false;
    timerState.accumulatedFocusSeconds = 0;
    const durMinutes = timerState.kind === 'focus'
      ? (appState.settings.timer.focusMinutes || 25)
      : (timerState.kind === 'longBreak'
        ? (appState.settings.timer.longBreakMinutes || 15)
        : (appState.settings.timer.shortBreakMinutes || 5));
    timerState.totalSeconds = durMinutes * 60;
    timerState.remainingSeconds = timerState.mode === 'stopwatch' ? 0 : timerState.totalSeconds;
    if (typeof root.renderTimerDisplayOnly === 'function') {
      root.renderTimerDisplayOnly();
    }
  }

  function handleTimerCompletion() {
    if (timerState.mode !== 'pomodoro') {
      resetTimerDefaults();
      return;
    }

    if (timerState.kind === 'focus') {
      timerState.sessionCount++;
      const sessionsBeforeLong = appState.settings.timer.sessionsBeforeLongBreak || 4;
      if (timerState.sessionCount % sessionsBeforeLong === 0) {
        timerState.kind = 'longBreak';
      } else {
        timerState.kind = 'break';
      }
      resetTimerDefaults();
      if (appState.settings.timer.autoStartBreaks && appState.settings.timer.breaksEnabled) {
        startFocusSession();
      }
    } else {
      timerState.kind = 'focus';
      resetTimerDefaults();
      if (appState.settings.timer.autoStartBreaks) {
        startFocusSession();
      }
    }
  }

  // --- Interrupted/Abandoned Session Recovery (Section 26) ---
  function savePendingSession() {
    if (!activeSession) return;
    try {
      const payload = {
        session: activeSession,
        timer: {
          remainingSeconds: timerState.remainingSeconds,
          totalSeconds: timerState.totalSeconds,
          mode: timerState.mode,
          kind: timerState.kind,
          running: timerState.running,
          lastKnownTimestamp: Date.now()
        }
      };
      localStorage.setItem('flowspace_pending_session', JSON.stringify(payload));
    } catch {}
  }

  function clearPendingSession() {
    localStorage.removeItem('flowspace_pending_session');
  }

  function recoverInterruptedSession() {
    try {
      const raw = localStorage.getItem('flowspace_pending_session');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const pending = parsed.session;
      const timerInfo = parsed.timer;
      if (!pending || !timerInfo) {
        clearPendingSession();
        return;
      }

      if (timerInfo.running && timerInfo.lastKnownTimestamp) {
        const elapsed = Math.floor((Date.now() - timerInfo.lastKnownTimestamp) / 1000);
        const maxRecoverable = Math.max(0, pending.plannedSeconds - (pending.actualSeconds || 0));
        const recovered = Math.max(0, Math.min(elapsed, maxRecoverable));
        pending.actualSeconds = (pending.actualSeconds || 0) + recovered;
      }

      pending.abandoned = true;
      pending.endedAt = new Date().toISOString();
      if (pending.actualSeconds > 10) {
        recordSession(pending);
      }
      clearPendingSession();
    } catch {
      clearPendingSession();
    }
  }

  // --- Productivity Insights & Analytics (Sections 49 & 50) ---
  function calculateHourlyActivity() {
    const hours = Array(24).fill(0);
    (statistics.sessions || []).forEach(session => {
      if (!session.startedAt) return;
      const h = new Date(session.startedAt).getHours();
      if (h >= 0 && h < 24) {
        hours[h] += (session.actualSeconds || 0);
      }
    });
    return hours;
  }

  function calculateSessionCompletionRate() {
    const sessions = statistics.sessions || [];
    if (!sessions.length) return 0;
    const completed = sessions.filter(s => s.completed).length;
    return Math.round((completed / sessions.length) * 100);
  }

  // --- Self-Healing Data Integrity (Section 41) ---
  function rebuildStatisticsFromSessions() {
    statistics.days = {};
    for (const session of statistics.sessions || []) {
      const key = session.dateKey || formatDateKey(new Date(session.startedAt || Date.now()));
      if (!statistics.days[key]) {
        statistics.days[key] = createDailyStats(key);
      }
      const day = statistics.days[key];
      day.focusSeconds += (session.actualSeconds || 0);
      day.sessionCount++;
      if (session.completed) day.completedSessions++;
      if (session.cancelled) day.cancelledSessions++;
      if (session.abandoned) day.abandonedSessions++;
      if (session.streakEligible) day.streakEligible = true;
    }

    // Recheck goal and eligibility for every day
    Object.keys(statistics.days).forEach(dateKey => {
      const day = statistics.days[dateKey];
      const goal = calculateDailyGoal(dateKey);
      day.goalCompleted = goal.completed;
      day.streakEligible = isDayStreakEligible(dateKey);
    });

    recalculateLifetimeStats();
    recalculateStreakStats();
  }

  // --- Schema Migration v1/v2 -> v3 (Section 40) ---
  function migrateV1ToV2(data) {
    if (!data.settings) data.settings = {};
    data.version = 2;
  }

  function migrateV2ToV3(data) {
    if (!data.statistics) {
      data.statistics = {
        lifetime: {
          focusSeconds: 0,
          sessionCount: 0,
          completedSessions: 0,
          studyDays: 0
        },
        streak: {
          current: 0,
          best: 0,
          lastCalculatedDate: null,
          freezesAvailable: 2,
          freezesUsedTotal: 0
        },
        days: {},
        sessions: [],
        achievements: {}
      };
    }

    if (!data.settings) data.settings = {};
    if (!data.settings.streak) {
      data.settings.streak = {
        enabled: true,
        minimumMinutes: 30,
        requireDailyGoal: false,
        freezeEnabled: true,
        maxFreezeCharges: 2,
        maxFreezeDaysPerMonth: 2
      };
    }
    if (!data.settings.weeklyGoal) {
      data.settings.weeklyGoal = {
        enabled: true,
        studyDays: 5,
        focusMinutes: 600
      };
    }
    data.version = 3;
  }

  function migrateData(data) {
    let version = Number(data.version || 1);
    while (version < FLOWSPACE_VERSION) {
      if (version === 1) {
        migrateV1ToV2(data);
        version = 2;
      }
      if (version === 2) {
        migrateV2ToV3(data);
        version = 3;
      }
    }
    data.version = FLOWSPACE_VERSION;
  }

  // --- Data Persistence & Loading (Sections 38, 39) ---
  function saveAppData() {
    try {
      const payload = {
        app: 'Flowspace',
        version: FLOWSPACE_VERSION,
        settings: appState.settings,
        statistics,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Flowspace save error:', e);
    }
  }

  function loadAppData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check legacy v1/v2 storage ('flowStudy')
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw);
          initializeFreshData();
          // Convert legacy days map (minutes) into v3 daily stats
          if (parsed && parsed.days) {
            Object.entries(parsed.days).forEach(([dateKey, minutes]) => {
              const focusSec = Math.round((Number(minutes) || 0) * 60);
              const day = createDailyStats(dateKey);
              day.focusSeconds = focusSec;
              day.sessionCount = Math.max(1, Math.round(focusSec / 1500));
              day.completedSessions = day.sessionCount;
              day.goalCompleted = focusSec >= (appState.settings.dailyGoalMinutes * 60);
              day.streakEligible = (focusSec / 60) >= (appState.settings.streak.minimumMinutes || 30);
              statistics.days[dateKey] = day;
            });
          }
          if (parsed.xp) {
            statistics.lifetime.completedSessions = Math.max(statistics.lifetime.completedSessions, parsed.xp);
          }
          refreshStatistics();
          saveAppData();
          return;
        } catch (err) {
          console.warn('Failed to migrate legacy flowStudy:', err);
        }
      }
      initializeFreshData();
      return;
    }

    try {
      const data = JSON.parse(raw);
      migrateData(data);
      if (data.settings) {
        Object.assign(appState.settings, data.settings);
      }
      if (data.statistics) {
        statistics = Object.assign(statistics, data.statistics);
        if (!statistics.days) statistics.days = {};
        if (!statistics.sessions) statistics.sessions = [];
        if (!statistics.achievements) statistics.achievements = {};
      }
      recalculateLifetimeStats();
      recalculateStreakStats();
    } catch (error) {
      console.error('Flowspace data load failed:', error);
      initializeFreshData();
    }
  }

  function initializeFreshData() {
    statistics = {
      lifetime: {
        focusSeconds: 0,
        sessionCount: 0,
        completedSessions: 0,
        studyDays: 0
      },
      streak: {
        current: 0,
        best: 0,
        lastCalculatedDate: todayKey(),
        freezesAvailable: 2,
        freezesUsedTotal: 0
      },
      days: {},
      sessions: [],
      achievements: {}
    };
    saveAppData();
  }

  // --- Cross-Tab Synchronization & BroadcastChannel (Sections 42 & 43) ---
  let flowspaceChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      flowspaceChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      flowspaceChannel.onmessage = event => {
        if (event.data?.type === 'DATA_CHANGED') {
          loadAppData();
          if (typeof root.renderAllViews === 'function') {
            root.renderAllViews();
          }
        }
      };
    }
  } catch (err) {
    console.warn('BroadcastChannel not supported:', err);
  }

  function broadcastDataChange() {
    if (flowspaceChannel) {
      try {
        flowspaceChannel.postMessage({ type: 'DATA_CHANGED', timestamp: Date.now() });
      } catch {}
    }
  }

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) {
      loadAppData();
      if (typeof root.renderAllViews === 'function') {
        root.renderAllViews();
      }
    }
  });

  // --- Electron Mini-Timer Synchronization (Sections 44 & 45) ---
  function broadcastTimerState() {
    const n = timerState.remainingSeconds;
    const mm = Math.floor(n / 60);
    const ss = Math.floor(n % 60);
    const timeText = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    const modeName = timerState.kind === 'break' || timerState.kind === 'longBreak'
      ? 'Break'
      : (timerState.mode === 'stopwatch' ? 'Stopwatch' : (timerState.mode === 'countdown' ? 'Countdown' : 'Pomodoro'));

    const total = Math.max(1, timerState.totalSeconds || 1500);
    const percent = timerState.mode === 'stopwatch'
      ? Math.min(100, (n / total) * 100)
      : Math.max(0, Math.min(100, (1 - (n / total)) * 100));

    const state = {
      time: timeText,
      mode: modeName,
      kind: timerState.kind,
      running: timerState.running,
      remainingSeconds: timerState.remainingSeconds,
      totalSeconds: timerState.totalSeconds,
      sessionCount: timerState.sessionCount,
      percent: Math.round(percent)
    };

    if (window.electronAPI?.syncTimerToMini) {
      window.electronAPI.syncTimerToMini(state);
    }

    if (typeof root.syncFloatingMiniTimer === 'function') {
      root.syncFloatingMiniTimer(state);
    }
  }

  // --- Data Portability: Export, Import & Reset (Sections 51, 52, 53, 54) ---
  function exportFlowspaceData() {
    const payload = {
      app: 'Flowspace',
      version: FLOWSPACE_VERSION,
      exportedAt: new Date().toISOString(),
      settings: appState.settings,
      statistics
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowspace-backup-v3-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function importFlowspaceData(file) {
    if (!file) return false;
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.app !== 'Flowspace') {
      throw new Error('Invalid backup file. Missing Flowspace signature.');
    }

    migrateData(data);
    if (data.settings) {
      Object.assign(appState.settings, data.settings);
    }
    if (data.statistics) {
      statistics = Object.assign(statistics, data.statistics);
    }

    rebuildStatisticsFromSessions();
    saveAppData();
    broadcastDataChange();
    if (typeof root.renderAllViews === 'function') {
      root.renderAllViews();
    }
    return true;
  }

  function resetStatistics() {
    statistics = {
      lifetime: {
        focusSeconds: 0,
        sessionCount: 0,
        completedSessions: 0,
        studyDays: 0
      },
      streak: {
        current: 0,
        best: 0,
        lastCalculatedDate: todayKey(),
        freezesAvailable: appState.settings.streak.maxFreezeCharges || 2,
        freezesUsedTotal: 0
      },
      days: {},
      sessions: [],
      achievements: {}
    };
    saveAppData();
    broadcastDataChange();
    if (typeof root.renderAllViews === 'function') {
      root.renderAllViews();
    }
  }

  function resetEverything() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem('flowspace_pending_session');
    location.reload();
  }

  // --- Public Stats & Control Facade (Section 33) ---
  const Stats = {
    today() {
      return calculateDailyGoal(todayKey());
    },
    currentStreak() {
      return calculateCurrentStreak();
    },
    bestStreak() {
      return calculateBestStreak();
    },
    lifetime() {
      return statistics.lifetime;
    },
    week(date) {
      return calculateWeeklyStats(date);
    },
    month(year, month) {
      return calculateMonthlyStats(year, month);
    },
    day(dateKey) {
      return statistics.days[dateKey] || createDailyStats(dateKey);
    },
    getMonthlyArchive(count = 6) {
      return getMonthlyArchive(count);
    },
    getFreezesAvailable() {
      return statistics.streak.freezesAvailable || 0;
    },
    canUseFreeze(dateKey) {
      return canUseStreakFreeze(dateKey);
    },
    useFreeze(dateKey) {
      return useStreakFreeze(dateKey);
    },
    achievements() {
      return {
        catalog: ACHIEVEMENTS,
        unlocked: statistics.achievements || {}
      };
    },
    insights() {
      return {
        hourly: calculateHourlyActivity(),
        completionRate: calculateSessionCompletionRate(),
        totalSessions: (statistics.sessions || []).length
      };
    },
    getRawStatistics() {
      return statistics;
    },
    isStreakEligible(dateKey) {
      return isDayStreakEligible(dateKey);
    }
  };

  // Expose to window for UI layer binding
  root.FLOWSPACE_VERSION = FLOWSPACE_VERSION;
  root.appState = appState;
  root.timerState = timerState;
  root.Stats = Stats;
  root.isDayStreakEligible = isDayStreakEligible;
  root.startFocusSession = startFocusSession;
  root.pauseFocusSession = pauseFocusSession;
  root.resumeFocusSession = resumeFocusSession;
  root.finishTimerSession = finishTimerSession;
  root.cancelTimerSession = cancelTimerSession;
  root.resetTimerDefaults = resetTimerDefaults;
  root.formatDateKey = formatDateKey;
  root.todayKey = todayKey;
  root.loadAppData = loadAppData;
  root.saveAppData = saveAppData;
  root.refreshStatistics = refreshStatistics;
  root.getCalendarDayStatus = getCalendarDayStatus;
  root.exportFlowspaceData = exportFlowspaceData;
  root.importFlowspaceData = importFlowspaceData;
  root.resetStatistics = resetStatistics;
  root.resetEverything = resetEverything;
  root.recoverInterruptedSession = recoverInterruptedSession;

  // Initialize on script parse
  loadAppData();
  recoverInterruptedSession();

})(window);
