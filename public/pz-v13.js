(()=>{
const NAME='Pixel Arena Show';document.title=NAME;document.documentElement.lang='pl';
let scheduled=false,collapsed=true;
// Only branding headings, never question text, inputs, data or storage keys.
function update(){scheduled=false;if(!document.body)return;document.body.classList.add('pz-v13');
for(const node of document.querySelectorAll('.av5 h1,.av5 header h2,#arena-v7 .v7-wrap>h1,#arena-v7 .v7-wrap>.v7-muted')){
 for(const child of [...node.childNodes])if(child.nodeType===Node.TEXT_NODE){const t=child.nodeValue;if(/Arena\s*(?:Wiedzy|·\s*DRUŻYNY)/i.test(t)){const next=t.replace(/Arena\s*Wiedzy(?:\s*v\d+)?/gi,NAME).replace(/(?:PIXEL\s+)?ARENA\s*·\s*DRUŻYNY/gi,'PIXEL ARENA · DRUŻYNY');if(next!==t)child.nodeValue=next;}}
}
const panel=document.getElementById('q12');if(panel){panel.classList.toggle('pz-collapsed',collapsed);let b=panel.querySelector('.pz-toggle');if(!b){b=document.createElement('button');b.type='button';b.className='pz-toggle';b.onclick=()=>{collapsed=!collapsed;update();};panel.prepend(b);}const label=collapsed?'Pytania i zgłoszenia ▸':'Zwiń zgłoszenia ▾';if(b.textContent!==label)b.textContent=label;b.setAttribute('aria-expanded',String(!collapsed));}
}
const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}});
function start(){update();observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
