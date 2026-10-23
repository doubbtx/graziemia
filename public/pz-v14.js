(()=>{
'use strict';
let pending=false,advanced=false;
const norm=s=>(s||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('pl');
const fullscreen=/^(?:⛶\s*)?(?:pełny ekran|tryb pełnoekranowy|fullscreen)(?:\s*⛶)?$/i;
const backend=/(?:adres\s+(?:serwera\s+)?backendu|backend(?:\s*(?:url|address))?|url\s+backendu)/i;
const technical=/^(?:adres backendu|backend url|konfiguracja połączenia|ustawienia połączenia|ustawienia techniczne)/i;
function mark(el,cls){if(el&&!el.classList.contains(cls))el.classList.add(cls);}
function text(el,value){if(el.textContent!==value)el.textContent=value;}
function ownText(el){return [...el.childNodes].filter(x=>x.nodeType===Node.TEXT_NODE).map(x=>x.nodeValue).join(' ');}
function update(){
 pending=false;const app=document.querySelector('.av5');if(!app)return;
 document.body.classList.add('pz-v14');
 // Never alter question content, game overlays, storage keys or network settings.
 const safe=el=>!el.closest('.question,.judge-actions,#v10-card,#v11-ui,#q12,#arena-v7');
 const buttons=[...app.querySelectorAll('button')];
 for(const b of buttons){if(safe(b)&&fullscreen.test(norm(b.textContent)))mark(b,'pz14-remove');}
 const create=buttons.find(b=>safe(b)&&/^(utwórz(?: nowe)? (?:lobby|pokój)|stwórz (?:lobby|pokój))$/i.test(norm(b.textContent)));
 const join=buttons.find(b=>safe(b)&&/^(dołącz(?: do (?:lobby|gry|pokoju))?)$/i.test(norm(b.textContent)));
 const home=!!create&&!!join;
 document.body.classList.toggle('pz14-home',home);
 // Backend field is hidden, not removed or re-created. Existing value/events survive.
 const fields=[...app.querySelectorAll('input')].filter(i=>safe(i)&&(
 backend.test([i.getAttribute('aria-label'),i.placeholder,i.name,i.id].join(' '))||
 backend.test(i.closest('label')?.textContent||'')||
 (i.id&&[...app.querySelectorAll('label')].some(l=>l.htmlFor===i.id&&backend.test(l.textContent)))
 ));
 for(const i of fields){
  mark(i,'pz14-backend');
  const wrap=i.closest('label')||i.closest('.field,.form-field,.input-group');
  if(wrap&&wrap.querySelectorAll('input,select,textarea').length===1)mark(wrap,'pz14-backend');
  if(i.id)for(const l of app.querySelectorAll('label'))if(l.htmlFor===i.id)mark(l,'pz14-backend');
 }
 for(const el of app.querySelectorAll('.pz14-backend'))el.classList.toggle('pz14-hidden',!advanced);
 let toggle=document.querySelector('[data-pz14-settings]');
 if(fields.length){
  if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.dataset.pz14Settings='';toggle.className='pz14-settings';toggle.onclick=()=>{advanced=!advanced;update();};
   // Add outside React-owned app tree to avoid moving/remounting its controls.
   let settings=document.getElementById('pz14-settings');if(!settings){settings=document.createElement('aside');settings.id='pz14-settings';document.body.append(settings);}settings.append(toggle);
  }
  toggle=document.querySelector('[data-pz14-settings]');text(toggle,advanced?'Zamknij ustawienia połączenia':'⚙ Ustawienia połączenia');toggle.setAttribute('aria-expanded',String(advanced));
 }else document.getElementById('pz14-settings')?.remove();
 if(!home)return;
 mark(create,'pz14-create');mark(join,'pz14-join');
 const heading=app.querySelector('header h1')||app.querySelector('h1');
 if(heading&&safe(heading)){
  mark(heading,'pz14-title');
  for(const n of [...heading.childNodes])if(n.nodeType===Node.TEXT_NODE&&/Arena\s*Wiedzy|Punkt\s*Zwrotny/i.test(n.nodeValue)){if(n.nodeValue!=='Punkt Zwrotny')n.nodeValue='Punkt Zwrotny';}
  mark(heading.closest('header'),'pz14-header');
 }
 for(const action of[create,join]){
  const box=action.closest('.card,form,section');if(box&&box!==app&&!box.contains(create===action?join:create))mark(box,action===create?'pz14-create-card':'pz14-join-card');
 }
 for(const i of app.querySelectorAll('input')){
  if(!safe(i)||fields.includes(i))continue;
  const label=[i.placeholder,i.getAttribute('aria-label'),i.name,i.id,i.closest('label')?.textContent].join(' ');
  if(/kod.*(?:lobby|pokoju)|(?:lobby|pokój).*kod/i.test(label)){mark(i,'pz14-code');i.setAttribute('autocomplete','off');}
 }
 // Only short home-screen descriptions; never hide alerts, controls or errors.
 for(const el of app.querySelectorAll('header p,header .muted,header .eyebrow,p,.muted,small')){
  if(!safe(el)||el.closest('[role="alert"],.error,.warning,.danger')||el.querySelector('button,input,select,textarea,a')||el.textContent.length>700)continue;
  const t=norm(el.textContent);
  const header=el.closest('header');
  if((header&&el.tagName==='P')||technical.test(t)||/^(?:wiedza\s*[·•|]\s*ryzyko|gra (?:online|wieloosobowa)|stwórz lobby i|utwórz lobby i|połącz się z|wersja (?:v)?\d|makieta wyglądu)/i.test(t))mark(el,'pz14-home-copy');
 }
}
const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(update);}});
function start(){update();observer.observe(document.body,{subtree:true,childList:true,characterData:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
