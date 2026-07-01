/* ================= 단어장 순서 변경 모달 =================
   단어장 탭 헤더의 ⋮ 버튼에서 열리는 팝업.
   순서 변경과 단어장 삭제(+내 문장 휴지통 이동)를 담당합니다. */

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
