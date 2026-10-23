import * as old from './engine-before-v11.mjs';
export * from './engine-before-v11.mjs';
import {randomInt} from 'node:crypto';
const PRICE={revive:50,laststand:35};
const pof=(r,id)=>r.players.find(p=>p.id===id);
const live=r=>r.players.filter(p=>p.lives>0);
const teams=r=>r.settings.mode==='teams';
const ok=(v,m)=>{if(!v)throw Error(m);};
const points=p=>Math.round((Number(p.points)||0)*100);
function init(r){r.economyVersion=12;r.economy=r.economy||{passed:[],winner:null,continuing:null};for(const p of r.players){p.walletCents=p.walletCents||0;p.reviveBought=!!p.reviveBought;p.winStreak=p.winStreak||0;}if(r.duel&&!r.duel.v11Start)r.duel.v11Start=Object.fromEntries(r.players.map(p=>[p.id,points(p)]));}
function before(r){return{duel:r.duel?{ids:[...r.duel.ids],category:r.duel.category,laststand:!!r.duel.laststand,start:r.duel.v11Start}:null,log:r.log?.length||0,players:Object.fromEntries(r.players.map(p=>[p.id,{points:points(p),category:p.category,lives:p.lives,streak:p.winStreak||0}])),continuing:r.economy?.continuing||null};}
function ended(r){return teams(r)?new Set(live(r).map(p=>p.team)).size<=1:live(r).length<=1;}
function returnCandidates(r){return r.players.filter(p=>p.lives===0&&!p.reviveBought&&p.walletCents>=PRICE.revive*100&&!r.economy.passed.includes(p.id));}
function finalText(r){if(teams(r))return 'Wygrywa drużyna '+(live(r)[0]?.team||'—')+'.';return 'Wygrywa '+(live(r)[0]?.name||'—')+'.';}
function finishOrReturns(r){
 if(!ended(r))return false;
 r.economy.winner=null;
 if(returnCandidates(r).length){r.phase='v11_returns';r.finishReason=null;}
 else{r.phase='finished';r.finishReason=finalText(r);}
 return true;
}
function after(r,b){
 init(r);
 // Only main-game point changes fund the wallet. Audience points are separate.
 for(const p of r.players){const delta=points(p)-(b.players[p.id]?.points??points(p));if(delta>0)p.walletCents+=delta;}
 if(!b.duel||r.duel)return;
 const entry=(r.log||[]).slice(b.log).reverse().find(x=>b.duel.ids.includes(x.winner)&&b.duel.ids.includes(x.loser));
 const loserId=entry?.loser||b.duel.ids.find(id=>pof(r,id)?.lives<(b.players[id]?.lives??0));
 const winnerId=entry?.winner||(loserId?b.duel.ids.find(id=>id!==loserId):null);
 if(!winnerId||!loserId)return;
 const w=pof(r,winnerId),l=pof(r,loserId);if(!w||!l)return;
 if(b.duel.laststand){l.lives=0;l.category=null;r.lastDecision={text:w.name+' wygrywa pojedynek Ostatniej szansy. '+l.name+' traci wszystkie życia.'};}
 l.winStreak=0;
 const streak=b.continuing===winnerId?(b.players[winnerId]?.streak||1)+1:1;
 w.winStreak=streak;
 const base=Math.max(0,points(w)-(b.duel.start?.[winnerId]??b.players[winnerId]?.points??0));
 const rate=b.continuing===winnerId?(streak>=3?0.5:0.25):0;
 const bonus=Math.round(base*rate);
 if(bonus){w.points=Math.round((points(w)+bonus))/100;w.walletCents+=bonus;}
 r.economy.lastReward={winner:winnerId,base:base/100,bonus:bonus/100,streak};
 r.economy.continuing=null;r.economy.passed=[];
 if(!teams(r)){
  // Replaces v9 capture: winner keeps their own pre-duel category.
  w.category=b.players[winnerId].category;l.category=null;
  r.pending=(r.pending||[]).filter(id=>id!==winnerId&&pof(r,id)?.lives>0);
  if(l.lives>0&&!r.pending.includes(loserId))r.pending.push(loserId);
  const held=new Set(live(r).map(p=>p.category).filter(Boolean));
  r.retired=(r.retired||[]).filter(c=>!held.has(c));
  if(!held.has(b.duel.category)&&!r.retired.includes(b.duel.category))r.retired.push(b.duel.category);
  r.categoryTransfer=null;
 }
 if(finishOrReturns(r))return;
 if(r.phase==='finished')return;
 if(!teams(r)){
  r.economy.winner=winnerId;r.economy.resumePhase=(r.pending||[]).length?'category':'choose';r.phase='v11_winner';
  r.lastDecision={text:w.name+' zachowuje kategorię '+w.category+'. Wybiera odpoczynek lub dalszą grę.'};
 }
}
export function createRoom(...args){const r=old.createRoom(...args);init(r);return r;}
export function tick(r,now=Date.now()){
 init(r);if(['v11_winner','v11_returns'].includes(r.phase))return false;
 const b=before(r),changed=old.tick(r,now);after(r,b);return changed;
}
function eligibleBuy(r,p,item){
 if(item==='revive')return !teams(r)&&p.lives===0&&!p.reviveBought&&p.walletCents>=PRICE.revive*100;
 return !teams(r)&&p.lives>0&&!p.cardUsed&&p.card!=='laststand'&&p.walletCents>=PRICE.laststand*100;
}
export function command(r,id,a,now=Date.now()){
 tick(r,now);init(r);ok(a.rev===r.rev,'Stan gry zmienił się. Spróbuj ponownie.');const p=pof(r,id);ok(p?.connected,'Brak aktywnej sesji.');
 if(a.type==='UNDO')throw Error('Cofanie jest wyłączone w v11, aby nie powielać zakupów i punktów.');
 if(a.type==='V11_CHOICE'){
  ok(r.phase==='v11_winner'&&r.economy.winner===id,'To nie jest Twój wybór.');ok(['rest','continue'].includes(a.choice),'Nieprawidłowy wybór.');
  if(a.choice==='continue'){r.challengerId=id;r.economy.continuing=id;}
  else{const candidates=r.players.filter(x=>x.lives>0&&x.connected&&x.id!==id);ok(candidates.length,'Brak innego gracza online. Możesz grać dalej.');p.winStreak=0;r.economy.continuing=null;const index=r.players.findIndex(x=>x.id===id);r.challengerId=candidates.find(x=>r.players.indexOf(x)>index)?.id||candidates[0].id;}
  r.protectedId=null;r.phase=r.economy.resumePhase;r.economy.winner=null;r.rev++;r.updated=now;return r;
 }
 if(a.type==='V11_BUY'){
  ok(!r.duel&&['choose','category','team_category','team_draft','team_nominate','v11_winner','v11_returns'].includes(r.phase),'Sklep jest dostępny między pojedynkami.');
  ok(Object.hasOwn(PRICE,a.item),'Nieznany produkt.');ok(!teams(r),'Zakupy życia i karty są wyłączone w trybie drużynowym.');ok(eligibleBuy(r,p,a.item),'Brak punktów lub niespełnione warunki zakupu.');
  if(a.item==='laststand'){p.walletCents-=PRICE.laststand*100;p.card='laststand';p.cardUsed=false;p.v11BoughtCard=true;}
  else{
   p.walletCents-=PRICE.revive*100;p.reviveBought=true;p.lives=1;p.winStreak=0;
   if(!teams(r)){p.category=null;r.pending=r.pending||[];if(!r.pending.includes(id))r.pending.push(id);}
   r.economy.passed=r.economy.passed.filter(x=>x!==id);
   if(r.phase==='v11_returns'){r.phase='category';r.finishReason=null;r.economy.winner=null;r.economy.continuing=null;r.protectedId=null;r.challengerId=live(r).find(x=>x.id!==id)?.id||id;if(teams(r))old.beginTeamRound(r);}
   else if(r.phase==='v11_winner')r.economy.resumePhase=teams(r)?r.economy.resumePhase:'category';
   else if(!teams(r))r.phase='category';
  }
  r.lastDecision={text:p.name+' kupuje '+(a.item==='revive'?'Wskrzeszenie':'kartę Ostatnia szansa')+'.'};r.rev++;r.updated=now;return r;
 }
 if(a.type==='V11_PASS_RETURN'){
  ok(r.phase==='v11_returns'&&returnCandidates(r).some(x=>x.id===id),'Nie oczekujemy Twojej decyzji o powrocie.');r.economy.passed.push(id);finishOrReturns(r);r.rev++;r.updated=now;return r;
 }
 if(a.type==='CARD'&&p.card==='laststand'){
  ok(!teams(r),'Karty są wyłączone w trybie drużynowym.');
  const d=r.duel;ok(d&&['ready','countdown'].includes(d.status)&&d.ids.includes(id)&&p.lives>0&&!p.cardUsed,'Kartę można użyć tylko podczas gotowości do własnego pojedynku.');ok(!d.laststand,'Ten pojedynek ma już aktywną Ostatnią szansę.');
  d.laststand=true;d.laststandBy=id;p.cardUsed=true;r.lastDecision={text:'OSTATNIA SZANSA: przegrany tego pojedynku straci wszystkie życia.'};r.rev++;r.updated=now;return r;
 }
 ok(!['v11_winner','v11_returns'].includes(r.phase),'Najpierw zakończ wybór lub etap powrotów.');
 const b=before(r);const result=old.command(r,id,a,now);
 if(a.type==='START'){
  init(r);for(const x of r.players){x.walletCents=0;x.reviveBought=false;x.winStreak=0;}
  r.economy={passed:[],winner:null,continuing:null};
  // One participant receives the new card instead of the original random card.
  const choices=live(r).filter(x=>x.card!=='homecategory');if(choices.length&&!teams(r)){const x=choices[randomInt(choices.length)];x.card='laststand';x.cardUsed=false;}
  return result;
 }
 if(a.type==='REMATCH'){r.economyVersion=12;r.economy={passed:[],winner:null,continuing:null};for(const x of r.players){x.walletCents=0;x.reviveBought=false;x.winStreak=0;}return result;}
 if(a.type==='UNDO')return result;
 after(r,b);return result;
}
export function publicState(r,id,now=Date.now()){
 const s=old.publicState(r,id,now),p=pof(r,id);s.economyVersion=12;s.canUndo=false;
 s.cardTypes={...s.cardTypes,laststand:{name:'Ostatnia szansa',text:'Jednorazowo, przed pierwszym pytaniem: przegrany traci wszystkie życia. Ostrzeżenie jest jawne dla obu zawodników.'}};
 if(s.duel&&r.duel?.laststand)s.duel.laststand=true;
 if(!teams(r)&&p?.card==='laststand'&&s.cardPanel){s.cardPanel={...s.cardPanel,visible:!p.cardUsed&&r.phase!=='finished',type:'laststand',allowed:!!r.duel&&['ready','countdown'].includes(r.duel.status)&&r.duel.ids.includes(id)&&!r.duel.laststand,reason:'Aktywuj podczas gotowości do własnego pojedynku, przed pierwszym pytaniem.'};}
 const shopPhase=!teams(r)&&!r.duel&&['choose','category','team_category','team_draft','team_nominate','v11_winner','v11_returns'].includes(r.phase);
 s.economyPanel={wallet:(p?.walletCents||0)/100,prices:PRICE,shopOpen:shopPhase,canRevive:shopPhase&&!!p&&eligibleBuy(r,p,'revive'),canBuyCard:shopPhase&&!!p&&eligibleBuy(r,p,'laststand'),reviveBought:!!p?.reviveBought,phase:r.phase,winner:r.economy?.winner||null,canChoose:r.phase==='v11_winner'&&r.economy?.winner===id,canPass:r.phase==='v11_returns'&&returnCandidates(r).some(x=>x.id===id),waitingFor:r.phase==='v11_returns'?returnCandidates(r).map(x=>({id:x.id,name:x.name})):[],lastReward:r.economy?.lastReward||null};
 return s;
}
