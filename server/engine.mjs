import * as old from './engine-before-v12.mjs';
export * from './engine-before-v12.mjs';
import {bank} from './bank.mjs';
import {randomUUID} from 'node:crypto';
const ok=(x,m)=>{if(!x)throw Error(m);};
const mediaReadyTimeout=6000;
const current=r=>r.duel?bank[r.duel.category]?.[r.duel.index]:null;
// Players report once every image is preloaded; then an image question starts at once instead of waiting for IMAGE_READY round trips.
function skipPreloadedMedia(r,now){const d=r.duel,q=current(r);if(d?.status!=='media'||!q?.image)return false;const ready=[...d.ids,d.adminId].every(id=>{const failed=r.mediaPreload?.[id];return Array.isArray(failed)&&!failed.includes(q.image)});if(!ready)return false;d.status='running';d.lastAt=now;d.mediaReady=[...d.ids,d.adminId];d.mediaDeadline=null;return true;}
function observe(r,now){r.questionRulesVersion=13;r.questionReports=r.questionReports||[];const d=r.duel;if(!d)return;skipPreloadedMedia(r,now);if(d.status==='media'){if(!Number.isFinite(d.mediaDeadline))d.mediaDeadline=now+mediaReadyTimeout;}else d.mediaDeadline=null;if(d.v12Key!==d.key){d.v12Key=d.key;d.v12Since=d.status==='running'?now:null;d.v12Level=0;d.v12Seen=d.v12Seen||[];if(!d.v12Seen.includes(d.index))d.v12Seen.push(d.index);}else if(d.status==='running'&&!Number.isFinite(d.v12Since))d.v12Since=now;else if(d.status!=='running')d.v12Since=null;}
function awardNoSkip(r,duel,logLength){
 if(!duel||r.duel===duel||(r.log?.length||0)<=logLength)return;
 const noSkip=duel.ids.filter(playerId=>(duel.skipCounts?.[playerId]||0)===0);
 for(const playerId of noSkip){const player=r.players.find(player=>player.id===playerId);if(player){player.points+=5;if(Number.isFinite(player.walletCents))player.walletCents+=500;}}
 if(noSkip.length&&r.lastDecision)r.lastDecision.text+=' Bez pominięć: +5 pkt dla '+noSkip.map(playerId=>r.players.find(player=>player.id===playerId)?.name||'gracza').join(' i ')+'.';
}
export function createRoom(...args){const r=old.createRoom(...args);observe(r,Date.now());return r;}
export function tick(r,now=Date.now()){const duel=r.duel,logLength=r.log?.length||0,x=old.tick(r,now),skipped=skipPreloadedMedia(r,now),mediaTimedOut=!!r.duel&&r.duel.status==='media'&&Number.isFinite(r.duel.mediaDeadline)&&now>=r.duel.mediaDeadline;if(mediaTimedOut){r.duel.status='running';r.duel.lastAt=now;r.rev++;r.updated=now;}if(skipped){r.rev++;r.updated=now;}awardNoSkip(r,duel,logLength);observe(r,now);return x||mediaTimedOut||skipped;}
export function command(r,id,a,now=Date.now()){
 tick(r,now);
 // Idempotent status report, accepted regardless of revision so a busy room cannot starve it.
 if(a.type==='MEDIA_PRELOADED'){ok(r.players.some(p=>p.id===id),'Brak sesji.');ok(Array.isArray(a.failed)&&a.failed.length<=1000&&a.failed.every(x=>typeof x==='string'&&x.length<=500),'Nieprawidłowa lista obrazków.');r.mediaPreload={...r.mediaPreload,[id]:a.failed};observe(r,now);r.rev++;r.updated=now;return r;}ok(a.rev===r.rev,'Stan gry zmienił się.');const p=r.players.find(p=>p.id===id);ok(p?.connected,'Brak sesji.');const d=r.duel,q=current(r);
 if(['Q12_REPORT','Q12_HINT','Q12_SKIP'].includes(a.type)){
  ok(d&&q&&d.status==='running'&&a.questionKey===d.key,'To pytanie nie jest już aktywne.');
  if(a.type==='Q12_REPORT'){
   ok(typeof a.reason==='string'&&a.reason.trim().length>=3&&a.reason.length<=500,'Powód: 3–500 znaków.');
   ok(!r.questionReports.some(x=>x.key===d.key&&x.by===id),'To pytanie zostało już przez Ciebie zgłoszone.');
   ok(r.questionReports.length<1000,'Osiągnięto limit zgłoszeń w lobby.');
   r.questionReports.push({id:randomUUID(),by:id,key:d.key,category:d.category,index:d.index,questionId:q.id||null,prompt:q.prompt??q[0],reason:a.reason.trim(),at:now,status:'open'});
  }else if(a.type==='Q12_HINT'){
   ok(d.adminId===id,'Kolejną wskazówkę odsłania sędzia dla obu graczy.');ok(q.format==='clues'&&d.status==='running','To nie jest aktywne pytanie ze wskazówkami.');ok(d.v12Level<q.clues.length-1,'Wszystkie wskazówki są już widoczne.');d.v12Level++;
  }else{
   ok(d.adminId===id,'Tylko sędzia może unieważnić pytanie.');ok(d.status==='running','Pojedynek nie jest aktywny.');
   ok(Number.isFinite(d.expire),'Nie rozpoznano zegara silnika. Bezpieczne pominięcie zablokowane.');
   const list=bank[d.category],index=list.findIndex((_,i)=>!d.v12Seen.includes(i));ok(index>=0,'Brak kolejnego pytania w tej kategorii. Nie zmieniono wyniku.');
   const previousKey=d.key;
   // Preserve points, lives and turn. Refund elapsed time of this question.
   d.expire+=Math.max(0,now-d.v12Since);d.index=index;d.key=randomUUID();
   r.questionReports.filter(x=>x.key===previousKey).forEach(x=>x.status='skipped');
   if(!r.questionReports.some(x=>x.key===previousKey))r.questionReports.push({id:randomUUID(),by:id,key:previousKey,category:d.category,index:list.indexOf(q),questionId:q.id||null,prompt:q.prompt??q[0],reason:'Unieważnione przez sędziego',at:now,status:'skipped'});
   // Audience guesses on an invalid question are discarded, never rewarded.
   if(r.audiencePrivate)delete r.audiencePrivate[previousKey];observe(r,now);
  }
  r.rev++;r.updated=now;return r;
 }
 const answer=d&&a.type==='ANSWER'&&d.status==='running'&&a.questionKey===d.key?{key:d.key,turn:d.turn,kind:a.kind,points:r.players.find(x=>x.id===d.turn)?.points||0,since:d.v12Since}:null;
 const finishing=d?{duel:d,ids:[...d.ids],skipCounts:{...(d.skipCounts||{})},logLength:r.log?.length||0}:null;
 let freeSkip=false,remainingBefore,skipsBefore,freeSkipsBefore;
 if(answer?.kind==='skip'){
  d.skipCounts=d.skipCounts||Object.fromEntries(d.ids.map(playerId=>[playerId,0]));
  skipsBefore=d.skipCounts[answer.turn]||0;d.skipCounts[answer.turn]=skipsBefore+1;
  if(d.skip5?.playerId===d.turn&&d.skip5.remaining>0){freeSkip=true;remainingBefore=d.remaining[answer.turn];freeSkipsBefore=d.skip5.remaining;d.remaining[answer.turn]+=3000;d.skip5.remaining--;}
 }
 let result;
 try{result=old.command(r,id,a,now);}
 catch(error){if(answer?.kind==='skip'){d.skipCounts[answer.turn]=skipsBefore;if(freeSkip){d.remaining[answer.turn]=remainingBefore;d.skip5.remaining=freeSkipsBefore;}}throw error;}
 if(answer?.kind==='good'&&r.duel?.key!==answer.key){
  const x=r.players.find(x=>x.id===answer.turn);
  if(x&&x.points>answer.points&&Number.isFinite(answer.since)&&now-answer.since<=1500){x.points++;if(Number.isFinite(x.walletCents))x.walletCents+=100;}
 }
 if(a.type==='CHALLENGE'&&r.duel&&!r.duel.skipCounts)r.duel.skipCounts=Object.fromEntries(r.duel.ids.map(playerId=>[playerId,0]));
 if(finishing)awardNoSkip(r,finishing.duel,finishing.logLength);
 observe(r,now);return result;
}
export function publicState(r,id,now=Date.now()){
 const s=old.publicState(r,id,now),d=r.duel,q=current(r);s.questionRulesVersion=13;s.mediaPreloaded=Array.isArray(r.mediaPreload?.[id]);delete s.mediaPreload;if(s.duel&&s.duel.prompt&&q?.footballer)s.duel.footballer=q.footballer;
 if(d&&q&&s.duel&&d.status==='running'){delete s.duel.clues;delete s.duel.v12Seen;const level=d.v12Level||0;if(q.format==='clues')s.duel.prompt=q.prompt+'\n'+q.clues.slice(0,level+1).map((x,i)=>(i+1)+'. '+x).join('\n');s.questionPanel={key:d.key,format:q.format||'standard',judge:d.adminId===id,canHint:d.adminId===id&&q.format==='clues'&&level<q.clues.length-1&&d.status==='running',canSkip:d.adminId===id&&d.status==='running'&&Number.isFinite(d.expire),reported:(r.questionReports||[]).some(x=>x.key===d.key&&x.by===id)};}
 // Only host/judge receive full reports; no answer keys included.
 s.questionReports=(r.hostId===id||d?.adminId===id)?structuredClone(r.questionReports||[]):(r.questionReports||[]).filter(x=>x.by===id).map(x=>({...x}));return s;
}
