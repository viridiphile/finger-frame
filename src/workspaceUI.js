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
    // Keep an anchored, scrollable panel inside the viewport after page scroll
    // or zoom; the available space can be above or below its button.
    const bounds = settings.getBoundingClientRect();
    const above = bounds.top - 24;
    const below = window.innerHeight - bounds.bottom - 24;
    const openAbove = above >= Math.min(panel.scrollHeight, 360) || above >= below;
    panel.style.maxHeight = `${Math.max(0, Math.min(360, openAbove ? above : below))}px`;
    panel.style.bottom = openAbove ? 'calc(100% + 12px)' : 'auto';
    panel.style.top = openAbove ? 'auto' : 'calc(100% + 12px)';
    settings.setAttribute('aria-expanded', 'true');
    panel.querySelector('input').focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!anchor.contains(event.target)) closeSettings();
  });
  document.addEventListener('focusin', (event) => {
    if (!anchor.contains(event.target)) closeSettings();
  });
  window.addEventListener('resize', () => closeSettings());
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
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, a[href]')].filter((element) => !element.disabled && element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
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
