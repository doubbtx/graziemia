import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addPlayer, command, createRoom, tick} from '../server/engine.mjs';

function mediaRoom(category = 'Stolice') {
  const room = createRoom('123456', 'Sędzia', 'judge-token', 1000);
  const players = [
    room.players[0],
    addPlayer(room, 'Gracz 2', 'player-two-token'),
    addPlayer(room, 'Gracz 3', 'player-three-token'),
  ];
  room.phase = 'duel';
  room.duel = {
    ids: players.slice(0, 2).map(player => player.id),
    adminId: players[2].id,
    category,
    turn: players[0].id,
    remaining: {[players[0].id]: 45000, [players[1].id]: 45000},
    ready: [],
    mediaReady: [],
    status: 'media',
    deadline: null,
    lastAt: null,
    index: 0,
    key: 'media-test',
    cycle: 1,
    lastActionAt: null,
  };
  return {room, players};
}

test('image loading cannot block a duel for more than six seconds', () => {
  const {room} = mediaRoom();

  assert.equal(tick(room, 1000), false);
  assert.equal(room.duel.mediaDeadline, 7000);
  assert.equal(tick(room, 6999), false);
  assert.equal(room.duel.status, 'media');
  assert.equal(tick(room, 7000), true);
  assert.equal(room.duel.status, 'running');
  assert.equal(room.duel.lastAt, 7000);
});

test('a duel starts as soon as every client has the loaded image', () => {
  const {room, players} = mediaRoom();

  for (const [index, player] of players.entries()) {
    command(room, player.id, {
      type: 'IMAGE_READY',
      rev: room.rev,
      questionKey: room.duel.key,
    }, 1000 + index);

    if (index < players.length - 1) {
      assert.equal(room.duel.status, 'media');
    }
  }

  assert.equal(room.duel.status, 'running');
  assert.equal(room.duel.lastAt, 1002);
  assert.equal(room.duel.mediaDeadline, null);
});

test('a preloaded image question starts without waiting for confirmations', () => {
  const {room, players} = mediaRoom('Flagi na obrazkach');
  for (const [index, player] of players.entries()) {
    command(room, player.id, {type: 'MEDIA_PRELOADED', rev: -1, failed: []}, 1000 + index);
    assert.equal(room.duel.status, index < players.length - 1 ? 'media' : 'running');
  }
  assert.equal(room.duel.lastAt, 1002);
});

test('a player whose copy of the image failed to preload still gets the loading wait', () => {
  const {room, players} = mediaRoom('Flagi na obrazkach');
  const image = 'https://flagcdn.com/w640/cz.png';
  for (const player of players) command(room, player.id, {type: 'MEDIA_PRELOADED', rev: -1, failed: player === players[1] ? [image] : []}, 1000);
  assert.equal(room.duel.status, 'media');
});

test('Category-scoped preload reports start image questions only for reported categories',async()=>{
 const {createRoom,addPlayer,command,tick}=await import('../server/engine.mjs');
 const {bank}=await import('../server/bank.mjs');
 const room=createRoom('246810','A','ta',1000);addPlayer(room,'B','tb');addPlayer(room,'C','tc');
 const cat='Flagi na obrazkach';room.players.forEach((p,i)=>{p.category=[cat,'Stolice','Sport'][i];p.ready=true;});
 const act=(id,type,data={},now=1000)=>command(room,id,{type,rev:room.rev,...data},now);
 act(room.hostId,'START');
 const flagOwner=room.players.find(p=>p.category===cat),challenger=room.players.find(p=>p.id===room.challengerId);
 if(challenger.id===flagOwner.id){room.challengerId=room.players.find(p=>p.id!==flagOwner.id).id;}
 act(room.challengerId,'CHALLENGE',{opponent:flagOwner.id});
 for(const id of [...room.duel.ids,room.duel.adminId])act(id,'DUEL_READY');
 const imageIndex=bank[cat].findIndex(q=>q.image);room.duel.index=imageIndex;
 for(const p of room.players)command(room,p.id,{type:'MEDIA_PRELOADED',failed:[],categories:['Stolice']},1500);
 tick(room,4500);
 assert.equal(room.duel.status,'media');
 for(const p of room.players)command(room,p.id,{type:'MEDIA_PRELOADED',failed:[],categories:['Stolice',cat]},4600);
 tick(room,4700);
 assert.equal(room.duel.status,'running');
});
