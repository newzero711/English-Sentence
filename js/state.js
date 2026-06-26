/* ================= 상태 관리 / 로컬 저장소 / 공용 유틸 =================
   모든 탭이 공유하는 데이터 계층. 탭별 화면 로직은 건드리지 않고
   이 파일만 보고 데이터 구조를 파악할 수 있도록 분리했습니다. */

const DB_KEYS = {
  sentences: 'sm_sentences',
  decks: 'sm_decks',
  logs: 'sm_logs',
  pendingLogs: 'sm_pending_logs',
  pendingSentences: 'sm_pending_sentences',
  pendingUpdates: 'sm_pending_updates',
  pendingDecks: 'sm_pending_decks',
  pendingDeletes: 'sm_pending_deletes',
  history: 'sm_history',
  config: 'sm_config'
};

const defaultConfig = {
  sheetUrl: '',
  threshold: 0.85
};

const now0 = new Date();

let state = {
  sentences: [],
  allDecks: [],           // 동기화로 받은 단어장 탭 전체 목록 (문장이 0개인 단어장도 포함)
  logs: {},              // sentenceId -> { lastCorrect: bool, attempts: n }
  pendingLogs: [],        // 동기화 안 된 학습 로그
  pendingSentences: [],   // 동기화 안 된 새 문장
  pendingUpdates: [],     // 동기화 안 된 문장 수정 (id별로 마지막 수정만 보관)
  pendingDecks: [],       // 동기화 안 된 새 단어장 (빈 탭 생성 대기)
  pendingDeletes: [],     // 동기화 안 된 문장 삭제 (id 목록)
  history: [],            // { date:'YYYY-MM-DD', deck, sentenceId, isCorrect } (달력용, 영구 보관)
  config: { ...defaultConfig },

  activeTab: 'vocab',
  vocabDeck: 'all',       // 단어장 탭에서 선택된 단어장 필터
  editingId: null,        // 수정 오버레이에서 편집 중인 문장 id

  filter: 'all',          // 학습 오버레이 필터 (전체/오답만/안 푼 문장)
  studyDeck: 'all',       // 현재 학습 세션이 한정된 단어장
  queue: [],
  index: 0,
  checked: false,

  calYear: now0.getFullYear(),
  calMonth: now0.getMonth(),
  calSelectedDate: null
};

/* ---------- 로컬 저장소 ---------- */

function loadState() {
  try {
    state.sentences = JSON.parse(localStorage.getItem(DB_KEYS.sentences) || '[]');
    state.allDecks = JSON.parse(localStorage.getItem(DB_KEYS.decks) || '[]');
    state.logs = JSON.parse(localStorage.getItem(DB_KEYS.logs) || '{}');
    state.pendingLogs = JSON.parse(localStorage.getItem(DB_KEYS.pendingLogs) || '[]');
    state.pendingSentences = JSON.parse(localStorage.getItem(DB_KEYS.pendingSentences) || '[]');
    state.pendingUpdates = JSON.parse(localStorage.getItem(DB_KEYS.pendingUpdates) || '[]');
    state.pendingDecks = JSON.parse(localStorage.getItem(DB_KEYS.pendingDecks) || '[]');
    state.pendingDeletes = JSON.parse(localStorage.getItem(DB_KEYS.pendingDeletes) || '[]');
    state.history = JSON.parse(localStorage.getItem(DB_KEYS.history) || '[]');
    state.config = { ...defaultConfig, ...JSON.parse(localStorage.getItem(DB_KEYS.config) || '{}') };
  } catch (e) {
    console.error('state load error', e);
  }
}

function saveSentences() { localStorage.setItem(DB_KEYS.sentences, JSON.stringify(state.sentences)); }
function saveDecks() { localStorage.setItem(DB_KEYS.decks, JSON.stringify(state.allDecks)); }
function saveLogs() { localStorage.setItem(DB_KEYS.logs, JSON.stringify(state.logs)); }
function savePending() { localStorage.setItem(DB_KEYS.pendingLogs, JSON.stringify(state.pendingLogs)); }
function savePendingSentences() { localStorage.setItem(DB_KEYS.pendingSentences, JSON.stringify(state.pendingSentences)); }
function savePendingUpdates() { localStorage.setItem(DB_KEYS.pendingUpdates, JSON.stringify(state.pendingUpdates)); }
function savePendingDecks() { localStorage.setItem(DB_KEYS.pendingDecks, JSON.stringify(state.pendingDecks)); }
function savePendingDeletes() { localStorage.setItem(DB_KEYS.pendingDeletes, JSON.stringify(state.pendingDeletes)); }
function saveHistory() { localStorage.setItem(DB_KEYS.history, JSON.stringify(state.history)); }
function saveConfig() { localStorage.setItem(DB_KEYS.config, JSON.stringify(state.config)); }

/* ---------- 유틸 ---------- */

function deckOf(s) {
  const d = s && s.deck ? String(s.deck).trim() : '';
  return d || '기본';
}

// 단어장 탭 정렬용: id 끝의 숫자가 클수록 더 나중에 추가된 것
// 시트 동기화분("deck!행번호")은 행번호, 로컬 미동기화분("local-타임스탬프")은 타임스탬프라
// 스케일이 달라도 "더 큰 값 = 더 최근"이 자연스럽게 맞아떨어짐
function recencyKey(s) {
  const id = String(s.id);
  const sep = Math.max(id.lastIndexOf('!'), id.lastIndexOf('-'));
  const n = parseInt(id.slice(sep + 1), 10);
  return isNaN(n) ? 0 : n;
}

function getDecks() {
  const set = new Set(state.allDecks.map(d => d.trim() || '기본'));
  state.sentences.forEach(s => set.add(deckOf(s)));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function makeChip(label, active, onClick) {
  const btn = document.createElement('button');
  btn.className = 'chip' + (active ? ' active' : '');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

/* ---------- 유사도 채점 ---------- */

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(\w+)s\b/g, '$1');
}

function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  return 1 - dist / maxLen;
}

/* ---------- 동기화 대기 카운트 (설정 탭 상단 통계에 표시되지만,
   모든 탭의 액션에서 호출되는 데이터 계층 함수라 여기 둡니다) ---------- */

function updateStats() {
  document.getElementById('stat-total').textContent = state.sentences.length;
  document.getElementById('stat-pending').textContent = state.pendingLogs.length + state.pendingSentences.length + state.pendingUpdates.length + state.pendingDecks.length + state.pendingDeletes.length;
}

/* ---------- Toast ---------- */

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
