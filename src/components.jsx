import React, {memo, useEffect, useRef, useState} from 'react';
import {CHOICE_RULE, categoryDescription, isChoiceCategory} from './categoryInfo.js';

const categoryEmojis = {
  stolice: '🏛️',
  pierwiastki: '⚗️',
  zwierzeta: '🦊',
  polska: '🦅',
  jedzenie: '🍓',
  sport: '🏆',
  technologia: '💻',
  przedmioty: '🧩',
  rosliny: '🌿',
  'geografia swiata': '🌍',
  przeciwienstwa: '↔️',
  nauka: '🔬',
  matematyka: '➗',
  geometria: '📐',
  jednostki: '📏',
  angielski: '💂',
  'wiedza ogolna': '💡',
  'flagi na obrazkach': '🚩',
  logika: '🧠',
  'liczby rzymskie': '🏺',
  gry: '🎮',
  filmy: '🎬',
  kosmos: '🚀',
  historia: '📜',
  literatura: '📚',
  motoryzacja: '🏎️',
  wynalazki: '🛠️',
  muzyka: '🎵',
  'pogoda i zjawiska': '🌦️',
  'transport i podroze': '✈️',
  'zawody i narzedzia': '🧰',
  'jezyk polski': '✍️',
  'rebusy emoji': '🤔',
  'co tu nie pasuje?': '🔎',
  'prawda/falsz': '⚖️',
  'league of legends': '🗡️',
  'marki i logotypy': '🏷️',
  'rozpoznawanie jezykow': '🗣️',
  'znaki drogowe': '🚦',
  'wiecej czy mniej?': '📊',
  'co bylo wczesniej?': '⏳',
  'brakujace litery': '🔤',
  'herby pilkarskie': '🛡️',
  'rozsypane litery': '🔀',
  'co to za pilkarz?': '⚽',
  'kontury panstw': '🗺️',
  kosmetyki: '💄',
  'co to za postac?': '🎭',
  'bajki z dziecinstwa': '🧸',
  'znane sklepy': '🛒',
  'co to za dzien?': '📅',
  'co to za skrot?': '🔠',
  'zabytki swiata': '🏰',
  'co kosztuje wiecej?': '💰', 'siatkowka': '🏐', 'slang mlodziezowy': '💬', 'valorant': '🎯', 'minecraft': '⛏️', 'rasy psow': '🐶', 'soundtrack': '🎵', 'przyblizenie': '🔍', 'popularne piosenki': '🎤', 'dokoncz tekst': '📝',
};

export function getCategoryEmoji(category) {
  const key = category.trim().toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  return categoryEmojis[key] || '🎯';
}

const AVATAR_COLORS = ['cyan', 'magenta', 'violet', 'amber', 'green', 'rose'];
export function PlayerAvatar({name, color}) {
  const initial = name?.trim().charAt(0).toLocaleUpperCase('pl') || '?';
  // Without a team colour, derive a stable colour from the name so players are easy to tell apart.
  color ??= AVATAR_COLORS[[...(name || '')].reduce((sum, ch) => sum + ch.codePointAt(0), 0) % AVATAR_COLORS.length];
  return <span className={`avatar avatar--${color}`} aria-hidden="true">{initial}</span>;
}

export const PixelTimer = memo(function PixelTimer({milliseconds, label, active = false}) {
  const [remaining, setRemaining] = useState(Math.max(0, milliseconds));
  useEffect(() => {
    const startedAt = Date.now();
    setRemaining(Math.max(0, milliseconds));
    if (!active) return;
    const interval = setInterval(() => setRemaining(Math.max(0, milliseconds - (Date.now() - startedAt))), 100);
    return () => clearInterval(interval);
  }, [milliseconds, active]);
  return <output className={`clock${active ? ' clock--active' : ''}${active && remaining <= 5000 ? ' clock--urgent' : ''}`} role="timer" aria-label={`${label}: ${Math.ceil(remaining / 1000)} sekund`}>{(remaining / 1000).toFixed(1)}<small>s</small></output>;
});

export function TerritoryTile({category, count, status, state, selected, disabled, onClick, onInfo}) {
  return <div className="tile-wrap">
    <button type="button" className="tile" data-state={state} aria-pressed={selected} aria-label={`${category}, ${count} pytań, ${status}`} disabled={disabled} onClick={onClick} title={categoryDescription(category)}>
      <span className="tile__emoji" aria-hidden="true">{getCategoryEmoji(category)}</span>
      <span className="tile__text"><strong>{category}</strong><small>{count} pytań · {status}</small></span>
      {selected && <span className="tile__check" aria-hidden="true">✓</span>}
    </button>
    {onInfo && <InfoButton category={category} onClick={onInfo}/>}
  </div>;
}

export function InfoButton({category, onClick}) {
  return <button type="button" className="info-button" aria-label={`Opis kategorii ${category}`} title={categoryDescription(category)} onClick={onClick}>i</button>;
}

/** Sheet with a category's description and, for choice categories, the wrong-answer rule. */
export function CategorySheet({category, count, status, onPick, pickLabel = 'Wybierz tę kategorię', onClose}) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="category-sheet-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal__box category-sheet">
      <span className="category-sheet__emoji" aria-hidden="true">{getCategoryEmoji(category)}</span>
      <h2 id="category-sheet-title">{category}</h2>
      {(count !== undefined || status) && <p className="muted">{[count !== undefined && `${count} pytań`, status].filter(Boolean).join(' · ')}</p>}
      <p className="category-sheet__desc">{categoryDescription(category) || 'Brak opisu.'}</p>
      {isChoiceCategory(category) && <p className="rule-note">{CHOICE_RULE}</p>}
      <div className="category-sheet__actions">
        {onPick && <button type="button" className="btn btn--primary btn--lg" onClick={() => { onPick(); onClose(); }}>{pickLabel}</button>}
        <button type="button" className="btn btn--lg" onClick={onClose} autoFocus>Zamknij</button>
      </div>
    </div>
  </div>;
}

function ClubCrest({club}) {
  const [failed, setFailed] = useState(false);
  const initials = club.name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(word => word.length > 1 && !/^(FC|AC|AS|SC|CF|SL|SV|VfL|VfB|RB|SSC|OGC|AFC)$/.test(word)).slice(0, 2).map(word => word[0]).join('').toUpperCase() || club.name.slice(0, 2).toUpperCase();
  return <li className="club">
    <span className="club__crest">{club.logo && !failed ? <img src={club.logo} alt="" decoding="sync" referrerPolicy="no-referrer" onError={() => setFailed(true)}/> : <span className="club__monogram" aria-hidden="true">{initials}</span>}</span>
    <span className="club__name">{club.name}</span>
  </li>;
}

/** "Co to za piłkarz?" question: flag, position and the last clubs as crests. */
export function FootballerCard({footballer}) {
  return <div className="footballer">
    <h2 className="question__prompt">Co to za piłkarz?</h2>
    <div className="footballer__meta">
      <span className="footballer__chip"><img src={footballer.flag} alt="" referrerPolicy="no-referrer"/>{footballer.nationality}</span>
      <span className="footballer__chip">{footballer.position}</span>
    </div>
    <ol className="footballer__clubs" aria-label={`Ostatnie kluby: ${footballer.clubs.map(c => c.name).join(', ')}`}>
      {footballer.clubs.map((club, index) => <ClubCrest club={club} key={`${index}-${club.name}`}/>)}
    </ol>
    <span className="muted small">Ostatnie kluby, od najstarszego</span>
  </div>;
}

/** Plays a question's music on every device as soon as the question starts; pauses with the duel. */
export function SoundtrackPlayer({src, playKey, running, volume, onVolume}) {
  const audio = useRef(null), [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('arena-muted') === '1'; } catch { return false; } });
  useEffect(() => {
    const a = new Audio(src); a.preload = 'auto'; audio.current = a;
    return () => { a.pause(); a.removeAttribute('src'); a.load(); };
  }, [src, playKey]);
  useEffect(() => {
    const a = audio.current; if (!a) return;
    a.muted = muted; a.volume = volume;
    if (running) a.play().then(() => setBlocked(false), () => setBlocked(true)); else a.pause();
  }, [running, muted, src, playKey]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume]);
  function replay() { const a = audio.current; if (!a) return; a.currentTime = 0; a.play().then(() => setBlocked(false), () => setBlocked(true)); }
  function toggleMute() { setMuted(m => { try { localStorage.setItem('arena-muted', m ? '0' : '1'); } catch {} return !m; }); }
  return <div className="soundtrack">
    <label className="volume" title="Głośność"><span aria-hidden="true">{muted || volume === 0 ? '🔈' : '🔊'}</span><input type="range" min="0" max="100" step="5" value={Math.round(volume * 100)} onChange={e => onVolume(e.target.value / 100)} aria-label="Głośność muzyki"/><b>{Math.round(volume * 100)}%</b></label>
    <span className={`soundtrack__wave${running && !blocked && !muted ? ' is-playing' : ''}`} aria-hidden="true"><i/><i/><i/><i/><i/></span>
    {blocked ? <button className="btn btn--primary btn--sm" onClick={replay}>▶ Kliknij, aby włączyć muzykę</button> : <button className="btn btn--sm" onClick={replay} disabled={!running}>↺ Od początku</button>}
    <button className="btn btn--ghost btn--sm" onClick={toggleMute} aria-pressed={muted}>{muted ? '🔇 Wyciszone' : 'Wycisz'}</button>
  </div>;
}

export const DEFAULT_SETTINGS = {textScale: 1, imageScale: 1, uiScale: 1, volume: 0.7, flashes: true};
const SETTING_ROWS = [
  ['textScale', 'Wielkość tekstu pytań', 0.8, 1.6, 0.05, v => Math.round(v * 100) + '%'],
  ['imageScale', 'Wielkość obrazków', 0.6, 2, 0.05, v => Math.round(v * 100) + '%'],
  ['uiScale', 'Skala całego interfejsu', 0.8, 1.3, 0.05, v => Math.round(v * 100) + '%'],
  ['volume', 'Głośność muzyki', 0, 1, 0.05, v => Math.round(v * 100) + '%'],
];

/** Per-device display settings: text, image and interface scale plus music volume. */
export function SettingsSheet({settings, onChange, onClose}) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal__box settings">
      <h2 id="settings-title">Ustawienia</h2>
      <p className="muted small">Zapisywane tylko na tym urządzeniu.</p>
      {SETTING_ROWS.map(([key, label, min, max, step, format]) => <label className="settings__row" key={key}>
        <span>{label}<b>{format(settings[key])}</b></span>
        <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={e => onChange({...settings, [key]: +e.target.value})}/>
      </label>)}
      <label className="settings__toggle"><span>Błyski po odpowiedzi<small>Zielony – dobrze, czerwony – źle, pomarańczowy – pominięte.</small></span><input type="checkbox" checked={settings.flashes} onChange={e => onChange({...settings, flashes: e.target.checked})}/></label>
      <div className="settings__preview" aria-hidden="true"><span className="question__prompt">Przykładowe pytanie?</span><span className="settings__swatch"/></div>
      <div className="category-sheet__actions">
        <button type="button" className="btn" onClick={() => onChange(DEFAULT_SETTINGS)}>Przywróć domyślne</button>
        <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>Gotowe</button>
      </div>
    </div>
  </div>;
}
