// Player tracking debug dashboard

function getCurrentSkill(){
  if(!currentQuestion) return null;
  return currentQuestion.skill || ({"+":"addition","−":"subtraction","×":"multiplication","÷":"division"}[currentQuestion.op] || currentQuestion.op);
}
function updateDebugPanel(){
  if(typeof DEBUG_MODE === "undefined" || !DEBUG_MODE) return;
  const p=getPlayerLearningProfile();
  const el=id=>document.getElementById(id);
  const info=playerEventTracker.getPlayerInfo();
  el("debugPlayerName").textContent=info.name||"-";
  el("debugPlayerAge").textContent=info.age||"-";
  el("debugPlayerId").textContent=playerEventTracker.playerId;
  el("debugSessionId").textContent=playerEventTracker.sessionId;
  el("debugLevel").textContent=levelKey;
  el("debugDifficulty").textContent=levelKey;
  el("debugQuestions").textContent=p.totalQuestions;
  el("debugCorrect").textContent=p.correctAnswers;
  el("debugIncorrect").textContent=p.incorrectAnswers;
  el("debugAccuracy").textContent=(p.accuracy*100).toFixed(1)+"%";
  el("debugAvgTime").textContent=Math.round(p.averageResponseTime)+" ms";
  el("debugHints").textContent=p.hintsUsed;
  el("debugSkill").textContent="Current Skill: "+(getCurrentSkill() || "-");
  el("debugAI").textContent="AI Decision: "+(lastAIDecision ? `${lastAIDecision.action} • ${lastAIDecision.skill} • ${lastAIDecision.difficulty}${lastAIDecision.useHint?" • hint":""}` : "-");
}
