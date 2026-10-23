// Wrap the installed v9 API; do not replace the user's question bank.
import * as previous from './engine-before-v10.mjs';
export * from './engine-before-v10.mjs';
const preparation=d=>d&&['ready','countdown'].includes(d.status);
const hints=['letter','length'];
const player=(r,id)=>r.players.find(p=>p.id===id);
function sameDuel(d,q){return d&&d.ids?.includes(q.id)&&d.category===q.category&&d.ids.join('|')===q.ids;}
function flush(r,now){
 const queue=r.v10Queue||{};
 for(const[id,q]of Object.entries(queue)){
  const p=player(r,id),d=r.duel;
  if(!sameDuel(d,q)||r.phase==='finished'){delete queue[id];r.rev++;r.updated=now;continue;}
  if(!p||p.cardUsed||p.lives<=0){delete queue[id];continue;}
  if(d.status!=='running'||d.turn!==id)continue;
  delete queue[id];
  try{previous.command(r,id,{type:'CARD',rev:r.rev,questionKey:d.key},now);p.cardUsed=true;p.v10CardNotice='Karta dodatkowego czasu została zastosowana.';}
  catch(e){p.v10CardNotice='Nie zastosowano karty: '+e.message+'. Karta pozostaje dostępna.';}
  r.rev++;r.updated=now;
 }
}
export function createRoom(...args){const r=previous.createRoom(...args);r.cardRulesVersion=11;r.v10Queue={};return r;}
export function tick(r,now=Date.now()){const rev=r.rev,result=previous.tick(r,now);flush(r,now);return result||r.rev!==rev;}
export function command(r,id,a,now=Date.now()){
 tick(r,now);
 if(a.rev!==r.rev)throw Error('Stan gry się zmienił. Spróbuj ponownie.');
 const p=player(r,id);
 if(a.type==='CARD'){
  if(!p?.connected)throw Error('Brak aktywnej sesji.');
  if(p.cardUsed||r.v10Queue?.[id])throw Error('Ta karta została już użyta lub aktywowana.');
  const d=r.duel;
  if(preparation(d)&&d.ids?.includes(id)&&p.lives>0){
   if(hints.includes(p.card)){
    d.roundHints=d.roundHints||{};d.roundHints[id]=p.card;p.cardUsed=true;p.v10CardNotice='Podpowiedź aktywna na cały nadchodzący pojedynek.';r.lastDecision={text:p.name+' używa karty: '+(previous.cards[p.card]?.name||p.card)+'.'};r.rev++;r.updated=now;return r;
   }
   if(p.card==='time'){
    r.v10Queue=r.v10Queue||{};r.v10Queue[id]={id,category:d.category,ids:d.ids.join('|')};p.v10CardNotice='Karta czasu aktywowana. Efekt zostanie naliczony przy pierwszej własnej turze.';r.lastDecision={text:p.name+' aktywuje kartę: '+(previous.cards[p.card]?.name||p.card)+'.'};r.rev++;r.updated=now;return r;
   }
   if(p.card==='skip5'){
    d.skip5={playerId:id,remaining:5};p.cardUsed=true;p.v10CardNotice='Masz 5 bezpłatnych pominięć w tym pojedynku.';r.lastDecision={text:p.name+' aktywuje pięć bezpłatnych pominięć.'};r.rev++;r.updated=now;return r;
   }
  }
  const result=previous.command(r,id,a,now);
  // Swap is also a single-use card. The replacement is not another usable card.
  const current=player(r,id);if(current)current.cardUsed=true;
  return result;
 }
 const result=previous.command(r,id,a,now);if(a.type==='REMATCH'){r.cardRulesVersion=11;r.v10Queue={};}flush(r,now);return result;
}
export function publicState(r,id,now=Date.now()){
 const s=previous.publicState(r,id,now),p=player(r,id),d=r.duel;
 s.cardRulesVersion=11;
 const pending=!!r.v10Queue?.[id];
 const visible=r.settings.mode!=='teams'&&!!p?.card&&!p.cardUsed&&!pending&&r.phase!=='finished';
 const preparing=preparation(d)&&d.ids?.includes(id)&&p?.lives>0;
 const running=d?.status==='running'&&d.turn===id;
 const between=!d&&['choose','category','team_category','team_nominate'].includes(r.phase);
 let allowed=false,reason='Karta niedostępna w tej fazie.';
 if(visible){
  if(p.card==='homecategory'){allowed=r.settings.mode!=='teams'&&d?.status==='ready'&&preparing;reason='Moja kategoria: aktywuj przed rozpoczęciem własnego pojedynku.';}
  else if(hints.includes(p.card)||p.card==='time'){allowed=!!preparing||!!running;reason='Użyj podczas gotowości do własnego pojedynku albo we własnej turze.';}
  else if(p.card==='skip5'){allowed=!!preparing;reason='Aktywuj przed rozpoczęciem własnego pojedynku.';}
  else if(p.card==='heal'){allowed=between&&p.lives>0&&p.lives<3;reason='Apteczka: między pojedynkami, gdy masz 1 lub 2 życia.';}
  else if(p.card==='revive'){allowed=between;reason='Wskrzeszenie: między pojedynkami, przed zakończeniem gry.';}
  else{allowed=!!running||between;reason='Efekt i dostępność sprawdza serwer według zasad danej karty.';}
 }
 s.cardPanel={visible,type:p?.card||null,allowed,reason,notice:p?.v10CardNotice||null,preparing:!!preparing,oneUse:true};
 // Do not leak other players' private status messages.
 for(const x of s.players||[]){delete x.v10CardNotice;if(r.v10Queue?.[x.id])x.cardUsed=true;}
 return s;
}
