/* Web Speech API adapter. */
function speakText(text){if(!("speechSynthesis"in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text).replace(/<[^>]*>/g,""));u.lang="id-ID";u.rate=.95;window.speechSynthesis.speak(u);}
window.speakText=speakText;
