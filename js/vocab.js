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

  const deckSentences = state.sentences.filter(s => state.vocabDeck === 'all' || deckOf(s) === state.vocabDeck);
  const visibleSentences = deckSentences.filter(s => !isHidden(s));
  const hiddenCount = deckSentences.length - visibleSentences.length;
  const filtered = (state.vocabShowHidden ? deckSentences : visibleSentences)
    .slice()
    .sort((a, b) => recencyKey(b) - recencyKey(a));

  const hiddenToggleBtn = document.getElementById('vocab-hidden-toggle-btn');
  hiddenToggleBtn.classList.toggle('active', state.vocabShowHidden);
  hiddenToggleBtn.title = state.vocabShowHidden ? '숨긴 문장 가리기' : '숨긴 문장도 보기';

  document.getElementById('vocab-count').textContent = (hiddenCount && !state.vocabShowHidden)
    ? `${filtered.length}개 문장 · 숨김 ${hiddenCount}개`
    : `${filtered.length}개 문장`;
  const startBtn = document.getElementById('vocab-start-btn');
  startBtn.disabled = false;
  startBtn.textContent = visibleSentences.length === 0 ? '문장 추가하기' : '학습 시작';

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
    listEl.innerHTML = hiddenCount
      ? `
      <div class="empty-state">
        <div class="icon">🙈</div>
        <h3>모두 숨긴 문장이에요</h3>
        <p>상단의 숨김 보기 버튼을 누르면 확인할 수 있어요.</p>
      </div>`
      : `
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
    const hidden = isHidden(s);

    const item = document.createElement('div');
    item.className = 'vocab-item' + (hidden ? ' hidden-item' : '');
    item.innerHTML = `
      <div class="vocab-item-top">
        <div>
          <div class="vocab-english">${escapeHtml(s.english)}</div>
          <div class="vocab-korean">${escapeHtml(s.korean)}</div>
        </div>
        <div class="vocab-tags">
          <button class="vocab-hide-btn" title="${hidden ? '숨김 해제' : '숨기기'}">${hidden ? '숨김 해제' : '숨기기'}</button>
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

    item.querySelector('.vocab-hide-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHidden(s);
      renderVocabTab();
    });

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
  document.getElementById('edit-hide-btn').textContent = isHidden(sentence) ? '숨김 해제' : '숨기기 (학습에서 제외)';

  document.getElementById('edit-overlay').classList.add('show');
}

function handleEditToggleHidden() {
  const sentence = state.sentences.find(s => String(s.id) === String(state.editingId));
  if (!sentence) { closeEditOverlay(); return; }

  toggleHidden(sentence);
  closeEditOverlay();
  renderVocabTab();
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
  state.hiddenIds = state.hiddenIds.filter(x => x !== String(id));
  saveHiddenIds();

  // 휴지통에는 항상 로컬로만 보관 (시트 동기화 성공/실패와 무관) - 복구할 때만 시트에 다시 추가함
  state.trash.unshift({
    trashId: `trash-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: dateOnly(sentence.date),
    english: sentence.english,
    korean: sentence.korean,
    detail: sentence.detail,
    deck: sentence.deck,
    deletedAt: Date.now()
  });
  saveTrash();
  updateTrashBadge();

  const url = state.config.sheetUrl;
  if (url) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteSentence', id })
    }).then(r => r.json()).then(data => {
      if (data.ok) {
        // 같은 단어장의 다른 문장들 행번호가 한 칸씩 밀렸으므로 최신 id로 다시 맞춘다
        refreshSentencesFromSheet().then(() => { renderVocabTab(); updateStats(); });
        showToast('문장을 삭제했어요');
      } else {
        queuePendingDelete(id);
        showToast('시트 연결에 문제가 있어 동기화 대기열에 저장했어요');
      }
    }).catch(() => {
      queuePendingDelete(id);
      showToast('시트 연결에 문제가 있어 동기화 대기열에 저장했어요');
    });
  } else {
    queuePendingDelete(id);
    showToast('문장을 삭제했어요 (시트 URL 미설정 · 동기화 대기열에 저장됨)');
  }

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
document.getElementById('edit-hide-btn').addEventListener('click', handleEditToggleHidden);
document.getElementById('edit-delete-btn').addEventListener('click', handleEditDelete);
document.getElementById('edit-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'edit-overlay') closeEditOverlay();
});

document.getElementById('vocab-hidden-toggle-btn').addEventListener('click', () => {
  state.vocabShowHidden = !state.vocabShowHidden;
  renderVocabTab();
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

/* ---------- 단어장 순서 변경 (단어장 탭 헤더의 ⋮ 버튼) ---------- */

function renderDeckOrderList() {
  const decks = getDecks();
  const listEl = document.getElementById('deck-order-list');
  listEl.innerHTML = '';

  decks.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'deck-order-item';
    row.innerHTML = `
      <span class="deck-order-name">${escapeHtml(d)}</span>
      <div class="deck-order-arrows">
        <button class="order-btn" data-dir="up" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="order-btn" data-dir="down" ${i === decks.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="btn-text-danger" data-act="delete">삭제</button>
      </div>`;
    row.querySelector('[data-dir="up"]').addEventListener('click', () => moveDeckOrder(d, -1));
    row.querySelector('[data-dir="down"]').addEventListener('click', () => moveDeckOrder(d, 1));
    row.querySelector('[data-act="delete"]').addEventListener('click', () => handleDeleteDeck(d));
    listEl.appendChild(row);
  });
}

function handleDeleteDeck(deckName) {
  const sentencesInDeck = state.sentences.filter(s => deckOf(s) === deckName);
  const count = sentencesInDeck.length;
  const msg = count
    ? `"${deckName}" 단어장을 삭제할까요? 문장 ${count}개는 휴지통으로 이동돼요.`
    : `"${deckName}" 단어장을 삭제할까요?`;
  if (!confirm(msg)) return;

  sentencesInDeck.forEach(s => {
    state.trash.unshift({
      trashId: `trash-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: dateOnly(s.date),
      english: s.english,
      korean: s.korean,
      detail: s.detail,
      deck: s.deck,
      deletedAt: Date.now()
    });
    delete state.logs[String(s.id)];
  });
  state.sentences = state.sentences.filter(s => deckOf(s) !== deckName);
  const deletedIds = sentencesInDeck.map(s => String(s.id));
  state.hiddenIds = state.hiddenIds.filter(x => !deletedIds.includes(x));
  saveSentences();
  saveLogs();
  saveHiddenIds();
  saveTrash();
  updateTrashBadge();

  state.allDecks = state.allDecks.filter(d => (d.trim() || '기본') !== deckName);
  saveDecks();
  state.deckOrder = state.deckOrder.filter(d => d !== deckName);
  saveDeckOrder();
  if (state.vocabDeck === deckName) state.vocabDeck = 'all';

  const url = state.config.sheetUrl;
  if (url) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteDeck', deck: deckName })
    }).then(r => r.json()).then(data => {
      if (!data.ok) queuePendingDeckDelete(deckName);
    }).catch(() => queuePendingDeckDelete(deckName));
  } else {
    queuePendingDeckDelete(deckName);
  }

  showToast(`"${deckName}" 단어장을 삭제했어요`);
  renderDeckOrderList();
  renderVocabTab();
  renderAddDeckChips();
  updateStats();
}

function queuePendingDeckDelete(name) {
  if (!state.pendingDeckDeletes.includes(name)) state.pendingDeckDeletes.push(name);
  savePendingDeckDeletes();
  updateStats();
}

function moveDeckOrder(deck, delta) {
  const decks = getDecks();
  const idx = decks.indexOf(deck);
  const target = idx + delta;
  if (target < 0 || target >= decks.length) return;

  [decks[idx], decks[target]] = [decks[target], decks[idx]];
  state.deckOrder = decks;
  saveDeckOrder();
  renderDeckOrderList();
  renderVocabTab();
  renderAddDeckChips();
}

function openDeckOrderModal() {
  renderDeckOrderList();
  document.getElementById('deck-order-overlay').classList.add('show');
}

function closeDeckOrderModal() {
  document.getElementById('deck-order-overlay').classList.remove('show');
}

document.getElementById('deck-order-btn').addEventListener('click', openDeckOrderModal);
document.getElementById('deck-order-close-btn').addEventListener('click', closeDeckOrderModal);
document.getElementById('deck-order-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'deck-order-overlay') closeDeckOrderModal();
});
