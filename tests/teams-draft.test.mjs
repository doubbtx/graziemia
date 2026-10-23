import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addPlayer,command,publicState,categories} from '../server/engine.mjs';

function setup(count){
 const room=createRoom('123456','Gracz 1','token-0',1000);
 for(let i=1;i<count;i++)addPlayer(room,`Gracz ${i+1}`,`token-${i}`);
 const host=room.hostId;
 const action=(id,type,data={})=>command(room,id,{type,rev:room.rev,...data},1000);
 for(const player of room.players)player.category='Nauka';
 action(host,'MODE',{mode:'teams'});
 assert.ok(room.players.every(player=>player.category===null));
 for(const player of room.players)action(player.id,'READY');
 action(host,'START');
 return{room,action};
}

test('Team start draws two captains and drafts all players in alternating picks',()=>{
 const{room,action}=setup(5),draft=room.teamDraft;
 assert.equal(room.phase,'team_draft');
 assert.ok(draft.captains.A&&draft.captains.B);
 assert.notEqual(draft.captains.A,draft.captains.B);
 assert.ok(['A','B'].includes(draft.turnTeam));
 assert.deepEqual(new Set(room.players.filter(p=>p.team).map(p=>p.id)),new Set(Object.values(draft.captains)));
 const nonCaptain=room.players.find(p=>p.id!==draft.captains[draft.turnTeam]);
 assert.throws(()=>action(nonCaptain.id,'DRAFT_PICK',{playerId:room.players.find(p=>p.team===null).id}),/kapitan drużyny/);
 while(room.phase==='team_draft'){
  const team=room.teamDraft.turnTeam,chooser=room.teamDraft.captains[team];
  const candidate=room.players.find(p=>p.team===null);
  action(chooser,'DRAFT_PICK',{playerId:candidate.id});
 }
 const sizeA=room.players.filter(p=>p.team==='A').length,sizeB=room.players.filter(p=>p.team==='B').length;
 assert.equal(room.phase,'team_nominate');
 assert.ok(room.players.every(player=>player.category===null&&player.card===null));
 assert.ok(room.players.every(player=>player.ready));
 assert.equal(Math.abs(sizeA-sizeB),1);
 assert.ok(categories.includes(room.roundCategory));
 assert.ok(!room.retired.includes(room.roundCategory));
});

test('Team rounds draw unused categories and all cards are disabled',()=>{
 const{room,action}=setup(4);
 while(room.phase==='team_draft'){
  const team=room.teamDraft.turnTeam,chooser=room.teamDraft.captains[team];
  action(chooser,'DRAFT_PICK',{playerId:room.players.find(p=>p.team===null).id});
 }
 room.players.filter(player=>player.team==='A').forEach((player,index)=>{player.played=index;});
 const category=room.roundCategory;
 for(const team of ['A','B']){
  const captain=room.teamDraft.captains[team],candidates=room.players.filter(p=>p.team===team&&p.connected),candidate=team==='A'?candidates.at(-1):candidates[0];
  action(captain,'NOMINATE',{playerId:candidate.id});
 }
 assert.equal(room.phase,'duel');
 assert.equal(room.duel.category,category);
 assert.deepEqual(new Set(publicState(room,room.hostId).roundControl.candidates.A),new Set(room.players.filter(player=>player.team==='A'&&player.connected).map(player=>player.id)));
 const player=room.players.find(p=>room.duel.ids.includes(p.id));
 player.card='homecategory';
 player.cardUsed=false;
 assert.equal(publicState(room,player.id).cardPanel.visible,false);
 assert.throws(()=>action(player.id,'CARD'),/Karty są wyłączone w trybie drużynowym/);
 player.card='laststand';
 player.cardUsed=false;
 assert.equal(publicState(room,player.id).cardPanel.visible,false);
 assert.throws(()=>action(player.id,'CARD'),/Karty są wyłączone w trybie drużynowym/);
 const playedCategory=room.duel.category,judge=room.duel.adminId;
 const livesBefore=Object.fromEntries(room.players.map(player=>[player.id,player.lives]));
 action(judge,'AWARD',{winner:room.duel.ids[0]});
 assert.equal(room.phase,'team_nominate');
 assert.ok(room.players.every(player=>player.lives===livesBefore[player.id]));
 assert.ok(publicState(room,room.hostId).teams.every(team=>!Object.hasOwn(team,'lives')));
 const afterRound=publicState(room,room.hostId),lastByTeam=Object.fromEntries(Object.entries(room.teamLastNominees));
 assert.deepEqual(afterRound.roundControl.lastNominees,lastByTeam);
 for(const team of ['A','B']){
  const last=lastByTeam[team],teamPlayers=room.players.filter(player=>player.team===team);
  assert.ok(!afterRound.roundControl.candidates[team].includes(last));
  assert.equal(afterRound.roundControl.candidates[team].length,teamPlayers.length-1);
  assert.equal(afterRound.roundControl.teamPoints[team],teamPlayers.reduce((sum,player)=>sum+player.points,0));
  const captain=room.teamDraft.captains[team];
  assert.throws(()=>action(captain,'NOMINATE',{playerId:last}),/ostatniego zawodnika/);
 }
 const win=afterRound.roundControl.playerStats[room.log.at(-1).winner];
 const loss=afterRound.roundControl.playerStats[room.log.at(-1).loser];
 assert.deepEqual(win,{wins:1,losses:0,winRate:100});
 assert.deepEqual(loss,{wins:0,losses:1,winRate:0});
 assert.ok(!room.retired.includes(room.roundCategory));
 assert.notEqual(room.roundCategory,playedCategory);
 player.walletCents=10000;
 assert.throws(()=>action(player.id,'V11_BUY',{item:'laststand'}),/wyłączone w trybie drużynowym/);
 assert.ok(room.players.every(player=>player.category===null));
});

test('Team game ends when unused categories are exhausted, not when a team loses all lives',()=>{
 const{room,action}=setup(4);
 while(room.phase==='team_draft'){
  const team=room.teamDraft.turnTeam,chooser=room.teamDraft.captains[team];
  action(chooser,'DRAFT_PICK',{playerId:room.players.find(p=>p.team===null).id});
 }
 const finalCategory=room.roundCategory;
 room.retired=categories.filter(category=>category!==finalCategory);
 const nominateBoth=()=>{
  for(const team of ['A','B']){
   const captain=room.teamDraft.captains[team],candidate=room.players.find(player=>player.team===team&&player.connected);
   action(captain,'NOMINATE',{playerId:candidate.id});
  }
 };
 nominateBoth();
 const lastDuel=room.duel;
 action(lastDuel.adminId,'AWARD',{winner:lastDuel.ids[0]});
 assert.equal(room.phase,'finished');
 assert.match(room.finishReason,/po wyczerpaniu kategorii/);
});
