import { mount } from '@jjordy/rogue/router'

const target = document.getElementById('app')
if (!target) throw new Error('mount target #app not found')

const ssr = window.__JSX_WC_DATA__
mount(target, ssr ? {
  initialData: ssr.data,
  initialParams: ssr.params,
} : {})
