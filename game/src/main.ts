import { mount } from 'svelte';
import App from './App.svelte';
import './styles/variables.css';
import './styles/base.css';
import './styles/map.css';
import './styles/tree.css';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
