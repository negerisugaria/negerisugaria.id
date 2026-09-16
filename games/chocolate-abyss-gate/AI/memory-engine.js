/* Small persistent learning-memory layer. */
const MEMORY_STORAGE="chocolateAbyssLearningMemory";
function getLearningMemory(){try{return JSON.parse(localStorage.getItem(MEMORY_STORAGE))||{skills:{},recent:[]};}catch{return {skills:{},recent:[]};}}
function recordLearningMemory(skill,correct){const m=getLearningMemory();m.skills[skill]??={correct:0,incorrect:0};m.skills[skill][correct?"correct":"incorrect"]++;m.recent.push({skill,correct,at:Date.now()});m.recent=m.recent.slice(-50);localStorage.setItem(MEMORY_STORAGE,JSON.stringify(m));}
window.getLearningMemory=getLearningMemory;window.recordLearningMemory=recordLearningMemory;
