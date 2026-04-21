import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, test } from 'vitest';

import { getRevisionFromPointer, getRevisionMarkerPercent, RevisionSlider } from '../src/components/revision-slider.js';

describe('revision slider', () => {
  test('keeps a local draft value, avoids duplicate input handlers, and makes each revision marker a draggable hover target', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/components/revision-slider.tsx'),
      'utf8'
    );
    const css = readFileSync(
      resolve(import.meta.dirname, '../src/styles/app.css'),
      'utf8'
    );

    expect(source).toContain("from 'react'");
    expect(source).toContain('useState(props.currentRevision)');
    expect(source).toContain('setDraftRevision(props.currentRevision);');
    expect(source).toContain('value={draftRevision}');
    expect(source).toContain('revision-marker-row');
    expect(source).toContain('revision-marker-slot');
    expect(source).toContain('revision-hover-bubble');
    expect(source).toContain('onPointerDown={handlePointerDown}');
    expect(source).toContain('onPointerMove={handlePointerMove}');
    expect(source).toContain('type="button"');
    expect(source).toContain('data-testid={`revision-marker-${marker}`}');
    expect(css).toContain('inset: 50% 0 auto 0;');
    expect(source).not.toContain('revision-scale');
    expect(source).not.toContain('onInput=');
  });

  test('maps pointer drag positions to the nearest revision', () => {
    expect(getRevisionFromPointer(-20, 0, 100, 3)).toBe(1);
    expect(getRevisionFromPointer(0, 0, 100, 3)).toBe(1);
    expect(getRevisionFromPointer(50, 0, 100, 3)).toBe(2);
    expect(getRevisionFromPointer(100, 0, 100, 3)).toBe(3);
    expect(getRevisionFromPointer(140, 0, 100, 3)).toBe(3);
  });

  test('places two revision markers on the slider endpoints instead of centered between native range endpoints', () => {
    expect(getRevisionMarkerPercent(1, 2)).toBe(0);
    expect(getRevisionMarkerPercent(2, 2)).toBe(100);

    const html = renderToStaticMarkup(
      createElement(RevisionSlider, {
        currentRevision: 2,
        maxRevision: 2,
        onChange() {
          return;
        }
      })
    );

    expect(html).toContain('data-testid="revision-marker-slot-1"');
    expect(html).toContain('left:0%');
    expect(html).toContain('data-testid="revision-marker-slot-2"');
    expect(html).toContain('left:100%');
  });

  test('uses progress fill on the rail without selected marker highlight classes', () => {
    expect(getRevisionMarkerPercent(1, 3)).toBe(0);
    expect(getRevisionMarkerPercent(2, 3)).toBe(50);
    expect(getRevisionMarkerPercent(3, 3)).toBe(100);

    const html = renderToStaticMarkup(
      createElement(RevisionSlider, {
        currentRevision: 2,
        maxRevision: 3,
        onChange() {
          return;
        }
      })
    );

    expect(html).toContain('--revision-progress:50%');
    expect(html).not.toContain('is-active');
  });

  test('hides the native range visuals so custom revision markers are the only visible dots', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, '../src/styles/app.css'),
      'utf8'
    );

    expect(css).toContain('appearance: none;');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('::-webkit-slider-thumb');
    expect(css).toContain('opacity: 0;');
    expect(css).toContain('var(--revision-progress, 100%)');
  });

  test('suppresses focus rings because the revision strip has no selected state', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, '../src/styles/app.css'),
      'utf8'
    );

    expect(css).toContain('.revision-slider-shell input[type="range"]:focus');
    expect(css).toContain('border: 0;');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('.revision-marker-slot:focus-visible');
    expect(css).toContain('outline: none;');
  });
});
