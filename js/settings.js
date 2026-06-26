/* ================= 설정 탭 / 동기화 / CSV·초기화 =================
   설정 탭과 Google Sheets 동기화만 다룹니다. */

async function flushPendingSentences(url) {
  if (!state.pendingSentences.length) return;
  const remaining = [];
  for (const s of state.pendingSentences) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addSentence', english: s.english, korean: s.korean, detail: s.detail, deck: s.deck, date: s.date })
      });
      const data = await res.json();
      if (!data.ok) remaining.push(s);
    } catch (e) {
      remaining.push(s);
    }
  }
  state.pendingSentences = remaining;
  savePendingSentences();
}

async function flushPendingDecks(url) {
  if (!state.pendingDecks.length) return;
  const remaining = [];
  for (const name of state.pendingDecks) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addDeck', deck: name })
      });
      const data = await res.json();
      if (!data.ok) remaining.push(name);
    } catch (e) {
      remaining.push(name);
    }
  }
  state.pendingDecks = remaining;
  savePendingDecks();
}

async function flushPendingUpdates(url) {
  if (!state.pendingUpdates.length) return;
  const remaining = [];
  for (const u of state.pendingUpdates) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateSentence', ...u })
      });
      const data = await res.json();
      if (!data.ok) remaining.push(u);
    } catch (e) {
      remaining.push(u);
    }
  }
  state.pendingUpdates = remaining;
  savePendingUpdates();
}

async function flushPendingDeletes(url) {
  if (!state.pendingDeletes.length) return;
  const remaining = [];
  for (const id of state.pendingDeletes) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteSentence', id })
      });
      const data = await res.json();
      if (!data.ok) remaining.push(id);
    } catch (e) {
      remaining.push(id);
    }
  }
  state.pendingDeletes = remaining;
  savePendingDeletes();
}

async function syncWithSheet() {
  const url = state.config.sheetUrl;
  if (!url) {
    showToast('설정에서 시트 URL을 먼저 입력해주세요');
    return;
  }

  setConnStatus('pending', '동기화 중...');

  try {
    await flushPendingDecks(url);
    await flushPendingSentences(url);
    await flushPendingUpdates(url);
    await flushPendingDeletes(url);

    const res = await fetch(`${url}?action=sentences`);
    const data = await res.json();

    if (data.sentences) {
      state.sentences = data.sentences;
      saveSentences();
    }
    if (data.decks) {
      state.allDecks = data.decks;
      saveDecks();
    }

    if (state.pendingLogs.length) {
      const uploadRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addLogsBatch', logs: state.pendingLogs })
      });
      const uploadData = await uploadRes.json();
      if (uploadData.ok) {
        state.pendingLogs = [];
        savePending();
      }
    }

    const stillPending = state.pendingLogs.length + state.pendingSentences.length + state.pendingUpdates.length + state.pendingDecks.length + state.pendingDeletes.length;
    if (stillPending > 0) {
      setConnStatus('err', `동기화 일부 실패 · 문장 ${state.sentences.length}개 · ${stillPending}건 대기 중`);
      showToast('일부 항목이 동기화되지 않았어요. Apps Script 재배포를 확인해주세요');
    } else {
      setConnStatus('ok', `동기화 완료 · 문장 ${state.sentences.length}개`);
      showToast(`${state.sentences.length}개 문장을 불러왔어요`);
    }
    buildQueue();
    updateStats();
    renderVocabTab();
    renderAddDeckChips();
  } catch (e) {
    console.error(e);
    setConnStatus('err', '동기화 실패 · URL을 확인해주세요');
    showToast('동기화에 실패했어요');
  }
}

function setConnStatus(type, msg) {
  const dot = document.getElementById('conn-dot');
  const status = document.getElementById('conn-status');
  dot.classList.remove('ok', 'err');
  if (type === 'ok') dot.classList.add('ok');
  if (type === 'err') dot.classList.add('err');
  status.textContent = msg;
}

/* ---------- CSV 내보내기 / 초기화 ---------- */

function exportCsv() {
  const rows = [['timestamp', 'sentenceId', 'deck', 'userInput', 'isCorrect', 'similarity']];

  state.pendingLogs.forEach(l => {
    rows.push([l.timestamp, l.sentenceId, l.deck, l.userInput, l.isCorrect, l.similarity]);
  });

  if (rows.length === 1) {
    showToast('내보낼 새 기록이 없어요');
    return;
  }

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sentence_log_${localDateStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resetProgress() {
  if (!confirm('모든 학습 기록(달력 기록 포함)을 초기화할까요? 시트에 동기화된 기록은 유지됩니다.')) return;
  state.logs = {};
  state.pendingLogs = [];
  state.history = [];
  saveLogs();
  savePending();
  saveHistory();
  buildQueue();
  updateStats();
  renderVocabTab();
  if (state.activeTab === 'calendar') renderCalendar();
  showToast('학습 기록을 초기화했어요');
}

document.getElementById('save-url-btn').addEventListener('click', () => {
  state.config.sheetUrl = document.getElementById('sheet-url').value.trim();
  saveConfig();
  showToast('URL을 저장했어요');
});

document.getElementById('sync-btn').addEventListener('click', () => {
  state.config.sheetUrl = document.getElementById('sheet-url').value.trim();
  saveConfig();
  syncWithSheet();
});

document.getElementById('threshold-slider').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  state.config.threshold = val;
  document.getElementById('threshold-value').textContent = `${Math.round(val * 100)}%`;
  saveConfig();
});

document.getElementById('export-csv-btn').addEventListener('click', exportCsv);
document.getElementById('reset-progress-btn').addEventListener('click', resetProgress);
