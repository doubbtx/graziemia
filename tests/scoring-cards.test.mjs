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

test('True/false bank adds exactly 80 questions as a category',()=>{
 assert.equal(trueFalseQuestions.length,80);
 assert.equal(bank['Prawda/Fałsz'].length,80);
 assert.equal(categories.length,42);
 assert.equal(Object.values(bank).reduce((count,questions)=>count+questions.length,0),3462);
 assert.equal(new Set(trueFalseQuestions.map(question=>question.prompt)).size,80);
 assert.ok(trueFalseQuestions.every(question=>['Prawda','Fałsz'].includes(question.answer)));
 const room=createRoom('123456','Gracz','token',1000),state=publicState(room,room.hostId);
 assert.equal(state.categories.length,42);
 assert.equal(state.totalQuestions,3462);
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
