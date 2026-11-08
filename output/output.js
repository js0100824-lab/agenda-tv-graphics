import * as store from '../modules/store.js?v=13d';
import { createStage } from '../modules/stage.js?v=13d';
const stage = createStage(document.getElementById('root'));
store.subscribe(s => stage.apply(s.program));   // la salida SOLO lee /program
store.init();
