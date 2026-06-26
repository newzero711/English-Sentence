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

  const activeDates = new Set(
    state.history.filter(h => h.date.startsWith(monthPrefix)).map(h => h.date)
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
    cell.innerHTML = `<span>${d}</span>` + (activeDates.has(dateStr) ? '<span class="dot"></span>' : '');
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
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateLabel = `${y}년 ${m}월 ${d}일`;

  if (!entries.length) {
    detailEl.innerHTML = `<div class="cal-detail-title">${dateLabel}</div><p class="cal-empty-note">이 날은 학습 기록이 없어요.</p>`;
    return;
  }

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

  detailEl.innerHTML = `<div class="cal-detail-title">${dateLabel}</div>${rows}`;
}

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
