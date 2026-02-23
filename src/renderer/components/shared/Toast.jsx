import { signal } from '@preact/signals';

const toastMessage = signal('');
const toastVisible = signal(false);
const toastShow = signal(false);

let toastTimeout = null;

export function showToast(message) {
  toastMessage.value = message;
  toastVisible.value = true;
  clearTimeout(toastTimeout);
  // Use requestAnimationFrame to ensure the 'hidden' removal has painted before adding 'show'
  requestAnimationFrame(() => {
    toastShow.value = true;
  });
  toastTimeout = setTimeout(() => {
    toastShow.value = false;
    setTimeout(() => {
      toastVisible.value = false;
    }, 300);
  }, 2500);
}

export function Toast() {
  const hidden = !toastVisible.value;
  const show = toastShow.value;

  return (
    <div
      id="toast"
      className={`toast${hidden ? ' hidden' : ''}${show ? ' show' : ''}`}
    >
      {toastMessage.value}
    </div>
  );
}
