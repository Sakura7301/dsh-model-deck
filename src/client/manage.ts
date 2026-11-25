/**
 * "Manage models" bridge: open Settings on its Models section.
 *
 * DSH's settings shell hands `openSettings` only to its own slot children, so
 * a plugin cannot call it directly. This walks the two entrances a person
 * uses — the account menu's Settings item, then the Models nav row — with
 * guarded lookups so a layout change leaves the page untouched instead of
 * throwing. Replace this helper the day the client exposes a settings verb.
 */

/** Localized "Settings" labels across the shipped dictionaries. */
const SETTINGS_LABELS = new Set([
  'Settings', '设置', '設定', 'Configuración', 'Paramètres', 'Einstellungen', 'Настройки', 'Configurações',
])

/** Localized Models-section labels across the shipped dictionaries. */
const MODELS_LABELS = new Set([
  '模型', 'Models', 'モデル', 'Modelos', 'Modèles', 'Modelle', 'Модели',
])

/** Localized account-menu trigger labels. */
const ACCOUNT_MENU_LABEL = /account menu|账户菜单|アカウントメニュー|menú de cuenta|menu du compte|kontomenü|меню аккаунта|menu da conta/i

const SETTINGS_DIALOG = '[role="dialog"][data-shortcut-modal="settings"]'

/** Click the Models row inside an already-open Settings dialog. */
function selectModelsSection(): void {
  const dialog = document.querySelector<HTMLElement>(SETTINGS_DIALOG)
  if (dialog === null) return
  const row = Array.from(dialog.querySelectorAll<HTMLButtonElement>('nav button'))
    .find(button => MODELS_LABELS.has((button.textContent ?? '').trim()))
  row?.click()
}

/** Wait for the Settings dialog, then land on the Models section. */
function whenSettingsOpen(retries = 8): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(SETTINGS_DIALOG) !== null) {
    selectModelsSection()
    return
  }
  if (retries <= 0) return
  window.setTimeout(() => { whenSettingsOpen(retries - 1) }, 90)
}

/** The sidebar account-menu trigger (the menu that carries the Settings item). */
function accountMenuTrigger(): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"][aria-label]'))
    .find(button => ACCOUNT_MENU_LABEL.test(button.getAttribute('aria-label') ?? ''))
}

/** Open Settings → Models, best effort. */
export function openModelSettings(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(SETTINGS_DIALOG) !== null) {
    selectModelsSection()
    return
  }
  const trigger = accountMenuTrigger()
  if (trigger === undefined) return
  trigger.click()
  window.setTimeout(() => {
    const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find(node => SETTINGS_LABELS.has((node.textContent ?? '').trim()))
    if (item === undefined) {
      // Close the account menu we opened so a failed lookup is not sticky.
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      return
    }
    item.click()
    whenSettingsOpen()
  }, 80)
}
