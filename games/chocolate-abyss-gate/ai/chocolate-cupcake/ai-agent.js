(function(){

  const CUPCAKE_API =
    "https://api.negerisugaria.id/api/cupcake/respond";

  const CUPCAKE_API_TIMEOUT = 8000;

  /*
   * ============================================================
   * STATE IMAGES
   * ============================================================
   */

  const stateImages = {
    welcome: "sources/welcome.png",
    encouraging: "sources/encouraging.png",
    thinking: "sources/thinking.png",
    oops: "sources/oops.png",
    teaching: "sources/theaching.png",
    celebrating: "sources/celebrating.png",
    victory: "sources/victory.png"
  };


  /*
   * ============================================================
   * LOCAL ADAPTIVE DECISION
   * ============================================================
   */

  window.requestAIDecision = function(playerProfile){

    playerProfile = playerProfile || {};

    const skill =
      playerProfile.currentSkill ||
      Object.keys(playerProfile.skills || {})[0] ||
      "addition";

    const skillData =
      (playerProfile.skills || {})[skill] || {};

    const recent =
      (playerProfile.recentPerformance || [])
        .filter(e => e.skill === skill)
        .slice(-3);

    const recentMistakes =
      recent.filter(e => !e.isCorrect).length;

    const accuracy =
      Number.isFinite(skillData.accuracy)
        ? skillData.accuracy
        : Number(playerProfile.accuracy || 0);

    const slow =
      Number(playerProfile.averageResponseTime || 0) > 7000;

    const totalAttempts =
      Number(playerProfile.attempts || 0);

    let decision;

    if(totalAttempts === 0){

      decision = {
        action: "BASELINE",
        difficulty:
          playerProfile.currentDifficulty || "easy",
        skill,
        useHint: false,
        reason: "no_history"
      };

    }else if(recentMistakes >= 2 || accuracy < 0.5){

      decision = {
        action: "REMEDIATE",
        difficulty: "easy",
        skill,
        useHint: true,
        reason: "repeated_mistakes"
      };

    }else if(recentMistakes >= 1 || accuracy < 0.7 || slow){

      decision = {
        action: "SUPPORT",
        difficulty: "easy",
        skill,
        useHint: true,
        reason: "needs_support"
      };

    }else{

      decision = {
        action: "PRACTICE",
        difficulty:
          playerProfile.currentDifficulty || "medium",
        skill,
        useHint: false,
        reason: "continue_practice"
      };

    }

    return decision;
  };


  /*
   * ============================================================
   * API REQUEST
   * ============================================================
   */

  window.requestCupcakeResponse = async function(eventData){

    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        () => controller.abort(),
        CUPCAKE_API_TIMEOUT
      );

    try{

      const response =
        await fetch(CUPCAKE_API, {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body:
            JSON.stringify(eventData),

          signal:
            controller.signal

        });

      if(!response.ok){

        throw new Error(
          "Cupcake API HTTP " +
          response.status
        );

      }

      const data =
        await response.json();

      if(!data || !data.success){

        throw new Error(
          "Invalid Cupcake API response"
        );

      }

      return data;

    }catch(error){

      const message =
        error &&
        error.name === "AbortError"

          ? "Cupcake API timeout"

          : (
              error &&
              error.message
            ) ||
            "Unknown API error";

      console.warn(
        "[Chocolate Cupcake] API unavailable:",
        message
      );

      return {

        success: false,

        fallback: true,

        response: null,

        error: message

      };

    }finally{

      clearTimeout(timeoutId);

    }

  };


  /*
   * ============================================================
   * TTS
   * ============================================================
   */

  window.cupcakeTTS = {

    enabled: true,

    unlocked: false,

    speaking: false,

    lastText: "",

    lastSpokenAt: 0,

    voice: null

  };


  function findIndonesianVoice(){

    if(!("speechSynthesis" in window)){
      return null;
    }

    const voices =
      window.speechSynthesis.getVoices();

    if(!voices || !voices.length){
      return null;
    }

    const exact =
      voices.find(v =>
        String(v.lang || "")
          .toLowerCase() === "id-id"
      );

    if(exact){
      return exact;
    }

    const indonesia =
      voices.find(v =>
        String(v.lang || "")
          .toLowerCase()
          .startsWith("id-")
      );

    if(indonesia){
      return indonesia;
    }

    return null;
  }


  function refreshCupcakeVoice(){

    const voice =
      findIndonesianVoice();

    if(voice){

      window.cupcakeTTS.voice =
        voice;

      console.log(
        "[Chocolate Cupcake] TTS voice:",
        voice.name,
        voice.lang
      );

    }

    return voice;
  }


  window.unlockChocolateCupcakeTTS =
    function(){

      if(!("speechSynthesis" in window)){
        return false;
      }

      try{

        const utterance =
          new SpeechSynthesisUtterance("");

        utterance.lang =
          "id-ID";

        utterance.volume =
          0;

        window.speechSynthesis.speak(
          utterance
        );

        window.cupcakeTTS.unlocked =
          true;

        refreshCupcakeVoice();

        console.log(
          "[Chocolate Cupcake] TTS unlocked."
        );

        return true;

      }catch(error){

        console.warn(
          "[Chocolate Cupcake] TTS unlock error:",
          error
        );

        return false;
      }

    };


  function cleanCupcakeSpeech(text){

    return String(text || "")

      .replace(
        /[\u{1F300}-\u{1FAFF}]/gu,
        ""
      )

      .replace(
        /[*_#`]/g,
        ""
      )

      .replace(
        /\s+/g,
        " "
      )

      .trim();

  }


  window.speakChocolateCupcake =
    function(text){

      if(
        !window.cupcakeTTS.enabled ||
        !("speechSynthesis" in window)
      ){

        return;

      }

      const speech =
        cleanCupcakeSpeech(text);

      if(!speech){
        return;
      }

      const now =
        Date.now();

      /*
       * Jangan mengulang kalimat identik
       * dalam waktu sangat singkat.
       */

      if(
        speech ===
        window.cupcakeTTS.lastText &&

        now -
        window.cupcakeTTS.lastSpokenAt <
        3000
      ){

        return;

      }

      window.cupcakeTTS.lastText =
        speech;

      window.cupcakeTTS.lastSpokenAt =
        now;

      try{

        /*
         * Jangan cancel speech setiap kali.
         * Ini mencegah error "interrupted".
         */

        const synth =
          window.speechSynthesis;

        if(synth.speaking){
          synth.cancel();
        }

        const utterance =
          new SpeechSynthesisUtterance(
            speech
          );

        const voice =
          window.cupcakeTTS.voice ||
          refreshCupcakeVoice();

        utterance.lang =
          voice
            ? voice.lang
            : "id-ID";

        if(voice){
          utterance.voice =
            voice;
        }

        utterance.rate =
          0.90;

        utterance.pitch =
          1.08;

        utterance.volume =
          1;

        utterance.onstart =
          function(){

            window.cupcakeTTS.speaking =
              true;

          };

        utterance.onend =
          function(){

            window.cupcakeTTS.speaking =
              false;

          };

        utterance.onerror =
          function(event){

            window.cupcakeTTS.speaking =
              false;

            /*
             * "interrupted" biasanya terjadi
             * ketika browser menghentikan speech
             * untuk speech baru.
             */

            if(
              event &&
              event.error !==
              "interrupted"
            ){

              console.warn(
                "[Chocolate Cupcake] TTS error:",
                event.error
              );

            }

          };

        synth.speak(
          utterance
        );

        console.log(
          "[Chocolate Cupcake] 🔊 Speaking:",
          speech
        );

      }catch(error){

        console.warn(
          "[Chocolate Cupcake] TTS error:",
          error
        );

      }

    };


  if("speechSynthesis" in window){

    refreshCupcakeVoice();

    window.speechSynthesis
      .addEventListener(
        "voiceschanged",
        function(){

          refreshCupcakeVoice();

        }
      );

  }


  /*
   * ============================================================
   * VISUAL MATH ENGINE
   *
   * Visual dibuat langsung dari soal game.
   * Tidak menunggu OpenClaw.
   * ============================================================
   */


  function normalizeOperation(operation){

    const op =
      String(
        operation || "+"
      ).trim();

    if(
      op === "x" ||
      op === "X" ||
      op === "*"
    ){
      return "×";
    }

    if(
      op === "/" ||
      op === ":"
    ){
      return "÷";
    }

    if(
      op === "-"
    ){
      return "−";
    }

    return "+";
  }


  function safeNumber(value){

    const number =
      Number(value);

    return Number.isFinite(number)
      ? Math.max(
          0,
          Math.floor(number)
        )
      : null;

  }


  function createMathObject(
    emoji,
    className = "math-object"
  ){

    const object =
      document.createElement("span");

    object.className =
      className;

    object.textContent =
      emoji;

    return object;

  }


  function createObjectsRow(
    count,
    emoji
  ){

    const row =
      document.createElement("div");

    row.className =
      "cupcake-math-items";

    const maxVisible =
      Math.min(
        Math.max(
          0,
          Number(count || 0)
        ),
        30
      );

    for(
      let i = 0;
      i < maxVisible;
      i++
    ){

      row.appendChild(
        createMathObject(
          emoji
        )
      );

    }

    return row;

  }


  function createNumberLabel(
    number
  ){

    const label =
      document.createElement("div");

    label.className =
      "cupcake-math-number";

    label.textContent =
      String(number);

    return label;

  }


  function createOperator(
    operator
  ){

    const element =
      document.createElement("div");

    element.className =
      "cupcake-math-operator";

    element.textContent =
      operator;

    return element;

  }


  function buildAdditionVisual(
    a,
    b,
    teaching
  ){

    const visual =
      document.createElement("div");

    visual.className =
      "cupcake-math-visual";

    const title =
      document.createElement("div");

    title.className =
      "cupcake-math-title";

    title.textContent =
      teaching
        ? "Ayo kita hitung bersama!"
        : "Yuk hitung pelan-pelan!";

    visual.appendChild(title);

    const equation =
      document.createElement("div");

    equation.className =
      "cupcake-math-equation";

    const groupA =
      document.createElement("div");

    groupA.className =
      "cupcake-math-group";

    groupA.appendChild(
      createNumberLabel(a)
    );

    groupA.appendChild(
      createObjectsRow(
        a,
        "🍫"
      )
    );

    equation.appendChild(
      groupA
    );

    equation.appendChild(
      createOperator("+")
    );

    const groupB =
      document.createElement("div");

    groupB.className =
      "cupcake-math-group";

    groupB.appendChild(
      createNumberLabel(b)
    );

    groupB.appendChild(
      createObjectsRow(
        b,
        "🍫"
      )
    );

    equation.appendChild(
      groupB
    );

    visual.appendChild(
      equation
    );

    const instruction =
      document.createElement("div");

    instruction.className =
      "cupcake-math-instruction";

    if(teaching){

      instruction.textContent =
        "Hitung cokelat pertama, lalu tambahkan cokelat kedua.";

    }else{

      instruction.textContent =
        "Hitung semua cokelat. Ada berapa semuanya?";

    }

    visual.appendChild(
      instruction
    );

    return visual;

  }


  function buildSubtractionVisual(
    a,
    b,
    teaching
  ){

    const visual =
      document.createElement("div");

    visual.className =
      "cupcake-math-visual";

    const title =
      document.createElement("div");

    title.className =
      "cupcake-math-title";

    title.textContent =
      teaching
        ? "Mari kita kurangi bersama!"
        : "Coba hitung yang tersisa!";

    visual.appendChild(title);

    const original =
      document.createElement("div");

    original.className =
      "cupcake-math-group cupcake-math-subtraction";

    original.appendChild(
      createNumberLabel(a)
    );

    const row =
      document.createElement("div");

    row.className =
      "cupcake-math-items";

    for(
      let i = 0;
      i < Math.min(a, 30);
      i++
    ){

      const object =
        createMathObject(
          "🍫"
        );

      if(
        i >= a - b
      ){

        object.classList.add(
          "cupcake-math-removed"
        );

      }

      row.appendChild(
        object
      );

    }

    original.appendChild(
      row
    );

    visual.appendChild(
      original
    );

    const legend =
      document.createElement("div");

    legend.className =
      "cupcake-math-instruction";

    if(teaching){

      legend.textContent =
        "Coret " +
        b +
        " cokelat. Sekarang hitung cokelat yang masih ada.";

    }else{

      legend.textContent =
        "Ada " +
        a +
        " cokelat. Ambil " +
        b +
        ". Berapa yang tersisa?";

    }

    visual.appendChild(
      legend
    );

    return visual;

  }


  function buildMultiplicationVisual(
    a,
    b,
    teaching
  ){

    const visual =
      document.createElement("div");

    visual.className =
      "cupcake-math-visual";

    const title =
      document.createElement("div");

    title.className =
      "cupcake-math-title";

    title.textContent =
      teaching
        ? "Kita buat beberapa kelompok!"
        : "Hitung setiap kelompok!";

    visual.appendChild(
      title
    );

    const groups =
      document.createElement("div");

    groups.className =
      "cupcake-math-multiplication";

    const totalGroups =
      Math.min(a, 10);

    const objectsPerGroup =
      Math.min(b, 15);

    for(
      let i = 0;
      i < totalGroups;
      i++
    ){

      const group =
        document.createElement("div");

      group.className =
        "cupcake-math-multigroup";

      const groupLabel =
        document.createElement("span");

      groupLabel.className =
        "cupcake-math-group-label";

      groupLabel.textContent =
        "Kelompok " +
        (i + 1);

      group.appendChild(
        groupLabel
      );

      group.appendChild(
        createObjectsRow(
          objectsPerGroup,
          "🍫"
        )
      );

      groups.appendChild(
        group
      );

    }

    visual.appendChild(
      groups
    );

    const instruction =
      document.createElement("div");

    instruction.className =
      "cupcake-math-instruction";

    instruction.textContent =
      teaching
        ? `${a} kelompok, masing-masing ${b} cokelat. Hitung semuanya.`
        : `Ada ${a} kelompok. Setiap kelompok berisi ${b} cokelat. Berapa semuanya?`;

    visual.appendChild(
      instruction
    );

    return visual;

  }


  function buildDivisionVisual(
    a,
    b,
    teaching
  ){

    const visual =
      document.createElement("div");

    visual.className =
      "cupcake-math-visual";

    const title =
      document.createElement("div");

    title.className =
      "cupcake-math-title";

    title.textContent =
      teaching
        ? "Mari kita bagi bersama!"
        : "Coba bagikan dengan rata!";

    visual.appendChild(
      title
    );

    const sourceTitle =
      document.createElement("div");

    sourceTitle.className =
      "cupcake-math-source-title";

    sourceTitle.textContent =
      "Semua cokelat:";

    visual.appendChild(
      sourceTitle
    );

    visual.appendChild(
      createObjectsRow(
        a,
        "🍫"
      )
    );

    const groups =
      document.createElement("div");

    groups.className =
      "cupcake-math-division";

    const groupCount =
      Math.min(
        Math.max(1, b),
        10
      );

    const each =
      Math.floor(
        a / b
      );

    for(
      let i = 0;
      i < groupCount;
      i++
    ){

      const group =
        document.createElement("div");

      group.className =
        "cupcake-math-divgroup";

      const label =
        document.createElement("div");

      label.className =
        "cupcake-math-group-label";

      label.textContent =
        "🧁 " +
        (i + 1);

      group.appendChild(
        label
      );

      group.appendChild(
        createObjectsRow(
          each,
          "🍫"
        )
      );

      groups.appendChild(
        group
      );

    }

    visual.appendChild(
      groups
    );

    const instruction =
      document.createElement("div");

    instruction.className =
      "cupcake-math-instruction";

    instruction.textContent =
      teaching
        ? `${a} cokelat dibagikan kepada ${b} kelompok. Hitung cokelat di setiap kelompok.`
        : `Bagikan ${a} cokelat kepada ${b} kelompok secara rata.`;

    visual.appendChild(
      instruction
    );

    return visual;

  }


  function buildVisualMath(
    question,
    state
  ){

    if(!question){
      return null;
    }

    const a =
      safeNumber(question.a);

    const b =
      safeNumber(question.b);

    if(
      a === null ||
      b === null
    ){

      return null;

    }

    const operation =
      normalizeOperation(
        question.op ||
        question.operation
      );

    const teaching =
      state === "teaching";

    /*
     * Batasi visual agar tidak memenuhi
     * layar untuk angka yang sangat besar.
     */

    if(
      operation === "+" &&
      a <= 30 &&
      b <= 30
    ){

      return buildAdditionVisual(
        a,
        b,
        teaching
      );

    }

    if(
      operation === "−" &&
      a <= 30 &&
      b <= a
    ){

      return buildSubtractionVisual(
        a,
        b,
        teaching
      );

    }

    if(
      operation === "×" &&
      a <= 10 &&
      b <= 15
    ){

      return buildMultiplicationVisual(
        a,
        b,
        teaching
      );

    }

    if(
      operation === "÷" &&
      b > 0 &&
      a <= 30 &&
      a % b === 0
    ){

      return buildDivisionVisual(
        a,
        b,
        teaching
      );

    }

    /*
     * Fallback untuk angka yang terlalu besar.
     */

    const visual =
      document.createElement("div");

    visual.className =
      "cupcake-math-visual";

    const title =
      document.createElement("div");

    title.className =
      "cupcake-math-title";

    title.textContent =
      teaching
        ? "Mari kita pecah soalnya menjadi bagian kecil."
        : "Yuk kita hitung bersama.";

    visual.appendChild(
      title
    );

    const equation =
      document.createElement("div");

    equation.className =
      "cupcake-math-big-equation";

    equation.textContent =
      `${a} ${operation} ${b} = ?`;

    visual.appendChild(
      equation
    );

    const instruction =
      document.createElement("div");

    instruction.className =
      "cupcake-math-instruction";

    instruction.textContent =
      "Gunakan cara hitung yang paling mudah. Kerjakan satu bagian dulu.";

    visual.appendChild(
      instruction
    );

    return visual;

  }


  /*
   * ============================================================
   * VISUAL MATH CSS
   *
   * CSS dimasukkan dari JS supaya index.html tidak perlu
   * diubah.
   * ============================================================
   */

  function installVisualMathCSS(){

    if(
      document.getElementById(
        "chocolate-cupcake-math-css"
      )
    ){

      return;

    }

    const style =
      document.createElement("style");

    style.id =
      "chocolate-cupcake-math-css";

    style.textContent = `

      .cupcake-math-visual{
        margin-top:12px;
        padding:14px;
        border-radius:18px;
        background:linear-gradient(
          135deg,
          #fff8e8,
          #fffdf7
        );
        border:2px solid rgba(
          91,
          45,
          22,
          .14
        );
        text-align:center;
        color:#3b1d10;
        box-shadow:
          0 5px 15px rgba(
            0,
            0,
            0,
            .08
          );
      }

      .cupcake-math-title{
        font-size:18px;
        font-weight:800;
        margin-bottom:10px;
      }

      .cupcake-math-equation{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        flex-wrap:wrap;
      }

      .cupcake-math-group{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:5px;
        min-width:80px;
      }

      .cupcake-math-number{
        font-size:20px;
        font-weight:900;
      }

      .cupcake-math-items{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:4px;
        max-width:330px;
        margin:0 auto;
      }

      .math-object{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:30px;
        height:30px;
        font-size:23px;
        animation:cupcakeMathPop .25s ease;
      }

      .cupcake-math-operator{
        font-size:30px;
        font-weight:900;
      }

      .cupcake-math-instruction{
        margin-top:12px;
        font-size:14px;
        font-weight:700;
        line-height:1.45;
      }

      .cupcake-math-subtraction
      .cupcake-math-items{
        max-width:420px;
      }

      .cupcake-math-removed{
        opacity:.28;
        filter:grayscale(1);
        text-decoration:line-through;
        transform:scale(.9);
      }

      .cupcake-math-multiplication{
        display:flex;
        flex-direction:column;
        gap:7px;
        align-items:center;
      }

      .cupcake-math-multigroup{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        flex-wrap:wrap;
        width:100%;
      }

      .cupcake-math-group-label{
        min-width:85px;
        font-size:13px;
        font-weight:800;
      }

      .cupcake-math-source-title{
        font-weight:800;
        margin-bottom:5px;
      }

      .cupcake-math-division{
        display:grid;
        grid-template-columns:
          repeat(
            auto-fit,
            minmax(100px,1fr)
          );
        gap:8px;
        margin-top:12px;
      }

      .cupcake-math-divgroup{
        padding:8px;
        border-radius:12px;
        background:#fff;
        border:1px solid rgba(
          91,
          45,
          22,
          .12
        );
      }

      .cupcake-math-big-equation{
        font-size:26px;
        font-weight:900;
        margin:10px 0;
      }

      @keyframes cupcakeMathPop{
        from{
          transform:scale(.7);
          opacity:0;
        }
        to{
          transform:scale(1);
          opacity:1;
        }
      }

      @media(max-width:600px){

        .cupcake-math-visual{
          padding:10px;
        }

        .math-object{
          width:26px;
          height:26px;
          font-size:20px;
        }

        .cupcake-math-title{
          font-size:16px;
        }

        .cupcake-math-instruction{
          font-size:13px;
        }

      }

    `;

    document.head.appendChild(
      style
    );

  }


  installVisualMathCSS();


  /*
   * ============================================================
   * DISPLAY CUPCAKE RESPONSE
   * ============================================================
   */

  function normalizeCupcakeState(
    state
  ){

    const value =
      String(
        state || "encouraging"
      )
      .toLowerCase()
      .trim();

    return stateImages[value]
      ? value
      : "encouraging";

  }


  function showCupcakeResponse(
    data,
    options = {}
  ){

    if(
      !data ||
      !data.success ||
      !data.response
    ){

      return;

    }

    const ai =
      data.response;

    const note =
      document.getElementById(
        "aiNote"
      );

    if(!note){

      console.warn(
        "[Chocolate Cupcake] #aiNote tidak ditemukan."
      );

      return;

    }

    const state =
      normalizeCupcakeState(
        ai.state ||
        ai.emotion
      );

    const imageSrc =
      stateImages[state];

    let message =
      String(
        ai.message || ""
      ).trim();

    if(ai.hint){

      const hint =
        String(
          ai.hint
        ).trim();

      if(
        hint &&
        !message.includes(hint)
      ){

        message +=
          (message ? " " : "") +
          hint;

      }

    }

    note.innerHTML = "";

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "cupcake-ai-response";

    const image =
      document.createElement(
        "img"
      );

    image.className =
      "cupcake-ai-image";

    image.src =
      imageSrc;

    image.alt =
      "Chocolate Cupcake";

    image.loading =
      "eager";

    const content =
      document.createElement(
        "div"
      );

    content.className =
      "cupcake-ai-content";

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      "🍫 Chocolate Cupcake";

    const textElement =
      document.createElement(
        "div"
      );

    textElement.className =
      "cupcake-ai-message";

    textElement.textContent =
      message;

    content.appendChild(
      title
    );

    content.appendChild(
      textElement
    );


    /*
     * ==========================================================
     * LOCAL VISUAL MATH
     *
     * Prioritas:
     * 1. Soal asli dari event game
     * 2. Visual dari AI jika tersedia
     * ==========================================================
     */

    if(
      options.question &&
      (
        state === "encouraging" ||
        state === "teaching"
      )
    ){

      const mathVisual =
        buildVisualMath(
          options.question,
          state
        );

      if(mathVisual){

        content.appendChild(
          mathVisual
        );

      }

    }else if(
      ai.visual &&
      ai.visual.enabled &&
      ai.visual.content
    ){

      const visual =
        document.createElement(
          "div"
        );

      visual.className =
        "cupcake-ai-visual";

      visual.textContent =
        String(
          ai.visual.content
        );

      content.appendChild(
        visual
      );

    }


    wrapper.appendChild(
      image
    );

    wrapper.appendChild(
      content
    );

    note.appendChild(
      wrapper
    );

    note.classList.remove(
      "hidden"
    );


    /*
     * TTS
     */

    if(
      options.speak === true &&
      ai.speak !== false &&
      message
    ){

      window.speakChocolateCupcake(
        message
      );

    }


    /*
     * Celebration timer
     */

    if(
      state === "celebrating" ||
      state === "victory"
    ){

      if(
        window.cupcakeCelebrationTimer
      ){

        clearTimeout(
          window.cupcakeCelebrationTimer
        );

      }

      const duration =
        state === "victory"
          ? 10000
          : 5000;

      window.cupcakeCelebrationTimer =
        setTimeout(
          function(){

            if(note){

              note.classList.remove(
                "hidden"
              );

            }

          },
          duration
        );

    }

  }


  window.showCupcakeResponse =
    showCupcakeResponse;


  /*
   * ============================================================
   * SEND EVENT
   * ============================================================
   */

  let cupcakeRequestSequence = 0;

  function nextCupcakeRequestId(){

    cupcakeRequestSequence += 1;

    return cupcakeRequestSequence;

  }


  window.sendCupcakeEvent =
    function(eventData){

      const requestId =
        nextCupcakeRequestId();

      requestCupcakeResponse(
        eventData
      )
      .then(
        function(data){

          /*
           * Event lama tidak boleh
           * menimpa event terbaru.
           */

          if(
            requestId !==
            cupcakeRequestSequence
          ){

            return;

          }

          /*
           * API hanya memperkaya tutor_request.
           *
           * Feedback answer sudah ditampilkan
           * secara lokal sehingga tidak menunggu AI.
           */

          if(
            data &&
            data.success &&
            eventData &&
            eventData.event ===
            "tutor_request"
          ){

            showCupcakeResponse(
              data,
              {
                speak: false,
                question:
                  eventData.question
              }
            );

          }

        }
      )
      .catch(
        function(error){

          console.warn(
            "[Chocolate Cupcake] Event error:",
            error
          );

        }
      );

      return requestId;

    };


  /*
   * ============================================================
   * LOCAL CUPCAKE STATE
   * ============================================================
   */

  function showLocalCupcakeState({
    state,
    message,
    hint = "",
    question = null,
    speak = true
  }){

    showCupcakeResponse(

      {
        success: true,

        response: {

          state,

          message,

          hint,

          visual: {
            enabled: false,
            content: ""
          },

          speak,

          emotion: state

        }

      },

      {
        speak,

        question

      }

    );

  }


  /*
   * ============================================================
   * LOCAL ANSWER FEEDBACK
   * ============================================================
   */

  function localAnswerFeedback({

    isCorrect,

    attemptNumber,

    question

  }){

    /*
     * ==========================================================
     * CORRECT
     * ==========================================================
     */

    if(isCorrect === true){

      showLocalCupcakeState({

        state:
          "celebrating",

        message:
          "Benar! Hebat sekali! 🎉",

        hint:
          "",

        question:
          null,

        speak:
          true

      });

      return;

    }


    /*
     * ==========================================================
     * WRONG
     * ==========================================================
     */

    const attempt =
      Number(
        attemptNumber || 1
      );


    /*
     * ==========================================================
     * FIRST WRONG
     *
     * ENCOURAGING + VISUAL
     * ==========================================================
     */

    if(attempt <= 1){

      showLocalCupcakeState({

        state:
          "encouraging",

        message:
          "Tidak apa-apa. Yuk coba lagi! Kamu pasti bisa!",

        hint:
          "Lihat cokelatnya dan hitung satu per satu.",

        question:
          question,

        speak:
          true

      });

      return;

    }


    /*
     * ==========================================================
     * SECOND WRONG
     *
     * TEACHING + VISUAL
     * ==========================================================
     */

    if(attempt === 2){

      showLocalCupcakeState({

        state:
          "teaching",

        message:
          "Ayo kita hitung bersama.",

        hint:
          "Perhatikan kelompok cokelatnya, lalu hitung pelan-pelan.",

        question:
          question,

        speak:
          true

      });

      return;

    }


    /*
     * ==========================================================
     * THIRD+ WRONG
     *
     * TEACHING + MORE DIRECT VISUAL
     * ==========================================================
     */

    showLocalCupcakeState({

      state:
        "teaching",

      message:
        "Tidak apa-apa. Kita kerjakan langkah demi langkah.",

      hint:
        "Hitung benda yang terlihat. Tidak perlu terburu-buru.",

      question:
        question,

      speak:
        true

    });

  }


  /*
   * ============================================================
   * ANSWER EVENT
   * ============================================================
   */

  window.askCupcakeAfterAnswer =
    function({

      question,

      playerAnswer,

      correctAnswer,

      isCorrect,

      attemptNumber,

      responseTime,

      skill,

      difficulty,

      playerId

    }){

      /*
       * ========================================================
       * 1. FEEDBACK LANGSUNG
       *
       * Anak langsung mendapat feedback tanpa menunggu API.
       * ========================================================
       */

      localAnswerFeedback({

        isCorrect,

        attemptNumber,

        question

      });


      /*
       * ========================================================
       * 2. KIRIM DATA KE AI
       *
       * Berjalan asynchronous di background.
       * ========================================================
       */

      window.sendCupcakeEvent({

        event:
          "answer_submitted",

        player: {

          id:
            playerId ||
            "player"

        },

        game: {

          gameId:
            "chocolate-abyss-gate",

          level:
            difficulty ||
            "easy"

        },

        question: {

          type:
            skill ||
            "addition",

          a:
            question?.a,

          b:
            question?.b,

          operation:
            question?.op ||
            question?.operation,

          correctAnswer

        },

        answer: {

          value:
            playerAnswer,

          correct:
            isCorrect

        },

        attempt:
          Number(
            attemptNumber || 1
          ),

        context: {

          responseTime:
            Number(
              responseTime || 0
            ),

          skill:
            skill ||
            "addition"

        }

      });

    };


  /*
   * ============================================================
   * WELCOME
   * ============================================================
   */

  window.startCupcakeWelcome =
    function(playerId){

      window.unlockChocolateCupcakeTTS();

      showLocalCupcakeState({

        state:
          "welcome",

        message:
          "Halo! Aku Chocolate Cupcake. Yuk kita mulai petualangan! ✨",

        hint:
          "",

        question:
          null,

        speak:
          true

      });

      window.sendCupcakeEvent({

        event:
          "game_started",

        player: {

          id:
            playerId ||
            "player"

        },

        game: {

          gameId:
            "chocolate-abyss-gate",

          level:
            window.getCurrentGameLevel
              ? window.getCurrentGameLevel()
              : "easy"

        }

      });

    };


  /*
   * ============================================================
   * VICTORY
   * ============================================================
   */

  window.sendCupcakeVictory =
    function({

      playerId,

      level,

      correct,

      wrong

    }){

      const levelKey =
        String(
          level || "easy"
        )
        .toLowerCase();


      const isFinalVictory =
        levelKey === "hard";


      if(isFinalVictory){

        showLocalCupcakeState({

          state:
            "victory",

          message:
            "Luar biasa! Kamu berhasil menyelesaikan Chocolate Abyss Gate! 🏆🎉",

          hint:
            "",

          question:
            null,

          speak:
            true

        });

      }else{

        showLocalCupcakeState({

          state:
            "celebrating",

          message:
            "Hebat! Level ini selesai! 🎉",

          hint:
            "",

          question:
            null,

          speak:
            true

        });

      }


      window.sendCupcakeEvent({

        event:
          "level_completed",

        player: {

          id:
            playerId ||
            "player"

        },

        game: {

          gameId:
            "chocolate-abyss-gate",

          level:
            level ||
            "easy"

        },

        progress: {

          correct:
            Number(
              correct || 0
            ),

          wrong:
            Number(
              wrong || 0
            ),

          completed:
            true,

          finalVictory:
            isFinalVictory

        }

      });

    };


  /*
   * ============================================================
   * TTS CONTROLS
   * ============================================================
   */

  window.setChocolateCupcakeTTS =
    function(enabled){

      window.cupcakeTTS.enabled =
        Boolean(enabled);

      if(
        !window.cupcakeTTS.enabled &&
        "speechSynthesis" in window
      ){

        window.speechSynthesis.cancel();

        window.cupcakeTTS.speaking =
          false;

      }

    };


  window.stopChocolateCupcakeTTS =
    function(){

      if(
        "speechSynthesis" in window
      ){

        window.speechSynthesis.cancel();

      }

      window.cupcakeTTS.speaking =
        false;

    };


  /*
   * ============================================================
   * DEBUG / STATUS
   * ============================================================
   */

  console.log(
    "[Chocolate Cupcake] AI Agent loaded."
  );

  console.log(
    "[Chocolate Cupcake] TTS available:",
    "speechSynthesis" in window
  );

  if(
    "speechSynthesis" in window
  ){

    console.log(
      "[Chocolate Cupcake] TTS voices loaded:",
      window.speechSynthesis
        .getVoices()
        .length
    );

  }


})();
