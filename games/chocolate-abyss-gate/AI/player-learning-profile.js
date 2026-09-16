(function(){
  function calculate(events, player={}){
    const answers=events.filter(e=>e.type==="ANSWER_SUBMITTED");
    const correct=answers.filter(e=>e.isCorrect);
    const times=answers.map(e=>Number(e.responseTime)).filter(Number.isFinite);
    const profile={
      playerId:player.playerId||null,
      name:player.name||"",
      age:player.age||null,
      accuracy:answers.length?correct.length/answers.length:0,
      averageResponseTime:times.length?times.reduce((a,b)=>a+b,0)/times.length:0,
      totalQuestions:new Set(answers.map(e=>e.questionId)).size,
      correctAnswers:correct.length,
      incorrectAnswers:answers.filter(e=>!e.isCorrect).length,
      hintsUsed:events.filter(e=>e.type==="HINT_USED").length,
      attempts:answers.length,
      skills:{},
      recentPerformance:answers.slice(-8).map(e=>({skill:e.skill,isCorrect:!!e.isCorrect,responseTime:Number(e.responseTime)||0,attemptNumber:e.attemptNumber||1})),
      currentSkill:null,
      currentDifficulty:null
    };
    const skills=[...new Set(answers.map(e=>e.skill).filter(Boolean))];
    skills.forEach(skill=>{
      const a=answers.filter(e=>e.skill===skill);
      profile.skills[skill]={accuracy:a.length?a.filter(e=>e.isCorrect).length/a.length:0,attempts:a.length,correctAnswers:a.filter(e=>e.isCorrect).length,incorrectAnswers:a.filter(e=>!e.isCorrect).length};
    });
    ["addition","subtraction","multiplication","division"].forEach(skill=>{if(profile.skills[skill]) profile[skill+"Accuracy"]=profile.skills[skill].accuracy;});
    return profile;
  }
  window.PlayerLearningProfile={calculate};
  window.getPlayerLearningProfile=function(){
    const tracker=window.playerEventTracker;
    const player=tracker?.getPlayerInfo ? tracker.getPlayerInfo() : {};
    const p=calculate(tracker?tracker.getEvents():[],player);
    p.currentSkill=window.getCurrentSkill?window.getCurrentSkill():null;
    p.currentDifficulty=window.getCurrentGameLevel?window.getCurrentGameLevel():null;
    return p;
  };
})();
