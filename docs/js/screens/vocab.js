/* ================= 단어장 탭 =================
   단어장 목록 렌더링과 탭 직속 버튼만 다룹니다.
   수정/추가/순서 모달은 modals/ 폴더를 보세요. */

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
          <button class="vocab-hide-btn${hidden ? ' is-hidden' : ''}" title="${hidden ? '숨김 해제' : '숨기기'}">${hidden ? '숨김 해제' : '숨기기'}</button>
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
