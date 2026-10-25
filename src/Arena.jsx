import React, {useEffect, useRef, useState} from 'react';
import {CategorySheet, DEFAULT_SETTINGS, FootballerCard, getCategoryEmoji, InfoButton, PixelTimer, PlayerAvatar, SettingsSheet, SoundtrackPlayer, TerritoryTile} from './components.jsx';
import {AudiencePanel, CardPanel, EconomyDialog, QuestionReports, ShopPanel, ShopSheet, TeamScreen, plural} from './panels.jsx';
import {CHOICE_RULE, categoryDescription, isChoiceQuestion} from './categoryInfo.js';
import './arena.css';

function saved() { try { return JSON.parse(sessionStorage.getItem('arena-v6') || 'null'); } catch { return null; } }
const loadedImageUrls = new Set();
// Decoded images are kept referenced so the browser can paint them instantly when a question shows up.
// Preloaded images stay in the browser's HTTP cache only. Keeping ~1000 decoded bitmaps alive cost hundreds of MB of RAM
// and slowed the game down; decoding one cached image when its question appears takes milliseconds.
function preloadImage(url, signal) {
  return new Promise(resolve => {
    const image = new Image();
    let timeout, settled = false;
    const finish = loaded => { if (settled) return; settled = true; clearTimeout(timeout); signal.removeEventListener('abort', abort); image.onload = image.onerror = image.onabort = null; if (loaded) loadedImageUrls.add(url); image.src = ''; resolve(loaded); };
    const abort = () => { image.src = ''; finish(false); };
    image.decoding = 'async'; image.fetchPriority = 'low'; image.referrerPolicy = 'no-referrer';
    image.onload = () => image.decode().catch(() => {}).then(() => finish(true)); image.onerror = image.onabort = () => finish(false);
    signal.addEventListener('abort', abort, {once: true});
    timeout = setTimeout(() => { image.src = ''; finish(false); }, 15000);
    image.src = url;
  });
}
const avatarColor = (player, index) => player?.team === 'A' ? 'cyan' : player?.team === 'B' ? 'magenta' : index === undefined ? undefined : index === 1 ? 'magenta' : 'cyan';
const TABS = [['arena', 'Arena'], ['kategorie', 'Kategorie'], ['ranking', 'Ranking'], ['zasady', 'Zasady']];
const STATUS = {running: 'Na żywo', paused: 'Pauza', media: 'Obrazek', countdown: 'Start', ready: 'Gotowość'};

export default function Arena() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('arena-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [settings, setSettings] = useState(() => { try { return {...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('arena-settings') || '{}')}; } catch { return DEFAULT_SETTINGS; } }), [settingsOpen, setSettingsOpen] = useState(false), [shopOpen, setShopOpen] = useState(false);
  const [session, setSession] = useState(saved), [room, setRoom] = useState(null), [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const params = new URLSearchParams(location.search);
  const [name, setName] = useState(''), [code, setCode] = useState(() => params.get('room') || '');
  const [endpoint] = useState(() => params.get('backend') || import.meta.env.VITE_API_BASE_URL || '');
  const [infoCategory, setInfoCategory] = useState(null), [tab, setTab] = useState('arena'), [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(null), [imageError, setImageError] = useState(null), [imagePreload, setImagePreload] = useState(null);
  const [flash, setFlash] = useState(null), seenAnswer = useRef(null);
  const questionRef = useRef(null), [questionMinHeight, setQuestionMinHeight] = useState(0);
  const ref = useRef(null), sref = useRef(session), conn = useRef(false), lock = useRef(false);
  sref.current = session;

  useEffect(() => {
    document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = theme === 'dark' ? '#000000' : '#f5f5f7';
    try { localStorage.setItem('arena-theme', theme); } catch {}
  }, [theme]);
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--text-scale', settings.textScale); root.setProperty('--image-scale', settings.imageScale); root.setProperty('--ui-scale', settings.uiScale);
    try { localStorage.setItem('arena-settings', JSON.stringify(settings)); } catch {}
  }, [settings]);
  // The counter seen with the first loaded state is the baseline, so reloading the page does not replay an old flash.
  const lastAnswerN = room ? room.lastAnswer?.n ?? 0 : null;
  useEffect(() => {
    if (lastAnswerN === null) return;
    if (seenAnswer.current === null || lastAnswerN <= seenAnswer.current) { seenAnswer.current = lastAnswerN; return; }
    seenAnswer.current = lastAnswerN;
    const last = room.lastAnswer;
    const choice = isChoiceQuestion(last.category, last.prompt), good = last.kind === 'good';
    setFlash({n: last.n, tone: good ? 'good' : choice ? 'bad' : 'next', text: good ? 'Dobrze' : choice ? 'Źle' : 'Pominięte – kolejne pytanie'});
    const t = setTimeout(() => setFlash(f => f?.n === last.n ? null : f), 500);
    return () => clearTimeout(t);
  }, [lastAnswerN]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(t); }, [notice]);

  function accept(r) {
    if (!r || r.code !== sref.current?.code) return;
    if (r.rulesVersion !== 6) { setError('Wymagany backend v6. Zainstaluj aktualizację i utwórz nowe lobby.'); return; }
    if (ref.current && (r.rev < ref.current.rev || r.rev === ref.current.rev && r.serverNow < ref.current.serverNow)) return;
    const previous = ref.current; ref.current = r;
    // Clock-only updates of a running question do not need a re-render; timers run locally.
    if (previous && previous.duel?.status === 'running' && r.rev === previous.rev && r.duel?.status === 'running' && r.duel.questionKey === previous.duel.questionKey && r.duel.turn === previous.duel.turn) return;
    setRoom(r);
  }
  function store(s) {
    try { s ? sessionStorage.setItem('arena-v6', JSON.stringify(s)) : sessionStorage.removeItem('arena-v6'); } catch {}
    sref.current = s; setSession(s); ref.current = null; setRoom(null); conn.current = false; setOnline(false);
  }
  async function request(path, data, token, base = sref.current?.base || '') {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
    try {
      const res = await fetch(base + path, {method: 'POST', headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})}, body: JSON.stringify(data), signal: c.signal});
      let x;
      try { x = await res.json(); } catch { throw Error('Backend gry zwrócił nieprawidłową odpowiedź (' + res.status + '). Sprawdź VITE_API_BASE_URL i wdrożenie backendu.'); }
      if (x.state) accept(x.state);
      if (!res.ok) throw Error(x.error || 'Błąd serwera.');
      return x;
    } catch (e) { if (e.name === 'AbortError') throw Error('Serwer nie odpowiedział.'); throw e; } finally { clearTimeout(t); }
  }
  async function enter(create) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const base = endpoint.trim().replace(/\/$/, '');
      if (base && !/^https?:\/\//.test(base)) throw Error('Podaj adres HTTP lub HTTPS.');
      const s = await request(create ? '/api/create' : '/api/join', {name: name.trim(), code}, null, base);
      if (params.has('room')) { const url = new URL(location.href); url.searchParams.delete('room'); url.searchParams.delete('backend'); history.replaceState(null, '', url); }
      store({...s, base});
    } catch (e) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  }
  async function send(type, data = {}) {
    if (lock.current || !conn.current || !ref.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await request('/api/rooms/' + sref.current.code + '/action', {type, rev: ref.current.rev, ...data}, sref.current.token); }
    catch (e) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  }

  useEffect(() => {
    if (!session) return;
    let active = true;
    const es = new EventSource((session.base || '') + '/api/rooms/' + session.code + '/stream?token=' + encodeURIComponent(session.token));
    es.onopen = () => { if (active) { conn.current = true; setOnline(true); } };
    es.onmessage = e => { if (active) try { accept(JSON.parse(e.data)); conn.current = true; setOnline(true); } catch { setError('Nieprawidłowy stan serwera.'); } };
    es.onerror = () => { if (active) { conn.current = false; setOnline(false); } };
    return () => { active = false; es.close(); conn.current = false; };
  }, [session]);

  // Images are preloaded per category: only categories in play (current duel first), not the whole bank.
  // The server learns which categories are ready, so their image questions start without a loading pause.
  const [manifest, setManifest] = useState(null);
  const preloadQueue = useRef(null), neededRef = useRef([]);
  const neededCategories = !room ? [] : [...new Set([room.duel?.category, ...room.players.filter(p => p.lives > 0 || room.phase === 'lobby').map(p => p.category)].filter(Boolean))];
  neededRef.current = neededCategories;
  useEffect(() => {
    setManifest(null); setImagePreload(null);
    if (!session) return;
    const controller = new AbortController();
    preloadQueue.current = {running: false, done: [], failed: [], controller};
    fetch((session.base || '') + '/api/rooms/' + session.code + '/media', {headers: {Authorization: 'Bearer ' + session.token}, signal: controller.signal})
      .then(response => { if (!response.ok) throw Error('Nie udało się pobrać listy obrazków (' + response.status + ').'); return response.json(); })
      .then(json => setManifest(json.byCategory || {}))
      .catch(e => { if (e.name !== 'AbortError') setImagePreload({status: 'error', message: e.message}); });
    return () => controller.abort();
  }, [session]);
  useEffect(() => {
    const queue = preloadQueue.current;
    if (!manifest || !queue || queue.running) return;
    const full = url => url.startsWith('/media/') ? (sref.current?.base || '') + url : url;
    const pending = () => neededRef.current.find(category => !queue.done.includes(category));
    const run = async () => {
      queue.running = true;
      try {
        for (let category = pending(); category && !queue.controller.signal.aborted; category = pending()) {
          const urls = (manifest[category] || []).filter(url => !loadedImageUrls.has(full(url)));
          let next = 0, done = 0;
          setImagePreload({status: 'loading', category, done, total: urls.length});
          const worker = async () => {
            for (let url = urls[next++]; url && !queue.controller.signal.aborted; url = urls[next++]) {
              if (!await preloadImage(full(url), queue.controller.signal)) {
                await new Promise(resolve => setTimeout(resolve, 400));
                if (!await preloadImage(full(url), queue.controller.signal) && !queue.failed.includes(url)) queue.failed.push(url);
              }
              done++;
              if (done % 8 === 0) setImagePreload({status: 'loading', category, done, total: urls.length});
            }
          };
          await Promise.all(Array.from({length: Math.min(6, urls.length)}, worker));
          if (queue.controller.signal.aborted) return;
          queue.done = [...queue.done, category];
          setImagePreload({status: 'complete', categories: queue.done, failed: queue.failed.slice(0, 1000)});
        }
      } finally {
        queue.running = false;
        if (!queue.controller.signal.aborted && pending()) run();
      }
    };
    run();
  }, [manifest, neededCategories.join('|')]);

  // Images cached by the game server are served from the backend, which may live on another origin than this page.
  const mediaUrl = src => src?.startsWith('/media/') ? (session?.base || '') + src : src;
  const d = room?.duel, me = room?.players.find(p => p.id === room.you), host = !!room && room.hostId === room.you;
  const judge = !!d && d.adminId === room.you, participant = !!d && d.ids.includes(room.you), disabled = busy || !online;
  const teams = room?.settings.mode === 'teams';
  const person = id => room?.players.find(p => p.id === id), pname = id => person(id)?.name || 'Gracz';
  const alive = room?.players.filter(p => p.lives > 0) || [];
  const rank = room ? [...room.players].sort((a, b) => b.lives - a.lives || b.points - a.points || b.trophies.length - a.trophies.length) : [];
  const scoreRank = room ? [...room.players].sort((a, b) => b.points - a.points || b.wins - a.wins || b.correct - a.correct) : [];
  const displayCategory = p => teams ? room.roundControl?.category || d?.category : p.category || (d?.ids.includes(p.id) ? d.category : null);
  const q = room?.questionPanel;

  useEffect(() => {
    if (d?.status === 'media' && (loaded === d.questionKey || loadedImageUrls.has(mediaUrl(d.image))) && (judge || participant) && !d.mediaReady.includes(room.you) && !busy && online) send('IMAGE_READY', {questionKey: d.questionKey});
  }, [room?.rev, d?.status, d?.questionKey, d?.image, loaded, imagePreload?.done, busy, online]);

  // Tell the server which categories have all images ready, so their questions start without a loading pause.
  useEffect(() => {
    if (imagePreload?.status !== 'complete' || !room || !online || busy) return;
    if ((room.mediaCategories || []).join('|') !== imagePreload.categories.join('|')) send('MEDIA_PRELOADED', {failed: imagePreload.failed, categories: imagePreload.categories});
  }, [imagePreload, room?.mediaCategories?.join('|'), online, busy]);

  useEffect(() => {
    const fn = e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
      const r = ref.current, duel = r?.duel;
      if (!duel || duel.adminId !== r.you) return;
      if (e.code === 'Space') { e.preventDefault(); send(duel.status === 'paused' ? 'RESUME' : 'PAUSE'); }
      if (duel.status === 'running' && e.code === 'ArrowRight') { e.preventDefault(); send('ANSWER', {kind: 'good', questionKey: duel.questionKey}); }
      if (duel.status === 'running' && e.key.toLowerCase() === 'p') send('ANSWER', {kind: 'skip', questionKey: duel.questionKey});
      if (e.key.toLowerCase() === 'z' && r.canUndo) send('UNDO');
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const hearts = (p, label = `Życia gracza ${p.name}`) => <span className="life-meter" role="img" aria-label={`${label}: ${p.lives} z 3`}>{[0, 1, 2].map(i => <span className={`life-meter__heart${i < p.lives ? ' is-filled' : ''}`} key={i} aria-hidden="true">♥</span>)}</span>;
  const previous = () => room?.previous && <div className="previous" aria-live="polite"><span className="eyebrow">Poprzednia odpowiedź</span><strong>{room.previous.answer}</strong><details><summary>Pokaż pytanie</summary><p>{room.previous.prompt}</p></details></div>;

  async function invite() {
    try {
      const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', room.code);
      if (session.base) u.searchParams.set('backend', session.base);
      await navigator.clipboard.writeText(u.toString()); setNotice('Skopiowano link z zaproszeniem.');
    } catch { setNotice('Udostępnij adres gry i kod ' + room.code); }
  }
  async function leave() {
    if (!confirm('Opuścić lobby? Nie odzyskasz miejsca w trwającej grze.')) return;
    try { await request('/api/rooms/' + session.code + '/leave', {}, session.token); } catch {}
    store(null);
  }
  function toggleFullscreen() { const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); p?.catch(e => setError(e.message)); }

  const categoryPicker = () => {
    const needle = search.trim().toLocaleLowerCase('pl'), list = room.categories.filter(c => c.toLocaleLowerCase('pl').includes(needle));
    return <div className="category-picker">
      <div className="category-picker__bar">
        <input type="search" aria-label="Szukaj kategorii" value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj kategorii…"/>
        <span className="muted small">{room.availableCategories.length} wolnych · {room.retired.length} rozegranych</span>
      </div>
      <div className="tile-grid">{list.map(c => {
        const selected = me.category === c, retired = room.retired.includes(c), available = room.availableCategories.includes(c);
        return <TerritoryTile key={c} category={c} count={room.categoryCounts[c]} selected={selected} state={selected ? 'selected' : retired ? 'played' : available ? 'available' : 'locked'} status={retired ? 'rozegrana' : selected ? 'twoja' : available ? 'wolna' : 'zajęta'} disabled={disabled || !available} onClick={() => send('CATEGORY', {category: c})} onInfo={() => setInfoCategory(c)}/>;
      })}</div>
      {!list.length && <p className="muted">Brak pasujących kategorii.</p>}
    </div>;
  };

  const roster = () => <section className="panel">
    <div className="panel__head"><h3>Gracze</h3><span className="pill">{alive.length}/{room.players.length}</span></div>
    <div className="player-list">{room.players.map(p => <article className={`player-row${p.id === me.id ? ' is-self' : ''}${p.id === d?.turn ? ' is-turn' : ''}${p.lives === 0 && !teams ? ' is-out' : ''}`} data-team={p.team || ''} key={p.id}>
      <PlayerAvatar name={p.name} color={avatarColor(p)}/>
      <div className="player-row__id">
        <strong>{p.name}{p.id === me.id ? ' · TY' : ''}</strong>
        <small>{p.team ? `Drużyna ${p.team} · ` : ''}{p.connected ? 'online' : 'offline'}{p.id === d?.turn ? ' · odpowiada' : ''}</small>
        {!teams && displayCategory(p) && <small className="player-row__cat">{getCategoryEmoji(displayCategory(p))} {displayCategory(p)}</small>}
        {!teams && <small className="muted">{p.armed ? `Aktywna karta: ${room.cardTypes[p.armed]?.name || p.armed}` : p.card ? `Karta ${p.cardUsed ? 'użyta' : 'w ręku'}` : 'Bez karty'}{d?.skip5?.playerId === p.id ? ` · darmowe pominięcia ${d.skip5.remaining}/5` : ''}</small>}
      </div>
      <div className="player-row__side"><b>{p.points}<small> pkt</small></b>{!teams && hearts(p)}</div>
      {room.phase === 'choose' && room.challengerId === me.id && p.id !== me.id && <button className="btn btn--primary btn--sm player-row__action" disabled={disabled || !room.eligibleOpponentIds.includes(p.id)} onClick={() => send('CHALLENGE', {opponent: p.id})}>{room.protectedId === p.id && alive.length > 2 ? 'Ochrona' : '⚔ Wyzwij'}</button>}
    </article>)}</div>
  </section>;

  const sidebar = () => <aside className="arena-side">
    <CardPanel room={room} send={send} disabled={disabled}/>
    <AudiencePanel room={room} send={send} disabled={disabled}/>
    <ShopPanel room={room} send={send} disabled={disabled}/>
    {roster()}
    {(room.lastDecision || room.log.length > 0) && <section className="panel">
      <h3>Ostatnie wydarzenia</h3>
      <ul className="event-list">{room.log.slice(-4).reverse().map(log => <li key={log.round}><b>Runda {log.round}</b> {pname(log.winner)} pokonuje {pname(log.loser)} · {log.category}{!teams && ` · zostało ${log.livesLeft} ${plural(log.livesLeft, 'życie', 'życia', 'żyć')}`}</li>)}</ul>
    </section>}
  </aside>;

  const RULES = [
    ['categoryPick', 'Kategorie graczy', [['choose', 'Każdy wybiera swoją'], ['random', 'Losowane']]],
    ['opponentPick', 'Dobór rywala', [['choose', 'Wyzywający wybiera'], ['random', 'Losowy rywal'], ['pair', 'Losowa para graczy']]],
    ['duelCategory', 'Kategoria pojedynku', [['opponent', 'Kategoria rywala'], ['random', 'Losowo: jednego z dwóch graczy']]],
  ];
  const RULE_HINTS = {
    random: 'Każdy dostaje losową, inną kategorię – także po przegranej.',
    pair: 'Losujemy dwie osoby: pierwszeństwo mają ci, którzy grali najmniej; nikt nie gra trzeci raz z rzędu i ta sama para nie trafia na siebie dwa razy pod rząd.',
    opponent: 'Losowy rywal: pierwszeństwo mają gracze z najmniejszą liczbą pojedynków, bez powtórki poprzedniego rywala.',
    duelCategory: 'Kategoria pojedynku jest losowana 50/50 spośród kategorii dwóch graczy, którzy grają – wyzywający też może zagrać u siebie.',
  };
  const lobbyRules = () => {
    const rules = room.settings.rules || {};
    const hints = [rules.categoryPick === 'random' && RULE_HINTS.random, rules.opponentPick === 'pair' && RULE_HINTS.pair, rules.opponentPick === 'random' && RULE_HINTS.opponent, rules.duelCategory === 'random' && RULE_HINTS.duelCategory].filter(Boolean);
    return <section className="panel lobby-rules">
      <div className="panel__head"><div><span className="eyebrow">Zasady lobby</span><h3>Jak gramy?</h3></div>{!host && <span className="pill">ustawia gospodarz</span>}</div>
      <div className="lobby-rules__grid">{RULES.map(([key, label, options]) => <label className="field" key={key}>{label}
        <select value={rules[key]} disabled={!host || disabled} onChange={e => send('LOBBY_RULES', {[key]: e.target.value})}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
      </label>)}</div>
      {hints.length > 0 && <ul className="lobby-rules__hints">{hints.map(text => <li key={text}>{text}</li>)}</ul>}
    </section>;
  };
  const lobby = () => {
    const readyCount = room.players.filter(p => p.ready && p.connected && (teams || p.category)).length, needed = teams ? 4 : 3;
    const canStart = room.players.length >= needed && room.players.every(p => p.ready && p.connected && (teams || p.category));
    return <div className="stack">
      <section className="panel action-bar">
        <div>
          <span className="eyebrow">Przygotowanie · {readyCount}/{room.players.length} gotowych</span>
          <h2>{!me.category ? (room.settings.rules?.categoryPick === 'random' ? 'Losujemy kategorie…' : 'Wybierz swoją kategorię') : me.ready ? 'Czekamy na pozostałych' : 'Potwierdź gotowość'}</h2>
          <p className="muted small">Start wymaga co najmniej {needed} graczy online z wybraną kategorią.{!host && ' Mecz uruchamia gospodarz.'}</p>
        </div>
        <div className="action-bar__actions">
          <button className={`btn ${me.ready ? 'btn--success' : 'btn--primary'}`} disabled={disabled || !me.category} onClick={() => send('READY')}>{me.ready ? '✓ Gotowy · cofnij' : 'Jestem gotowy'}</button>
          {host && <>
            <label className="field field--inline">Tryb<select value={room.settings.mode || 'solo'} disabled={disabled} onChange={e => send('MODE', {mode: e.target.value})}><option value="solo">Każdy na każdego</option><option value="teams">Drużyny (min. 4)</option></select></label>
            <label className="field field--inline">Czas<select value={room.settings.seconds} disabled={disabled} onChange={e => send('SETTINGS', {seconds: +e.target.value})}>{[30, 45, 60, 90].map(n => <option key={n} value={n}>{n} s</option>)}</select></label>
            <button className="btn btn--primary" disabled={disabled || !canStart} onClick={() => send('START')}>▶ Rozpocznij mecz</button>
          </>}
        </div>
      </section>
      {!teams && lobbyRules()}
      <div className="lobby-grid">
        <section className="panel">
          <div className="panel__head"><div><span className="eyebrow">Twój obszar</span><h3>{me.category ? <>{getCategoryEmoji(me.category)} {me.category}</> : 'Kategorie'}</h3></div><span className="pill">{room.totalQuestions} pytań</span></div>
          {room.settings.rules?.categoryPick === 'random' && !teams ? <p className="muted">🎲 Kategorie są losowane. Twoja kategoria jest widoczna powyżej i na liście graczy.</p> : categoryPicker()}
        </section>
        <aside className="arena-side">
          <section className="panel">
            <div className="panel__head"><h3>Gracze</h3><span className="pill">{room.players.length}</span></div>
            <div className="player-list">{room.players.map(p => <article className={`player-row${p.id === me.id ? ' is-self' : ''}`} key={p.id}>
              <PlayerAvatar name={p.name} color={avatarColor(p)}/>
              <div className="player-row__id"><strong>{p.name}{p.id === me.id ? ' · TY' : ''}</strong><small>{p.connected ? 'online' : 'offline'} · {p.ready ? '✓ gotowy' : 'czeka'}</small>{p.category && <small className="player-row__cat">{getCategoryEmoji(p.category)} {p.category}</small>}</div>
              {host && !p.connected && <button className="btn btn--ghost btn--sm" aria-label={`Usuń nieobecnego gracza ${p.name}`} disabled={disabled} onClick={() => send('REMOVE_OFFLINE', {playerId: p.id})}>Usuń</button>}
            </article>)}</div>
          </section>
          {imagePreload && imagePreload.status !== 'complete' && <p className="muted small">{imagePreload.status === 'error' ? imagePreload.message + ' Obrazki będą pobierane w trakcie gry.' : `Wczytywanie obrazków (${imagePreload.category}): ${imagePreload.done} / ${imagePreload.total}`}</p>}
        </aside>
      </div>
    </div>;
  };

  const duel = () => <div className="stack">
    <div className="duel-head">
      <div><span className="eyebrow">Pojedynek · runda {room.round + 1}</span><h2 className="duel-head__title" title={categoryDescription(d.category)}>{getCategoryEmoji(d.category)} {d.category} <InfoButton category={d.category} onClick={() => setInfoCategory(d.category)}/></h2></div>
      <span className="duel-head__pills">{d.randomCategory && <span className="pill">🎲 Wylosowana kategoria: {pname(d.ids.find(id => person(id)?.category === d.category)) || 'gracza'}</span>}<span className="pill">⚖ Sędzia: {pname(d.adminId)}</span></span>
    </div>
    <div className="duel-players">{d.ids.map((id, index) => {
      const player = person(id), active = d.turn === id;
      return <section className={`panel duel-player${active ? ' is-active' : ''}`} data-side={index} key={id}>
        <div className="duel-player__who"><PlayerAvatar name={pname(id)} color={avatarColor(player, index)}/><strong>{pname(id)}</strong>{!teams && hearts(player)}</div>
        <PixelTimer milliseconds={d.remaining[id]} active={active && d.status === 'running' && d.freeze?.playerId !== id} label={pname(id)}/>
        <small className="duel-player__state">{active ? '● Odpowiada' : 'Czeka'}{player.armed ? ' · ' + room.cardTypes[player.armed].name : ''}{d.freeze?.playerId === id ? (active ? ' · ❄ Zegar zamrożony' : ` · ❄ Zamrożenie czeka (${Math.ceil(d.freeze.left / 1000)} s)`) : ''}{d.fog?.target === id ? ' · 🌫 Mgła' : ''}</small>
      </section>;
    })}</div>
    <section ref={questionRef} style={{minHeight: questionMinHeight || undefined}} className={`panel question${d.status === 'paused' ? ' is-paused' : ''}`}>
      {d.status === 'ready' ? <>
        <h2>Potwierdźcie gotowość</h2>
        <div className="ready-list">{[...d.ids, d.adminId].map(id => <span className={`pill${d.ready.includes(id) ? ' pill--ok' : ''}`} key={id}>{d.ready.includes(id) ? '✓' : '○'} {pname(id)}</span>)}</div>
        {(judge || participant) && <button className="btn btn--primary btn--lg" disabled={disabled || d.ready.includes(me.id)} onClick={() => send('DUEL_READY')}>{d.ready.includes(me.id) ? '✓ Gotowe' : 'Jestem gotowy'}</button>}
      </> : d.status === 'countdown' ? <><span className="eyebrow">Zaczynamy za</span><div className="countdown">{d.countdown}</div></> : <>
        <span className="eyebrow">{d.status === 'paused' ? '⏸ Pauza' : d.status === 'media' ? 'Wczytywanie obrazka · limit 6 s' : 'Odpowiedz na głos'}</span>
        <div className={'question__body' + (d.fogged && d.turn === me.id ? ' is-fogged' + (d.status === 'running' ? '' : ' is-held') : '')} key={d.questionKey}>
        {d.footballer ? <FootballerCard footballer={d.footballer}/> : <h2 className="question__prompt">{d.prompt}</h2>}
        {q?.format === 'clues' && <p className="muted small">Sędzia odsłania kolejne wskazówki. Szybka odpowiedź (do 1,5 s) daje dodatkowy punkt.</p>}
        {d.visual && (d.visual.startsWith('📅 ') ? (() => { const [day, ...month] = d.visual.slice(3).split(' '); return <div className="calendar-card" role="img" aria-label={d.visual.slice(3)}><span>{month.join(' ')}</span><b>{day}</b></div>; })() : <div className="visual-riddle" role="img" aria-label="Rebus do rozpoznania">{d.visual}</div>)}
        {d.privateHint && <div className="notice notice--hint">{d.privateHint}</div>}
        {d.audio && <SoundtrackPlayer src={d.audio} playKey={d.questionKey} running={d.status === 'running'} volume={settings.volume} onVolume={volume => setSettings(s => ({...s, volume}))}/>}
        {d.image && imageError !== d.questionKey && (d.zoom
          ? <div className={'zoom-frame' + (d.zoom.pixel ? ' is-pixel' : '') + (d.status === 'running' ? '' : ' is-held')} key={d.questionKey} style={{'--zx': d.zoom.x + '%', '--zy': d.zoom.y + '%'}}><img className="zoom-frame__img" decoding="sync" src={mediaUrl(d.image)} alt="Obrazek do rozpoznania" referrerPolicy="no-referrer" onLoad={() => setLoaded(d.questionKey)} onError={() => { setImageError(d.questionKey); setLoaded(d.questionKey); }}/></div>
          : <img className="quiz-image" decoding="sync" key={d.questionKey} src={mediaUrl(d.image)} alt="Obrazek do rozpoznania" referrerPolicy="no-referrer" onLoad={() => setLoaded(d.questionKey)} onError={() => { setImageError(d.questionKey); setLoaded(d.questionKey); }}/>)}
        {imageError === d.questionKey && (d.emoji ? <div className="emoji-fallback" role="img" aria-label="Ilustracja do rozpoznania">{d.emoji}</div> : <p>Grafika niedostępna. Sędzia może unieważnić pytanie bez kary.</p>)}
        </div>
        {d.status === 'running' && isChoiceQuestion(d.category, d.prompt) && <p className="rule-note">{CHOICE_RULE}</p>}
        <p className="muted">{d.status === 'media' ? `Wczytano u ${d.mediaReady.length}/3 osób.` : `Odpowiada ${pname(d.turn)}.`}</p>
        {d.turn === me.id && !judge && d.status === 'running' && <button className="btn" disabled={disabled} onClick={() => send('PLAYER_SKIP', {questionKey: d.questionKey})}>↷ Pomiń pytanie · {d.skip5?.playerId === me.id && d.skip5.remaining > 0 ? 'bez kary' : '−3 s'}</button>}
      </>}
      {previous()}
      <QuestionReports room={room} send={send} disabled={disabled}/>
    </section>
    {judge && <section className="panel judge-panel">
      <div className="panel__head"><span className="eyebrow">Panel sędziego · tylko dla Ciebie</span><span className={`status status--${d.status}`}>{STATUS[d.status] || d.status}</span></div>
      {d.answer && <div className="judge-answer" role="status" aria-live="polite"><span>Odpowiedź</span><strong>{d.answer}</strong></div>}
      <div className="judge-panel__main">
        <button className="btn btn--success btn--xl" disabled={disabled || d.status !== 'running'} onClick={() => send('ANSWER', {kind: 'good', questionKey: d.questionKey})}>✓ Zalicza <kbd>→</kbd></button>
        <button className="btn btn--warning btn--xl" disabled={disabled || d.status !== 'running'} onClick={() => send('ANSWER', {kind: 'skip', questionKey: d.questionKey})}>↷ Pomiń · −3 s <kbd>P</kbd></button>
      </div>
      <div className="judge-panel__tools">
        <button className="btn" disabled={disabled || !['running', 'paused', 'media', 'countdown'].includes(d.status)} onClick={() => send(d.status === 'paused' ? 'RESUME' : 'PAUSE')}>{d.status === 'paused' ? '▶ Wznów' : '⏸ Pauza'} <kbd>Spacja</kbd></button>
        <button className="btn" disabled={disabled || !room.canUndo} onClick={() => send('UNDO')}>↶ Cofnij <kbd>Z</kbd></button>
        {q?.format === 'clues' && <button className="btn" disabled={disabled || !q.canHint} onClick={() => send('Q12_HINT', {questionKey: q.key})}>💡 Następna wskazówka</button>}
        {q?.canSkip && <button className="btn" disabled={disabled} onClick={() => { if (confirm('Unieważnić to pytanie? Wynik i czas zostaną zachowane.')) send('Q12_SKIP', {questionKey: q.key}); }}>Unieważnij pytanie</button>}
        {d.status === 'media' && <button className="btn" disabled={disabled} onClick={() => send('VOID_IMAGE', {questionKey: d.questionKey})}>Anuluj niedostępny obrazek</button>}
      </div>
      <details className="judge-panel__manual"><summary>Ręczne rozstrzygnięcie pojedynku</summary><div className="choice-list">{d.ids.map(id => <button className="btn btn--sm" key={id} disabled={disabled} onClick={() => { if (confirm('Wygrywa ' + pname(id) + '?')) send('AWARD', {winner: id}); }}>Wygrywa {pname(id)}</button>)}</div></details>
    </section>}
    {host && !person(d.adminId)?.connected && <button className="btn btn--warning" disabled={disabled} onClick={() => send('REPLACE_ADMIN')}>Sędzia offline · wyznacz nowego</button>}
  </div>;

  const finished = () => {
    const top = rank[0], winners = teams ? [] : rank.filter(p => p.lives === top.lives && p.points === top.points && p.trophies.length === top.trophies.length);
    return <section className="panel finale">
      <span className="eyebrow">Koniec gry</span>
      <div className="finale__trophy" aria-hidden="true">🏆</div>
      <h1>{teams ? room.finishReason : winners.map(p => p.name).join(' i ')}</h1>
      {!teams && <p className="muted">{room.finishReason}</p>}
      <ol className="finale__podium">{scoreRank.slice(0, 3).map((p, i) => <li key={p.id}><span>{['🥇', '🥈', '🥉'][i]}</span><strong>{p.name}</strong><b>{p.points} pkt</b></li>)}</ol>
      {host && <button className="btn btn--primary btn--lg" disabled={disabled} onClick={() => send('REMATCH')}>↻ Rewanż</button>}
    </section>;
  };

  const arena = () => {
    const teamPhase = teams && ['lobby', 'team_draft', 'team_category', 'team_nominate'].includes(room.phase);
    if (teamPhase && room.phase === 'lobby') return <TeamScreen room={room} send={send} disabled={disabled}/>;
    if (teamPhase) return <div className="arena-layout"><div className="arena-main"><TeamScreen room={room} send={send} disabled={disabled}/></div>{sidebar()}</div>;
    if (room.phase === 'lobby') return lobby();
    return <div className="arena-layout">
      <div className="arena-main stack">
        <EconomyDialog room={room} send={send} disabled={disabled} error={error}/>
        {room.phase === 'category' && <section className="panel">
          <span className="eyebrow">Zmiana kategorii</span>
          <h2>{pname(room.pending[0])} wybiera nową kategorię</h2>
          {room.pending[0] === me.id ? <><p className="muted">Wolne, nierozegrane kategorie są znowu dostępne. Rozegrane pozostają zamknięte.</p>{categoryPicker()}</> : <p className="muted">Czekamy na wybór gracza {pname(room.pending[0])}.</p>}
        </section>}
        {room.phase === 'choose' && <section className="panel spotlight">
          <span className="eyebrow">{room.settings.rules?.opponentPick && room.settings.rules.opponentPick !== 'choose' ? 'Losowanie pojedynku' : room.round === 0 ? 'Pierwsze losowanie' : 'Zwycięzca wybiera'}</span>
          <h1>{room.settings.rules?.opponentPick === 'pair' ? '🎲' : pname(room.challengerId)}</h1>
          <p>{room.settings.rules?.opponentPick && room.settings.rules.opponentPick !== 'choose' ? 'Losujemy kolejny pojedynek… Jeśli to trwa, sprawdź, czy wszyscy są online – potrzebny jest też sędzia.' : room.challengerId === me.id ? 'Wybierz rywala – przycisk „Wyzwij” przy graczu na liście.' : 'Wybiera kolejnego rywala.'}</p>
          {room.protectedId && alive.length > 2 && <p className="muted">{pname(room.protectedId)} ma ochronę w tym pojedynku.</p>}
          {host && !person(room.challengerId)?.connected && <button className="btn btn--warning" disabled={disabled} onClick={() => send('REPLACE_CHOOSER')}>Wybierający offline · zastąp</button>}
        </section>}
        {d && duel()}
        {!d && room.previous && room.phase !== 'finished' && <section className="panel">{previous()}</section>}
        {room.phase === 'finished' && finished()}
        {room.canUndo && !judge && <button className="btn" disabled={disabled} onClick={() => send('UNDO')}>↶ Cofnij ostatnią decyzję (sędzia)</button>}
      </div>
      {sidebar()}
    </div>;
  };

  const rules = () => <section className="panel prose">
    <h2>{teams ? 'Zasady trybu drużynowego' : 'Zasady gry'}</h2>
    {teams ? <ol>
      <li>Po starcie losujemy dwóch kapitanów, którzy na zmianę dobierają graczy do drużyn.</li>
      <li>Każda runda losuje kategorię spośród nierozegranych. Rozegrana kategoria nie wraca.</li>
      <li>Kapitanowie wystawiają po jednym zawodniku do pojedynku.</li>
      <li>W trybie drużynowym nie ma żyć ani kart. Przegrana nie eliminuje gracza.</li>
      <li>Gra kończy się po wyczerpaniu kategorii. Wygrywa drużyna z większą liczbą punktów.</li>
    </ol> : <ol>
      <li>Każdy wybiera kategorię i ma 3 życia. Wyeliminowani mogą sędziować i typować odpowiedzi jako widzowie.</li>
      <li>Pojedynek to dwa zegary szachowe. Odpowiadacie na zmianę na głos, a sędzia ocenia: <b>Zalicza</b> zmienia turę, <b>Pomiń</b> kosztuje 3 s i daje nowe pytanie.</li>
      <li>Odpowiadający może sam pominąć pytanie przyciskiem „Pomiń pytanie” – kosztuje to 3 s, tak jak pominięcie przez sędziego.</li>
      <li>Pytania z wyborem (prawda/fałsz, A lub B, „co tu nie pasuje”): zła odpowiedź oznacza pominięcie – nie można zgadywać drugi raz.</li>
      <li>Komu pierwszemu skończy się czas, przegrywa i traci życie. Zwycięzca wybiera kolejnego rywala, a przegrany nową kategorię.</li>
      <li>Rozegrana kategoria znika z puli. Przegrany ma ochronę na jeden pojedynek (poza finałem dwóch graczy).</li>
    </ol>}
    <h3>Punkty</h3>
    <ul><li>Poprawna odpowiedź: <b>+1</b> (do 1,5 s: <b>+2</b>)</li><li>Wygrany pojedynek: <b>+3</b></li><li>Pojedynek bez pominięć: <b>+5</b></li><li>Punkty trafiają też do portfela sklepu. Zakupy nie obniżają wyniku w rankingu.</li></ul>
    {!teams && room.cardTypes && <><h3>Karty jednorazowe</h3><dl className="card-list">{Object.entries(room.cardTypes).map(([key, c]) => <div key={key}><dt>{c.name}</dt><dd>{c.text}</dd></div>)}</dl></>}
    <h3>Skróty sędziego</h3>
    <p><kbd>→</kbd> zalicza · <kbd>P</kbd> pomija · <kbd>Spacja</kbd> pauza · <kbd>Z</kbd> cofnij</p>
  </section>;

  // Decode the pre-drawn next question's image in the background; only this one bitmap is kept alive.
  const nextImage = useRef(null);
  useEffect(() => {
    if (!d?.nextImage) return;
    const image = new Image();
    image.decoding = 'async'; image.referrerPolicy = 'no-referrer'; image.src = mediaUrl(d.nextImage);
    image.decode().catch(() => {});
    nextImage.current = image;
  }, [d?.nextImage]);

  // The question panel keeps the tallest height reached in the current duel, so the page does not jump up
  // when a question with an image is followed by one without (or an image is still loading).
  const duelId = d ? d.ids.join('|') + ':' + room.round : '';
  useEffect(() => {
    setQuestionMinHeight(0);
    const el = questionRef.current;
    if (!duelId || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setQuestionMinHeight(h => Math.max(h, Math.ceil(el.getBoundingClientRect().height))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [duelId, !!d && d.status !== 'ready' && d.status !== 'countdown']);

  // Short full-screen blink after each judged answer: green = correct, red = wrong choice, orange = skipped.
  const answerFlash = flash && settings.flashes && <div className={'answer-flash answer-flash--' + flash.tone} key={flash.n} role="status" aria-label={flash.text}/>;

  // Readiness is confirmed from a bar pinned to the bottom of the screen, so nobody has to scroll to it.
  const readyBar = (() => {
    if (!room || !me) return null;
    if (d?.status === 'ready' && (judge || participant) && !d.ready.includes(me.id)) return <div className="ready-bar" role="region" aria-label="Gotowość"><span>{judge ? '⚖ Sędziujesz ten pojedynek' : '⚔ Twój pojedynek'} · {d.ready.length}/3 gotowych</span><button className="btn btn--primary btn--lg" disabled={disabled} onClick={() => send('DUEL_READY')}>Jestem gotowy</button></div>;
    if (room.phase === 'lobby' && (teams || me.category)) return <div className="ready-bar" role="region" aria-label="Gotowość"><span>{room.players.filter(p => p.ready).length}/{room.players.length} gotowych</span><button className={`btn btn--lg ${me.ready ? 'btn--success' : 'btn--primary'}`} disabled={disabled} onClick={() => send('READY')}>{me.ready ? '✓ Gotowy · cofnij' : 'Jestem gotowy'}</button></div>;
    return null;
  })();

  return <main className={`app${d ? ' is-duel' : ''}`}>
    {d?.laststand && <div className="banner banner--danger" role="status">⚠ Ostatnia szansa: przegrany traci wszystkie życia.</div>}
    <header className="topbar">
      <div className="brand"><span className="brand__mark" aria-hidden="true">▣</span><span>Pixel Arena</span></div>
      {room && <nav className="topnav" aria-label="Widoki">{TABS.map(([key, label]) => <button key={key} className={tab === key ? 'is-active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button>)}</nav>}
      <div className="topbar__actions">
        {session && <span className={`pill ${online ? 'pill--ok' : 'pill--warn'}`}>{online ? '● Online' : '○ Łączenie…'}</span>}
        <button className="btn btn--ghost btn--icon" aria-label={theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'} title="Motyw" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀' : '☾'}</button>
        <button className="btn btn--ghost btn--icon" aria-label="Ustawienia" title="Ustawienia: wielkość tekstu, obrazków, głośność" onClick={() => setSettingsOpen(true)}>⚙</button>
        <button className="btn btn--ghost btn--icon" aria-label="Pełny ekran" title="Pełny ekran" onClick={toggleFullscreen}>⛶</button>
      </div>
    </header>
    <div className="wrap">
      {answerFlash}
      {readyBar}
      {error && <div role="alert" className="notice notice--error"><span>{error}</span><button className="btn btn--ghost btn--sm" onClick={() => setError('')}>Zamknij</button></div>}
      {notice && <div role="status" className="toast">{notice}</div>}
      {shopOpen && room?.economyPanel && <ShopSheet room={room} send={send} disabled={disabled} onClose={() => setShopOpen(false)}/>}
      {settingsOpen && <SettingsSheet settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)}/>}
      {infoCategory && room && (() => {
        const canPick = room.phase === 'lobby' && !teams && room.settings.rules?.categoryPick !== 'random' && room.availableCategories.includes(infoCategory) && me?.category !== infoCategory || room.phase === 'category' && room.pending?.[0] === me?.id && room.availableCategories.includes(infoCategory);
        const status = room.retired.includes(infoCategory) ? 'rozegrana' : me?.category === infoCategory ? 'Twoja kategoria' : room.availableCategories.includes(infoCategory) ? 'wolna' : 'zajęta';
        return <CategorySheet category={infoCategory} count={room.categoryCounts[infoCategory]} status={status} onPick={canPick && !disabled ? () => send('CATEGORY', {category: infoCategory}) : null} onClose={() => setInfoCategory(null)}/>;
      })()}
      {!session ? <div className="home">
        <section className="home__copy">
          <span className="eyebrow">Quiz na żywo ze znajomymi</span>
          <h1>Wybierz kategorię.<br/><span className="accent">Podejmij wyzwanie.</span></h1>
          <p className="lead">Pojedynki na czas, w których odpowiadacie na głos, a sędzia z waszego grona ocenia odpowiedzi. Zbierajcie punkty, używajcie kart i brońcie swoich kategorii.</p>
        </section>
        <form className="panel home__login" onSubmit={e => { e.preventDefault(); enter(code.length !== 6); }}>
          <h2>{params.get('room') ? 'Dołącz do gry' : 'Wejdź do gry'}</h2>
          <label className="field">Pseudonim<input autoComplete="nickname" autoFocus maxLength={24} value={name} onChange={e => setName(e.target.value)} placeholder="Jak mamy Cię nazywać?"/></label>
          {!params.get('room') && <><button className="btn btn--primary btn--block btn--lg" type="button" disabled={busy || !name.trim()} onClick={() => enter(true)}>Utwórz lobby</button>
            <div className="divider"><span>albo dołącz kodem</span></div></>}
          <label className="field">Kod lobby<input aria-label="Kod lobby" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6 cyfr" className="code-input"/></label>
          <button className={`btn btn--block btn--lg${params.get('room') ? ' btn--primary' : ''}`} type="button" disabled={busy || !name.trim() || code.length !== 6} onClick={() => enter(false)}>{busy ? 'Łączenie…' : 'Dołącz do lobby'}</button>
        </form>
        <div className="stats"><div><b>45</b><span>kategorii</span></div><div><b>3600+</b><span>pytań</span></div><div><b>3</b><span>życia na start</span></div><div><b>+3</b><span>za wygraną</span></div></div>
      </div> : !room ? <section className="panel center"><h2>Łączenie z lobby {session.code}…</h2><button className="btn" onClick={() => store(null)}>Wróć do ekranu startowego</button></section> : <>
        <div className="roombar">
          <button className="roombar__code" onClick={invite} title="Kliknij, aby skopiować zaproszenie"><span className="eyebrow">Kod lobby</span><strong>{room.code}</strong></button>
          <div className="roombar__me"><PlayerAvatar name={me.name} color={avatarColor(me)}/><div><strong>{me.name}</strong><small>{judge ? '⚖ Sędzia' : participant ? '⚔ W pojedynku' : me.lives === 0 && !teams ? 'Widz' : 'Gracz'}{teams && me.team ? ` · drużyna ${me.team}` : ''}</small></div>{!teams && room.phase !== 'lobby' && hearts(me)}<b className="roombar__points">{me.points} pkt</b></div>
          <div className="roombar__actions">{room.economyPanel && room.phase !== 'lobby' && <button className="btn btn--primary btn--sm" onClick={() => setShopOpen(true)}>🛒 Sklep · {room.economyPanel.wallet.toFixed(0)} pkt</button>}<button className="btn btn--sm" onClick={invite}>Zaproś</button><button className="btn btn--ghost btn--sm" onClick={leave}>Opuść</button></div>
        </div>
        {!online && <div className="notice notice--warn">Brak synchronizacji. Sterowanie zablokowane, zegary mogą być nieaktualne.</div>}
        {room.teams?.length > 0 && room.phase !== 'lobby' && <div className="team-score">{room.teams.map(t => <div className="team-score__item" data-team={t.team} key={t.team}><span>Drużyna {t.team}</span><b>{t.points} pkt</b></div>)}</div>}
        {room.lastDecision && room.phase !== 'lobby' && <div className="notice" role="status">{room.lastDecision.text}</div>}
        {tab === 'arena' && arena()}
        {tab === 'kategorie' && <section className="panel">
          <div className="panel__head"><h2>Wszystkie kategorie</h2><span className="pill">{room.categories.length} kategorii · {room.totalQuestions} pytań</span></div>
          <div className="tile-grid">{room.categories.map(c => {
            const status = room.retired.includes(c) ? 'Rozegrana' : room.players.some(p => p.category === c && p.lives > 0) ? 'Zajęta' : 'Wolna';
            return <button type="button" className="overview-tile" data-status={status} key={c} title={categoryDescription(c)} onClick={() => setInfoCategory(c)}><span className="overview-tile__emoji" aria-hidden="true">{getCategoryEmoji(c)}</span><div><strong>{c}</strong><small>{room.categoryCounts[c]} pytań · {status}</small></div><span className="overview-tile__more" aria-hidden="true">ⓘ</span></button>;
          })}</div>
        </section>}
        {tab === 'ranking' && <section className="panel">
          <h2>Ranking</h2>
          <p className="muted small">{teams ? 'Kolejność według punktów.' : 'Kolejność: życia, potem punkty, potem zdobyte kategorie.'}</p>
          <ol className="ranking">{(teams ? scoreRank : rank).map((p, i) => <li key={p.id}><span className="ranking__place">{i + 1}</span><PlayerAvatar name={p.name} color={avatarColor(p)}/><div><strong>{p.name}</strong><small>{p.wins} wygranych · {p.correct} odpowiedzi · {p.trophies.length} zdobytych kategorii</small></div>{!teams && hearts(p)}<b>{p.points} pkt</b></li>)}</ol>
          {room.log.length > 0 && <details><summary>Historia pojedynków ({room.log.length})</summary><ul className="event-list">{room.log.map(l => <li key={l.round}><b>#{l.round}</b> {pname(l.winner)} pokonuje {pname(l.loser)} · {l.category}{!teams && ` · zostało ${l.livesLeft} ${plural(l.livesLeft, 'życie', 'życia', 'żyć')}`}</li>)}</ul></details>}
        </section>}
        {tab === 'zasady' && rules()}
      </>}
      <footer className="footer"><span>Pixel Arena · głos przez własny komunikator</span><span>Grafiki: <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noreferrer">Twemoji</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>) · flagi: <a href="https://flagcdn.com/" target="_blank" rel="noreferrer">Flagcdn</a> · kontury: <a href="https://github.com/djaiss/mapsicon" target="_blank" rel="noreferrer">mapsicon (djaiss)</a> · zdjęcia: <a href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer">Wikimedia Commons</a> · postacie: ilustracje z <a href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">Wikipedii</a>, prawa należą do właścicieli</span></footer>
    </div>
  </main>;
}
