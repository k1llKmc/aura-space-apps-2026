'use client';
import { useId, useState } from 'react';
import { moodLabel } from './format';
export function WellbeingSlider({
  name,
  label,
  hint,
}: {
  name: string;
  label: string;
  hint: string;
}) {
  const id = useId();
  const [value, setValue] = useState(name === 'moodScore' ? 7 : 4);
  const mood = name === 'moodScore',
    description = mood
      ? moodLabel(value)
      : value <= 2
        ? 'Very low'
        : value <= 5
          ? 'Moderate'
          : value <= 8
            ? 'High'
            : 'Very high';
  const glyph = mood
    ? value === 1
      ? '☁'
      : value <= 5
        ? '☂'
        : value <= 8
          ? '◒'
          : '☀'
    : '◌';
  return (
    <label className="wellbeing-slider" htmlFor={id}>
      <span className="slider-heading">
        <strong>{label}</strong>
        <output htmlFor={id}>
          {value}
          <small>/10</small>
        </output>
      </span>
      <span className="slider-emotion" aria-live="polite">
        <span aria-hidden="true">{glyph}</span>
        {description}
      </span>
      <input
        id={id}
        aria-label={label}
        aria-valuetext={`${value} out of 10, ${description}`}
        aria-describedby={`${name}-hint`}
        name={name}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onInput={(e) => setValue(Number(e.currentTarget.value))}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <span className="slider-ticks">
        <span>{mood ? 'Very low' : 'Low'}</span>
        <span>{mood ? 'Great' : 'High'}</span>
      </span>
      <span className="field-hint" id={`${name}-hint`}>
        {hint}
      </span>
    </label>
  );
}
