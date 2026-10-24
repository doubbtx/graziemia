import React, {useEffect, useState} from 'react';
import {PlayerAvatar} from './components.jsx';

const plural = (count, one, few, many) => count === 1 ? one : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? few : many;
const teamColor = team => team === 'A' ? 'cyan' : team === 'B' ? 'magenta' : 'violet';

/** One-use card of the current player (solo mode). */
export function CardPanel({room, send, disabled}) {
  const panel = room.cardPanel, me = room.players.find(p => p.id === room.you);
  const [collapsed, setCollapsed] = useState(false), [target, setTarget] = useState('');
  if (room.settings.mode === 'teams' || !panel?.visible || !me) return null;
  const card = room.cardTypes?.[panel.type] || {name: panel.type, text: ''};
  const candidates = panel.type === 'revive' ? room.players.filter(p => p.lives === 0) : [];
  const validTarget = panel.type !== 'revive' || candidates.some(p => p.id === target);
  if (collapsed) return <button className="card-chip" onClick={() => setCollapsed(false)} aria-label={`Pokaż kartę ${card.name}`}><span aria-hidden="true">🃏</span> {card.name}</button>;
  function use() {
    const data = {};
    if (room.duel?.questionKey) data.questionKey = room.duel.questionKey;
    if (panel.type === 'revive') data.target = target;
    send('CARD', data);
  }
  return <section className="panel special-card" aria-label="Karta jednorazowa">
    <div className="panel__head"><span className="eyebrow">Karta jednorazowa</span><button className="btn btn--ghost btn--sm" onClick={() => setCollapsed(true)}>Zwiń</button></div>
    <h3>🃏 {card.name}</h3>
    <p>{card.text}</p>
    {panel.type === 'revive' && (candidates.length
      ? <label className="field">Kogo wskrzesić<select value={target} onChange={e => setTarget(e.target.value)}><option value="">Wybierz osobę</option>{candidates.map(p => <option key={p.id} value={p.id}>{p.id === me.id ? 'Siebie · wróć z 1 życiem' : p.name}</option>)}</select></label>
      : <p className="muted">Nie ma osoby, którą można wskrzesić.</p>)}
    {!panel.allowed && panel.reason && <p className="muted">{panel.reason}</p>}
    {panel.notice && <p className="muted">{panel.notice}</p>}
    <button className="btn btn--success btn--block" disabled={disabled || !panel.allowed || !validTarget} onClick={use}>{panel.preparing ? 'Aktywuj na ten pojedynek' : 'Użyj karty'}</button>
  </section>;
}

function ShopItems({room, send, disabled}) {
  const e = room.economyPanel;
  return <div className="shop">
    <div className="shop__item">
      <div><strong>Wskrzeszenie</strong><small>{e.reviveBought ? 'Zakupione wskrzeszenie zostało już wykorzystane.' : 'Po odpadnięciu wracasz z 1 życiem. Jeden zakup na grę.'}</small></div>
      <button className="btn btn--sm" disabled={disabled || !e.canRevive} onClick={() => send('V11_BUY', {item: 'revive'})}>{e.prices.revive} pkt</button>
    </div>
    {room.settings.mode !== 'teams' && <div className="shop__item">
      <div><strong>Ostatnia szansa</strong><small>Zastępuje niewykorzystaną kartę.</small></div>
      <button className="btn btn--sm" disabled={disabled || !e.canBuyCard} onClick={() => send('V11_BUY', {item: 'laststand'})}>{e.prices.laststand} pkt</button>
    </div>}
    <p className="muted small">Portfel rośnie razem z punktami. Zakupy nie obniżają wyniku w rankingu.</p>
  </div>;
}

/** Wallet shop shown between duels. */
export function ShopPanel({room, send, disabled}) {
  const e = room.economyPanel;
  if (!e?.shopOpen || ['v11_returns', 'v11_winner'].includes(e.phase)) return null;
  return <details className="panel shop-panel">
    <summary><span>🛒 Sklep</span><b>{e.wallet.toFixed(2)} pkt</b></summary>
    <ShopItems room={room} send={send} disabled={disabled}/>
  </details>;
}

/** Winner decision and last-chance returns: a modal the affected players must answer. */
export function EconomyDialog({room, send, disabled, error}) {
  const e = room.economyPanel;
  if (!e) return null;
  const pname = id => room.players.find(p => p.id === id)?.name || 'Gracz';
  if (e.phase === 'v11_winner' && !e.canChoose) return <div className="notice notice--info" role="status">{pname(e.winner)} decyduje, czy gra dalej.</div>;
  if (!(e.phase === 'v11_returns' || e.phase === 'v11_winner' && e.canChoose)) return null;
  const winner = room.players.find(p => p.id === e.winner);
  return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="economy-title">
    <div className="modal__box">
      {e.phase === 'v11_winner' ? <>
        <span className="eyebrow">Wygrany pojedynek</span>
        <h2 id="economy-title">🏆 Wygrana! Co dalej?</h2>
        <p>{winner?.name || 'Zwycięzca'} zachowuje kategorię <strong>{winner?.category || '—'}</strong>.</p>
        {e.lastReward && <div className="reward"><div><b>+{e.lastReward.base.toFixed(2)}</b><span>za pojedynek</span></div><div><b>+{e.lastReward.bonus.toFixed(2)}</b><span>premia za serię</span></div></div>}
        <div className="choice-grid">
          <button className="btn btn--lg" disabled={disabled} onClick={() => send('V11_CHOICE', {choice: 'rest'})}><span className="choice-grid__icon" aria-hidden="true">☕</span>Odpoczywam<small>Oddaję kolejkę, seria się kończy</small></button>
          <button className="btn btn--primary btn--lg" disabled={disabled} onClick={() => send('V11_CHOICE', {choice: 'continue'})}><span className="choice-grid__icon" aria-hidden="true">⚔️</span>Gram dalej<small>2. wygrana z rzędu +25%, kolejne +50%</small></button>
        </div>
      </> : <>
        <span className="eyebrow">Przed zakończeniem gry</span>
        <h2 id="economy-title">Powroty</h2>
        <p>Gra nie ogłosi zwycięzcy, dopóki uprawnieni gracze nie kupią powrotu albo nie zrezygnują.</p>
        <p className="muted">Czekamy na: {e.waitingFor.map(p => p.name).join(', ')}</p>
        {e.canPass && <button className="btn" disabled={disabled} onClick={() => send('V11_PASS_RETURN')}>Rezygnuję z powrotu</button>}
      </>}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      <h3 className="shop-title">🛒 Sklep · {e.wallet.toFixed(2)} pkt</h3>
      <ShopItems room={room} send={send} disabled={disabled}/>
    </div>
  </div>;
}

/** Spectators in solo mode type their guesses. */
export function AudiencePanel({room, send, disabled}) {
  const a = room.audience, d = room.duel;
  const [draft, setDraft] = useState(''), [open, setOpen] = useState(true);
  useEffect(() => setDraft(''), [d?.questionKey]);
  if (!a || room.settings.mode === 'teams') return null;
  if (!d) return room.phase === 'finished' && a.ranking.some(p => p.points > 0) ? <section className="panel"><span className="eyebrow">Liga widzów</span><h3>Końcowy ranking widzów</h3><Ranking rows={a.ranking}/></section> : null;
  if (d.ids.includes(room.you) || d.adminId === room.you) return null;
  const submit = () => { if (a.eligible && !a.submitted && draft.trim()) send('AUDIENCE_ANSWER', {text: draft, questionKey: d.questionKey}); };
  return <section className="panel audience">
    <div className="panel__head"><span className="eyebrow">Liga widzów · {a.points.toFixed(1)} pkt</span><button className="btn btn--ghost btn--sm" onClick={() => setOpen(v => !v)}>{open ? 'Zwiń' : 'Rozwiń'}</button></div>
    {open && <>
      <p className="muted small">Wpisz odpowiedź na bieżące pytanie: +0,1 pkt za trafienie, maks. 0,5 pkt na pojedynek.</p>
      <form className="inline-form" onSubmit={e => { e.preventDefault(); submit(); }}>
        <input aria-label="Twoja odpowiedź" maxLength={160} placeholder="Twoja odpowiedź…" value={a.submitted ? a.myText : draft} disabled={a.submitted || !a.eligible || disabled} onChange={e => setDraft(e.target.value)}/>
        <button className="btn btn--primary" type="submit" disabled={disabled || !a.eligible || a.submitted || !draft.trim()}>{a.submitted ? 'Zapisano' : 'Typuj'}</button>
      </form>
      {a.feedback && <p className="small">{a.feedback}</p>}
      <details><summary>Ranking widzów</summary><Ranking rows={a.ranking}/></details>
    </>}
  </section>;
}

function Ranking({rows}) {
  return <ol className="mini-ranking">{rows.map(p => <li key={p.id}><span>{p.name}</span><b>{p.points.toFixed(1)}</b></li>)}</ol>;
}

/** Report the current question; host and judge also see all reports. */
export function QuestionReports({room, send, disabled}) {
  const q = room.questionPanel, reports = room.questionReports || [];
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [q?.key]);
  if (!q && !reports.length) return null;
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(reports, null, 2)], {type: 'application/json'})), link = document.createElement('a');
    link.href = url; link.download = `zgloszenia-${room.code}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="question-reports">
    {q && <details>
      <summary>⚑ {q.reported ? 'Pytanie zgłoszone' : 'Zgłoś błąd w pytaniu'}</summary>
      {!q.reported && <form className="inline-form" onSubmit={e => { e.preventDefault(); send('Q12_REPORT', {questionKey: q.key, reason}); }}>
        <input aria-label="Powód zgłoszenia" maxLength={500} placeholder="Np. błędna odpowiedź, dwuznaczność" value={reason} onChange={e => setReason(e.target.value)}/>
        <button className="btn" type="submit" disabled={disabled || reason.trim().length < 3}>Wyślij</button>
      </form>}
    </details>}
    {reports.length > 0 && <details>
      <summary>Zgłoszenia ({reports.length})</summary>
      <ul className="report-list">{reports.map(r => <li key={r.id}><strong>{r.category}</strong> · {r.prompt}<small>{r.reason} · {r.status === 'skipped' ? 'pominięte' : 'otwarte'}</small></li>)}</ul>
      <button className="btn btn--sm" onClick={download}>Pobierz JSON</button>
    </details>}
  </div>;
}

/** Teams mode: lobby, captain draft and nominations. */
export function TeamScreen({room, send, disabled}) {
  const me = room.players.find(p => p.id === room.you), r = room.roundControl, host = room.hostId === room.you;
  const who = id => room.players.find(p => p.id === id)?.name || 'Gracz';
  if (room.phase === 'lobby') {
    const ready = room.players.filter(p => p.ready && p.connected).length, canStart = room.players.length >= 4 && room.players.every(p => p.connected && p.ready);
    return <div className="stack">
      <section className="panel action-bar">
        <div><span className="eyebrow">Tryb drużynowy</span><h2>Losowanie kapitanów</h2><p className="muted">Po starcie losujemy dwóch kapitanów, którzy na zmianę dobierają graczy. Kategorie są losowane w każdej rundzie. Minimum 4 osoby.</p></div>
        <div className="action-bar__actions">
          <button className={`btn ${me.ready ? 'btn--success' : 'btn--primary'}`} disabled={disabled} onClick={() => send('READY')}>{me.ready ? '✓ Gotowy · cofnij' : 'Jestem gotowy'}</button>
          {host && <>
            <label className="field field--inline">Czas<select value={room.settings.seconds || 45} disabled={disabled} onChange={e => send('SETTINGS', {seconds: +e.target.value})}>{[30, 45, 60, 90].map(n => <option key={n} value={n}>{n} s</option>)}</select></label>
            <button className="btn" disabled={disabled} onClick={() => send('MODE', {mode: 'solo'})}>Tryb solo</button>
            <button className="btn btn--primary" disabled={disabled || !canStart} onClick={() => send('START')}>Rozpocznij losowanie</button>
          </>}
        </div>
      </section>
      <section className="panel">
        <div className="panel__head"><h3>Gracze</h3><span className="pill">{ready}/{room.players.length} gotowych</span></div>
        <div className="player-list">{room.players.map(p => <div className="player-row" key={p.id}>
          <PlayerAvatar name={p.name}/><div className="player-row__id"><strong>{p.name}{p.id === me.id ? ' · TY' : ''}</strong><small>{p.connected ? 'Online' : 'Offline'} · {p.ready ? 'Gotowy' : 'Czeka'}</small></div>
          {host && !p.connected && <button className="btn btn--ghost btn--sm" disabled={disabled} onClick={() => send('REMOVE_OFFLINE', {playerId: p.id})}>Usuń</button>}
        </div>)}</div>
      </section>
    </div>;
  }
  if (room.phase === 'team_draft') {
    const picker = r.captains[r.draftTurn];
    return <div className="stack">
      <section className="panel"><span className="eyebrow">Dobór drużyn</span><h2>Wybiera kapitan {who(picker)}</h2><p className="muted">Po każdym wyborze kolej przechodzi do drugiego kapitana.</p></section>
      <div className="team-grid">{['A', 'B'].map(team => <section className={`panel team-card${r.draftTurn === team ? ' is-turn' : ''}`} data-team={team} key={team}>
        <h3>Drużyna {team}</h3><p className="muted">Kapitan: {who(r.captains[team])}</p>
        <div className="player-list">{(r.draftTeams?.[team] || []).map(id => <div className="player-row" key={id}><PlayerAvatar name={who(id)} color={teamColor(team)}/><strong>{who(id)}</strong></div>)}</div>
      </section>)}</div>
      <section className="panel"><h3>Dostępni gracze</h3>
        {me.id === picker ? <div className="choice-list">{(r.draftCandidates || []).map(id => <button className="btn" data-team={r.draftTurn} key={id} disabled={disabled} onClick={() => send('DRAFT_PICK', {playerId: id})}>{who(id)}</button>)}</div> : <p className="muted">Teraz wybiera kapitan {who(picker)}.</p>}
      </section>
    </div>;
  }
  if (room.phase === 'team_nominate') return <div className="stack">
    <section className="panel"><span className="eyebrow">Runda {r.number}</span><h2>{r.category}</h2><p className="muted">Kategoria wylosowana z puli nierozegranych. Kapitanowie wystawiają po jednym zawodniku.</p></section>
    <div className="team-grid">{['A', 'B'].map(team => {
      const candidates = r.candidates[team] || [], last = r.lastNominees?.[team], captain = me.id === r.captains[team];
      return <section className={`panel team-card${captain ? ' is-turn' : ''}`} data-team={team} key={team}>
        <div className="panel__head"><h3>Drużyna {team}</h3><span className="pill">{r.teamPoints?.[team] ?? 0} pkt</span></div>
        <p className="muted small">Kapitan: {who(r.captains[team])} · ostatnio grał: {last ? who(last) : 'nikt'}</p>
        <p><strong>{r.nominees[team] ? `Do pojedynku: ${who(r.nominees[team])}` : 'Wybierz zawodnika do pojedynku'}</strong></p>
        <div className="choice-list">{candidates.map(id => {
          const s = r.playerStats?.[id] || {wins: 0, losses: 0, winRate: 0};
          return <button className={`btn btn--choice${r.nominees[team] === id ? ' is-selected' : ''}`} key={id} disabled={disabled || !captain} onClick={() => send('NOMINATE', {playerId: id})}><strong>{who(id)}</strong><small>{s.wins} wygr. · {s.losses} przegr. ({s.winRate}%)</small></button>;
        })}</div>
        {!candidates.length && !r.nominees[team] && <p className="muted">{last ? 'Ostatnio wystawiony zawodnik pauzuje. Czekaj na kolejnego gracza.' : 'Brak dostępnych graczy online.'}</p>}
      </section>;
    })}</div>
    {r.recap && <p className="notice">Poprzedni pojedynek: {who(r.recap.winner)} pokonał {who(r.recap.loser)}.</p>}
  </div>;
  return <section className="panel"><span className="eyebrow">Tryb drużynowy</span><h2>Przygotowanie rundy</h2><p className="muted">Kolejna kategoria: {r?.category || 'zostanie wylosowana'}.</p></section>;
}

export {plural};
