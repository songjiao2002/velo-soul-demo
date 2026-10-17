export const VISION_SCENES=['purple_vehicle','colorful_vehicle','trees','river','cafe_sign','food_sign','building','other','unclear'];

// Model confidence is a heuristic, not a calibrated probability. Silence is preferable to a weak guess.
export class SceneGate {
 constructor({cooldownMs=45000,repeatMs=180000}={}){this.cooldownMs=cooldownMs;this.repeatMs=repeatMs;this.lastSpoken=-Infinity;this.seen=new Map();}
 accept(result,now=Date.now()){
  if(!result||result.shouldSpeak!==true||!VISION_SCENES.includes(result.scene)||result.scene==='unclear'||!Number.isFinite(result.confidence)||result.confidence<.7||typeof result.reply!=='string'||!result.reply.trim())return false;
  if(now-this.lastSpoken<this.cooldownMs||now-(this.seen.get(result.scene)??-Infinity)<this.repeatMs)return false;
  this.lastSpoken=now;this.seen.set(result.scene,now);return true;
 }
}
