/**
 * Presentation-only types for the shared storyteller renderer (plan §7.1).
 * This module imports no simulation modules: hosts build a StoryView from their
 * own checked source state and StoryScene only renders it.
 */
export type StorySource = 'camp' | 'delivery' | 'journey' | 'exploration' | 'dungeon' | 'market' | 'forge';

export type StoryTone = 'normal' | 'good' | 'loss' | 'muted';

export type StoryFact = {
  id: string;
  label: string;
  value: string;
  tone: StoryTone;
};

export type StoryAction = {
  id: string;
  label: string;
  kind: 'commit' | 'navigate' | 'dismiss';
  disabled: boolean;
  reason: string;
};

export type StoryView = {
  key: string;
  source: StorySource;
  mode: 'decision' | 'receipt' | 'greeting';
  heading: string;
  speaker: string;
  media: 'camp' | 'trail' | 'discovery' | 'dungeon' | 'market' | 'forge';
  line: string;
  facts: readonly StoryFact[];
  actions: readonly StoryAction[];
  error: string;
};

export type StoryIntent = {
  key: string;
  actionId: string;
};
