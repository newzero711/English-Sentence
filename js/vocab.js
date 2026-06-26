/* ================= 단어장 탭 =================
   단어장 탭(목록/필터/문장 수정·삭제/단어장 추가)만 다룹니다.
   다른 탭(문장추가/달력/설정)을 고칠 때는 이 파일을 건드릴 필요가 없습니다. */

function renderVocabTab() {
  const decks = getDecks();
  const chipsEl = document.getElementById('deck-chips');
  chipsEl.innerHTML = '';
  chipsEl.appendChild(makeChip('전체', state.vocabDeck === 'all', () => {
    state.vocabDeck = 'all';
    renderVocabTab();
  }));
  decks.forEach(d => {
    chipsEl.appendChild(makeChip(d, state.vocabDeck === d, () => {
      state.vocabDeck = d;
      renderVocabTab();
    }));
  });

  const addChip = document.createElement('button');
  addChip.className = 'chip add-chip';
  addChip.innerHTML = '<span class="icon-plus"></span><span>추가</span>';
  addChip.addEventListener('click', openAddDeckModal);
  chipsEl.appendChild(addChip);

  const filtered = state.sentences
    .filter(s => state.vocabDeck === 'all' || deckOf(s) === state.vocabDeck)
    .slice()
    .sort((a, b) => recencyKey(b) - recencyKey(a));
  document.getElementById('vocab-count').textContent = `${filtered.length}개 문장`;
  const startBtn = document.getElementById('vocab-start-btn');
  startBtn.disabled = false;
  startBtn.textContent = filtered.length === 0 ? '문장 추가하기' : '학습 시작';

  const listEl = document.getElementById('vocab-list');
  listEl.innerHTML = '';

  if (!state.sentences.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">📄</div>
        <h3>문장이 없어요</h3>
        <p>설정 탭에서 Google Sheets와 동기화하면<br/>문장 목록을 불러올 수 있어요.</p>
      </div>`;
    return;
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <h3>이 단어장은 비어있어요</h3>
      </div>`;
    return;
  }

  filtered.forEach(s => {
    const log = state.logs[String(s.id)];
    const statusClass = !log ? 'unseen' : (log.lastCorrect ? 'correct' : 'wrong');
    const statusLabel = !log ? '안 외움' : (log.lastCorrect ? '암기완료' : '다시 외우기');

    const item = document.createElement('div');
    item.className = 'vocab-item';
    item.innerHTML = `
      <div class="vocab-item-top">
        <div>
          <div class="vocab-english">${escapeHtml(s.english)}</div>
          <div class="vocab-korean">${escapeHtml(s.korean)}</div>
        </div>
        <div class="vocab-tags">
          <span class="vocab-deck-tag">${escapeHtml(deckOf(s))}</span>
          <span class="vocab-status ${statusClass}">${statusLabel}</span>
        </div>
      </div>
      ${s.detail ? `<span class="vocab-hint-toggle">힌트 보기</span><div class="vocab-hint-text">${escapeHtml(s.detail)}</div>` : ''}
    `;

    if (s.detail) {
      const toggle = item.querySelector('.vocab-hint-toggle');
      const text = item.querySelector('.vocab-hint-text');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const showing = text.style.display === 'block';
        text.style.display = showing ? 'none' : 'block';
        toggle.textContent = showing ? '힌트 보기' : '힌트 닫기';
      });
    }

    item.addEventListener('click', () => openEditOverlay(s));

    listEl.appendChild(item);
  });
}

/* ---------- 문장 수정 오버레이 ---------- */

function openEditOverlay(sentence) {
  state.editingId = sentence.id;

  const decks = getDecks().filter(d => d !== '기본');
  const chipsEl = document.getElementById('edit-deck-chips');
  chipsEl.innerHTML = '';
  chipsEl.appendChild(makeChip('기본', deckOf(sentence) === '기본', () => {
    document.getElementById('edit-deck-input').value = '';
  }));
  decks.forEach(d => {
    chipsEl.appendChild(makeChip(d, deckOf(sentence) === d, () => {
      document.getElementById('edit-deck-input').value = d;
    }));
  });

  document.getElementById('edit-deck-input').value = deckOf(sentence) === '기본' ? '' : deckOf(sentence);
  document.getElementById('edit-english-input').value = sentence.english || '';
  document.getElementById('edit-korean-input').value = sentence.korean || '';
  document.getElementById('edit-detail-input').value = sentence.detail || '';

  document.getElementById('edit-overlay').classList.add('show');
}

function closeEditOverlay() {
  document.getElementById('edit-overlay').classList.remove('show');
  state.editingId = null;
}

function handleEditSave() {
  const sentence = state.sentences.find(s => String(s.id) === String(state.editingId));
  if (!sentence) { closeEditOverlay(); return; }

  const english = document.getElementById('edit-english-input').value.trim();
  const korean = document.getElementById('edit-korean-input').value.trim();
  const detail = document.getElementById('edit-detail-input').value.trim();
  const deck = document.getElementById('edit-deck-input').value.trim();

  if (!english || !korean) {
    showToast('영어 표현과 한글 대사를 모두 입력해주세요');
    return;
  }

  sentence.english = english;
  sentence.korean = korean;
  sentence.detail = detail;
  sentence.deck = deck;
  saveSentences();

  const update = { id: state.editingId, english, korean, detail, deck, date: sentence.date };
  const url = state.config.sheetUrl;
  if (url) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateSentence', ...update })
    }).then(r => r.json()).then(data => {
      if (data.ok && data.id) sentence.id = data.id;
      else if (!data.ok) queuePendingUpdate(update);
      saveSentences();
    }).catch(() => queuePendingUpdate(update));
  } else {
    queuePendingUpdate(update);
  }

  showToast('문장을 수정했어요');
  closeEditOverlay();
  renderVocabTab();
  updateStats();
}

function queuePendingUpdate(update) {
  state.pendingUpdates = state.pendingUpdates.filter(u => u.id !== update.id);
  state.pendingUpdates.push(update);
  savePendingUpdates();
  updateStats();
}

function handleEditDelete() {
  const id = state.editingId;
  const sentence = state.sentences.find(s => String(s.id) === String(id));
  if (!sentence) { closeEditOverlay(); return; }

  if (!confirm('이 문장을 삭제할까요?')) return;

  state.sentences = state.sentences.filter(s => String(s.id) !== String(id));
  saveSentences();
  delete state.logs[String(id)];
  saveLogs();

  const url = state.config.sheetUrl;
  if (url) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteSentence', id })
    }).then(r => r.json()).then(data => {
      if (!data.ok) queuePendingDelete(id);
    }).catch(() => queuePendingDelete(id));
  } else {
    queuePendingDelete(id);
  }

  showToast('문장을 삭제했어요');
  closeEditOverlay();
  renderVocabTab();
  updateStats();
}

function queuePendingDelete(id) {
  if (!state.pendingDeletes.includes(id)) state.pendingDeletes.push(id);
  savePendingDeletes();
  updateStats();
}

document.getElementById('edit-close-btn').addEventListener('click', closeEditOverlay);
document.getElementById('edit-save-btn').addEventListener('click', handleEditSave);
document.getElementById('edit-delete-btn').addEventListener('click', handleEditDelete);
document.getElementById('edit-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'edit-overlay') closeEditOverlay();
});

document.getElementById('vocab-start-btn').addEventListener('click', () => {
  const filtered = state.sentences.filter(s => state.vocabDeck === 'all' || deckOf(s) === state.vocabDeck);
  if (filtered.length === 0) {
    const deckToPrefill = (state.vocabDeck === 'all' || state.vocabDeck === '기본') ? '' : state.vocabDeck;
    setActiveTab('add');
    document.getElementById('add-deck-input').value = deckToPrefill;
  } else {
    startStudy(state.vocabDeck);
  }
});

/* ---------- 단어장 추가 (단어장 탭 칩 줄의 "+ 추가") ---------- */

const RESERVED_DECK_NAMES = ['전체', '학습로그'];

function openAddDeckModal() {
  document.getElementById('deck-name-input').value = '';
  document.getElementById('deck-overlay').classList.add('show');
  document.getElementById('deck-name-input').focus({ preventScroll: true });
}

function closeAddDeckModal() {
  document.getElementById('deck-overlay').classList.remove('show');
}

function handleAddDeckSave() {
  const name = document.getElementById('deck-name-input').value.trim();
  if (!name) {
    showToast('단어장 이름을 입력해주세요');
    return;
  }
  if (RESERVED_DECK_NAMES.includes(name)) {
    showToast('사용할 수 없는 이름이에요');
    return;
  }
  const existing = getDecks();
  if (existing.some(d => d.localeCompare(name, 'ko', { sensitivity: 'base' }) === 0)) {
    showToast('이미 있는 단어장이에요');
    return;
  }

  state.allDecks.push(name);
  saveDecks();

  const url = state.config.sheetUrl;
  if (url) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'addDeck', deck: name })
    }).then(r => r.json()).then(data => {
      if (!data.ok) queuePendingDeck(name);
    }).catch(() => queuePendingDeck(name));
  } else {
    queuePendingDeck(name);
  }

  state.vocabDeck = name;
  showToast('단어장을 만들었어요');
  closeAddDeckModal();
  renderVocabTab();
  renderAddDeckChips();
}

function queuePendingDeck(name) {
  if (!state.pendingDecks.includes(name)) state.pendingDecks.push(name);
  savePendingDecks();
  updateStats();
}

document.getElementById('deck-close-btn').addEventListener('click', closeAddDeckModal);
document.getElementById('deck-save-btn').addEventListener('click', handleAddDeckSave);
document.getElementById('deck-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'deck-overlay') closeAddDeckModal();
});
document.getElementById('deck-name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAddDeckSave();
  }
});
