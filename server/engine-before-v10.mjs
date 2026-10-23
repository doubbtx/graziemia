import * as core from './engine-v6-core.mjs';
import {bank} from './bank.mjs';
import {randomInt,randomUUID} from 'node:crypto';
export const categories=core.categories;
export const cards=core.cards;
export const available=core.available;
export const eligible=core.eligible;
const ok=(v,m)=>{if(!v)throw Error(m)};
export const normalize=s=>String(s).normalize('NFD').replace(/\p{M}/gu,'').replace(/ł/g,'l').replace(/Ł/g,'L').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function matches(text,q){const variants=q.aliases||[q.answer??q[1]];return variants.some(v=>normalize(v)===normalize(text))||(!q.aliases&&String(q.answer??q[1]).split('/').some(v=>normalize(v)===normalize(text)));}
const team=r=>r.settings.mode==='teams';
const current=r=>r.duel&&r.duel.index>=0?bank[r.duel.category]?.[r.duel.index]:null;
const activeTeam=r=>r.round%2?'B':'A';
const captain=(r,t)=>{const selected=r.teamDraft?.captains?.[t];return r.players.find(p=>p.id===selected&&p.lives>0&&p.connected)?.id||r.players.find(p=>p.team===t&&p.lives>0&&p.connected)?.id||selected||null;};
export function nominees(r,t){const last=r.teamLastNominees?.[t];return r.players.filter(p=>p.team===t&&p.connected&&p.id!==last);}
const free=r=>Object.keys(bank).filter(c=>bank[c]?.length&&!r.retired.includes(c));
function roundPhase(r){r.pending=[];r.protectedId=null;r.nominees={};if(!['A','B'].every(team=>r.players.some(p=>p.team===team&&p.connected))){r.phase='finished';r.finishReason='Obie drużyny muszą mieć co najmniej jednego połączonego gracza.';return;}const categories=free(r);if(!categories.length){r.phase='finished';const scores=['A','B'].map(t=>({t,p:r.players.filter(p=>p.team===t).reduce((n,p)=>n+p.points,0)}));r.finishReason=scores[0].p===scores[1].p?'Remis drużyn po wyczerpaniu kategorii.':'Wygrywa drużyna '+(scores[0].p>scores[1].p?'A':'B')+' punktami po wyczerpaniu kategorii.';return;}r.roundCategory=categories[randomInt(categories.length)];r.phase='team_nominate';}
export function beginTeamRound(r){if(team(r))roundPhase(r);}
function startDraft(r){const shuffled=[...r.players];for(let i=shuffled.length-1;i>0;i--){const j=randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}const captains={A:shuffled[0].id,B:shuffled[1].id};r.players.forEach(p=>{p.team=null;p.category=null;p.homeCategory=null;p.card=null;p.cardUsed=true;p.armed=null;p.lives=3;});r.players.find(p=>p.id===captains.A).team='A';r.players.find(p=>p.id===captains.B).team='B';const first=randomInt(2)?'A':'B';r.teamDraft={captains,turnTeam:first};r.teamLastNominees={A:null,B:null};r.nominees={};r.roundCategory=null;r.challengerId=null;r.phase='team_draft';}
export function createRoom(...args){const r=core.createRoom(...args);r.extensionVersion=7;r.audiencePrivate={};return r;}
export const addPlayer=core.addPlayer;
function snapshot(r){return {key:r.duel?.key,q:current(r),ids:r.duel?.ids,admin:r.duel?.adminId,round:r.round,duel:!!r.duel,lives:Object.fromEntries(r.players.map(player=>[player.id,player.lives]))};}
function settleAudience(r,before,afterKey){if(!before.key||before.key===afterKey||!before.q)return;const bets=r.audiencePrivate?.[before.key]||{};for(const[id,text]of Object.entries(bets)){const p=r.players.find(p=>p.id===id);if(!p||before.ids.includes(id)||id===before.admin)continue;if(matches(text,before.q)){p.audienceRound=p.audienceRound||{};const k=String(before.round);if((p.audienceRound[k]||0)<5){p.audienceRound[k]=(p.audienceRound[k]||0)+1;p.audienceTenths=(p.audienceTenths||0)+1;p.audienceFeedback='Trafienie! +0,1 pkt widza';}else p.audienceFeedback='Trafienie, ale limit 0,5 pkt na pojedynek został osiągnięty.';}else p.audienceFeedback='Tym razem bez punktu. Sprawdź poprzednią odpowiedź.';}if(r.audiencePrivate)delete r.audiencePrivate[before.key];}
function reconcile(r,before){settleAudience(r,before,r.duel?.key);if(team(r)&&before.duel&&!r.duel){r.players.forEach(player=>{player.lives=before.lives[player.id]??player.lives;player.category=null;});const played=Object.fromEntries(before.ids.map(id=>[r.players.find(player=>player.id===id)?.team,id]).filter(([team])=>team));r.teamLastNominees={...(r.teamLastNominees||{}),...played};const entry=r.log?.at(-1);if(entry)delete entry.livesLeft;const winner=r.players.find(player=>player.id===entry?.winner);r.lastDecision={text:(winner?.name||'Drużyna')+' wygrywa pojedynek drużynowy.'};r.roundRecap=entry||null;roundPhase(r);}}
export function tick(r,now=Date.now()){const b=snapshot(r),changed=core.tick(r,now);reconcile(r,b);return changed;}
export function setConnected(r,id,value,now=Date.now()){tick(r,now);core.setConnected(r,id,value,now);}
export function command(r,id,a,now=Date.now()){
 tick(r,now);ok(a.rev===r.rev,'Stan zmienił się. Spróbuj ponownie.');const p=r.players.find(p=>p.id===id);ok(p?.connected,'Brak aktywnej sesji.');const b=snapshot(r);
 if(a.type==='AUDIENCE_ANSWER'){
  ok(!team(r),'Liga oczekujących jest wyłączona w trybie drużynowym.');
  const d=r.duel;ok(d?.status==='running'&&a.questionKey===d.key,'To pytanie jest już zamknięte.');ok(!d.ids.includes(id)&&d.adminId!==id,'Zawodnicy i sędzia nie typują.');ok(typeof a.text==='string'&&a.text.trim()&&a.text.length<=160,'Odpowiedź: 1–160 znaków.');r.audiencePrivate=r.audiencePrivate||{};const bets=r.audiencePrivate[d.key]||{};ok(!(id in bets),'Masz już zapisany typ na to pytanie.');bets[id]=a.text.trim();r.audiencePrivate[d.key]=bets;r.rev++;r.updated=now;return r;
 }
 if(team(r)&&a.type==='DRAFT_PICK'){
  const draft=r.teamDraft;ok(r.phase==='team_draft'&&draft,'Teraz nie trwa dobór drużyn.');const pickingTeam=draft.turnTeam;ok(id===captain(r,pickingTeam),'Teraz wybiera kapitan drużyny '+pickingTeam+'.');const chosen=r.players.find(x=>x.id===a.playerId&&x.team===null&&x.connected);ok(chosen,'Wybierz dostępnego gracza.');chosen.team=pickingTeam;const remaining=r.players.some(x=>x.team===null);if(remaining)draft.turnTeam=pickingTeam==='A'?'B':'A';else{draft.turnTeam=null;roundPhase(r);}r.rev++;r.updated=now;return r;
 }
 if(a.type==='CARD'&&team(r))throw Error('Karty są wyłączone w trybie drużynowym.');
 if(a.type==='CARD'&&p?.card==='homecategory'){
  const d=r.duel,homeCategory=team(r)?p.homeCategory:p.category;ok(d?.status==='ready'&&d.ids.includes(id)&&p.lives>0&&!p.cardUsed&&homeCategory&&!r.retired.includes(homeCategory),'Kartę można użyć przed własnym pojedynkiem, jeśli kategoria nie była jeszcze rozgrywana.');const previousCategory=d.category,previousIndex=d.index;if(previousCategory!==homeCategory){const previousUsed=r.used[previousCategory]||[];r.used[previousCategory]=previousUsed.filter(index=>index!==previousIndex);d.category=homeCategory;let used=r.used[d.category]||[];const questions=bank[d.category];if(used.length>=questions.length){used=[];d.cycle++;}const availableIndexes=questions.map((_,index)=>index).filter(index=>!used.includes(index));ok(availableIndexes.length,'Wszystkie pytania z tej kategorii zostały już wykorzystane.');d.index=availableIndexes[randomInt(availableIndexes.length)];used.push(d.index);r.used[d.category]=used;d.key=randomUUID();d.hints={};d.mediaReady=[];}if(team(r))r.roundCategory=d.category;p.cardUsed=true;r.lastDecision={text:p.name+' używa karty „Moja kategoria”. Pojedynek odbędzie się w kategorii '+d.category+'.'};r.rev++;r.updated=now;return r;
 }
 if(team(r)&&a.type==='ROUND_CATEGORY'){
  ok(r.phase==='team_category','Teraz nie wybieramy kategorii.');ok(id===captain(r,activeTeam(r)),'Kategorię wybiera kapitan wskazanej drużyny.');ok(free(r).includes(a.category),'Kategoria jest rozegrana lub niedostępna.');r.roundCategory=a.category;r.nominees={};r.phase='team_nominate';r.rev++;r.updated=now;return r;
 }
 if(team(r)&&a.type==='NOMINATE'){
  ok(r.phase==='team_nominate','Teraz nie nominujemy.');ok(id===captain(r,p.team),'Nominację zatwierdza kapitan drużyny.');ok(nominees(r,p.team).some(x=>x.id===a.playerId),'Nie możesz ponownie wystawić ostatniego zawodnika ani wybrać osoby offline.');
  const selected={...r.nominees,[p.team]:a.playerId};
  if(selected.A&&selected.B){
   ok(['A','B'].every(t=>nominees(r,t).some(x=>x.id===selected[t])),'Skład się zmienił albo wybrano ostatnio wystawionego zawodnika. Wybierz ponownie.');
   const clone=structuredClone(r);clone.nominees=selected;clone.phase='choose';clone.challengerId=selected.A;clone.protectedId=null;const target=clone.players.find(x=>x.id===selected.B),targetCategory=target.category;target.category=r.roundCategory;
   core.command(clone,selected.A,{type:'CHALLENGE',rev:clone.rev,opponent:selected.B},now);
   target.category=targetCategory;clone.players.forEach(player=>{if(player.homeCategory&&player.lives>0)player.category=player.homeCategory;});clone.duel.turn=r.round%2?selected.B:selected.A;Object.assign(r,clone);return r;
  }
  r.nominees=selected;r.rev++;r.updated=now;return r;
 }
 if(team(r)&&['CHALLENGE','REPLACE_CHOOSER'].includes(a.type))throw Error('W drużynach najpierw wybierz kategorię i nominuj zawodników.');
 core.command(r,id,a,now);
 if(a.type==='UNDO'){r.audiencePrivate={};if(team(r)&&!r.duel&&['choose','category'].includes(r.phase))roundPhase(r);return r;}
 if(a.type==='REMATCH'){r.extensionVersion=7;r.audiencePrivate={};}
 if(team(r)&&a.type==='START')startDraft(r);
 if(team(r)&&a.type==='REMATCH'){r.teamDraft=null;r.players.forEach(player=>{player.team=null;player.homeCategory=null;});}
 reconcile(r,b);return r;
}
export function publicState(r,id,now=Date.now()){
 const copy=structuredClone(r);delete copy.audiencePrivate;copy.players.forEach(p=>{delete p.audienceRound;if(p.id!==id)delete p.audienceFeedback;});const s=core.publicState(copy,id,now);if(team(r)){s.players.forEach(player=>{player.lives=3;});s.log.forEach(entry=>delete entry.livesLeft);}
 const d=r.duel;const mine=d&&r.audiencePrivate?.[d.key]?.[id];s.extensionVersion=7;s.audience={eligible:!!d&&d.status==='running'&&!d.ids.includes(id)&&d.adminId!==id,submitted:mine!==undefined,myText:mine||'',points:(r.players.find(p=>p.id===id)?.audienceTenths||0)/10,feedback:r.players.find(p=>p.id===id)?.audienceFeedback||null,ranking:r.players.map(p=>({id:p.id,name:p.name,points:(p.audienceTenths||0)/10})).sort((a,b)=>b.points-a.points)};
 if(team(r)){const playerStats=Object.fromEntries(r.players.map(player=>{const wins=(r.log||[]).filter(entry=>entry.winner===player.id).length,losses=(r.log||[]).filter(entry=>entry.loser===player.id).length,total=wins+losses;return[player.id,{wins,losses,winRate:total?Math.round(wins/total*100):0}]}));s.roundControl={number:r.round+1,category:r.roundCategory||null,choosingTeam:activeTeam(r),captains:{A:captain(r,'A'),B:captain(r,'B')},nominees:r.nominees||{},candidates:{A:nominees(r,'A').map(p=>p.id),B:nominees(r,'B').map(p=>p.id)},teamPoints:Object.fromEntries(['A','B'].map(t=>[t,r.players.filter(p=>p.team===t).reduce((sum,player)=>sum+player.points,0)])),lastNominees:r.teamLastNominees||{A:null,B:null},playerStats,draftTurn:r.teamDraft?.turnTeam||null,draftCandidates:r.teamDraft?r.players.filter(p=>p.team===null&&p.connected).map(p=>p.id):[],draftTeams:r.teamDraft?Object.fromEntries(['A','B'].map(t=>[t,r.players.filter(p=>p.team===t).map(player=>player.id)])):null,categories:free(r),recap:r.roundRecap||null};}
 if(team(r))delete s.audience;
 return s;
}
