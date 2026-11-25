/**
 * Static class map + one-time CSS injection for the model card.
 *
 * The client bundle has no CSS-module step of its own, so `styles.css` is
 * bundled as a text asset and installed once under a stable tag. Every class
 * name is part of that stylesheet verbatim (`msm_*`), which keeps the menu's
 * DOM readable in DevTools and avoids colliding with other plugins.
 */
import cssText from './styles.css'

const tagId = 'dsh-model-deck/ModelSelect.css'

if (typeof document !== 'undefined') {
  const selector = `style[data-plugin-css=${JSON.stringify(tagId)}]`
  const existing = document.querySelector<HTMLStyleElement>(selector)
  if (existing !== null) {
    // A client-plugin hot update re-evaluates this module in the same page;
    // refresh the sheet instead of leaving the previous revision in place.
    existing.textContent = cssText
  } else {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-model-deck'
    tag.dataset.pluginCss = tagId
    tag.textContent = cssText
    document.head.appendChild(tag)
  }
}

/** Every class the component composes. */
export const css = {
  root: 'msm_root',
  trigger: 'msm_trigger',
  triggerLabel: 'msm_triggerLabel',
  triggerEffort: 'msm_triggerEffort',
  triggerIcon: 'msm_triggerIcon',
  chevron: 'msm_chevron',
  chevronOpen: 'msm_chevronOpen',
  menu: 'msm_menu',
  menuSingle: 'msm_menuSingle',
  header: 'msm_header',
  headerOpen: 'msm_headerOpen',
  headerLabel: 'msm_headerLabel',
  headerCount: 'msm_headerCount',
  headerChevron: 'msm_headerChevron',
  status: 'msm_status',
  empty: 'msm_empty',
  error: 'msm_error',
  warning: 'msm_warning',
  retry: 'msm_retry',
  searchRow: 'msm_searchRow',
  search: 'msm_search',
  searchWithQuery: 'msm_searchWithQuery',
  searchClear: 'msm_searchClear',
  list: 'msm_list',
  option: 'msm_option',
  optionActive: 'msm_optionActive',
  modelOption: 'msm_modelOption',
  selected: 'msm_selected',
  optionCopy: 'msm_optionCopy',
  modelName: 'msm_modelName',
  caps: 'msm_caps',
  cap: 'msm_cap',
  badgedName: 'msm_badgedName',
  badgedNameText: 'msm_badgedNameText',
  badge: 'msm_badge',
  check: 'msm_check',
  effortPanel: 'msm_effortPanel',
  effortHead: 'msm_effortHead',
  effortLabel: 'msm_effortLabel',
  effortValue: 'msm_effortValue',
  effortSlider: 'msm_effortSlider',
  effortNote: 'msm_effortNote',
  sliderWrap: 'msm_sliderWrap',
  sliderTrack: 'msm_sliderTrack',
  sliderBase: 'msm_sliderBase',
  sliderRest: 'msm_sliderRest',
  sliderTicks: 'msm_sliderTicks',
  sliderTicksOn: 'msm_sliderTicksOn',
  sliderTicksOff: 'msm_sliderTicksOff',
  flyout: 'msm_flyout',
  flyoutScroll: 'msm_flyoutScroll',
  flyoutFooter: 'msm_flyoutFooter',
  cell: 'msm_cell',
  cellLabel: 'msm_cellLabel',
  cellValue: 'msm_cellValue',
  manageIcon: 'msm_manageIcon',
} as const
