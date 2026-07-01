/* ================= 문장 수정 모달 =================
   단어장 탭에서 문장을 선택하면 열리는 수정 팝업.
   저장·숨기기·삭제 처리와 시트 연동을 모두 여기서 담당합니다. */

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

  // 휴지통에는 항상 로컬로만 보관 - 복구할 때만 시트에 다시 추가함
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
