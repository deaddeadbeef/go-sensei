export type ConceptCategory =
  | 'fundamentals'
  | 'tactics'
  | 'strategy'
  | 'endgame'
  | 'opening';

export interface Concept {
  id: string;
  name: string;
  category: ConceptCategory;
  description: string;
  prerequisites: string[];  // concept IDs that must be mastered first
}

export type MasteryLevel = 0 | 1 | 2 | 3;
// 0 = unseen, 1 = introduced, 2 = practiced, 3 = mastered

export interface ConceptMastery {
  conceptId: string;
  level: MasteryLevel;
  lastSeen: number;       // timestamp
  encounterCount: number;
}
