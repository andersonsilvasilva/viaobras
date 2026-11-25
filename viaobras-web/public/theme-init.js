// Aplica o tema salvo antes da primeira pintura. Mesmas regras de src/lib/theme.ts (conferidas em theme.test.ts).
;(function () {
  var theme = 'light'
  try {
    var stored = localStorage.getItem('viaobras:theme')
    if (stored === 'light' || stored === 'dark' || stored === 'auto') theme = stored
  } catch {
    // sem armazenamento: fica o padrão
  }
  var systemDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  var dark = theme === 'dark' || (theme === 'auto' && systemDark)
  document.documentElement.classList.toggle('dark', dark)
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0f1420' : '#f3f4f6')
})()
