// Presentation only: no camera or processor state lives here.
export function initializeWorkspaceUI() {
  const settings = document.querySelector('#settings-btn');
  const anchor = document.querySelector('#settings-anchor');
  const panel = document.querySelector('#sketch-adjustments');
  const dialog = document.querySelector('#about-dialog');
  const about = document.querySelector('#about-btn');
  let returnFocus = null;

  function closeSettings(restoreFocus = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
    if (restoreFocus) settings.focus();
  }
  settings.addEventListener('click', () => {
    if (!panel.hidden) return closeSettings(true);
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    panel.querySelector('input').focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!anchor.contains(event.target)) closeSettings();
  });
  document.addEventListener('focusin', (event) => {
    if (!anchor.contains(event.target)) closeSettings();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      closeSettings(true);
    }
  });

  about.addEventListener('click', () => {
    closeSettings();
    returnFocus = document.activeElement;
    dialog.showModal();
    document.documentElement.classList.add('modal-open');
  });
  document.querySelector('#about-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('modal-open');
    returnFocus?.focus();
  });
  for (const button of dialog.querySelectorAll('.accordion-button')) {
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      document.getElementById(button.getAttribute('aria-controls')).hidden = expanded;
      button.querySelector('.accordion-indicator').textContent = expanded ? '+' : '−';
    });
  }

  return {
    setGraphiteSelected(selected) {
      if (!selected) closeSettings();
      anchor.hidden = !selected;
    },
  };
}
