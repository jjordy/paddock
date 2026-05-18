import { mount } from '@jjordy/rogue/router'

const target = document.getElementById('app')
if (!target) throw new Error('mount target #app not found')

// Shared-element view-transition setup. Before rogue's click handler
// fires navigation (and rogue's runtime wraps the DOM swap in
// document.startViewTransition), we tag the clicked link with a
// view-transition-name derived from its href. Each detail page's
// hero panel carries the matching name, so the browser interpolates
// position + size between the clicked row and the hero — the row
// literally morphs into the title.
//
// Capture-phase listener so we set the name before any handler later
// in the bubble path can navigate away. The setTimeout reset clears
// the name after the transition would have finished; without it,
// subsequent navigations would see stale duplicates.
function hrefToVtName(href: string): string {
  // /drivers/verstappen → morph-drivers-verstappen
  // /races/2024/1     → morph-races-2024-1
  return 'morph' + href.replace(/[^A-Za-z0-9]+/g, '-')
}
const DETAIL_HREF = /^\/(drivers|teams|seasons|races)\/[^/]/
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement | null
  if (!t) return
  const link = t.closest('a[href]') as HTMLAnchorElement | null
  if (!link) return
  const href = link.getAttribute('href') ?? ''
  if (!DETAIL_HREF.test(href)) return
  const name = hrefToVtName(href)
  link.style.viewTransitionName = name
  // Strip 32 ms after the transition's longest animation completes;
  // the row's name otherwise lingers and the NEXT navigation collides.
  setTimeout(() => { link.style.viewTransitionName = '' }, 600)
}, true)

const ssr = window.__JSX_WC_DATA__
mount(target, ssr ? {
  initialData: ssr.data,
  initialParams: ssr.params,
} : {})
