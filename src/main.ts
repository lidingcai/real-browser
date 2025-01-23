import { createApp } from 'vue'

import App from './App.vue'
// import App from './App.vue'
import { i18n } from './locales'
import { router } from './router'

const app = createApp(App)
app.use(i18n)
async function setupApp() {
  try {
    app.use(router)
    await router.isReady()
    app.mount('#app').$nextTick(() => {
      postMessage({ payload: 'removeLoading' }, '*')
    })
  } catch (error) {
    console.log(error)
  }
}
setupApp()
/*
app.use(router)
app.mount('#app').$nextTick(() => {
  postMessage({ payload: 'removeLoading' }, '*')
})
*/
