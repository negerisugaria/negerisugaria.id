(function(){
  // Adaptive decision engine placeholder. No external API calls or credentials.
  // Designed to be replaced by a backend AI Agent later.
  window.requestAIDecision=function(playerProfile){
    const skill = playerProfile.currentSkill || Object.keys(playerProfile.skills || {})[0] || "addition";
    const skillData = (playerProfile.skills || {})[skill] || {};
    const recent = (playerProfile.recentPerformance || []).filter(e=>e.skill===skill).slice(-3);
    const recentMistakes = recent.filter(e=>!e.isCorrect).length;
    const accuracy = Number.isFinite(skillData.accuracy) ? skillData.accuracy : playerProfile.accuracy;
    const slow = Number(playerProfile.averageResponseTime || 0) > 7000;
    const totalAttempts=Number(playerProfile.attempts||0);

    if(totalAttempts===0){
      return {action:"BASELINE",difficulty:playerProfile.currentDifficulty || "easy",skill,useHint:false,reason:"no_history"};
    }
    if(recentMistakes >= 2 || accuracy < 0.5){
      return {action:"REMEDIATE",difficulty:"easy",skill,useHint:true,reason:"repeated_mistakes"};
    }
    if(recentMistakes >= 1 || accuracy < 0.7 || slow){
      return {action:"SUPPORT",difficulty:"easy",skill,useHint:true,reason:"needs_support"};
    }
    return {action:"PRACTICE",difficulty:playerProfile.currentDifficulty || "medium",skill,useHint:false,reason:"continue_practice"};
  };
})();
