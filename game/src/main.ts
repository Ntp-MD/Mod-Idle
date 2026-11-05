import { mount } from 'svelte';
import AppShell from './AppShell.svelte';

const app = mount(AppShell, { target: document.getElementById('app')! });
window.dispatchEvent(new Event('modworld:ready'));

export default app;
