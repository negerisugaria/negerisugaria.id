(function(){
  const EVENT_VERSION=2;
  const DATA_KEY="chocolateAbyssPlayerData";
  const PLAYER_KEY="chocolateAbyssPlayerId";
  function id(prefix){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;}
  function load(key=DATA_KEY){try{return JSON.parse(localStorage.getItem(key)||"null");}catch(e){return null;}}
  function saveData(key,data){localStorage.setItem(key,JSON.stringify(data));}
  class PlayerEventTracker{
    constructor(options={}){
      this.storageKey=options.storageKey||DATA_KEY;
      this.playerId=localStorage.getItem(PLAYER_KEY)||id("player");
      localStorage.setItem(PLAYER_KEY,this.playerId);
      const existing=load(this.storageKey)||{};
      this.sessionId=existing.sessionId||id("session");
      this.playerInfo=existing.playerInfo||{playerId:this.playerId,name:"",age:null};
      this.data={version:EVENT_VERSION,playerId:this.playerId,sessionId:this.sessionId,playerInfo:this.playerInfo,events:Array.isArray(existing.events)?existing.events:[]};
      this.save();
    }
    save(){saveData(this.storageKey,this.data);}
    startSession(){this.sessionId=id("session");this.data.sessionId=this.sessionId;this.save();}
    setPlayerInfo(name,age){this.playerInfo={playerId:this.playerId,name:String(name||"").trim(),age:Number(age)||null};this.data.playerInfo=this.playerInfo;this.save();}
    getPlayerInfo(){return {...this.playerInfo};}
    makeQuestionId(level,index,q){return `${level}_q${index+1}_${q.a}${q.op}${q.b}_${Date.now().toString(36)}`;}
    track(type,payload={}){
      const event={eventId:id("evt"),type,playerId:this.playerId,sessionId:this.sessionId,timestamp:payload.timestamp||new Date().toISOString(),level:payload.level || (window.getCurrentGameLevel ? window.getCurrentGameLevel() : null),difficulty:payload.difficulty || (window.getCurrentGameLevel ? window.getCurrentGameLevel() : null),...payload};
      this.data.events.push(event);this.save();window.dispatchEvent(new CustomEvent("player-event",{detail:event}));return event;
    }
    getEvents(){return [...this.data.events];}
    clearPlayerData(){this.data={version:EVENT_VERSION,playerId:this.playerId,sessionId:id("session"),playerInfo:{playerId:this.playerId,name:"",age:null},events:[]};this.sessionId=this.data.sessionId;this.playerInfo=this.data.playerInfo;this.save();}
    exportJSON(){
      const blob=new Blob([JSON.stringify(this.data,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`chocolate-abyss-player-${this.playerId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
  window.PlayerEventTracker=PlayerEventTracker;
  window.savePlayerData=()=>window.playerEventTracker?.save();
  window.loadPlayerData=()=>load();
  window.clearPlayerData=()=>window.playerEventTracker?.clearPlayerData();
})();
