(()=>{
 'use strict';
 const Native=window.EventSource;
 let state=null,busy=false,error='',root=null,online=false;
 const css=document.createElement('style');
 css.textContent=`#team-v19{position:fixed;inset:0;z-index:5000;overflow:auto;background:radial-gradient(ellipse at top,#1a3858,#090f1d 75%);color:#eef5ff;padding:24px;font:15px system-ui}#team-v19 *{box-sizing:border-box}#team-v19 .v19-wrap{max-width:1050px;margin:auto;padding-bottom:50px}#team-v19 h1{font-size:clamp(28px,4vw,48px)}#team-v19 h2{font-size:24px}#team-v19 p{line-height:1.6;color:#b1c5e0}#team-v19 .v19-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}#team-v19 .v19-card{padding:18px;border:1px solid #4b668b;border-radius:16px;background:#142238;margin:12px 0}#team-v19 button,#team-v19 select{font:inherit;color:#fff;background:#22466b;border:1px solid #6d92b9;border-radius:10px;padding:12px;min-height:44px;margin:4px;cursor:pointer}#team-v19 button:disabled{opacity:.45;cursor:not-allowed}#team-v19 button:focus-visible,#team-v19 select:focus-visible{outline:3px solid #67e8f9}#team-v19 .v19-primary{background:#087c96;border-color:#67e8f9}#team-v19 .v19-error{color:#ffb6bf}#team-v19 .v19-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}#team-v19 .v19-player{padding:10px;border-bottom:1px solid #3c5274}#team-v19 .v19-turn{border-color:#67e8f9;box-shadow:0 0 16px #22d3ee44}#team-v19 label{display:inline-flex;gap:8px;align-items:center;margin:8px 12px 8px 0}#team-v19 select{margin:0;background:#0d1a2c}body.team-v19-active #arena-v7{visibility:hidden!important}body.team-v19-active #v10-card{z-index:6000!important}@media(max-width:720px){#team-v19{padding:14px}#team-v19 .v19-card{padding:14px}}`;
 document.head.append(css);
 const theme=document.createElement('style');
 theme.textContent=`#team-v19{background:var(--color-bg);color:var(--color-text)}#team-v19 p{color:var(--color-muted)}#team-v19 .v19-card{border-color:var(--color-border);background:var(--color-panel);color:var(--color-text)}#team-v19 button,#team-v19 select{color:var(--color-text);background:var(--color-panel-raised,var(--color-panel));border-color:var(--color-border)}#team-v19 button:focus-visible,#team-v19 select:focus-visible{outline-color:var(--color-accent)}#team-v19 .v19-primary{color:#fff;background:var(--color-accent);border-color:var(--color-accent)}#team-v19 .v19-player{border-color:var(--color-border)}#team-v19 .v19-turn{border-color:var(--color-accent);box-shadow:0 0 16px color-mix(in srgb,var(--color-accent) 28%,transparent)}#team-v19 .v19-team-A{--team-color:var(--color-accent)}#team-v19 .v19-team-B{--team-color:var(--color-magenta)}#team-v19 .v19-team-A.v19-card,#team-v19 .v19-team-B.v19-card{border-color:var(--team-color)}#team-v19 .v19-team-A.v19-turn,#team-v19 .v19-team-B.v19-turn{box-shadow:0 0 18px color-mix(in srgb,var(--team-color) 30%,transparent)}#team-v19 .v19-choice{border-color:var(--team-color);color:var(--team-color)}#team-v19 .v19-choice:hover:not(:disabled){background:var(--team-color);color:#fff}body.team-v19-active #v10-card,body.team-v19-active #v10-card-reopen,body.v10-team-mode #v10-card,body.v10-team-mode #v10-card-reopen{display:none!important}`;
 document.head.append(theme);
 const nominationStyle=document.createElement('style');
 nominationStyle.textContent=`#team-v19 .v19-team-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--team-color) 10%,var(--color-panel));border:1px solid color-mix(in srgb,var(--team-color) 45%,var(--color-border))}#team-v19 .v19-team-summary strong{color:var(--team-color);white-space:nowrap}#team-v19 .v19-last-player{font-size:14px}#team-v19 .v19-last-player strong{color:var(--color-text)}#team-v19 .v19-choice{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:min(100%,190px);text-align:left}#team-v19 .v19-choice-name{font-weight:750}#team-v19 .v19-choice-stats{font-size:12px;opacity:.85}#team-v19 .v19-no-candidates{font-weight:650;color:var(--color-muted)}`;
 document.head.append(nominationStyle);
 const el=(tag,text,parent,cls)=>{const node=document.createElement(tag);if(text!==null)node.textContent=text;if(cls)node.className=cls;if(parent)parent.append(node);return node;};
 const who=id=>state?.players.find(p=>p.id===id)?.name||'Gracz';
 function button(parent,text,enabled,action,data={}){const b=el('button',text,parent);b.disabled=busy||!online||!enabled;b.onclick=()=>send(action,data);return b;}
 async function send(type,data={}){
  if(busy||!state)return;
  let session;try{session=JSON.parse(sessionStorage.getItem('arena-v6')||'null')}catch{}
  if(!session?.token){error='Brak aktywnej sesji.';render();return;}
  busy=true;error='';render();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch((session.base||'')+'/api/rooms/'+state.code+'/action',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify({type,rev:state.rev,...data}),signal:controller.signal});
   const result=await response.json();if(result.state)receive(result.state);if(!response.ok)throw Error(result.error||'Serwer odrzucił polecenie.');
  }catch(e){error=e.name==='AbortError'?'Serwer nie odpowiedział.':e.message;}
  finally{clearTimeout(timer);busy=false;render();}
 }
 function render(){
  const teamScreen=state?.settings.mode==='teams'&&['lobby','team_draft','team_category','team_nominate'].includes(state.phase);
  if(!teamScreen){document.body.classList.remove('team-v19-active');root?.remove();root=null;return;}
  document.body.classList.add('team-v19-active');
  if(!root){root=el('main',null,document.body);root.id='team-v19';}
  root.replaceChildren();
  const wrap=el('div',null,root,'v19-wrap'),me=state.players.find(p=>p.id===state.you),r=state.roundControl;
  el('p',`PIXEL ARENA · DRUŻYNY · LOBBY ${state.code}`,wrap);
  if(!online)el('p','Brak synchronizacji. Sterowanie jest zablokowane.',wrap,'v19-error');
  if(error)el('p',error,wrap,'v19-error');
  if(state.phase==='lobby'){
   el('h1','Losowanie kapitanów i wybór drużyn',wrap);
   el('p','Po starcie zostanie wylosowanych dwóch kapitanów. Będą na zmianę dobierać graczy do swoich drużyn.',wrap);
   const roster=el('section',null,wrap,'v19-card');
   el('h2',`Gracze · ${state.players.length}`,roster);
   state.players.forEach(p=>el('div',`${p.name}${p.id===me.id?' · TY':''} · ${p.connected?'online':'offline'} · ${p.ready?'gotowy':'niegotowy'}`,roster,'v19-player'));
   el('p',`${state.players.filter(p=>p.ready&&p.connected).length}/${state.players.length} gotowych. Minimum 4 osoby.`,wrap);
   button(wrap,me.ready?'Cofnij gotowość':'Gotowy do drużyn',true, 'READY');
   if(state.hostId===me.id){
    const settings=el('div',null,wrap,'v19-row');
    const timeLabel=el('label','Czas na zawodnika',settings),time=el('select',null,timeLabel);[30,45,60,90].forEach(n=>{const option=el('option',`${n} s`,time);option.value=n;});time.value=state.settings.seconds||45;time.disabled=busy||!online;time.onchange=()=>send('SETTINGS',{seconds:Number(time.value)});
    button(settings,'Rozpocznij losowanie',state.players.length>=4&&state.players.every(p=>p.connected&&p.ready),'START',{});
    button(settings,'Wróć do trybu solo',true,'MODE',{mode:'solo'});
    state.players.filter(p=>!p.connected).forEach(p=>button(settings,`Usuń ${p.name}`,true,'REMOVE_OFFLINE',{playerId:p.id}));
   }
   return;
  }
  if(state.phase==='team_draft'){
   el('h1','Dobór drużyn',wrap);
   el('p',`Kapitan ${who(r.captains[r.draftTurn])} wybiera teraz zawodnika. Po wyborze kolej przechodzi do drugiego kapitana.`,wrap,'v19-card v19-turn');
   const teams=el('div',null,wrap,'v19-grid');
   for(const team of ['A','B']){
    const box=el('section',null,teams,`v19-card v19-team-${team}${r.draftTurn===team?' v19-turn':''}`);
    el('h2',`Drużyna ${team}`,box);
    el('p',`Kapitan: ${who(r.captains[team])}`,box);
    (r.draftTeams?.[team]||[]).forEach(id=>el('div',who(id),box,'v19-player'));
   }
   const picker=r.captains[r.draftTurn];
   const choices=el('section',null,wrap,'v19-card');el('h2','Dostępni gracze',choices);
   if(me.id===picker){(r.draftCandidates||[]).forEach(id=>{const b=button(choices,who(id),true,'DRAFT_PICK',{playerId:id});b.classList.add('v19-choice',`v19-team-${picker}`);});}
   else el('p',`Teraz wybiera kapitan ${who(picker)}.`,choices);
   return;
  }
  if(state.phase==='team_nominate'){
   el('h1',`Runda ${r.number} · ${r.category}`,wrap);
   el('p','Kategoria jest losowana z puli nierozgrywanych kategorii. Kapitanowie wybierają po jednym zawodniku do pojedynku.',wrap);
   const teams=el('div',null,wrap,'v19-grid');
   for(const team of ['A','B']){
    const box=el('section',null,teams,`v19-card v19-team-${team}${me.id===r.captains[team]?' v19-turn':''}`);
    el('h2',`Drużyna ${team}`,box);
    el('p',`Kapitan: ${who(r.captains[team])}`,box);
    const summary=el('div',null,box,'v19-team-summary');
    el('span','Punkty drużyny',summary);
    el('strong',`${r.teamPoints?.[team]??0} pkt`,summary);
    const last=r.lastNominees?.[team];
    el('p',last?`Ostatnio wystawiony: ${who(last)}`:'Ostatnio wystawiony: jeszcze nikt',box,'v19-last-player');
    el('p',r.nominees[team]?`Do pojedynku: ${who(r.nominees[team])}`:'Wybierz zawodnika do pojedynku.',box);
    const candidates=r.candidates[team]||[];
    candidates.forEach(id=>{const stats=r.playerStats?.[id]||{wins:0,losses:0,winRate:0};const b=button(box,null,me.id===r.captains[team],'NOMINATE',{playerId:id});b.classList.add('v19-choice',`v19-team-${team}`);el('span',who(id),b,'v19-choice-name');el('span',`${stats.wins} wygr. · ${stats.losses} przegr. (${stats.winRate}%)`,b,'v19-choice-stats');});
    if(!candidates.length&&!r.nominees[team])el('p',last?'Ostatnio wystawiony zawodnik jest wyłączony. Czekaj na dostępnego gracza drużyny.':'Brak dostępnych graczy online.','v19-no-candidates',box);
   }
   if(r.recap)el('p',`Poprzedni pojedynek: ${who(r.recap.winner)} pokonał ${who(r.recap.loser)}.`,wrap,'v19-card');
   return;
  }
  el('h1','Przygotowanie rundy drużynowej',wrap);
  el('p',`Kolejna kategoria: ${r.category||'zostanie wylosowana'}.`,wrap);
 }
 function receive(next){
  if(next?.extensionVersion!==7)return;
  if(state&&next.code===state.code&&(next.rev<state.rev||next.rev===state.rev&&next.serverNow<state.serverNow))return;
  state=next;online=true;render();
 }
 window.EventSource=class extends Native{
  constructor(...args){super(...args);super.addEventListener('open',()=>{online=true;render();});super.addEventListener('error',()=>{online=false;render();});super.addEventListener('message',event=>{try{receive(JSON.parse(event.data));}catch{}});}
 };
})();
