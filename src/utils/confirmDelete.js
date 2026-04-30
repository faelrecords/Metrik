const KEY = 'metrik_skip_delete_confirm_until';

export function canSkipDeleteConfirm() {
  return Number(localStorage.getItem(KEY) || 0) > Date.now();
}

export function skipDeleteConfirm(minutes) {
  const n = Number(minutes) || 0;
  if (n > 0) localStorage.setItem(KEY, String(Date.now() + n * 60000));
}

export function clearDeleteConfirmSkip() {
  localStorage.removeItem(KEY);
}
