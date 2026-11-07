import * as store from '../modules/store.js';
import { createStage } from '../modules/stage.js';
const stage = createStage(document.getElementById('root'));
store.subscribe(s => stage.apply(s.program));   // la salida SOLO lee /program
store.init();
