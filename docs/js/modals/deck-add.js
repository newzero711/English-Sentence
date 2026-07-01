/* ================= 단어장 추가 모달 =================
   단어장 탭 칩 줄의 "+ 추가"에서 열리는 팝업. */

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
