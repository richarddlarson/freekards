#!/usr/bin/env python3
"""
Voice-clip build (spec 08 §Dialogue, spec 13, D-047, D-048).

For every character in spec/content/characters with a `voice.tts` block, synthesize each dialogue
line with Piper and encode it to Opus at assets/voices/<characterId>/<lineId>.opus.

- Engine: piper-tts (pinned below), installed automatically into .cache/piper-env (git-ignored).
- Voice models: downloaded from rhasspy/piper-voices at a pinned revision into .cache/piper-voices,
  each verified against the catalog's MD5.
- Only clips whose text or voice settings changed are regenerated (tracked in
  assets/voices/manifest.json). Piper samples random noise during synthesis, so a regenerated clip
  sounds the same but is not byte-identical. The committed clips are the canonical artifacts.
- TTS text rule (D-047): ALL-CAPS words are lowered before synthesis; bubble text is unchanged.

Usage:  python3 scripts/build-voices.py [--force] [characterId ...]
"""
import hashlib
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache'
ENV = CACHE / 'piper-env'
MODELS = CACHE / 'piper-voices'
OUT = ROOT / 'assets' / 'voices'
MANIFEST = OUT / 'manifest.json'

PIPER_VERSION = '1.8.0'
VOICES_REPO = 'https://huggingface.co/rhasspy/piper-voices/resolve'
VOICES_REVISION = 'e5349433ed883a32f893a434dc43a6c66b95ef7c'
OPUS = ['-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-compression_level', '10',
        '-application', 'voip', '-ac', '1', '-ar', '48000']


def ensure_env() -> Path:
    py = ENV / 'bin' / 'python'
    if not py.exists():
        print(f'creating {ENV} with piper-tts=={PIPER_VERSION} …')
        subprocess.run([sys.executable, '-m', 'venv', str(ENV)], check=True)
        subprocess.run([str(ENV / 'bin' / 'pip'), 'install', '-q', f'piper-tts=={PIPER_VERSION}'], check=True)
    return py


def catalog() -> dict:
    path = MODELS / f'voices-{VOICES_REVISION[:12]}.json'
    if not path.exists():
        MODELS.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(f'{VOICES_REPO}/{VOICES_REVISION}/voices.json', path)
    return json.loads(path.read_text())


def ensure_model(name: str, cat: dict) -> Path:
    files = cat[name]['files']
    for rel, meta in files.items():
        if not (rel.endswith('.onnx') or rel.endswith('.onnx.json')):
            continue
        dest = MODELS / Path(rel).name
        if not dest.exists() or hashlib.md5(dest.read_bytes()).hexdigest() != meta['md5_digest']:
            print(f'downloading {rel} …')
            urllib.request.urlretrieve(f'{VOICES_REPO}/{VOICES_REVISION}/{rel}', dest)
        if hashlib.md5(dest.read_bytes()).hexdigest() != meta['md5_digest']:
            raise SystemExit(f'MD5 mismatch for {rel}')
    return MODELS / f'{name}.onnx'


def tts_text(text: str) -> str:
    """Lower ALL-CAPS words (2+ letters) so espeak-ng doesn't spell them out."""
    return re.sub(r"\b[A-Z][A-Z']+\b", lambda m: m.group(0).lower(), text)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    py = ensure_env()
    cat = catalog()
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    roster = json.loads((ROOT / 'spec/content/characters/roster.json').read_text())['characters']
    made = skipped = 0
    for cid in roster:
        if args and cid not in args:
            continue
        char = json.loads((ROOT / f'spec/content/characters/{cid}.json').read_text())
        tts = char['voice'].get('tts')
        if not tts:
            print(f'{cid}: no voice.tts, skipped')
            continue
        model = ensure_model(tts['model'], cat)
        speaker_id = None
        if 'speaker' in tts:
            speaker_id = json.loads(Path(f'{model}.json').read_text())['speaker_id_map'][tts['speaker']]
        voice_key = json.dumps(tts, sort_keys=True)
        out_dir = OUT / cid
        out_dir.mkdir(parents=True, exist_ok=True)
        wanted = set()
        for lines in char['lines'].values():
            for line in lines:
                lid, text = line['id'], line['text']
                wanted.add(lid)
                dest = out_dir / f'{lid}.opus'
                key = hashlib.sha256(f'{voice_key}\n{text}'.encode()).hexdigest()
                if not force and dest.exists() and manifest.get(lid, {}).get('key') == key:
                    skipped += 1
                    continue
                wav = CACHE / 'tmp.wav'
                cmd = [str(py), '-m', 'piper', '-m', str(model), '-f', str(wav),
                       '--length-scale', str(tts.get('lengthScale', 1.0))]
                if speaker_id is not None:
                    cmd += ['-s', str(speaker_id)]
                if 'noiseScale' in tts:
                    cmd += ['--noise-scale', str(tts['noiseScale'])]
                subprocess.run(cmd, input=tts_text(text).encode(), check=True, capture_output=True)
                subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                                '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
                                       'silenceremove=start_periods=1:start_threshold=-50dB,areverse',
                                *OPUS, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
                                str(dest)], check=True)
                manifest[lid] = {'key': key, 'text': text}
                made += 1
        # Remove clips for lines that no longer exist.
        for stale in out_dir.glob('*.opus'):
            if stale.stem not in wanted:
                stale.unlink()
                manifest.pop(stale.stem, None)
        print(f'{cid}: {len(wanted)} lines')
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=1, ensure_ascii=False) + '\n')
    print(f'done: {made} generated, {skipped} unchanged')


if __name__ == '__main__':
    main()
