export function spawnHeartParticles(originEl) {
  if (!originEl) return;
  const rect = originEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const count = 7;
  for (let i = 0; i < count; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart-particle';
    heart.textContent = '\u2764';
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 20 + Math.random() * 25;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 15;
    const scale = 0.6 + Math.random() * 0.5;
    heart.style.left = cx + 'px';
    heart.style.top = cy + 'px';
    heart.style.setProperty('--dx', dx + 'px');
    heart.style.setProperty('--dy', dy + 'px');
    heart.style.setProperty('--s', scale);
    document.body.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}
