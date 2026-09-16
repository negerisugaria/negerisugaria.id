(function(){
  // Adaptive decision engine placeholder. No external API calls or credentials.
  // Designed to be replaced by a backend AI Agent later.
  window.requestAIDecision = function(playerProfile){

    const skill =
        playerProfile.currentSkill ||
        Object.keys(
            playerProfile.skills || {}
        )[0] ||
        "addition";

    const skillData =
        (playerProfile.skills || {})[
            skill
        ] || {};

    const recent =
        (
            playerProfile.recentPerformance ||
            []
        )
        .filter(
            x => x.skill === skill
        )
        .slice(-3);

    const recentMistakes =
        recent.filter(
            x => !x.isCorrect
        ).length;

    const accuracy =
        Number.isFinite(
            skillData.accuracy
        )
        ? skillData.accuracy
        : playerProfile.accuracy;

    const slow =
        Number(
            playerProfile.averageResponseTime || 0
        ) > 7000;

    const totalAttempts =
        Number(
            playerProfile.attempts || 0
        );

    if(totalAttempts === 0){

        return {

            action:"BASELINE",

            emotion:"welcome",

            speech:
              "Halo teman manis! Aku Chocolate Cupcake. Yuk belajar dan bermain bersama! 🍫",

            animation:"wave",

            difficulty:
              playerProfile.currentDifficulty ||
              "easy",

            skill,

            useHint:false

        };

    }

    if(
        recentMistakes >= 2 ||
        accuracy < 0.5
    ){

        return {

            action:"REMEDIATE",

            emotion:"teaching",

            speech:
              "Tidak apa-apa. Ayo kita pelajari pelan-pelan bersama. 🍫",

            animation:"explain",

            difficulty:"easy",

            skill,

            useHint:true

        };

    }

    if(
        recentMistakes >= 1 ||
        accuracy < 0.7 ||
        slow
    ){

        return {

            action:"SUPPORT",

            emotion:"encouraging",

            speech:
              "Bagus! Kamu sudah berusaha dengan baik. Sedikit lagi pasti bisa. 🌟",

            animation:"bounce",

            difficulty:"easy",

            skill,

            useHint:true

        };

    }

    return {

        action:"PRACTICE",

        emotion:"celebrating",

        speech:
          "Hebat! Kamu semakin pintar. Yuk lanjutkan petualanganmu! 🎉",

        animation:"jump",

        difficulty:
            playerProfile.currentDifficulty ||
            "medium",

        skill,

        useHint:false

    };

};
})();
window.getCupcakeMessage = function(decision){

    if(!decision)
        return "";

    return (
        decision.speech ||
        ""
    );

};
``
