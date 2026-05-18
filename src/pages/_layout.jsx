import { useRoute } from '@jjordy/rogue/router'
import './_layout.css'

const NAV = [
  { group: 'Overview', items: [
    { href: '/',         label: 'home' },
    { href: '/about',    label: 'about' },
  ]},
  { group: 'Archive', items: [
    { href: '/seasons',  label: 'seasons' },
    { href: '/drivers',  label: 'drivers' },
    { href: '/teams',    label: 'constructors' },
    { href: '/records',  label: 'records' },
  ]},
  { group: 'Tools', items: [
    { href: '/compare',  label: 'compare' },
  ]},
]

export default function RootLayout({ children }) {
  const { url } = useRoute()
  const isActive = (h) => url() === h
  return (
    <div class="shell">
      <header>
        <a class="brand" href="/">
          <span class="mark"></span>
          <span>paddock</span>
        </a>
        <span class="tagline">F1 archive · 1950–present</span>
      </header>
      <aside>
        {NAV.map((g) => (
          <div class="group">
            <div class="group-title">{g.group}</div>
            <ul>
              {g.items.map((i) => (
                <li>
                  <a href={i.href} class={isActive(i.href) ? 'active' : ''}>{i.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>
      <main>{children}</main>
    </div>
  )
}
