/**
 * PomoCalm — Modern Pastel Focus Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // DEFAULT & PERSISTED SETTINGS
    // ==========================================================================
    const defaultSettings = {
        focusDur: 25,
        shortDur: 5,
        longDur: 15,
        autoStartBreaks: false
    };

    let settings = loadSettings();

    function loadSettings() {
        try {
            const saved = localStorage.getItem('pomocalm_settings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : { ...defaultSettings };
        } catch (e) {
            return { ...defaultSettings };
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem('pomocalm_settings', JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save settings', e);
        }
    }

    function getModes() {
        return {
            focus: {
                duration: settings.focusDur * 60,
                label: 'Time to focus',
                theme: 'focus'
            },
            shortBreak: {
                duration: settings.shortDur * 60,
                label: 'Time for a break',
                theme: 'shortBreak'
            },
            longBreak: {
                duration: settings.longDur * 60,
                label: 'Rest & Recharge',
                theme: 'longBreak'
            }
        };
    }

    // Timer State
    let MODES = getModes();
    let currentMode = 'focus';
    let totalSeconds = MODES[currentMode].duration;
    let remainingSeconds = totalSeconds;
    let isRunning = false;
    let timerId = null;
    let endTime = null;
    let soundEnabled = true;
    let completedSessions = 0;

    // Task State
    let tasks = loadTasks();
    let activeTaskId = localStorage.getItem('pomocalm_active_task') || null;

    // Analytics State
    let analyticsData = loadAnalytics();

    // DOM Elements - Dashboard Navigation
    const dashNavBtns = document.querySelectorAll('.dash-nav-btn');
    const dashboardViews = document.querySelectorAll('.dashboard-view');

    // DOM Elements - Timer
    const htmlElement = document.documentElement;
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabIndicator = document.querySelector('.tab-indicator');
    const statusLabel = document.getElementById('status-label');
    const timerReadout = document.getElementById('timer-readout');
    const progressFill = document.querySelector('.progress-ring-fill');
    
    const startPauseBtn = document.getElementById('start-pause-btn');
    const startPauseText = document.getElementById('start-pause-text');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const resetBtn = document.getElementById('reset-btn');
    
    const soundToggle = document.getElementById('sound-toggle');
    const soundIconOn = document.getElementById('sound-icon-on');
    const soundIconOff = document.getElementById('sound-icon-off');
    const sessionDots = document.querySelectorAll('.session-dots .dot');

    const activeTaskPill = document.getElementById('active-task-pill');
    const activeTaskText = document.getElementById('active-task-text');

    // DOM Elements - Tasks
    const addTaskForm = document.getElementById('add-task-form');
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const taskProgressBadge = document.getElementById('task-progress-badge');
    const taskProgressFill = document.getElementById('task-progress-fill');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    const taskEmptyState = document.getElementById('task-empty-state');

    // DOM Elements - Analytics
    const statTotalTime = document.getElementById('stat-total-time');
    const statStreak = document.getElementById('stat-streak');
    const statCompletedPomo = document.getElementById('stat-completed-pomo');
    const barChartSvg = document.getElementById('analytics-bar-chart');
    const sessionHistoryList = document.getElementById('session-history-list');
    const historyEmpty = document.getElementById('history-empty');

    // DOM Elements - Ambient Soundscape
    const ambientMasterToggle = document.getElementById('ambient-master-toggle');
    const ambientMasterStatus = document.getElementById('ambient-master-status');
    const sliderRain = document.getElementById('volume-rain');
    const sliderWind = document.getElementById('volume-wind');
    const sliderNoise = document.getElementById('volume-noise');
    const sliderWaves = document.getElementById('volume-waves');
    const valRain = document.getElementById('val-rain');
    const valWind = document.getElementById('val-wind');
    const valNoise = document.getElementById('val-noise');
    const valWaves = document.getElementById('val-waves');

    // DOM Elements - Settings Form
    const settingsForm = document.getElementById('settings-form');
    const inputFocusDur = document.getElementById('setting-focus-dur');
    const inputShortDur = document.getElementById('setting-short-dur');
    const inputLongDur = document.getElementById('setting-long-dur');
    const checkAutoStart = document.getElementById('setting-auto-start');
    const btnResetAll = document.getElementById('btn-reset-all');

    // SVG Ring Perimeter (r = 125)
    const RING_PERIMETER = 2 * Math.PI * 125;
    progressFill.style.strokeDasharray = `${RING_PERIMETER}`;

    // Web Audio Context
    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // ==========================================================================
    // DASHBOARD VIEW NAVIGATION
    // ==========================================================================

    dashNavBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetViewId = e.currentTarget.dataset.view;

            dashNavBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            dashboardViews.forEach(view => {
                if (view.id === targetViewId) {
                    view.classList.remove('hidden');
                    view.classList.add('active');
                } else {
                    view.classList.add('hidden');
                    view.classList.remove('active');
                }
            });

            if (targetViewId === 'view-timer') {
                updateTabIndicator();
            } else if (targetViewId === 'view-analytics') {
                renderAnalytics();
            }
        });
    });

    // ==========================================================================
    // TIMER ENGINE
    // ==========================================================================

    function playChime() {
        if (!soundEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50];

        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.12);

            const startTime = now + index * 0.12;
            const duration = 1.2;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    function updateTabIndicator() {
        const activeTab = document.querySelector('.tab-btn.active');
        if (!activeTab || !tabIndicator) return;

        const tabNav = document.querySelector('.mode-tabs');
        const navRect = tabNav.getBoundingClientRect();
        const activeRect = activeTab.getBoundingClientRect();

        const offsetLeft = activeRect.left - navRect.left;
        const width = activeRect.width;

        tabIndicator.style.transform = `translateX(${offsetLeft - 6}px)`;
        tabIndicator.style.width = `${width}px`;
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function renderDisplay() {
        const timeStr = formatTime(remainingSeconds);
        timerReadout.textContent = timeStr;

        const modeTitle = MODES[currentMode].label;
        const activeTask = tasks.find(t => t.id === activeTaskId && !t.completed);
        const taskPrefix = activeTask ? `[${activeTask.text}] ` : '';
        document.title = `${taskPrefix}(${timeStr}) ${modeTitle} — PomoCalm`;

        const progressFraction = remainingSeconds / totalSeconds;
        const dashoffset = RING_PERIMETER * (1 - progressFraction);
        progressFill.style.strokeDashoffset = dashoffset;
    }

    function switchMode(modeKey) {
        if (!MODES[modeKey]) return;

        pauseTimer();

        currentMode = modeKey;
        totalSeconds = MODES[currentMode].duration;
        remainingSeconds = totalSeconds;

        htmlElement.setAttribute('data-theme', MODES[currentMode].theme);
        statusLabel.textContent = MODES[currentMode].label;

        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === modeKey);
        });
        updateTabIndicator();

        renderDisplay();
    }

    function startTimer() {
        getAudioContext();
        isRunning = true;
        document.body.classList.add('timer-active');

        startPauseText.textContent = 'Pause';
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');

        endTime = Date.now() + remainingSeconds * 1000;

        timerId = setInterval(() => {
            const now = Date.now();
            const difference = Math.round((endTime - now) / 1000);

            if (difference <= 0) {
                remainingSeconds = 0;
                renderDisplay();
                onTimerComplete();
            } else {
                remainingSeconds = difference;
                renderDisplay();
            }
        }, 200);
    }

    function pauseTimer() {
        isRunning = false;
        document.body.classList.remove('timer-active');
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }

        startPauseText.textContent = 'Start';
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }

    function toggleTimer() {
        if (isRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    }

    function resetTimer() {
        pauseTimer();
        remainingSeconds = totalSeconds;
        renderDisplay();
    }

    function onTimerComplete() {
        pauseTimer();
        playChime();

        if (currentMode === 'focus') {
            completedSessions = (completedSessions + 1) % 5;
            updateSessionDots();

            // Log Focus Session to Analytics
            const activeTask = tasks.find(t => t.id === activeTaskId);
            const taskName = activeTask ? activeTask.text : 'General Focus';
            logAnalyticsSession(settings.focusDur, taskName);
            
            if (completedSessions === 4) {
                switchMode('longBreak');
            } else {
                switchMode('shortBreak');
            }
        } else {
            switchMode('focus');
        }

        if (settings.autoStartBreaks) {
            startTimer();
        }
    }

    function updateSessionDots() {
        sessionDots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx < completedSessions);
        });
    }

    // ==========================================================================
    // TASK TRACKER MODULE
    // ==========================================================================

    function loadTasks() {
        try {
            const saved = localStorage.getItem('pomocalm_tasks');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem('pomocalm_tasks', JSON.stringify(tasks));
            if (activeTaskId) {
                localStorage.setItem('pomocalm_active_task', activeTaskId);
            } else {
                localStorage.removeItem('pomocalm_active_task');
            }
        } catch (e) {
            console.error('Failed to save tasks', e);
        }
    }

    function renderTasks() {
        taskList.innerHTML = '';

        const totalTasks = tasks.length;
        const completedCount = tasks.filter(t => t.completed).length;

        taskProgressBadge.textContent = `${completedCount}/${totalTasks}`;
        const pct = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
        taskProgressFill.style.width = `${pct}%`;

        taskEmptyState.classList.toggle('hidden', totalTasks > 0);
        clearCompletedBtn.classList.toggle('hidden', completedCount === 0);

        const activeTask = tasks.find(t => t.id === activeTaskId);
        if (activeTask && !activeTask.completed) {
            activeTaskText.textContent = activeTask.text;
            activeTaskPill.classList.remove('hidden');
        } else {
            activeTaskPill.classList.add('hidden');
            if (activeTask && activeTask.completed) {
                activeTaskId = null;
                saveTasks();
            }
        }

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === activeTaskId ? 'is-active' : ''}`;
            li.dataset.id = task.id;

            li.innerHTML = `
                <div class="task-main">
                    <button class="task-checkbox" aria-label="Toggle task completion">
                        <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <span class="task-text">${escapeHtml(task.text)}</span>
                </div>
                <div class="task-actions">
                    <button class="task-btn-action pin-btn" title="${task.id === activeTaskId ? 'Active Focus Task' : 'Set as Focus Task'}">
                        <svg class="task-pin-icon" viewBox="0 0 24 24" fill="${task.id === activeTaskId ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                    </button>
                    <button class="task-btn-action delete-btn" title="Delete Task">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            li.querySelector('.task-checkbox').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleTask(task.id);
            });

            li.querySelector('.task-main').addEventListener('click', () => {
                setActiveTask(task.id);
            });

            li.querySelector('.pin-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                setActiveTask(task.id);
            });

            li.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTask(task.id);
            });

            taskList.appendChild(li);
        });

        renderDisplay();
    }

    function addTask(text) {
        const trimmed = text.trim();
        if (!trimmed) return;

        const newTask = { id: 'task_' + Date.now(), text: trimmed, completed: false };
        tasks.push(newTask);

        if (!activeTaskId) activeTaskId = newTask.id;

        saveTasks();
        renderTasks();
    }

    function toggleTask(id) {
        tasks = tasks.map(task => {
            if (task.id === id) {
                const nextState = !task.completed;
                if (nextState && activeTaskId === id) activeTaskId = null;
                return { ...task, completed: nextState };
            }
            return task;
        });
        saveTasks();
        renderTasks();
    }

    function deleteTask(id) {
        tasks = tasks.filter(task => task.id !== id);
        if (activeTaskId === id) activeTaskId = tasks.length > 0 ? tasks[0].id : null;
        saveTasks();
        renderTasks();
    }

    function setActiveTask(id) {
        activeTaskId = (activeTaskId === id) ? null : id;
        saveTasks();
        renderTasks();
    }

    function clearCompleted() {
        tasks = tasks.filter(t => !t.completed);
        saveTasks();
        renderTasks();
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }

    // ==========================================================================
    // ANALYTICS & STATS ENGINE
    // ==========================================================================

    function loadAnalytics() {
        try {
            const saved = localStorage.getItem('pomocalm_analytics');
            return saved ? JSON.parse(saved) : { sessions: [] };
        } catch (e) {
            return { sessions: [] };
        }
    }

    function saveAnalytics() {
        try {
            localStorage.setItem('pomocalm_analytics', JSON.stringify(analyticsData));
        } catch (e) {
            console.error('Failed to save analytics', e);
        }
    }

    function logAnalyticsSession(durationMins, taskText) {
        const newSession = {
            id: 'sess_' + Date.now(),
            timestamp: Date.now(),
            duration: durationMins,
            taskText: taskText || 'Focus Session'
        };

        analyticsData.sessions.unshift(newSession); // Newest first
        saveAnalytics();
        renderAnalytics();
    }

    function renderAnalytics() {
        const sessions = analyticsData.sessions || [];
        const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
        const totalPomodoros = sessions.length;

        // Stat Card Values
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        statTotalTime.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        statCompletedPomo.textContent = totalPomodoros;

        // Streak Calculation
        const streakDays = calculateStreak(sessions);
        statStreak.textContent = `${streakDays} Day${streakDays === 1 ? '' : 's'}`;

        // Render 7-Day Bar Chart
        renderBarChart(sessions);

        // Render Session History
        sessionHistoryList.innerHTML = '';
        historyEmpty.classList.toggle('hidden', sessions.length > 0);

        sessions.slice(0, 8).forEach(s => {
            const li = document.createElement('li');
            li.className = 'history-item';
            const dateStr = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            li.innerHTML = `
                <span class="history-task">🎯 ${escapeHtml(s.taskText)}</span>
                <span class="history-time">${s.duration} min &bull; ${dateStr}</span>
            `;
            sessionHistoryList.appendChild(li);
        });
    }

    function calculateStreak(sessions) {
        if (sessions.length === 0) return 0;
        const days = new Set();
        sessions.forEach(s => {
            const dayKey = new Date(s.timestamp).toISOString().split('T')[0];
            days.add(dayKey);
        });

        let streak = 0;
        let checkDate = new Date();

        while (true) {
            const key = checkDate.toISOString().split('T')[0];
            if (days.has(key)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else if (streak === 0) {
                // Check if yesterday had sessions if today hasn't logged one yet
                checkDate.setDate(checkDate.getDate() - 1);
                const prevKey = checkDate.toISOString().split('T')[0];
                if (days.has(prevKey)) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        return streak;
    }

    function renderBarChart(sessions) {
        barChartSvg.innerHTML = '';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        const past7Days = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            const dayLabel = dayNames[d.getDay()];

            // Minutes for this date
            const dayMins = sessions
                .filter(s => new Date(s.timestamp).toISOString().split('T')[0] === dateKey)
                .reduce((acc, s) => acc + s.duration, 0);

            past7Days.push({ dateKey, dayLabel, mins: dayMins });
        }

        const maxMins = Math.max(60, ...past7Days.map(d => d.mins));
        const chartWidth = 360;
        const chartHeight = 160;
        const barWidth = 32;
        const spacing = (chartWidth - (barWidth * 7)) / 8;

        past7Days.forEach((d, idx) => {
            const x = spacing + idx * (barWidth + spacing);
            const barH = (d.mins / maxMins) * 90;
            const y = chartHeight - 35 - barH;

            // Bar Element
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', barWidth);
            rect.setAttribute('height', Math.max(4, barH));
            rect.setAttribute('rx', '6');
            rect.setAttribute('fill', d.mins > 0 ? 'var(--accent-color)' : 'var(--ring-track)');
            barChartSvg.appendChild(rect);

            // Minute Label above bar
            if (d.mins > 0) {
                const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                valText.setAttribute('x', x + barWidth / 2);
                valText.setAttribute('y', y - 6);
                valText.setAttribute('text-anchor', 'middle');
                valText.setAttribute('font-size', '10');
                valText.setAttribute('font-weight', '700');
                valText.setAttribute('fill', 'var(--text-dark)');
                valText.textContent = `${d.mins}m`;
                barChartSvg.appendChild(valText);
            }

            // Day Label below bar
            const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('x', x + barWidth / 2);
            labelText.setAttribute('y', chartHeight - 12);
            labelText.setAttribute('text-anchor', 'middle');
            labelText.setAttribute('font-size', '11');
            labelText.setAttribute('font-weight', '600');
            labelText.setAttribute('fill', 'var(--text-muted)');
            labelText.textContent = d.dayLabel;
            barChartSvg.appendChild(labelText);
        });
    }

    // ==========================================================================
    // MULTI-CHANNEL AMBIENT SOUNDSCAPE SYNTH
    // ==========================================================================

    class AmbientSynthEngine {
        constructor() {
            this.masterActive = true;
            this.nodes = {};
            this.gains = {};
        }

        initNodes() {
            const ctx = getAudioContext();
            if (!ctx || this.nodes.rain) return;

            // Rain Synth Node (Filtered Noise + Random Droplets)
            this.gains.rain = ctx.createGain();
            this.gains.rain.gain.value = 0;
            const rainNoise = this.createNoiseBuffer(ctx);
            const rainFilter = ctx.createBiquadFilter();
            rainFilter.type = 'lowpass';
            rainFilter.frequency.value = 800;

            const rainSource = ctx.createBufferSource();
            rainSource.buffer = rainNoise;
            rainSource.loop = true;
            rainSource.connect(rainFilter);
            rainFilter.connect(this.gains.rain);
            this.gains.rain.connect(ctx.destination);
            rainSource.start();
            this.nodes.rain = rainSource;

            // Wind Synth Node (Modulated Bandpass)
            this.gains.wind = ctx.createGain();
            this.gains.wind.gain.value = 0;
            const windNoise = this.createNoiseBuffer(ctx);
            const windFilter = ctx.createBiquadFilter();
            windFilter.type = 'bandpass';
            windFilter.frequency.value = 400;
            windFilter.Q.value = 3.0;

            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.2;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 250;
            lfo.connect(lfoGain);
            lfoGain.connect(windFilter.frequency);
            lfo.start();

            const windSource = ctx.createBufferSource();
            windSource.buffer = windNoise;
            windSource.loop = true;
            windSource.connect(windFilter);
            windFilter.connect(this.gains.wind);
            this.gains.wind.connect(ctx.destination);
            windSource.start();
            this.nodes.wind = windSource;

            // Brown Noise Synth Node (Deep Rumble)
            this.gains.noise = ctx.createGain();
            this.gains.noise.gain.value = 0;
            const brownBuffer = this.createBrownNoiseBuffer(ctx);
            const brownSource = ctx.createBufferSource();
            brownSource.buffer = brownBuffer;
            brownSource.loop = true;

            const brownFilter = ctx.createBiquadFilter();
            brownFilter.type = 'lowpass';
            brownFilter.frequency.value = 350;

            brownSource.connect(brownFilter);
            brownFilter.connect(this.gains.noise);
            this.gains.noise.connect(ctx.destination);
            brownSource.start();
            this.nodes.noise = brownSource;

            // Ocean Waves Synth Node
            this.gains.waves = ctx.createGain();
            this.gains.waves.gain.value = 0;
            const waveNoise = this.createNoiseBuffer(ctx);
            const waveFilter = ctx.createBiquadFilter();
            waveFilter.type = 'lowpass';
            waveFilter.frequency.value = 500;

            const waveLfo = ctx.createOscillator();
            waveLfo.frequency.value = 0.12; // Slow wave sweep
            const waveLfoGain = ctx.createGain();
            waveLfoGain.gain.value = 0.12;

            waveLfo.connect(waveLfoGain);
            waveLfoGain.connect(this.gains.waves.gain);
            waveLfo.start();

            const waveSource = ctx.createBufferSource();
            waveSource.buffer = waveNoise;
            waveSource.loop = true;
            waveSource.connect(waveFilter);
            waveFilter.connect(this.gains.waves);
            this.gains.waves.connect(ctx.destination);
            waveSource.start();
            this.nodes.waves = waveSource;
        }

        createNoiseBuffer(ctx) {
            const bufferSize = 2 * ctx.sampleRate;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            return buffer;
        }

        createBrownNoiseBuffer(ctx) {
            const bufferSize = 2 * ctx.sampleRate;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5;
            }
            return buffer;
        }

        setVolume(channel, percentage) {
            getAudioContext();
            this.initNodes();

            const val = (percentage / 100) * 0.25;
            if (this.gains[channel]) {
                this.gains[channel].gain.setTargetAtTime(
                    this.masterActive ? val : 0,
                    audioCtx.currentTime,
                    0.05
                );
            }
        }

        setMasterToggle(active) {
            this.masterActive = active;
            ['rain', 'wind', 'noise', 'waves'].forEach(ch => {
                const slider = document.getElementById(`volume-${ch}`);
                if (slider) this.setVolume(ch, Number(slider.value));
            });
        }
    }

    const soundEngine = new AmbientSynthEngine();

    function setupSlider(slider, label, channel) {
        slider.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            label.textContent = val > 0 ? `${val}%` : 'Off';
            soundEngine.setVolume(channel, val);
        });
    }

    setupSlider(sliderRain, valRain, 'rain');
    setupSlider(sliderWind, valWind, 'wind');
    setupSlider(sliderNoise, valNoise, 'noise');
    setupSlider(sliderWaves, valWaves, 'waves');

    ambientMasterToggle.addEventListener('click', () => {
        const next = !soundEngine.masterActive;
        soundEngine.setMasterToggle(next);
        ambientMasterToggle.classList.toggle('active', next);
        ambientMasterStatus.textContent = next ? 'Audio Active' : 'Audio Muted';
    });

    // ==========================================================================
    // SETTINGS MODULE
    // ==========================================================================

    function initSettingsUI() {
        inputFocusDur.value = settings.focusDur;
        inputShortDur.value = settings.shortDur;
        inputLongDur.value = settings.longDur;
        checkAutoStart.checked = settings.autoStartBreaks;
    }

    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        settings.focusDur = Math.max(1, Number(inputFocusDur.value));
        settings.shortDur = Math.max(1, Number(inputShortDur.value));
        settings.longDur = Math.max(1, Number(inputLongDur.value));
        settings.autoStartBreaks = checkAutoStart.checked;

        saveSettings();
        MODES = getModes();
        resetTimer();

        // Switch to Timer view automatically
        dashNavBtns[0].click();
    });

    btnResetAll.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all tasks, analytics, and settings?')) {
            localStorage.clear();
            settings = { ...defaultSettings };
            tasks = [];
            activeTaskId = null;
            analyticsData = { sessions: [] };
            
            initSettingsUI();
            saveSettings();
            saveTasks();
            saveAnalytics();
            
            MODES = getModes();
            resetTimer();
            renderTasks();
            renderAnalytics();
            alert('All data reset to defaults.');
        }
    });

    // ==========================================================================
    // INITIALIZATION & EVENT LISTENERS
    // ==========================================================================

    addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask(taskInput.value);
        taskInput.value = '';
    });

    clearCompletedBtn.addEventListener('click', clearCompleted);

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchMode(e.currentTarget.dataset.mode);
        });
    });

    startPauseBtn.addEventListener('click', toggleTimer);
    resetBtn.addEventListener('click', resetTimer);

    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundIconOn.classList.toggle('hidden', !soundEnabled);
        soundIconOff.classList.toggle('hidden', soundEnabled);
        if (soundEnabled) playChime();
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            toggleTimer();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            resetTimer();
        }
    });

    window.addEventListener('resize', updateTabIndicator);

    // Bootstrap app
    initSettingsUI();
    updateSessionDots();
    renderTasks();
    renderAnalytics();
    renderDisplay();
    setTimeout(updateTabIndicator, 50);
});
