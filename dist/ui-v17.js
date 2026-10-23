(()=>{'use strict';let queued=false;const n=s=>(s||'').trim().toLocaleLowerCase('pl');const maps=new Map();
const mark=(e,c)=>{if(e&&!e.classList.contains(c))e.classList.add(c)};
function run(){queued=false;const app=document.querySelector('.av5');if(!app)return;
 const heading=[...app.querySelectorAll('h1,h2,h3')].find(h=>n(h.textContent)==='wejdź do lobby');
 const categories=[...app.querySelectorAll('h1,h2,h3')].find(h=>n(h.textContent)==='przegląd kategorii');
 if(!heading||!categories){document.body.classList.remove('pz17-home');return;}document.body.classList.add('pz17-home');
 let form=heading.parentElement;while(form&&form!==app&&!(form.querySelector('input')&&form.querySelector('button')))form=form.parentElement;
 if(form&&form!==app){mark(form,'pz17-login');let row=form.parentElement;
  // Find the row containing the login and the now-empty promotional column.
  while(row&&row!==app&&!row.contains(categories)){
   const style=getComputedStyle(row);
   if(style.display==='grid'||style.display==='flex'){mark(row,'pz17-login-row');for(const child of row.children)if(child!==form&&!child.contains(form)&&!child.contains(categories)&&!child.querySelector('input,button,a,[role=alert]'))mark(child,'pz17-empty-column');break;}
   row=row.parentElement;
  }
 }
 const section=categories.closest('.card,section,article')||categories.parentElement;mark(section,'pz17-categories');
 for(const p of section.querySelectorAll('p,small'))if(/^Nowe:|Liczby pytań po aktualizacji/i.test(p.textContent.trim()))mark(p,'pz17-hide');
 // The screenshot shows span badges, not buttons. Support both without changing semantics.
 let grids=[...section.querySelectorAll('div,ul')].filter(g=>[...g.children].filter(x=>x.matches('.badge,.pill,.chip,button,li,[data-category]')).length>=3);
 grids=grids.filter(g=>!grids.some(other=>other!==g&&g.contains(other)));
 for(const g of grids){mark(g,'pz17-grid');const tiles=[...g.children].filter(x=>x.matches('.badge,.pill,.chip,button,li,[data-category]'));for(const t of tiles)mark(t,'pz17-tile');
  if(!maps.has(g)){
   const existing=g.previousElementSibling?.classList.contains('pz16-filter')?g.previousElementSibling:null;if(existing)mark(existing,'pz17-hide');
   const bar=document.createElement('div');bar.className='pz17-filter';const input=document.createElement('input');input.type='search';input.placeholder='Szukaj kategorii';input.setAttribute('aria-label','Szukaj w przeglądzie kategorii');const count=document.createElement('span');bar.append(input,count);g.before(bar);const empty=document.createElement('p');empty.className='pz17-no-results';empty.textContent='Brak pasujących kategorii.';g.after(empty);const e={bar,input,count,empty};maps.set(g,e);input.oninput=()=>filter(g,e);
  }filter(g,maps.get(g));
 }
 for(const[g,e]of maps)if(!g.isConnected){e.bar.remove();e.empty.remove();maps.delete(g);}
}
const norm=s=>n(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l');
function filter(g,e){const list=[...g.children].filter(x=>x.classList.contains('pz17-tile'));let total=0;for(const t of list){const hide=!norm(t.textContent).includes(norm(e.input.value));if(t.classList.contains('pz17-filtered')!==hide)t.classList.toggle('pz17-filtered',hide);if(!hide)total++;}const label=total+' / '+list.length+' kategorii';if(e.count.textContent!==label)e.count.textContent=label;e.empty.hidden=total!==0;}
function start(){run();new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(run);}}).observe(document.body,{subtree:true,childList:true,characterData:true});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();
