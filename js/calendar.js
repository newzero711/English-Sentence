/* ================= 달력 탭 =================
   달력 탭만 다룹니다. 이 파일과 css/calendar.css만 보면
   달력 구조를 전부 파악할 수 있고, 다른 탭 작업이 여기에 영향을 주지 않습니다. */

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-month-label');
  const y = state.calYear, m = state.calMonth;
  label.textContent = `${y}년 ${m + 1}월`;

  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = localDateStr();
  const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}`;

  const studiedDates = new Set(
    state.history.filter(h => h.date.startsWith(monthPrefix)).map(h => h.date)
  );
  const addedDates = new Set(
    state.sentences.filter(s => s.date && s.date.startsWith(monthPrefix)).map(s => s.date)
  );

  grid.innerHTML = '';
  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (dateStr === todayStr) cell.classList.add('today');
    if (dateStr === state.calSelectedDate) cell.classList.add('selected');
    const dots = (studiedDates.has(dateStr) ? '<span class="dot dot-study"></span>' : '')
      + (addedDates.has(dateStr) ? '<span class="dot dot-add"></span>' : '');
    cell.innerHTML = `<span>${d}</span>` + (dots ? `<span class="dot-row">${dots}</span>` : '');
    cell.addEventListener('click', () => {
      state.calSelectedDate = dateStr;
      renderCalendar();
      renderCalDetail(dateStr);
    });
    grid.appendChild(cell);
  }

  const detailEl = document.getElementById('cal-detail');
  if (state.calSelectedDate && state.calSelectedDate.startsWith(monthPrefix)) {
    renderCalDetail(state.calSelectedDate);
  } else {
    detailEl.innerHTML = '';
  }
}

function renderCalDetail(dateStr) {
  const detailEl = document.getElementById('cal-detail');
  const entries = state.history.filter(h => h.date === dateStr);
  const added = state.sentences.filter(s => s.date === dateStr);
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateLabel = `${y}년 ${m}월 ${d}일`;

  if (!entries.length && !added.length) {
    detailEl.innerHTML = `<div class="cal-detail-title">${dateLabel}</div><p class="cal-empty-note">이 날은 기록이 없어요.</p>`;
    return;
  }

  let html = `<div class="cal-detail-title">${dateLabel}</div>`;

  if (added.length) {
    const byAddDeck = {};
    added.forEach(s => { byAddDeck[deckOf(s)] = (byAddDeck[deckOf(s)] || 0) + 1; });
    const addRows = Object.keys(byAddDeck).sort((a, b) => a.localeCompare(b, 'ko')).map(deck =>
      `<div class="cal-deck-row cal-add-row" data-date="${escapeHtml(dateStr)}" data-deck="${escapeHtml(deck)}"><span class="deck-name">${escapeHtml(deck)}</span><span class="deck-stat">${byAddDeck[deck]}문장 추가</span></div>`
    ).join('');
    html += `<div class="cal-section-label">추가 기록</div>${addRows}`;
  }

  if (entries.length) {
    const byDeck = {};
    entries.forEach(e => {
      if (!byDeck[e.deck]) byDeck[e.deck] = { total: 0, correct: 0 };
      byDeck[e.deck].total++;
      if (e.isCorrect) byDeck[e.deck].correct++;
    });

    const rows = Object.keys(byDeck).sort((a, b) => a.localeCompare(b, 'ko')).map(deck => {
      const { total, correct } = byDeck[deck];
      const pct = Math.round((correct / total) * 100);
      return `<div class="cal-deck-row"><span class="deck-name">${escapeHtml(deck)}</span><span class="deck-stat">${total}문장 · 정답률 ${pct}%</span></div>`;
    }).join('');
    html += `<div class="cal-section-label">학습 기록</div>${rows}`;
  }

  detailEl.innerHTML = html;
  detailEl.querySelectorAll('.cal-add-row').forEach(row => {
    row.addEventListener('click', () => openCalAddModal(row.dataset.date, row.dataset.deck));
  });
}

function openCalAddModal(dateStr, deck) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const sentences = state.sentences.filter(s => s.date === dateStr && deckOf(s) === deck);

  document.getElementById('cal-add-title').textContent = `${y}년 ${m}월 ${d}일 · ${deck}`;
  document.getElementById('cal-add-list').innerHTML = sentences.map(s => `
    <div class="vocab-item">
      <div class="vocab-english">${escapeHtml(s.english)}</div>
      <div class="vocab-korean">${escapeHtml(s.korean)}</div>
    </div>
  `).join('');
  document.getElementById('cal-add-overlay').classList.add('show');
}

document.getElementById('cal-add-close-btn').addEventListener('click', () => {
  document.getElementById('cal-add-overlay').classList.remove('show');
});
document.getElementById('cal-add-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'cal-add-overlay') document.getElementById('cal-add-overlay').classList.remove('show');
});

document.getElementById('cal-prev').addEventListener('click', () => {
  state.calMonth--;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  state.calSelectedDate = null;
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  state.calMonth++;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  state.calSelectedDate = null;
  renderCalendar();
});
