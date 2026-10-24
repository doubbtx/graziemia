import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addPlayer, command, createRoom, tick} from '../server/engine.mjs';

function mediaRoom() {
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
    category: 'Stolice',
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
