export function toast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('fb:toast', { detail: { message, type } }));
}
