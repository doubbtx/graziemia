import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addPlayer,categories,command,createRoom,publicState,tick} from '../server/engine.mjs';
import {bank} from '../server/bank.mjs';
import {cards} from '../server/engine-v6-core.mjs';

const trueFalseQuestions=bank['Prawda/Fałsz'];

function action(room,id,type,data={},now=1000){
 return command(room,id,{type,rev:room.rev,...data},now);
}

function readyDuel(){
 const room=createRoom('654321','Gracz A','token-a',1000);
 for(const [index,name] of ['Gracz B','Gracz C','Gracz D'].entries())addPlayer(room,name,`token-${index+1}`);
 for(const player of room.players){player.category='Nauka';player.ready=true;}
 action(room,room.hostId,'START');
 const challenger=room.challengerId,opponent=room.players.find(player=>player.id!==challenger);
 action(room,challenger,'CHALLENGE',{opponent:opponent.id});
 return room;
}

function startDuel(room){
 for(const id of [...room.duel.ids,room.duel.adminId])action(room,id,'DUEL_READY');
 tick(room,4000);
 return room;
}

function answer(room,kind,now){
 return action(room,room.duel.adminId,'ANSWER',{kind,questionKey:room.duel.key},now);
}

test('Footballer category has at least 60 unique players with nationality and five clubs',()=>{
 const questions=bank['Co to za piłkarz?'];
 assert.ok(categories.includes('Co to za piłkarz?'));
 assert.ok(questions.length>=60);
 assert.equal(new Set(questions.map(question=>question.answer)).size,questions.length);
 assert.equal(new Set(questions.map(question=>question.id)).size,questions.length);
 for(const question of questions){
  assert.match(question.prompt,/\nNarodowość: .+\n/);
  const clubs=question.footballer.clubs;
  assert.ok(clubs.length>=3&&clubs.length<=5);
  assert.ok(['Bramkarz','Obrońca','Pomocnik','Napastnik'].includes(question.footballer.position));
  assert.ok(question.footballer.flag.startsWith('https://flagcdn.com/'));
  assert.equal(question.prompt.split('Ostatnie kluby')[1].split(' → ').length,clubs.length);
 }
});

test('True/false bank adds exactly 80 questions as a category',()=>{
 assert.equal(trueFalseQuestions.length,80);
 assert.equal(bank['Prawda/Fałsz'].length,80);
 assert.equal(categories.length,Object.keys(bank).length);
 assert.equal(new Set(trueFalseQuestions.map(question=>question.prompt)).size,80);
 assert.ok(trueFalseQuestions.every(question=>['Prawda','Fałsz'].includes(question.answer)));
 const room=createRoom('123456','Gracz','token',1000),state=publicState(room,room.hostId);
 assert.equal(state.categories.length,categories.length);
 assert.equal(state.totalQuestions,Object.values(bank).reduce((count,questions)=>count+questions.length,0));
 assert.equal(state.categoryCounts['Prawda/Fałsz'],80);
});

test('Card pool replaces random-card card with five free skips',()=>{
 assert.ok(cards.skip5);
 assert.ok(cards.homecategory);
 assert.equal(Object.hasOwn(cards,'swap'),false);
});

test('The home-category card is usable once in solo mode',()=>{
 const room=readyDuel(),player=room.players.find(player=>room.duel.ids.includes(player.id));
 const category=categories.find(name=>name!==room.duel.category&&!room.retired.includes(name));
 player.category=category;
 player.card='homecategory';
 player.cardUsed=false;
 assert.equal(publicState(room,player.id).cardPanel.allowed,true);
 action(room,player.id,'CARD');
 assert.equal(room.duel.category,category);
 assert.equal(player.cardUsed,true);
 assert.match(room.lastDecision.text,/Moja kategoria/);
});

test('Correct answer scores +2 at the 1.5 second threshold and credits the shop wallet',()=>{
 const room=startDuel(readyDuel()),playerId=room.duel.turn;
 answer(room,'good',5500);
 const player=room.players.find(player=>player.id===playerId);
 assert.equal(player.points,2);
 assert.equal(player.walletCents,200);
});

test('Correct answer after 1.5 seconds scores +1',()=>{
 const room=startDuel(readyDuel()),playerId=room.duel.turn;
 answer(room,'good',5501);
 const player=room.players.find(player=>player.id===playerId);
 assert.equal(player.points,1);
 assert.equal(player.walletCents,100);
});

test('Players without skips receive +5 and the winner receives +3',()=>{
 const room=startDuel(readyDuel()),[winnerId,loserId]=room.duel.ids;
 action(room,room.duel.adminId,'AWARD',{winner:winnerId},4500);
 const winner=room.players.find(player=>player.id===winnerId),loser=room.players.find(player=>player.id===loserId);
 assert.equal(winner.points,8);
 assert.equal(loser.points,5);
 assert.equal(winner.walletCents,800);
 assert.equal(loser.walletCents,500);
});

test('No-skip bonus is also awarded when a duel ends on time',()=>{
 const room=startDuel(readyDuel()),[winnerId,loserId]=room.duel.ids;
 room.duel.remaining[winnerId]=1000;
 tick(room,5000);
 assert.equal(room.players.find(player=>player.id===winnerId).points,5);
 assert.equal(room.players.find(player=>player.id===loserId).points,8);
 assert.equal(room.players.find(player=>player.id===winnerId).walletCents,500);
 assert.equal(room.players.find(player=>player.id===loserId).walletCents,800);
});

test('Five free skips preserve time, the sixth skip costs three seconds',()=>{
 const room=readyDuel(),playerId=room.duel.turn,player=room.players.find(player=>player.id===playerId);
 player.card='skip5';player.cardUsed=false;
 assert.equal(publicState(room,playerId).cardPanel.allowed,true);
 action(room,playerId,'CARD');
 startDuel(room);
 assert.equal(room.duel.skip5.remaining,5);
 for(let index=0;index<5;index++)answer(room,'skip',4000+index*300);
 assert.equal(room.duel.skip5.remaining,0);
 assert.equal(room.duel.skipCounts[playerId],5);
 const before=room.duel.remaining[playerId];
 answer(room,'skip',5500);
 assert.equal(room.duel.remaining[playerId],before-3300);
 assert.equal(room.duel.skipCounts[playerId],6);
});

test('Shop prices use the new point economy',()=>{
 const room=createRoom('765432','Gracz','token',1000);
 assert.deepEqual(publicState(room,room.hostId).economyPanel.prices,{revive:50,laststand:35});
});

test('The answering player can skip their own question like the judge (−3 s, new question)',()=>{
 const room=startDuel(readyDuel()),turn=room.duel.turn,other=room.duel.ids.find(id=>id!==turn),key=room.duel.key;
 assert.throws(()=>action(room,other,'PLAYER_SKIP',{questionKey:key},4500));
 const before=room.duel.remaining[turn];
 action(room,turn,'PLAYER_SKIP',{questionKey:key},4500);
 assert.notEqual(room.duel.key,key);
 assert.equal(room.duel.turn,turn);
 assert.ok(room.duel.remaining[turn]<=before-3000);
 assert.equal(room.duel.skipCounts[turn],1);
});

test('Freeze stops the own clock for 5 seconds, then time runs again',()=>{
 const room=startDuel(readyDuel()),d=room.duel,id=d.turn,player=room.players.find(player=>player.id===id);
 player.card='freeze';player.cardUsed=false;
 const before=d.remaining[id];
 action(room,id,'CARD',{questionKey:d.key},4000);
 tick(room,8000);
 assert.equal(room.duel.remaining[id],before);
 assert.equal(publicState(room,id,8000).duel.freeze.playerId,id);
 tick(room,11000);
 assert.equal(room.duel.remaining[id],before-2000);
 assert.equal(room.duel.freeze,null);
});

test('Time thief moves 5 seconds from the rival and fog targets the rival for the whole duel',()=>{
 const room=startDuel(readyDuel()),d=room.duel,[id,rival]=d.ids,player=room.players.find(player=>player.id===id);
 player.card='steal';player.cardUsed=false;
 const mine=d.remaining[id],theirs=d.remaining[rival];
 action(room,id,'CARD',{},4000);
 assert.equal(room.duel.remaining[rival],theirs-5000);
 assert.ok(room.duel.remaining[id]>=mine+5000-1);
 player.card='fog';player.cardUsed=false;
 action(room,id,'CARD',{},4000);
 assert.equal(room.duel.fog.target,rival);
 assert.equal(publicState(room,rival,4000).duel.fogged,true);
 assert.equal(publicState(room,id,4000).duel.fogged,false);
});

test('Shop sells every card between duels and replaces the unused card',()=>{
 const room=readyDuel(),challenger=room.duel.ids[0];
 room.duel=null;room.phase='choose';
 const player=room.players.find(player=>player.id===challenger);
 player.walletCents=3000;player.card='letter';player.cardUsed=false;
 const shop=publicState(room,challenger).economyPanel;
 assert.ok(['fog','freeze','steal','laststand','shield','heal'].every(type=>shop.cards.some(card=>card.type===type)));
 action(room,challenger,'V11_BUY',{item:'card',card:'steal'});
 assert.equal(player.card,'steal');
 assert.equal(player.walletCents,500);
 assert.throws(()=>action(room,challenger,'V11_BUY',{item:'card',card:'shield'}),/Za mało punktów/);
});

test('Soundtrack questions send the audio to both players and the judge once the question is visible',()=>{
 const questions=bank['Soundtrack'];
 assert.ok(questions.length>=60);
 assert.ok(questions.every(question=>question.audio.startsWith('https://audio-ssl.itunes.apple.com/')&&question.explanation));
 const room=readyDuel();
 room.duel.category='Soundtrack';room.duel.index=0;
 for(const id of [...room.duel.ids,room.duel.adminId])assert.ok(!publicState(room,id,1000).duel.audio);
 startDuel(room);
 room.duel.category='Soundtrack';room.duel.index=0;
 for(const id of [...room.duel.ids,room.duel.adminId])assert.equal(publicState(room,id,4000).duel.audio,questions[0].audio);
});

test('Zoom questions send the focus point once the question is visible',()=>{
 const questions=bank['Przybliżenie'];
 assert.ok(questions.length>=60);
 assert.ok(questions.every(question=>question.image&&question.zoom.x>=0&&question.zoom.x<=100&&question.zoom.y>=0&&question.zoom.y<=100));
 const room=startDuel(readyDuel());
 room.duel.category='Przybliżenie';room.duel.index=0;
 for(const id of [...room.duel.ids,room.duel.adminId])assert.deepEqual(publicState(room,id,4000).duel.zoom,questions[0].zoom);
});

test('Unused freeze time survives a correct answer and continues on the next own turn',()=>{
 const room=startDuel(readyDuel()),d=room.duel,id=d.turn,rival=d.ids.find(x=>x!==id),player=room.players.find(player=>player.id===id);
 player.card='freeze';player.cardUsed=false;
 action(room,id,'CARD',{questionKey:d.key},4000);
 tick(room,6000);
 const mine=room.duel.remaining[id];
 answer(room,'good',6000);
 assert.equal(room.duel.turn,rival);
 assert.equal(room.duel.freeze.left,3000);
 tick(room,9000);
 answer(room,'good',9000);
 assert.equal(room.duel.turn,id);
 tick(room,11000);
 assert.equal(room.duel.remaining[id],mine);
 tick(room,14000);
 assert.equal(room.duel.remaining[id],mine-2000);
 assert.equal(room.duel.freeze,null);
});

function lobbyWithRules(rules,players=4){
 const room=createRoom('777777','Gracz A','token-a',1000);
 for(let i=1;i<players;i++)addPlayer(room,'Gracz '+'BCDE'[i-1],'token-'+i);
 action(room,room.hostId,'LOBBY_RULES',rules);
 tick(room,1100);
 return room;
}

test('Random categories are drawn in the lobby and cannot be picked by hand',()=>{
 const room=lobbyWithRules({categoryPick:'random'});
 const picked=room.players.map(player=>player.category);
 assert.ok(picked.every(Boolean));
 assert.equal(new Set(picked).size,picked.length);
 assert.throws(()=>action(room,room.players[1].id,'CATEGORY',{category:categories.find(c=>!picked.includes(c))}),/losowane/);
});

test('Random opponent mode starts the duel without a manual challenge',()=>{
 const room=lobbyWithRules({opponentPick:'random'});
 for(const player of room.players){player.category??=categories[room.players.indexOf(player)];player.ready=true;}
 action(room,room.hostId,'START',{},1200);
 assert.equal(room.phase,'duel');
 assert.ok(room.duel.ids.includes(room.challengerId));
});

test('Random pair with random category plays one of the duelists\' categories and never the same pair twice',()=>{
 const room=lobbyWithRules({opponentPick:'pair',duelCategory:'random',categoryPick:'random'});
 assert.equal(room.settings.rules.categoryPick,'random');
 for(const player of room.players)player.ready=true;
 action(room,room.hostId,'START',{},1200);
 assert.equal(room.phase,'duel');
 const first=[...room.duel.ids],own=room.players.filter(p=>first.includes(p.id)).map(p=>p.category);
 assert.ok(own.includes(room.duel.category));
 action(room,room.duel.adminId,'AWARD',{winner:first[0]},1300);
 tick(room,1400);
 assert.equal(room.phase,'duel');
 assert.notDeepEqual([...room.duel.ids].sort(),[...first].sort());
});

test('Every judged answer is announced with its kind for the screen flash',()=>{
 const room=startDuel(readyDuel()),turn=room.duel.turn;
 answer(room,'skip',5000);
 assert.deepEqual([room.lastAnswer.n,room.lastAnswer.kind,room.lastAnswer.playerId],[1,'skip',turn]);
 answer(room,'good',6000);
 assert.deepEqual([room.lastAnswer.n,room.lastAnswer.kind],[2,'good']);
 assert.equal(publicState(room,room.players[0].id,6000).lastAnswer.n,2);
});

test('The next question is drawn in advance and its image is announced before the answer',()=>{
 const room=startDuel(readyDuel());
 room.duel.category='Flagi na obrazkach';room.duel.index=0;room.used['Flagi na obrazkach']=[0];room.duel.upcoming=null;
 tick(room,4100);
 const upcoming=room.duel.upcoming;
 assert.ok(Number.isInteger(upcoming)&&upcoming!==0);
 assert.equal(publicState(room,room.duel.adminId,4100).duel.nextImage,bank['Flagi na obrazkach'][upcoming].image);
 answer(room,'good',5000);
 assert.equal(room.duel.index,upcoming);
 assert.ok(room.used['Flagi na obrazkach'].includes(upcoming));
 assert.equal(new Set(room.used['Flagi na obrazkach']).size,room.used['Flagi na obrazkach'].length);
});
