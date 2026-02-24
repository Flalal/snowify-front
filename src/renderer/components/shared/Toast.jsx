import { toastMessage, toastVisible, toastShow } from '../../state/ui.js';

export { showToast } from '../../state/ui.js';

export function Toast() {
  const hidden = !toastVisible.value;
  const show = toastShow.value;

  return (
    <div
      id="toast"
      className={`toast${hidden ? ' hidden' : ''}${show ? ' show' : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {toastMessage.value}
    </div>
  );
}
