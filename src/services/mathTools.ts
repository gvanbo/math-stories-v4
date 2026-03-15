import { Outcome, Concept, PedagogyPlan, StorySkeleton, DigitCharacter, UserProfile, StoryContext, LessonPlan, Artifact } from '../types';
import { ALBERTA_GRADE_4_OUTCOMES, CONCEPTS, PEDAGOGY_PLANS, STORY_SKELETONS, DIGIT_CHARACTERS, ARTIFACTS } from '../data';

export const findOutcomesForQuery = (query: string): Outcome[] => {
  const lowerQuery = query.toLowerCase();
  return ALBERTA_GRADE_4_OUTCOMES.filter(o => 
    o.description.toLowerCase().includes(lowerQuery) || 
    o.keywords.some(k => lowerQuery.includes(k.toLowerCase())) ||
    o.code.toLowerCase().includes(lowerQuery)
  );
};

export const getConceptForOutcome = (outcomeCode: string): Concept | undefined => {
  return CONCEPTS.find(c => c.outcomeCode === outcomeCode);
};

export const getPedagogyForConcept = (conceptId: string): PedagogyPlan | undefined => {
  return PEDAGOGY_PLANS.find(p => p.conceptId === conceptId);
};

export const getStorySkeleton = (conceptId: string): StorySkeleton | undefined => {
  return STORY_SKELETONS.find(s => s.conceptId === conceptId);
};

export const getDigitCharacters = (digits: number[]): DigitCharacter[] => {
  return DIGIT_CHARACTERS.filter(c => digits.includes(c.digit));
};

export const getArtifactsForConcept = (conceptId: string): Artifact[] => {
  // In a real app, this would be filtered by conceptId
  return ARTIFACTS;
};

export const buildStoryContext = (
  conceptId: string, 
  userProfile: UserProfile, 
  userInputs: StoryContext['userInputs']
): StoryContext | undefined => {
  const skeleton = getStorySkeleton(conceptId);
  if (!skeleton) return undefined;

  // For simplicity, we pick some digits based on the concept or just default ones
  const characters = getDigitCharacters([1, 2, 5]); 

  return {
    conceptId,
    userProfile,
    userInputs,
    skeleton,
    characters
  };
};

export const planLesson = (conceptId: string, userProfile: UserProfile): LessonPlan | undefined => {
  const pedagogy = getPedagogyForConcept(conceptId);
  if (!pedagogy) return undefined;

  // Simple differentiation logic
  const level = userProfile.readingLevel === 'advanced' ? 'advanced' : 'onLevel';

  return {
    conceptId,
    stages: pedagogy.stages,
    differentiation: pedagogy.differentiation[level as keyof typeof pedagogy.differentiation]
  };
};

export const recordFeedback = (sessionId: string, feedback: string): void => {
  console.log(`Feedback for ${sessionId}: ${feedback}`);
};
