import * as old from './engine-before-v12.mjs';
export * from './engine-before-v12.mjs';
import {bank} from './bank.mjs';
import {randomInt,randomUUID} from 'node:crypto';
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
// Cards added on top of v12 (fog, freeze, time theft) and a shop that sells every card.
const newCards={fog:{name:'Mgła',text:'Na cały pojedynek: każde pytanie rywala pojawia się mocno rozmyte i wyostrza się dopiero po 4 sekundach. Aktywuj przed lub w trakcie własnego pojedynku.'},freeze:{name:'Zamrożenie',text:'We własnej turze zatrzymaj swój zegar na 5 sekund. Niewykorzystana część przepada, gdy tura przejdzie na rywala.'},steal:{name:'Złodziej czasu',text:'W trakcie własnego pojedynku zabierz rywalowi 5 sekund i dodaj je sobie. Rywalowi zostaje co najmniej 1 sekunda.'}};
// Prices in wallet points; a won duel usually brings 10–20.
const cardPrices={length:12,freeze:14,letter:15,homecategory:15,time:18,skip5:20,allin:20,fog:22,steal:25,revive:25,heal:30,shield:30,laststand:35};
const freezeMs=5000,stealMs=5000;
const solo=r=>r.settings.mode!=='teams';
const shopOpen=r=>solo(r)&&!r.duel&&['choose','category','team_category','team_draft','team_nominate','v11_winner','v11_returns'].includes(r.phase);
const inDuel=(r,id)=>!!r.duel?.ids.includes(id)&&['ready','countdown','media','running'].includes(r.duel.status);
const cardName=type=>newCards[type]?.name||old.cards[type]?.name||(type==='laststand'?'Ostatnia szansa':type);
// A frozen clock consumes freeze time first; core tick then only counts what is left of the elapsed time.
function applyFreeze(r,now){const d=r.duel,f=d?.freeze;if(!f)return false;if(d.turn!==f.playerId){d.freeze=null;return true;}if(d.status!=='running'||!Number.isFinite(d.lastAt))return false;const used=Math.min(f.left,Math.max(0,now-d.lastAt));f.left-=used;d.lastAt+=used;if(f.left>0)return false;d.freeze=null;return true;}
function playNewCard(r,id,p,now){
 ok(solo(r),'Karty są wyłączone w trybie drużynowym.');ok(!p.cardUsed&&p.lives>0,'Karta niedostępna.');const d=r.duel,rival=d?.ids.find(x=>x!==id);
 if(p.card==='fog'){ok(inDuel(r,id),'Mgłę aktywujesz podczas własnego pojedynku.');ok(!d.fog,'W tym pojedynku działa już mgła.');d.fog={by:id,target:rival};p.v10CardNotice='Mgła działa do końca pojedynku.';}
 else if(p.card==='freeze'){ok(d?.status==='running'&&d.turn===id,'Zamrożenia użyjesz we własnej turze.');ok(!d.freeze,'Zegar jest już zamrożony.');d.freeze={playerId:id,left:freezeMs};p.v10CardNotice='Twój zegar stoi przez 5 sekund.';}
 else{ok(d?.status==='running'&&d.ids.includes(id),'Złodzieja czasu użyjesz w trakcie własnego pojedynku.');const taken=Math.min(stealMs,Math.max(0,d.remaining[rival]-1000));ok(taken>0,'Rywalowi nie zostało czasu do zabrania.');d.remaining[rival]-=taken;d.remaining[id]+=taken;p.v10CardNotice='Zabrano rywalowi '+(taken/1000).toFixed(1)+' s.';}
 p.cardUsed=true;r.lastDecision={text:p.name+' używa karty: '+cardName(p.card)+'.'};r.rev++;r.updated=now;return r;
}
function buyCard(r,id,p,type,now){
 ok(shopOpen(r),'Sklep jest dostępny między pojedynkami w trybie solo.');const price=cardPrices[type];ok(Number.isFinite(price),'Nieznana karta.');ok(p.lives>0,'Karty kupują tylko gracze, którzy są w grze.');
 ok(!(p.card===type&&!p.cardUsed),'Masz już tę kartę w ręku.');ok((p.walletCents||0)>=price*100,'Za mało punktów w portfelu.');
 const replaced=p.card&&!p.cardUsed?cardName(p.card):null;p.walletCents-=price*100;p.card=type;p.cardUsed=false;p.v10CardNotice=null;
 r.lastDecision={text:p.name+' kupuje kartę: '+cardName(type)+(replaced?' (w miejsce: '+replaced+')':'')+'.'};r.rev++;r.updated=now;return r;
}
export function createRoom(...args){const r=old.createRoom(...args);observe(r,Date.now());return r;}
export function tick(r,now=Date.now()){const frozen=applyFreeze(r,now);if(frozen){r.rev++;r.updated=now;}const duel=r.duel,logLength=r.log?.length||0,x=old.tick(r,now)||frozen,skipped=skipPreloadedMedia(r,now),mediaTimedOut=!!r.duel&&r.duel.status==='media'&&Number.isFinite(r.duel.mediaDeadline)&&now>=r.duel.mediaDeadline;if(mediaTimedOut){r.duel.status='running';r.duel.lastAt=now;r.rev++;r.updated=now;}if(skipped){r.rev++;r.updated=now;}awardNoSkip(r,duel,logLength);observe(r,now);return x||mediaTimedOut||skipped;}
export function command(r,id,a,now=Date.now()){
 tick(r,now);
 // Idempotent status report, accepted regardless of revision so a busy room cannot starve it.
 if(a.type==='MEDIA_PRELOADED'){ok(r.players.some(p=>p.id===id),'Brak sesji.');ok(Array.isArray(a.failed)&&a.failed.length<=1000&&a.failed.every(x=>typeof x==='string'&&x.length<=500),'Nieprawidłowa lista obrazków.');r.mediaPreload={...r.mediaPreload,[id]:a.failed};observe(r,now);r.rev++;r.updated=now;return r;}ok(a.rev===r.rev,'Stan gry zmienił się.');const p=r.players.find(p=>p.id===id);ok(p?.connected,'Brak sesji.');const d=r.duel,q=current(r);
 // The answering player may skip their own question; it is applied exactly like the judge's skip (−3 s, new question).
 if(a.type==='PLAYER_SKIP'){ok(d&&d.status==='running'&&d.turn===id&&a.questionKey===d.key,'Pominąć możesz tylko własne, aktywne pytanie.');return command(r,d.adminId,{type:'ANSWER',kind:'skip',questionKey:d.key,rev:r.rev},now);}
 if(a.type==='CARD'&&newCards[p.card])return playNewCard(r,id,p,now);
 if(a.type==='V11_BUY'&&a.item==='card')return buyCard(r,id,p,a.card,now);
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
 // Deal the new cards too: every regular card is redrawn from the full deck (Moja kategoria and Ostatnia szansa stay as dealt).
 if(a.type==='START'&&solo(r)){const deck=[...Object.keys(old.cards).filter(type=>type!=='homecategory'),...Object.keys(newCards)];for(const x of r.players)if(x.card&&!['homecategory','laststand'].includes(x.card))x.card=deck[randomInt(deck.length)];}
 observe(r,now);return result;
}
export function publicState(r,id,now=Date.now()){
 const s=old.publicState(r,id,now),d=r.duel,q=current(r);s.questionRulesVersion=13;s.mediaPreloaded=Array.isArray(r.mediaPreload?.[id]);delete s.mediaPreload;if(s.duel&&s.duel.prompt&&q?.footballer)s.duel.footballer=q.footballer;
 if(d&&q&&s.duel&&d.status==='running'){delete s.duel.clues;delete s.duel.v12Seen;const level=d.v12Level||0;if(q.format==='clues')s.duel.prompt=q.prompt+'\n'+q.clues.slice(0,level+1).map((x,i)=>(i+1)+'. '+x).join('\n');s.questionPanel={key:d.key,format:q.format||'standard',judge:d.adminId===id,canHint:d.adminId===id&&q.format==='clues'&&level<q.clues.length-1&&d.status==='running',canSkip:d.adminId===id&&d.status==='running'&&Number.isFinite(d.expire),reported:(r.questionReports||[]).some(x=>x.key===d.key&&x.by===id)};}
 // Only host/judge receive full reports; no answer keys included.
 s.cardTypes={...s.cardTypes,...newCards};if(solo(r)&&s.cardTypes.homecategory)s.cardTypes.homecategory={...s.cardTypes.homecategory,text:'Przed rozpoczęciem własnego pojedynku zmień jego kategorię na swoją (jeśli nie była jeszcze rozgrywana).'};const p=r.players.find(x=>x.id===id);
 if(s.duel&&d){s.duel.fog=d.fog?{target:d.fog.target}:null;s.duel.fogged=d.fog?.target===id;s.duel.freeze=d.freeze?{playerId:d.freeze.playerId,left:d.freeze.left}:null;}
 if(s.cardPanel?.visible&&newCards[p?.card]){const running=d?.status==='running',allowed=p.card==='fog'?inDuel(r,id)&&!d.fog:p.card==='freeze'?running&&d.turn===id&&!d.freeze:running&&d.ids.includes(id);s.cardPanel={...s.cardPanel,allowed,reason:{fog:'Aktywuj podczas własnego pojedynku – działa do jego końca.',freeze:'Użyj we własnej turze, gdy biegnie Twój zegar.',steal:'Użyj w trakcie własnego pojedynku.'}[p.card]};}
 if(s.economyPanel)s.economyPanel.cards=Object.entries(cardPrices).map(([type,price])=>({type,price,name:cardName(type),text:s.cardTypes[type]?.text||'',canBuy:shopOpen(r)&&!!p&&p.lives>0&&!(p.card===type&&!p.cardUsed)&&(p.walletCents||0)>=price*100})),s.economyPanel.holding=p?.card&&!p.cardUsed?p.card:null;
 s.questionReports=(r.hostId===id||d?.adminId===id)?structuredClone(r.questionReports||[]):(r.questionReports||[]).filter(x=>x.by===id).map(x=>({...x}));return s;
}
