/** Sound settings panel (spec 13 §1): Music / Effects / Voices sliders and Mute all. Changes apply live. */
import { audio, type Channel } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';
import { h, onTap } from './stage.js';

const ROWS: [Channel, string, string?][] = [
  ['music', 'Music'],
  ['sfx', 'Sound effects'],
  ['voice', 'Voices'],
];

export function soundSettingsPanel(onDone: () => void): HTMLElement {
  const panel = h('div', 'dialog sound-panel');
  panel.append(h('h2', '', 'Sound'));
  const persist = () => {
    const s = loadSettings();
    s.volumes = audio.getVolumes();
    saveSettings(s);
  };

  const grid = h('div', 'sound-grid');
  for (const [ch, label, note] of ROWS) {
    const name = h('label', 'sound-label', label);
    if (note) name.append(h('span', 'sound-note', ` (${note})`));
    const slider = h('input', 'sound-slider');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(Math.round(audio.getVolumes()[ch] * 100));
    const value = h('span', 'sound-value', `${slider.value}%`);
    slider.addEventListener('input', () => {
      value.textContent = `${slider.value}%`;
      audio.setVolumes({ ...audio.getVolumes(), [ch]: Number(slider.value) / 100 });
    });
    slider.addEventListener('change', () => {
      persist();
      if (ch === 'sfx') audio.play('card.place'); // let the player hear the new level
    });
    grid.append(name, slider, value);
  }
  panel.append(grid);

  // Music track chooser (spec 13 §3): custom drop-down with finger-sized rows.
  const SHUFFLE = 'Shuffle all tracks';
  const labelFor = (id: string | null) => (id === null ? SHUFFLE : audio.tracks.find((t) => t.id === id)?.title ?? SHUFFLE);
  const trackRow = h('div', 'track-row');
  trackRow.append(h('span', 'sound-label', 'Music track'));
  const picker = h('div', 'track-picker');
  const button = h('button', 'track-button');
  const list = h('div', 'track-list');
  list.hidden = true;
  const nowPlaying = h('div', 'now-playing');
  const showNow = (id: string | null) => {
    const t = audio.tracks.find((x) => x.id === id);
    nowPlaying.textContent = t ? `Now playing: ${t.title} — ${t.composer}` : '';
  };
  const refreshButton = () => {
    button.textContent = '';
    button.append(h('span', '', labelFor(audio.musicChoice)), h('span', 'track-caret', '▾'));
  };
  const choose = (id: string | null) => {
    audio.setMusicChoice(id);
    const st = loadSettings();
    st.musicTrack = id;
    saveSettings(st);
    list.hidden = true;
    refreshButton();
  };
  const options: [string | null, string, string][] = [
    [null, SHUFFLE, 'All tracks, in random order'],
    ...audio.tracks.map((t): [string, string, string] => [t.id, t.title, t.composer]),
  ];
  for (const [id, title, sub] of options) {
    const opt = h('button', 'track-option');
    opt.append(h('span', 'track-check', ''), h('span', 'track-title', title), h('span', 'track-sub', sub));
    onTap(opt, () => choose(id));
    opt.dataset['id'] = id ?? '';
    list.append(opt);
  }
  onTap(button, () => {
    list.hidden = !list.hidden;
    for (const opt of list.querySelectorAll<HTMLElement>('.track-option')) {
      const selected = (opt.dataset['id'] || null) === audio.musicChoice;
      opt.classList.toggle('selected', selected);
      opt.querySelector('.track-check')!.textContent = selected ? '✓' : '';
    }
  });
  picker.append(button, list);
  trackRow.append(picker);
  refreshButton();
  showNow(audio.nowPlaying);
  const unsubscribe = audio.onTrackChange(showNow);
  panel.append(trackRow, nowPlaying);

  const mute = h('button', 'choice mute-toggle');
  const refreshMute = () => {
    const muted = audio.getVolumes().muted;
    mute.textContent = muted ? '🔇 Sound is muted' : '🔊 Mute all sound';
    mute.classList.toggle('selected', muted);
  };
  onTap(mute, () => {
    audio.setVolumes({ ...audio.getVolumes(), muted: !audio.getVolumes().muted });
    persist();
    refreshMute();
  });
  refreshMute();
  panel.append(mute);

  const row = h('div', 'dialog-buttons');
  const done = h('button', 'big-button', 'Done');
  onTap(done, () => {
    unsubscribe();
    onDone();
  });
  row.append(done);
  panel.append(row);
  return panel;
}
