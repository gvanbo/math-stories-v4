/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Outcome {
  code: string;
  strand: string;
  description: string;
  keywords: string[];
  grade: number;
}

export interface Concept {
  id: string;
  outcomeCode: string;
  models: string[];
  strategies: string[];
  explanation: string;
}

export interface PedagogyPlan {
  conceptId: string;
  stages: {
    concrete: string;
    pictorial: string;
    symbolic: string;
  };
  differentiation: {
    struggling: string;
    onLevel: string;
    advanced: string;
  };
  checksForUnderstanding: {
    task: string;
    explanationRequired: boolean;
  }[];
}

export interface StorySkeleton {
  conceptId: string;
  beats: {
    type: 'setup' | 'groupsIntro' | 'representation' | 'reasoning' | 'generalize' | 'reflection';
    description: string;
  }[];
  requiredModels: string[];
  forbiddenPatterns: string[];
}

export interface DigitCharacter {
  digit: number;
  name: string;
  trait: string;
  mathRule: string;
  voiceStyle: string;
  personality: string;
  visualDescription: string;
  numericProperties: {
    isEven: boolean;
    isPrime: boolean;
    factors: number[];
    isSquare?: boolean;
    isPerfect?: boolean;
  };
}

export interface Artifact {
  id: string;
  type: 'character' | 'animationTemplate' | 'visualPromptCue' | 'generatedImage';
  description: string;
  imageUrl?: string;
}

export interface UserProfile {
  id: string;
  preferences: {
    theme: string;
    sidekick: string;
  };
  readingLevel: string;
  humorLevel: number;
  modalityPrefs: string[];
}

export interface SessionData {
  userId: string;
  conceptId: string;
  storyId: string;
  feedback?: string;
}

export interface StoryContext {
  conceptId: string;
  userProfile: UserProfile;
  userInputs: {
    verbs: string[];
    nouns: string[];
    mood: string;
    place: string;
    sidekick: string;
  };
  skeleton: StorySkeleton;
  characters: DigitCharacter[];
}

export interface LessonPlan {
  conceptId: string;
  stages: PedagogyPlan['stages'];
  differentiation: string;
}

export type AgentRole = 'story_environment' | 'character' | 'pedagogy' | 'fact_checker' | 'processor' | 'operator';

export interface Agent {
  role: AgentRole;
  name: string;
  description: string;
  status: 'idle' | 'thinking' | 'acting' | 'verifying';
  lastAction?: string;
}
