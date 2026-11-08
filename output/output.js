import * as store from '../modules/store.js?v=13c';
import { createStage } from '../modules/stage.js?v=13c';
const stage = createStage(document.getElementById('root'));
store.subscribe(s => stage.apply(s.program));   // la salida SOLO lee /program
store.init();
