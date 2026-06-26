/* ================= 초기화 =================
   모든 탭 모듈이 로드된 뒤 가장 마지막에 실행됩니다. */

loadState();
purgeExpiredTrash();
updateTrashBadge();
renderVocabTab();
updateStats();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
