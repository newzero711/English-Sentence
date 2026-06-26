/* ================= 휴지통 =================
   삭제한 문장을 30일간 로컬에만 보관하다 기한이 지나면 자동으로 영구 삭제합니다.
   휴지통 자체는 시트에 올라가지 않고, 복구할 때만 addSentence로 시트에 다시 추가됩니다. */

const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function purgeExpiredTrash() {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const before = state.trash.length;
  state.trash = state.trash.filter(t => t.deletedAt > cutoff);
  if (state.trash.length !== before) saveTrash();
}

function trashDaysLeft(deletedAt) {
  const elapsedDays = Math.floor((Date.now() - deletedAt) / (24 * 60 * 60 * 1000));
  return Math.max(TRASH_RETENTION_DAYS - elapsedDays, 0);
}

function updateTrashBadge() {
  document.getElementById('trash-count-badge').textContent = state.trash.length ? `(${state.trash.length})` : '';
}

function renderTrash() {
  purgeExpiredTrash();
  updateTrashBadge();

  const listEl = document.getElementById('trash-list');
  const emptyBtn = document.getElementById('trash-empty-btn');
  emptyBtn.style.display = state.trash.length ? '' : 'none';
  listEl.innerHTML = '';

  if (!state.trash.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🗑️</div>
        <h3>휴지통이 비어있어요</h3>
        <p>단어장에서 삭제한 문장이 30일 동안 여기 보관돼요.</p>
      </div>`;
    return;
  }

  state.trash.forEach(t => {
    const item = document.createElement('div');
    item.className = 'trash-item';
    item.innerHTML = `
      <div class="trash-item-top">
        <div class="text-col">
          <div class="vocab-english">${escapeHtml(t.english)}</div>
          <div class="vocab-korean">${escapeHtml(t.korean)}</div>
        </div>
        <span class="vocab-deck-tag">${escapeHtml(deckOf(t))}</span>
      </div>
      <div class="trash-item-bottom">
        <span class="trash-days">${trashDaysLeft(t.deletedAt)}일 후 완전 삭제</span>
        <div class="trash-actions">
          <button class="btn-text" data-action="restore">복구</button>
          <button class="btn-text-danger" data-action="purge">영구 삭제</button>
        </div>
      </div>`;
    item.querySelector('[data-action="restore"]').addEventListener('click', () => restoreTrashItem(t.trashId));
    item.querySelector('[data-action="purge"]').addEventListener('click', () => purgeTrashItem(t.trashId));
    listEl.appendChild(item);
  });
}

function openTrashModal() {
  renderTrash();
  document.getElementById('trash-overlay').classList.add('show');
}

function closeTrashModal() {
  document.getElementById('trash-overlay').classList.remove('show');
}

function purgeTrashItem(trashId) {
  if (!confirm('이 문장을 완전히 삭제할까요? 복구할 수 없어요.')) return;
  state.trash = state.trash.filter(t => t.trashId !== trashId);
  saveTrash();
  renderTrash();
}

function emptyTrash() {
  if (!state.trash.length) return;
  if (!confirm(`휴지통의 문장 ${state.trash.length}개를 모두 완전히 삭제할까요? 복구할 수 없어요.`)) return;
  state.trash = [];
  saveTrash();
  renderTrash();
  showToast('휴지통을 비웠어요');
}

function restoreTrashItem(trashId) {
  const item = state.trash.find(t => t.trashId === trashId);
  if (!item) return;

  state.trash = state.trash.filter(t => t.trashId !== trashId);
  saveTrash();

  const restored = {
    id: `local-${Date.now()}`,
    date: dateOnly(item.date) || localDateStr(),
    english: item.english,
    korean: item.korean,
    detail: item.detail,
    deck: item.deck
  };
  state.sentences.push(restored);
  saveSentences();

  const url = state.config.sheetUrl;
  if (url) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'addSentence', english: restored.english, korean: restored.korean, detail: restored.detail, deck: restored.deck, date: restored.date })
    }).then(r => r.json()).then(data => {
      if (data.ok) {
        // 시트가 실제로 부여한 id(단어장!행번호)로 맞춰야 이후 삭제/수정 요청이 시트에 반영된다
        if (data.id) {
          restored.id = data.id;
          saveSentences();
        }
      } else {
        queuePendingSentence(restored);
      }
    }).catch(() => queuePendingSentence(restored));
  } else {
    queuePendingSentence(restored);
  }

  showToast('문장을 복구했어요');
  renderTrash();
  renderVocabTab();
  renderAddDeckChips();
  updateStats();
}

document.getElementById('open-trash-btn').addEventListener('click', openTrashModal);
document.getElementById('trash-close-btn').addEventListener('click', closeTrashModal);
document.getElementById('trash-empty-btn').addEventListener('click', emptyTrash);
document.getElementById('trash-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'trash-overlay') closeTrashModal();
});
