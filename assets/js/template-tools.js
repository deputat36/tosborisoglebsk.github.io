document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-print-template]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });

  document.querySelectorAll('[data-copy-template]').forEach((button) => {
    button.addEventListener('click', async () => {
      const selector = button.getAttribute('data-copy-template');
      const source = selector ? document.querySelector(selector) : document.querySelector('.template-paper');
      const status = document.querySelector('.template-copy-status');
      if (!source) return;
      try {
        await navigator.clipboard.writeText(source.innerText.trim());
        if (status) status.textContent = 'Текст скопирован';
      } catch (error) {
        if (status) status.textContent = 'Не удалось скопировать. Выделите текст вручную.';
      }
    });
  });
});
