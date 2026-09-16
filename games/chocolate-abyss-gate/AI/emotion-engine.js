/* Chocolate Cupcake emotion/asset engine */
const CUPCAKE_EXPRESSIONS = Object.freeze({
  welcome: "sources/welcome.png",
  thinking: "sources/thinking.png",
  oops: "sources/oops.png",
  encouraging: "sources/encouraging.png",
  teaching: "sources/teaching.png",
  celebrating: "sources/celebrating.png",
  victory: "sources/victory.png"
});

function setCupcakeEmotion(emotion, message) {
  const avatar = document.getElementById("cupcakeAvatar");
  const src = CUPCAKE_EXPRESSIONS[emotion] || CUPCAKE_EXPRESSIONS.welcome;
  if (avatar) {
    avatar.src = src;
    avatar.dataset.emotion = emotion || "welcome";
  }
  const chat = document.getElementById("agentMessage");
  if (chat && message != null) chat.textContent = message;
}

function applyAIDecisionEmotion(decision) {
  if (!decision) return;
  setCupcakeEmotion(decision.emotion, decision.speech);
}

window.CUPCAKE_EXPRESSIONS = CUPCAKE_EXPRESSIONS;
window.setCupcakeEmotion = setCupcakeEmotion;
window.applyAIDecisionEmotion = applyAIDecisionEmotion;
