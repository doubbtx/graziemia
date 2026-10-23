const norm=q=>Array.isArray(q)?{prompt:q[0],answer:q[1]}:{...q,prompt:q.prompt??q.question??q.q,answer:q.answer??q.a};
const key=q=>q.prompt.trim().replace(/\s+/g,' ')+'|'+(q.image||'');
export function mergeBank(base,u,report=[]){
 const result={};let skipped=0;
 function validate(q,c){if(typeof q.prompt!=='string'||!q.prompt.trim()||typeof q.answer!=='string'||!q.answer.trim())throw Error('Pusty rekord: '+c);}
 function unique(qs,c){const seen=new Map(),out=[];for(const raw of qs){const q=norm(raw);validate(q,c);const k=key(q);if(seen.has(k)){const old=seen.get(k);if(old.answer.trim()!==q.answer.trim())report.push({category:c,prompt:q.prompt,keptAnswer:old.answer,skippedAnswer:q.answer,policy:'Zachowano pierwszy rekord; dla dodatków pierwszeństwo ma lokalna baza. Rozbieżność wymaga przeglądu, nie rozstrzygnięto poprawności.'});skipped++;continue;}seen.set(k,q);out.push(q);}return out;}
 if(!base||typeof base!=='object')throw Error('Nie rozpoznano bazy v4.');
 for(const[c,qs]of Object.entries(base)){if(!Array.isArray(qs)||qs.length!==100)throw Error('Wymagana baza v4 po 100 pytań: '+c);result[c]=qs.map(norm);}
 for(const[c,extra]of Object.entries(u.additions)){if(!result[c])throw Error('Brak kategorii v4: '+c);result[c]=unique([...result[c],...extra],c);}
 for(const[c,qs]of Object.entries(u.replacements))result[c]=unique(qs,c);
 for(const[c,qs]of Object.entries(u.new)){if(result[c])throw Error('Nowa kategoria już istnieje: '+c);result[c]=unique(qs,c);}
 for(const[c,qs]of Object.entries(result))for(const q of qs)validate(q,c);
 if(Object.keys(result).length!==28)throw Error('Oczekiwano 28 kategorii.');
 console.log('Rozbieżności odpowiedzi do przeglądu: '+report.length+'.');
 console.log('Pominięte duplikaty: '+skipped+'. Rzeczywista liczba pytań: '+Object.values(result).reduce((n,qs)=>n+qs.length,0)+'.');
 console.log('Po pominięciu powtórzeń niektóre kategorie mogą mieć mniej niż 150 pytań.');
 return result;
}
