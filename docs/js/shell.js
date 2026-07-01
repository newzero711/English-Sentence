/* ================= 탭 전환 (앱 셸) =================
   하단 네비게이션 버튼 클릭 시 활성 탭을 바꾸고, 해당 탭의 렌더 함수를 호출합니다.
   탭별 렌더 로직은 각 탭 파일(vocab.js/add.js/calendar.js/settings.js)에 있습니다. */

function setActiveTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-view').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  if (tab === 'vocab') renderVocabTab();
  if (tab === 'add') renderAddDeckChips();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'settings') {
    document.getElementById('sheet-url').value = state.config.sheetUrl;
    document.getElementById('threshold-slider').value = state.config.threshold;
    document.getElementById('threshold-value').textContent = `${Math.round(state.config.threshold * 100)}%`;
    updateStats();
  }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});
