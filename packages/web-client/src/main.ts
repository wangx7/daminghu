import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/hud.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 忽略本地非 HTTPS 或隐私模式下的 SW 注册失败
    });
  });
}
