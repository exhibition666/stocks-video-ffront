import type { App } from 'vue'
import { Icon } from './Icon'
import IcpFooter from './IcpFooter/index.vue'

export const setupGlobCom = (app: App<Element>): void => {
  app.component('Icon', Icon)
  app.component('IcpFooter', IcpFooter)
}
