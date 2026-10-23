(()=>{'use strict';
const norm=s=>(s||'').replace(/<br\s*\/?\s*>/gi,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase('pl');
const snippets=[
'3 ŻYCIA · KARTY SPECJALNE · POJEDYNKI ONLINE',
'NOWE KATEGORIE. TWOJE ZASADY.',
'Wiedza to przewaga. Karta zmienia grę.',
'Wiedza to przewaga.', 'Karta zmienia grę.',
'Trzy życia, jedna karta na osobę i odpowiedź po każdym pytaniu. Przegrany sam wybiera nową kategorię. Wiedza ogólna wraca do poziomu łatwego i średniego.',
'Podgląd wymaga uruchomionego backendu v6. Muzyka pojawi się po dodaniu własnych lub licencjonowanych nagrań. Sama strona nie uruchamia serwera ani ngrok.'
].map(norm);
const ruleNames=['zasady','zasady gry','zasady rozgrywki','jak grać','jak grać?','pokaż zasady'].map(norm);
const protectedArea=e=>!!e.closest('.question,.quiz-question,[data-question],.judge-actions,[role="alert"],.error,input,textarea,select,option');
const hide=e=>{if(e&&!e.classList.contains('pz15-hidden'))e.classList.add('pz15-hidden');};
let queued=false;
function run(){queued=false;
const roots=[...document.querySelectorAll('.av5,#arena-v7,#v11-ui')];if(!roots.length)return;
for(const root of roots){
 for(const e of root.querySelectorAll('p,h1,h2,h3,h4,small,span,strong,div,label,button,summary,a')){
  if(protectedArea(e))continue;
  const clone=e.cloneNode(true);for(const br of clone.querySelectorAll('br'))br.replaceWith(document.createTextNode(' '));const t=norm(clone.textContent);
  if(snippets.includes(t)&&!e.querySelector('input,textarea,select,button,a'))hide(e);
  if(ruleNames.includes(t)){
   if(e.matches('button,a,summary')){hide(e);if(e.tagName==='SUMMARY')hide(e.closest('details'));continue;}
   if(e.matches('h1,h2,h3,h4,strong')){
    const box=e.closest('section,article,details,.card,.rules,.rules-panel');
    if(box&&box!==root&&!box.querySelector('input,textarea,select,.question,.judge-actions'))hide(box);else hide(e);
   }
  }
  if(t==='adres backendu'){
   if(!e.querySelector('input,textarea,select,button'))hide(e);
   else if(e.matches('label')){const inputs=e.querySelectorAll('input');if(inputs.length===1&&!e.querySelector('select,textarea,button'))hide(e);}
  }
 }
 for(const input of root.querySelectorAll('input')){
  if(protectedArea(input.parentElement)&&input.closest('.question'))continue;
  const desc=[input.placeholder,input.getAttribute('aria-label'),input.name,input.id].join(' ');
  const label=input.closest('label');
  const linked=input.id?[...root.querySelectorAll('label')].find(l=>l.htmlFor===input.id):null;
  if(/adres\s+backendu|backend(?:url|address)/i.test(desc)||norm(label?.textContent)==='adres backendu'||norm(linked?.textContent)==='adres backendu'){
   hide(input);if(label&&label.querySelectorAll('input,select,textarea').length===1)hide(label);if(linked)hide(linked);
  }
 }
}
// Hide the technical toggle created by v14; preserve stored address and connection logic.
hide(document.getElementById('pz14-settings'));
}
function start(){const style=document.createElement('style');style.textContent='.pz15-hidden{display:none!important}';document.head.append(style);run();new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(run);}}).observe(document.body,{childList:true,subtree:true,characterData:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();