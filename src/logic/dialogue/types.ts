/** Character data model (spec 08 §Character data). Loaded from spec/content/characters/*.json. */

export interface DialogueLine {
  /** Stable id: `<characterId>.<trigger>.<n>`; also names the voice clip file. */
  id: string;
  text: string;
}

export interface CharacterDef {
  schemaVersion: 1;
  id: string;
  name: string;
  nickname: string;
  /** `human` for now; reserved for future non-human characters. */
  kind: string;
  gender: string;
  ageRange: string;
  tagline: string;
  bio: string;
  look: string;
  traits: {
    tone: string;
    chattiness: number;
    risk: number;
    skillAdjust: number;
  };
  voice: { description: string; pitch: string; pace: string };
  lines: Record<string, DialogueLine[]>;
}

export interface RosterDef {
  schemaVersion: 1;
  characters: string[];
}

/** Something a character says, produced by the dialogue director. */
export interface Utterance {
  seat: number;
  characterId: string;
  trigger: string;
  line: DialogueLine;
}

/** A potential comment: which seat could react, with which trigger, and how strongly. */
export interface DialogueCandidate {
  seat: number;
  trigger: string;
  weight: number;
}
