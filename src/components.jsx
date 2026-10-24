import React from 'react';

const categoryEmojis = {
  stolice: '🏛️',
  pierwiastki: '⚗️',
  zwierzeta: '🦊',
  polska: '🇵🇱',
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
  angielski: '🔤',
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
  'rebusy emoji': '🧩',
  'co tu nie pasuje?': '🔎',
  'prawda/falsz': '⚖️',
  'league of legends': '🎮',
  'marki i logotypy': '🏷️',
  'rozpoznawanie jezykow': '🗣️',
  'znaki drogowe': '🚦',
  'wiecej czy mniej?': '⚖️',
  'co bylo wczesniej?': '⏳',
  'brakujace litery': '🔤',
};

export function getCategoryEmoji(category) {
  const key = category.trim().toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  return categoryEmojis[key] || '🎯';
}

export function PixelButton({children, className = '', type = 'button', ...props}) {
  return <button type={type} className={`pixel-button ${className}`.trim()} {...props}>{children}</button>;
}

export function PixelPanel({as: Element = 'section', className = '', children, ...props}) {
  return <Element className={`pixel-panel ${className}`.trim()} {...props}>{children}</Element>;
}

export function PlayerAvatar({name, color = 'cyan'}) {
  const initial = name?.trim().charAt(0).toLocaleUpperCase('pl') || '?';
  return <span className={`player-avatar player-avatar--${color}`} aria-hidden="true">{initial}</span>;
}

export function PixelTimer({milliseconds, value, label, active = false}) {
  const remaining = Math.max(0, milliseconds);
  const display = value ?? `${(remaining / 1000).toFixed(1)} s`;
  const announcement = value ?? `${Math.ceil(remaining / 1000)} sekund`;
  return <><output className={`clock ${active ? 'clock--active' : ''} ${remaining <= 5000 && active ? 'clock--urgent' : ''}`} role="timer" aria-live="off" aria-label={label}>{display}</output><span className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</span></>;
}

export function TerritoryTile({category, count, status, state, selected, disabled, onClick}) {
  return (
    <PixelButton
      className="territory-tile"
      data-territory-state={state}
      aria-pressed={selected}
      aria-label={`${category}, ${count} pytań, ${status}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="territory-tile__mark" aria-hidden="true">{getCategoryEmoji(category)}</span>
      <span className="territory-tile__name">{category}</span>
      <small>{count} pytań · {status}</small>
      <span className="territory-tile__state" aria-hidden="true">{selected ? '◆' : state === 'available' ? '◇' : '×'}</span>
    </PixelButton>
  );
}
