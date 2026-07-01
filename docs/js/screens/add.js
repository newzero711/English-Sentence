/* ================= 문장추가 탭 =================
   문장추가 탭만 다룹니다. 단어장 목록/달력/설정을 고칠 때는
   이 파일을 건드릴 필요가 없습니다. */

function renderAddDeckChips() {
  const decks = getDecks().filter(d => d !== '기본');
  const chipsEl = document.getElementById('add-deck-chips');
  chipsEl.innerHTML = '';
  chipsEl.appendChild(makeChip('기본', false, () => {
    document.getElementById('add-deck-input').value = '';
  }));
  decks.forEach(d => {
    chipsEl.appendChild(makeChip(d, false, () => {
      document.getElementById('add-deck-input').value = d;
    }));
  });
}

function handleAddSave() {
  const english = document.getElementById('add-english-input').value.trim();
  const korean = document.getElementById('add-korean-input').value.trim();
  const detail = document.getElementById('add-detail-input').value.trim();
  const deck = document.getElementById('add-deck-input').value.trim();

  if (!english || !korean) {
    showToast('영어 표현과 한글 대사를 모두 입력해주세요');
    return;
  }

  const newSentence = {
    id: `local-${Date.now()}`,
    date: localDateStr(),
    english, korean, detail, deck
  };
  state.sentences.push(newSentence);
  saveSentences();

  document.getElementById('add-english-input').value = '';
  document.getElementById('add-korean-input').value = '';
  document.getElementById('add-detail-input').value = '';
  document.getElementById('add-deck-input').value = '';

  const url = state.config.sheetUrl;
  if (url) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'addSentence', english, korean, detail, deck, date: newSentence.date })
    }).then(r => r.json()).then(data => {
      if (data.ok) {
        // 시트가 실제로 부여한 id(단어장!행번호)로 맞춰야 이후 삭제/수정 요청이 시트에 반영된다
        if (data.id) {
          newSentence.id = data.id;
          saveSentences();
        }
      } else {
        queuePendingSentence(newSentence);
      }
    }).catch(() => queuePendingSentence(newSentence));
  } else {
    queuePendingSentence(newSentence);
  }

  showToast('문장을 추가했어요');
  renderAddDeckChips();
  updateStats();
}

function queuePendingSentence(s) {
  state.pendingSentences.push(s);
  savePendingSentences();
  updateStats();
}

document.getElementById('add-save-btn').addEventListener('click', handleAddSave);
