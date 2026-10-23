(()=>{'use strict';let scheduled=false;const groups=new Map();const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase().trim();
function mark(e,c){if(!e.classList.contains(c))e.classList.add(c);}
function tiles(g){return [...g.children].filter(x=>x.matches('button,[data-category],.category-card,.category-tile'));}
function update(){scheduled=false;document.body.classList.add('pz16');
const roots=[...document.querySelectorAll('.av5,#arena-v7')];
for(const root of roots){
 // Explicit category containers; do not guess that every button grid is a category selector.
 const candidates=[...root.querySelectorAll('[data-category-grid],.category-grid,.categories-grid,.category-list,.categories-list,.v7-categories,.v7-cat-grid')];
 for(const heading of root.querySelectorAll('h1,h2,h3'))if(/^(przegląd kategorii|kategorie|wybierz kategorię|dostępne kategorie)$/i.test(heading.textContent.trim())){
  const section=heading.closest('section,.card,article');if(section)for(const e of section.querySelectorAll('div,ul'))if(tiles(e).length>=3)candidates.push(e);
 }
 for(const g of new Set(candidates)){
  if(g.closest('.category-picker')&&root.querySelector('.category-picker__search-input'))continue;
  if(g.previousElementSibling?.matches('input[aria-label="Szukaj kategorii"]'))continue;
  if(g.closest('.question,.judge-actions,#v10-card,#q12')||tiles(g).length<2)continue;
  mark(g,'pz16-grid');for(const t of tiles(g))mark(t,'pz16-tile');
  if(!groups.has(g)){
   const bar=document.createElement('div');bar.className='pz16-filter';const input=document.createElement('input');input.type='search';input.placeholder='Szukaj kategorii…';input.setAttribute('aria-label','Szukaj kategorii');const count=document.createElement('span');count.className='pz16-count';const empty=document.createElement('p');empty.className='pz16-empty';empty.textContent='Brak pasujących kategorii.';empty.hidden=true;bar.append(input,count);g.before(bar);g.after(empty);
   const entry={bar,input,count,empty};groups.set(g,entry);input.addEventListener('input',()=>filter(g,entry));
  }filter(g,groups.get(g));
 }
}
for(const[g,e]of groups)if(!g.isConnected){e.bar.remove();e.empty.remove();groups.delete(g);}
// Collapse only genuinely empty layout wrappers left by previous copy removal.
for(const e of document.querySelectorAll('.av5 header,.av5 .hero,.av5 .intro')){
 const visible=[...e.children].some(x=>getComputedStyle(x).display!=='none');if(!visible&&!e.textContent.trim())e.style.display='none';
}
}
function filter(g,e){const list=tiles(g),q=norm(e.input.value);let n=0;for(const t of list){const hide=!!q&&!norm(t.textContent).includes(q);if(t.classList.contains('pz16-filtered')!==hide)t.classList.toggle('pz16-filtered',hide);if(!hide)n++;}const s=n+' / '+list.length+' kategorii';if(e.count.textContent!==s)e.count.textContent=s;e.empty.hidden=n!==0;}
function start(){update();new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}}).observe(document.body,{subtree:true,childList:true,characterData:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();})();