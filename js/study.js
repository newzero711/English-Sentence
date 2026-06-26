/* ================= 학습 카드 오버레이 =================
   단어장 탭의 "학습 시작" 버튼으로 진입하는 풀스크린 학습 플로우.
   단어장 목록 자체(vocab.js)와는 분리되어 있어, 채점/필터 로직을
   고칠 때 단어장 목록 렌더링에 영향을 주지 않습니다. */

function buildQueue() {
  let ids = state.sentences
    .filter(s => state.studyDeck === 'all' || deckOf(s) === state.studyDeck)
    .map(s => String(s.id));

  if (state.filter === 'wrong') {
    ids = ids.filter(id => {
      const log = state.logs[id];
      return log && log.lastCorrect === false;
    });
  } else if (state.filter === 'unseen') {
    ids = ids.filter(id => !state.logs[id]);
  }

  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  state.queue = ids;
  state.index = 0;
}

function currentSentence() {
  const id = state.queue[state.index];
  return state.sentences.find(s => String(s.id) === id);
}

const FILTER_LABELS = { all: '전체 문장', wrong: '오답 문장', unseen: '안 푼 문장' };

function startStudy(deckValue) {
  state.studyDeck = deckValue;
  state.filter = 'all';
  document.querySelectorAll('#filter-chips .chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === 'all');
  });
  buildQueue();
  if (!state.queue.length) {
    showToast('학습할 문장이 없어요');
    return;
  }
  document.getElementById('study-overlay').classList.add('show');
  render();
}

function closeStudyOverlay() {
  document.getElementById('study-overlay').classList.remove('show');
  renderVocabTab();
}

document.getElementById('study-close-btn').addEventListener('click', closeStudyOverlay);

function render() {
  const total = state.queue.length;
  const cardArea = document.getElementById('card-area');
  const promptCard = document.getElementById('prompt-card');
  const answerCard = document.querySelector('.answer-card');
  const actionRow = document.querySelector('#study-overlay .action-row');

  document.getElementById('filter-summary').textContent =
    `${state.studyDeck === 'all' ? '전체' : state.studyDeck} · ${FILTER_LABELS[state.filter]}`;

  if (!total) {
    promptCard.style.display = 'none';
    answerCard.style.display = 'none';
    actionRow.style.display = 'none';
    document.getElementById('result-card').classList.remove('show');

    if (!cardArea.querySelector('.empty-state')) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="icon">🎉</div>
        <h3>해당하는 문장이 없어요</h3>
        <p>다른 필터를 선택해보세요.</p>
      `;
      cardArea.appendChild(empty);
    }
    document.getElementById('progress-fill').style.width = '0%';
    return;
  }

  const existingEmpty = cardArea.querySelector('.empty-state');
  if (existingEmpty) existingEmpty.remove();

  promptCard.style.display = 'block';
  answerCard.style.display = 'block';
  actionRow.style.display = 'flex';

  const sentence = currentSentence();
  document.getElementById('prompt-counter').textContent = `${state.index + 1} / ${total}`;
  document.getElementById('prompt-text').textContent = sentence.korean || '';

  const hintToggle = document.getElementById('hint-toggle');
  const hintText = document.getElementById('hint-text');
  hintText.style.display = 'none';
  hintToggle.textContent = '힌트 보기';
  if (sentence.detail) {
    hintToggle.style.display = 'inline-block';
    hintText.textContent = sentence.detail;
  } else {
    hintToggle.style.display = 'none';
  }

  document.getElementById('progress-fill').style.width = `${Math.round((state.index / total) * 100)}%`;

  const dayPill = document.getElementById('day-pill');
  const totalAttempts = Object.keys(state.logs).length;
  dayPill.textContent = `DAY ${Math.max(1, Math.ceil((totalAttempts + 1) / Math.max(state.sentences.length, 1)))}`;

  document.getElementById('result-card').classList.remove('show');
  document.getElementById('answer-input').value = '';
  state.checked = false;
  document.getElementById('check-btn').textContent = '채점하기';
  document.getElementById('answer-input').focus({ preventScroll: true });
}

document.getElementById('hint-toggle').addEventListener('click', () => {
  const hintText = document.getElementById('hint-text');
  const hintToggle = document.getElementById('hint-toggle');
  const showing = hintText.style.display !== 'none';
  hintText.style.display = showing ? 'none' : 'block';
  hintToggle.textContent = showing ? '힌트 보기' : '힌트 닫기';
});

/* ---------- 채점 처리 ---------- */

function handleCheck() {
  const sentence = currentSentence();
  if (!sentence) return;

  if (!state.checked) {
    const userInput = document.getElementById('answer-input').value.trim();
    const correctAnswer = sentence.english || '';
    const sim = similarity(userInput, correctAnswer);
    const isCorrect = sim >= state.config.threshold;

    showResult(isCorrect, correctAnswer, sim, userInput);
    recordLog(sentence, userInput, isCorrect, sim);

    state.checked = true;
    document.getElementById('check-btn').textContent = '다음 문장';
  } else {
    nextCard();
  }
}

function showResult(isCorrect, correctAnswer, sim, userInput) {
  const card = document.getElementById('result-card');
  const status = document.getElementById('result-status');
  const answer = document.getElementById('result-answer');
  const fill = document.getElementById('similarity-fill');

  card.classList.remove('correct', 'incorrect');
  card.classList.add('show', isCorrect ? 'correct' : 'incorrect');

  status.textContent = isCorrect ? '정답이에요' : '다시 확인해보세요';
  answer.innerHTML = `모범 답안: <span class="ans-text">${escapeHtml(correctAnswer)}</span>`;

  const pct = Math.round(sim * 100);
  fill.style.width = `${pct}%`;
  fill.style.background = isCorrect ? 'var(--correct)' : 'var(--incorrect)';
}

function recordLog(sentence, userInput, isCorrect, sim) {
  const id = sentence.id;
  const deck = deckOf(sentence);

  state.logs[String(id)] = { lastCorrect: isCorrect, attempts: (state.logs[String(id)]?.attempts || 0) + 1 };
  saveLogs();

  state.history.push({ date: localDateStr(), deck, sentenceId: id, isCorrect });
  saveHistory();

  state.pendingLogs.push({
    timestamp: new Date().toISOString(),
    sentenceId: id,
    deck,
    userInput: userInput,
    isCorrect: isCorrect,
    similarity: Math.round(sim * 100) / 100
  });
  savePending();
  updateStats();
}

function nextCard() {
  state.index++;
  if (state.index >= state.queue.length) {
    buildQueue();
    if (!state.queue.length) {
      render();
      return;
    }
  }
  render();
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll('#filter-chips .chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  buildQueue();
  render();
}

document.getElementById('check-btn').addEventListener('click', handleCheck);
document.getElementById('skip-btn').addEventListener('click', nextCard);

document.getElementById('answer-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleCheck();
  }
});

document.querySelectorAll('#filter-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => setFilter(chip.dataset.filter));
});
