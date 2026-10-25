import React, {memo, useEffect, useState} from 'react';
import {categoryDescription} from './categoryInfo.js';

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

export function TerritoryTile({category, count, status, state, selected, disabled, onClick}) {
  return <button type="button" className="tile" data-state={state} aria-pressed={selected} aria-label={`${category}, ${count} pytań, ${status}`} disabled={disabled} onClick={onClick} title={categoryDescription(category)}>
    <span className="tile__emoji" aria-hidden="true">{getCategoryEmoji(category)}</span>
    <span className="tile__text"><strong>{category}</strong><small>{count} pytań · {status}</small></span>
    {selected && <span className="tile__check" aria-hidden="true">✓</span>}
  </button>;
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
