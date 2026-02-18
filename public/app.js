// =============================================
// inthehole · SA Golf Tracker – app.js v1.0.0
// Scoring engine + routing + leaderboard + sharing
// =============================================

'use strict';

/* ─── STATE ─────────────────────────────────── */
const App = {
  currentScreen: 'home',
  round: null,
  history: [],
  leaderboard: [],
  installPrompt: null,

  // New-round builder state
  builder: {
    courseId: null,
    players: [],
    scoringType: 'stableford', // or 'stroke'
    holes: 18,
  }
};

/* ─── STORAGE HELPERS ────────────────────────── */
const Store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
};

/* ─── SCORING ENGINE ─────────────────────────── */
const Scoring = {
  /**
   * How many handicap strokes does this player get on this hole?
   * @param {number} playingHcp - playing handicap (already adjusted)
   * @param {number} si - stroke index of the hole
   */
  hcpStrokesOnHole(playingHcp, si) {
    let strokes = 0;
    if (playingHcp >= si) strokes += 1;
    if (playingHcp >= si + 18) strokes += 1;
    return strokes;
  },

  /**
   * Stableford points for a hole.
   * netScore = gross - hcp strokes
   * diff = par - netScore
   * diff >= 2 → 4 pts (eagle+), 1 → 3 pts, 0 → 2, -1 → 1, else 0
   */
  stablefordPoints(grossScore, par, hcpStrokes) {
    if (!grossScore || grossScore <= 0) return null;
    const net = grossScore - hcpStrokes;
    const diff = par - net;
    if (diff >= 3) return 5;  // albatross or better
    if (diff === 2) return 4; // eagle
    if (diff === 1) return 3; // birdie
    if (diff === 0) return 2; // par
    if (diff === -1) return 1; // bogey
    return 0;
  },

  /** Label for gross score relative to par */
  scoreLabel(gross, par) {
    const diff = gross - par;
    if (diff <= -3) return 'Albatross';
    if (diff === -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0)  return 'Par';
    if (diff === 1)  return 'Bogey';
    if (diff === 2)  return 'Double';
    return `+${diff}`;
  },

  scoreClass(gross, par) {
    const diff = gross - par;
    if (diff <= -2) return 'score-eagle';
    if (diff === -1) return 'score-birdie';
    if (diff === 0)  return 'score-par';
    if (diff === 1)  return 'score-bogey';
    return 'score-double';
  },

  /** Compute playing handicap (use 95% of exact handicap, rounded) */
  playingHcp(exactHcp) {
    return Math.round(exactHcp * 0.95);
  },

  /** Tally total stableford points for a player */
  totalStableford(player, course) {
    return player.scores.reduce((sum, s, idx) => {
      const hole = course.holes[idx];
      if (!s || !hole) return sum;
      const phcp = Scoring.playingHcp(player.handicap);
      const strokes = Scoring.hcpStrokesOnHole(phcp, hole.si);
      const pts = Scoring.stablefordPoints(s, hole.par, strokes);
      return sum + (pts || 0);
    }, 0);
  },

  /** Tally total gross strokes */
  totalGross(player) {
    return player.scores.reduce((sum, s) => sum + (s || 0), 0);
  },

  /** Total to par (gross - course par) */
  toPar(player, course) {
    const gross = Scoring.totalGross(player);
    if (!gross) return null;
    return gross - course.par;
  },

  /** Net score = gross - playing handicap */
  netScore(player, course) {
    return Scoring.totalGross(player) - Scoring.playingHcp(player.handicap);
  },

  /** Rank players by scoring type */
  rankPlayers(players, course, scoringType) {
    return [...players].sort((a, b) => {
      if (scoringType === 'stableford') {
        return Scoring.totalStableford(b, course) - Scoring.totalStableford(a, course);
      }
      return Scoring.totalGross(a) - Scoring.totalGross(b);
    });
  }
};

/* ─── ROUTER ─────────────────────────────────── */
function showScreen(id, title) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${id}`);
  if (el) el.classList.add('active');
  App.currentScreen = id;

  // Update nav
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === id);
  });
}

/* ─── INIT ───────────────────────────────────── */
function init() {
  // Load persisted data
  App.history   = Store.get('ith_history') || [];
  App.leaderboard = Store.get('ith_leaderboard') || [];

  buildUI();
  registerServiceWorker();
  setupInstallPrompt();
  renderHome();
  showScreen('home');
}

/* ─── BUILD ALL SCREENS ──────────────────────── */
function buildUI() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${buildInstallBanner()}
    ${buildToast()}

    <!-- HOME -->
    <div id="screen-home" class="screen active">
      <div class="top-bar">
        <div class="logo">inthe<span>hole</span></div>
        <span style="font-size:0.75rem;color:rgba(255,255,255,0.6);">SA Golf Tracker</span>
      </div>
      <div id="home-content"></div>
    </div>

    <!-- NEW ROUND – COURSE SELECT -->
    <div id="screen-new-round" class="screen">
      <div class="top-bar">
        <button class="back-btn" onclick="showScreen('home')">‹</button>
        <h2>Select Course</h2>
        <div></div>
      </div>
      <div id="course-select-content"></div>
    </div>

    <!-- NEW ROUND – PLAYERS -->
    <div id="screen-players" class="screen">
      <div class="top-bar">
        <button class="back-btn" onclick="showScreen('new-round')">‹</button>
        <h2>Players & Settings</h2>
        <div></div>
      </div>
      <div id="players-content"></div>
    </div>

    <!-- SCORECARD -->
    <div id="screen-scorecard" class="screen">
      <div id="scorecard-content"></div>
    </div>

    <!-- RESULTS -->
    <div id="screen-results" class="screen">
      <div id="results-content"></div>
    </div>

    <!-- LEADERBOARD -->
    <div id="screen-leaderboard" class="screen">
      <div class="top-bar">
        <div class="logo">inthe<span>hole</span></div>
        <h2 style="color:rgba(255,255,255,0.8);font-size:0.85rem;">Leaderboard</h2>
      </div>
      <div id="leaderboard-content"></div>
    </div>

    <!-- HISTORY -->
    <div id="screen-history" class="screen">
      <div class="top-bar">
        <div class="logo">inthe<span>hole</span></div>
        <h2 style="color:rgba(255,255,255,0.8);font-size:0.85rem;">My Rounds</h2>
      </div>
      <div id="history-content"></div>
    </div>

    ${buildBottomNav()}
  `;
}

function buildInstallBanner() {
  return `<div class="install-banner hidden" id="install-banner">
    📲 Add inthehole to your home screen — free, forever
    <button onclick="triggerInstall()">Install</button>
  </div>`;
}

function buildToast() {
  return `<div class="toast" id="toast"></div>`;
}

function buildBottomNav() {
  return `<nav class="bottom-nav">
    <button class="nav-btn active" data-screen="home" onclick="navTo('home')">
      <span class="nav-icon">🏌️</span>Home
    </button>
    <button class="nav-btn" data-screen="leaderboard" onclick="navTo('leaderboard')">
      <span class="nav-icon">🏆</span>Board
    </button>
    <button class="nav-btn" data-screen="history" onclick="navTo('history')">
      <span class="nav-icon">📋</span>History
    </button>
  </nav>`;
}

function navTo(screen) {
  showScreen(screen);
  if (screen === 'home')        renderHome();
  if (screen === 'leaderboard') renderLeaderboard();
  if (screen === 'history')     renderHistory();
}

/* ─── HOME SCREEN ────────────────────────────── */
function renderHome() {
  const totalRounds = App.history.length;
  const bestStableford = App.history.length
    ? Math.max(...App.history.map(r => r.playerResults?.[0]?.stableford || 0))
    : 0;
  const lastPlayed = App.history.length
    ? App.history[App.history.length - 1].course?.name?.split(' ')[0]
    : '–';

  const recentHTML = App.history.length === 0
    ? `<div class="empty-state"><div class="icon">⛳</div><h3>No rounds yet</h3><p>Tap "Start Round" to play your first round.</p></div>`
    : App.history.slice().reverse().slice(0, 8).map(r => renderRoundCard(r)).join('');

  document.getElementById('home-content').innerHTML = `
    <div class="hero-card">
      <p class="greeting">Howzit, golfer 👋</p>
      <h1>Ready to<br>play<span class="dot">?</span></h1>
      <button class="quick-start-btn" onclick="startNewRound()">
        ⛳ Start New Round
      </button>
    </div>

    <div class="stats-row">
      <div class="stat-chip">
        <div class="val">${totalRounds}</div>
        <div class="lbl">Rounds</div>
      </div>
      <div class="stat-chip">
        <div class="val">${bestStableford || '–'}</div>
        <div class="lbl">Best Pts</div>
      </div>
      <div class="stat-chip">
        <div class="val">${lastPlayed}</div>
        <div class="lbl">Last Course</div>
      </div>
    </div>

    <div class="section-label">Recent Rounds</div>
    ${recentHTML}
    <div style="height:20px;"></div>
  `;
}

function renderRoundCard(round) {
  const winner = round.playerResults?.[0];
  const pts = winner?.stableford || 0;
  const gross = winner?.gross || 0;
  const date = round.date ? new Date(round.date).toLocaleDateString('en-ZA', { day:'numeric', month:'short' }) : '';
  return `
    <div class="round-card" onclick="viewResult('${round.id}')">
      <div class="round-badge">
        <div>${pts}</div>
        <div class="score-label">pts</div>
      </div>
      <div class="round-info">
        <h3>${round.course?.name || 'Unknown Course'}</h3>
        <p>${date} · ${round.players?.length || 1} player${(round.players?.length || 1) > 1 ? 's' : ''}</p>
        <div class="pills">
          <span class="pill stableford">${pts} Stableford</span>
          <span class="pill stroke">${gross} Gross</span>
        </div>
      </div>
    </div>
  `;
}

/* ─── COURSE SELECT ──────────────────────────── */
function startNewRound() {
  App.builder = { courseId: null, players: [{ name: '', handicap: 18 }], scoringType: 'stableford', holes: 18 };
  renderCourseSelect();
  showScreen('new-round');
}

function renderCourseSelect(province = null, query = '') {
  const provinces = PROVINCES;
  let courses = query ? searchCourses(query) : (province ? getCoursesByProvince(province) : SA_COURSES);

  const tabsHTML = provinces.map(p => `
    <button class="tab-chip ${p === province ? 'active' : ''}" onclick="renderCourseSelect('${p}','')">
      ${p}
    </button>
  `).join('');

  const coursesHTML = courses.length === 0
    ? `<p style="color:var(--text-light);padding:20px;">No courses found.</p>`
    : courses.map(c => `
      <div class="course-item ${App.builder.courseId === c.id ? 'selected' : ''}"
           onclick="selectCourse('${c.id}')">
        <div>
          <h4>${c.name}</h4>
          <p>${c.city} · Rating ${c.rating}</p>
        </div>
        <span class="par-badge">Par ${c.par}</span>
      </div>
    `).join('');

  document.getElementById('course-select-content').innerHTML = `
    <div class="form-section">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input class="input-field" type="search" placeholder="Search courses or city…"
               value="${query}"
               oninput="renderCourseSelect(null, this.value)">
      </div>
      <div class="province-tabs">
        <button class="tab-chip ${!province ? 'active' : ''}" onclick="renderCourseSelect(null,'')">All</button>
        ${tabsHTML}
      </div>
      <div class="course-list">
        ${coursesHTML}
      </div>
    </div>
    <button class="primary-btn" ${App.builder.courseId ? '' : 'disabled'} onclick="goToPlayers()">
      Continue →
    </button>
    <div style="height:20px;"></div>
  `;
}

function selectCourse(id) {
  App.builder.courseId = id;
  renderCourseSelect();
}

function goToPlayers() {
  if (!App.builder.courseId) return;
  renderPlayersScreen();
  showScreen('players');
}

/* ─── PLAYERS SCREEN ─────────────────────────── */
function renderPlayersScreen() {
  const course = getCourseById(App.builder.courseId);
  document.getElementById('players-content').innerHTML = `
    <div class="form-section">
      <div style="background:var(--green-pale);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:16px;">
        <div style="font-weight:700;font-size:0.9rem;">📍 ${course.name}</div>
        <div style="font-size:0.75rem;color:var(--text-light);">${course.city} · Par ${course.par} · CR ${course.rating}</div>
      </div>

      <h3>Scoring Format</h3>
      <div class="toggle-group" style="margin-bottom:16px;">
        <button class="toggle-btn ${App.builder.scoringType === 'stableford' ? 'active' : ''}"
                onclick="setScoringType('stableford')">Stableford</button>
        <button class="toggle-btn ${App.builder.scoringType === 'stroke' ? 'active' : ''}"
                onclick="setScoringType('stroke')">Stroke Play</button>
      </div>

      <h3>Holes</h3>
      <div class="toggle-group" style="margin-bottom:16px;">
        <button class="toggle-btn ${App.builder.holes === 18 ? 'active' : ''}"
                onclick="setHoles(18)">18 Holes</button>
        <button class="toggle-btn ${App.builder.holes === 9 ? 'active' : ''}"
                onclick="setHoles(9)">9 Holes (Front)</button>
      </div>

      <h3>Players</h3>
    </div>

    <div class="players-grid" id="players-grid">
      ${App.builder.players.map((p, i) => renderPlayerCard(p, i)).join('')}
    </div>

    ${App.builder.players.length < 4 ? `
      <button class="add-player-btn" onclick="addPlayer()">+ Add Player</button>
    ` : ''}

    <button class="primary-btn" onclick="startScorecard()">
      ⛳ Let's Play!
    </button>
    <div style="height:20px;"></div>
  `;
}

function renderPlayerCard(player, idx) {
  return `
    <div class="player-card" id="player-card-${idx}">
      <div class="player-avatar">${player.name ? player.name[0].toUpperCase() : (idx + 1)}</div>
      <div class="player-fields">
        <input type="text" placeholder="Player ${idx + 1} name"
               value="${player.name || ''}"
               maxlength="20"
               oninput="updatePlayer(${idx}, 'name', this.value)">
      </div>
      <div class="player-hcp">
        <label>HCP</label>
        <input class="hcp-input" type="number" min="0" max="36" step="0.1"
               value="${player.handicap}"
               onchange="updatePlayer(${idx}, 'handicap', parseFloat(this.value) || 0)">
        ${idx > 0 ? `<button class="remove-player-btn" onclick="removePlayer(${idx})">✕</button>` : ''}
      </div>
    </div>
  `;
}

function setScoringType(type) {
  App.builder.scoringType = type;
  renderPlayersScreen();
}

function setHoles(n) {
  App.builder.holes = n;
  renderPlayersScreen();
}

function updatePlayer(idx, field, val) {
  App.builder.players[idx][field] = val;
  // Update avatar initial only
  const card = document.getElementById(`player-card-${idx}`);
  if (card && field === 'name') {
    const avatar = card.querySelector('.player-avatar');
    if (avatar) avatar.textContent = val ? val[0].toUpperCase() : (idx + 1);
  }
}

function addPlayer() {
  if (App.builder.players.length >= 4) return;
  App.builder.players.push({ name: '', handicap: 18 });
  renderPlayersScreen();
}

function removePlayer(idx) {
  App.builder.players.splice(idx, 1);
  renderPlayersScreen();
}

/* ─── SCORECARD ──────────────────────────────── */
let currentHole = 0;

function startScorecard() {
  const course = getCourseById(App.builder.courseId);
  // Default names
  App.builder.players = App.builder.players.map((p, i) => ({
    ...p,
    name: p.name || `Player ${i + 1}`,
    scores: new Array(App.builder.holes).fill(0)
  }));

  App.round = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    course,
    players: App.builder.players,
    scoringType: App.builder.scoringType,
    holes: App.builder.holes,
    complete: false
  };

  currentHole = 0;
  renderScorecardHole();
  showScreen('scorecard');
}

function renderScorecardHole() {
  const r = App.round;
  const course = r.course;
  const hole = course.holes[currentHole];
  const holesTotal = r.holes;

  const progressHTML = Array.from({ length: holesTotal }, (_, i) => {
    const cls = i < currentHole ? 'done' : i === currentHole ? 'current' : '';
    return `<div class="hole-dot ${cls}"></div>`;
  }).join('');

  const playersHTML = r.players.map((p, pi) => {
    const gross = p.scores[currentHole] || hole.par;
    const phcp  = Scoring.playingHcp(p.handicap);
    const hcpS  = Scoring.hcpStrokesOnHole(phcp, hole.si);
    const pts   = Scoring.stablefordPoints(gross, hole.par, hcpS);
    const ptsBadge = pts !== null ? `<span class="pts-badge pts-${pts}">${pts} pt${pts !== 1 ? 's' : ''}</span>` : '';

    return `
      <div class="player-score-row">
        <div class="player-score-name">${p.name}</div>
        <div class="score-stepper">
          <button class="stepper-btn" onclick="adjustScore(${pi}, -1)">−</button>
          <input class="stepper-val" type="number" min="1" max="15"
                 value="${gross || hole.par}"
                 id="score-${pi}"
                 onchange="setScore(${pi}, parseInt(this.value))">
          <button class="stepper-btn" onclick="adjustScore(${pi}, 1)">+</button>
        </div>
        ${r.scoringType === 'stableford' ? `<div class="stableford-pts">${ptsBadge}</div>` : ''}
      </div>
    `;
  }).join('');

  const liveTotalsHTML = r.players.map(p => {
    const pts   = Scoring.totalStableford(p, course);
    const gross = Scoring.totalGross(p);
    return `
      <div class="live-total-row">
        <span class="player-name">${p.name}</span>
        <div class="totals">
          ${r.scoringType === 'stableford' ? `<span class="pts">${pts} pts</span>` : ''}
          <span class="gross">${gross || 0} gross</span>
        </div>
      </div>
    `;
  }).join('');

  const isLast = currentHole === holesTotal - 1;

  document.getElementById('scorecard-content').innerHTML = `
    <div class="scorecard-header">
      <div class="course-name">${course.name}</div>
      <div class="round-title">${r.scoringType === 'stableford' ? 'Stableford' : 'Stroke Play'} · ${holesTotal} Holes</div>
    </div>

    <div class="hole-progress">${progressHTML}</div>

    <div class="hole-card">
      <div class="hole-header">
        <div>
          <div class="hole-num">Hole ${hole.hole}</div>
          <div style="font-size:0.75rem;opacity:0.6;margin-top:2px;">SI ${hole.si}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:0.75rem;opacity:0.7;">Par</div>
          <div class="hole-par">${hole.par}</div>
        </div>
        <div class="hole-si">
          <div>${currentHole + 1} / ${holesTotal}</div>
          <span>${currentHole < 9 ? 'Front' : 'Back'} 9</span>
        </div>
      </div>
      <div class="players-scoring">${playersHTML}</div>
    </div>

    <div class="live-totals">
      <h4>Running Totals</h4>
      ${liveTotalsHTML}
    </div>

    <div class="hole-nav">
      ${currentHole > 0
        ? `<button class="hole-nav-btn prev" onclick="goHole(-1)">← Prev</button>`
        : `<button class="hole-nav-btn prev" onclick="confirmAbandon()">✕ Quit</button>`}
      <button class="hole-nav-btn next" onclick="${isLast ? 'finishRound()' : 'goHole(1)'}">
        ${isLast ? '🏁 Finish Round' : 'Next →'}
      </button>
    </div>
  `;
}

function adjustScore(playerIdx, delta) {
  const r = App.round;
  const hole = r.course.holes[currentHole];
  const cur = r.players[playerIdx].scores[currentHole] || hole.par;
  const next = Math.max(1, Math.min(15, cur + delta));
  r.players[playerIdx].scores[currentHole] = next;
  renderScorecardHole();
}

function setScore(playerIdx, val) {
  if (isNaN(val) || val < 1) val = 1;
  if (val > 15) val = 15;
  App.round.players[playerIdx].scores[currentHole] = val;
  renderScorecardHole();
}

function goHole(dir) {
  currentHole = Math.max(0, Math.min(App.round.holes - 1, currentHole + dir));
  renderScorecardHole();
}

function confirmAbandon() {
  if (confirm('Quit this round? Progress will be lost.')) {
    App.round = null;
    navTo('home');
  }
}

/* ─── FINISH ROUND ───────────────────────────── */
function finishRound() {
  const r = App.round;
  const course = r.course;

  // Build results
  const playerResults = r.players.map(p => ({
    name: p.name,
    handicap: p.handicap,
    stableford: Scoring.totalStableford(p, course),
    gross: Scoring.totalGross(p),
    net: Scoring.netScore(p, course),
    toPar: Scoring.toPar(p, course),
    front9: p.scores.slice(0, 9).reduce((a, b) => a + (b || 0), 0),
    back9:  p.scores.slice(9, 18).reduce((a, b) => a + (b || 0), 0),
    scores: [...p.scores]
  }));

  // Sort
  playerResults.sort((a, b) =>
    r.scoringType === 'stableford'
      ? b.stableford - a.stableford
      : a.gross - b.gross
  );

  r.playerResults = playerResults;
  r.complete = true;

  // Save to history
  App.history.push(r);
  Store.set('ith_history', App.history);

  // Update leaderboard
  updateLeaderboard(playerResults, course);

  renderResults();
  showScreen('results');
}

function updateLeaderboard(results, course) {
  results.forEach(pr => {
    const existing = App.leaderboard.find(e => e.name === pr.name);
    if (existing) {
      existing.rounds++;
      existing.totalPts += pr.stableford;
      existing.bestPts = Math.max(existing.bestPts, pr.stableford);
      if (pr.toPar !== null) existing.bestGross = Math.min(existing.bestGross, pr.toPar);
    } else {
      App.leaderboard.push({
        name: pr.name,
        rounds: 1,
        totalPts: pr.stableford,
        bestPts: pr.stableford,
        bestGross: pr.toPar || 0,
        handicap: pr.handicap
      });
    }
  });
  App.leaderboard.sort((a, b) => b.bestPts - a.bestPts);
  Store.set('ith_leaderboard', App.leaderboard);
}

/* ─── RESULTS SCREEN ─────────────────────────── */
function renderResults() {
  const r = App.round;
  const results = r.playerResults;
  const course = r.course;
  const date = new Date(r.date).toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Podium (up to 3)
  const podiumPlayers = results.slice(0, 3);
  const podiumOrder = podiumPlayers.length >= 2
    ? [podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]].filter(Boolean)
    : podiumPlayers;

  const podiumHTML = `
    <div class="podium">
      ${podiumOrder.map((p, i) => {
        const rank = podiumOrder.indexOf(p) === 1 ? 1 : podiumOrder.indexOf(p) === 0 ? 2 : 3;
        return `
          <div class="podium-place">
            <div class="podium-avatar">${p.name[0]}</div>
            <div class="podium-bar">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}<br>${r.scoringType === 'stableford' ? p.stableford+'pts' : p.gross}</div>
            <div class="podium-name">${p.name}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Full results table
  const tableHTML = `
    <div class="results-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>HCP</th>
            <th>Gross</th>
            <th>Net</th>
            <th>${r.scoringType === 'stableford' ? 'Pts' : 'To Par'}</th>
          </tr>
        </thead>
        <tbody>
          ${results.map((p, i) => `
            <tr ${i === 0 ? 'class="leader"' : ''}>
              <td>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
              <td>${p.name}</td>
              <td>${p.handicap}</td>
              <td>${p.gross}</td>
              <td>${p.net}</td>
              <td>${r.scoringType === 'stableford' ? p.stableford : (p.toPar >= 0 ? '+' : '') + p.toPar}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Hole-by-hole scorecard
  const holeTableHTML = buildHoleTable(r, results);

  document.getElementById('results-content').innerHTML = `
    <div class="top-bar">
      <button class="back-btn" onclick="navTo('home')">‹</button>
      <h2>Round Complete</h2>
      <div></div>
    </div>

    <div class="results-hero">
      <div class="trophy">🏆</div>
      <h2>${results[0]?.name || 'Great Round'} Wins!</h2>
      <p>${course.name} · ${date}</p>
    </div>

    ${results.length > 1 ? podiumHTML : ''}
    ${tableHTML}

    <div class="section-label">Hole-by-Hole</div>
    ${holeTableHTML}

    <div class="share-section">
      <button class="share-btn whatsapp" onclick="shareWhatsApp()">
        💬 Share on WhatsApp
      </button>
      <button class="share-btn copy" onclick="copyScore()">
        📋 Copy Score
      </button>
    </div>

    <button class="primary-btn" style="background:var(--grey-100);color:var(--text-dark);box-shadow:none;" onclick="navTo('home')">
      ← Back Home
    </button>
    <div style="margin:0 16px 16px;background:#fff8e8;border-radius:10px;padding:12px 14px;border-left:3px solid var(--gold);">
      <div style="font-size:0.75rem;font-weight:700;color:var(--gold);margin-bottom:3px;">⛳ PRO TIP</div>
      <div style="font-size:0.8rem;color:var(--text-dark);line-height:1.4;">Dirty grooves cost you strokes. One squirt of <a href="https://cleanharry.world" target="_blank" style="color:var(--green-main);font-weight:700;">Clean Harry</a> sorts it. SA-made. Plant-based. Lekker.</div>
    </div>
    <div style="height:20px;"></div>
  `;
}

function buildHoleTable(r, results) {
  const course = r.course;
  const holesTotal = r.holes;
  const holes = course.holes.slice(0, holesTotal);

  return `
    <div class="scorecard-full-table">
      <table>
        <thead>
          <tr>
            <th>Hole</th>
            ${holes.map(h => `<th>${h.hole}</th>`).join('')}
            ${holesTotal === 18 ? '<th>F9</th><th>B9</th>' : ''}
            <th>TOT</th>
          </tr>
          <tr>
            <th>Par</th>
            ${holes.map(h => `<th>${h.par}</th>`).join('')}
            ${holesTotal === 18 ? '<th>36</th><th>36</th>' : ''}
            <th>${course.par}</th>
          </tr>
          <tr>
            <th>SI</th>
            ${holes.map(h => `<th>${h.si}</th>`).join('')}
            ${holesTotal === 18 ? '<th></th><th></th>' : ''}
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${results.map(p => `
            <tr>
              <td>${p.name}</td>
              ${holes.map((h, i) => {
                const s = p.scores[i];
                const cls = s ? Scoring.scoreClass(s, h.par) : '';
                return `<td class="${cls}">${s || '–'}</td>`;
              }).join('')}
              ${holesTotal === 18 ? `<td class="front-9">${p.front9||0}</td><td class="back-9">${p.back9||0}</td>` : ''}
              <td class="total-row">${p.gross}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function viewResult(roundId) {
  const r = App.history.find(h => h.id === roundId);
  if (!r) return;
  App.round = r;
  renderResults();
  showScreen('results');
}

/* ─── SHARING ─────────────────────────────────── */
function buildShareText() {
  const r = App.round;
  const winner = r.playerResults?.[0];
  const date = new Date(r.date).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });
  const lines = [
    `⛳ *inthehole SA Golf Tracker*`,
    `📍 ${r.course.name} · ${date}`,
    ``,
    r.playerResults.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      return `${medal} ${p.name} – ${p.stableford} pts (${p.gross} gross)`;
    }).join('\n'),
    ``,
    `Tracked with inthehole 🇿🇦 · by Clean Harry (cleanharry.world)`
  ];
  return lines.join('\n');
}

function shareWhatsApp() {
  const text = encodeURIComponent(buildShareText());
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function copyScore() {
  const text = buildShareText();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Score copied! 📋'));
  } else {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Score copied! 📋');
  }
}

/* ─── LEADERBOARD ────────────────────────────── */
function renderLeaderboard() {
  const lb = App.leaderboard;
  if (lb.length === 0) {
    document.getElementById('leaderboard-content').innerHTML = `
      <div class="empty-state">
        <div class="icon">🏆</div>
        <h3>No scores yet</h3>
        <p>Complete a round to appear on the leaderboard.</p>
      </div>
    `;
    return;
  }

  const rankMedal = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const rankIcon  = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

  document.getElementById('leaderboard-content').innerHTML = `
    <div class="section-label" style="padding-top:16px;">All-Time Best Stableford</div>
    ${lb.map((e, i) => `
      <div class="lb-rank-card">
        <div class="lb-rank ${rankMedal(i)}">${rankIcon(i)}</div>
        <div class="lb-avatar">${e.name[0]}</div>
        <div class="lb-info">
          <h4>${e.name}</h4>
          <p>HCP ${e.handicap} · ${e.rounds} round${e.rounds !== 1 ? 's' : ''} played</p>
        </div>
        <div class="lb-score">
          <div class="pts">${e.bestPts}</div>
          <div class="lbl">Best pts</div>
        </div>
      </div>
    `).join('')}

    <div class="section-label">Most Rounds Played</div>
    ${[...lb].sort((a,b) => b.rounds - a.rounds).slice(0, 5).map((e, i) => `
      <div class="lb-rank-card">
        <div class="lb-rank">${i + 1}</div>
        <div class="lb-avatar" style="background:var(--grey-500);">${e.name[0]}</div>
        <div class="lb-info">
          <h4>${e.name}</h4>
          <p>Avg ${e.rounds > 0 ? Math.round(e.totalPts / e.rounds) : 0} pts per round</p>
        </div>
        <div class="lb-score">
          <div class="pts" style="color:var(--text-mid);">${e.rounds}</div>
          <div class="lbl">Rounds</div>
        </div>
      </div>
    `).join('')}
    <div style="height:20px;"></div>
  `;
}

/* ─── HISTORY SCREEN ─────────────────────────── */
function renderHistory() {
  const history = [...App.history].reverse();
  if (history.length === 0) {
    document.getElementById('history-content').innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <h3>No rounds yet</h3>
        <p>Your completed rounds will appear here.</p>
      </div>
    `;
    return;
  }

  document.getElementById('history-content').innerHTML = `
    <div style="height:12px;"></div>
    ${history.map(r => renderRoundCard(r)).join('')}
    <div style="height:20px;"></div>
  `;
}

/* ─── TOAST ──────────────────────────────────── */
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/* ─── PWA INSTALL ────────────────────────────── */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => console.warn('SW registration failed:', err));
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    App.installPrompt = e;
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.remove('hidden');
  });
}

function triggerInstall() {
  if (!App.installPrompt) return;
  App.installPrompt.prompt();
  App.installPrompt.userChoice.then(() => {
    App.installPrompt = null;
    const banner = document.getElementById('install-banner');
    if (banner) banner.classList.add('hidden');
  });
}

/* ─── BOOTSTRAP ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
