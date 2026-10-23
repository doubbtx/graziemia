import {spawn,spawnSync} from 'node:child_process';
import {access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PORT||3001);
const binary=process.env.NGROK_BIN||'ngrok';
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');process.exit(code);},1000);}
function start(command,args){const child=spawn(command,args,{cwd:root,stdio:'inherit',env:{...process.env,PORT:String(port)},shell:false});children.push(child);child.on('error',e=>{console.error('Nie udalo sie uruchomic procesu:',e.message);stop(1);});child.on('exit',code=>stop(code||0));return child;}
async function checkPort(){await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(Error('Port '+port+' jest zajety. Zatrzymaj poprzedni serwer albo ustaw PORT.')));probe.listen(port,'0.0.0.0',()=>probe.close(resolve));});}
try{
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Nieprawidlowy PORT.');
 await access(resolve(root,'dist/index.html'));
 const version=spawnSync(binary,['version'],{encoding:'utf8',timeout:5000,shell:false});
 if(version.error||version.status!==0)throw Error('Brak ngrok CLI. Zainstaluj ngrok i dodaj go do PATH albo ustaw NGROK_BIN. Instrukcja: NGROK.md');
 await checkPort();
 console.log('Arena Online: start serwera i tunelu. Token jest odczytywany przez ngrok z jego lokalnej konfiguracji.');
 start(process.execPath,['server/index.mjs']);
 let ready=false;
 for(let i=0;i<100&&!stopping;i++){try{const res=await fetch('http://127.0.0.1:'+port+'/api/health',{signal:AbortSignal.timeout(500)});const data=await res.json();if(res.ok&&data.version===6){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Backend nie uruchomil sie poprawnie.');
 console.log('Otworz publiczny adres HTTPS pokazany przez ngrok. Utworz lobby i wyslij znajomym zaproszenie z gry.');
 console.log('Pozostaw terminal otwarty. Ctrl+C zatrzymuje serwer i tunel.');
 const args=['http',String(port),'--inspect=false'];
 if(process.env.NGROK_URL){const url=new URL(process.env.NGROK_URL);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('NGROK_URL musi byc samym adresem HTTPS domeny przypisanej do Twojego konta.');args.push('--url',url.origin);}
 start(binary,args);
}catch(e){console.error(e.message);stop(1);}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
