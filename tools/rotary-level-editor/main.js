import { createEditorApplication } from './app-controller.js';

createEditorApplication({
  loadTemplate: async () => {
    const response = await fetch('./templates/level18.rotary.v1.json');
    if (!response.ok) throw new Error(`Template load failed: ${response.status}`);
    return response.json();
  }
}).catch((error) => {
  document.body.dataset.bootError = 'true';
  console.error(error);
});
