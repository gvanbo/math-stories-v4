import { Agent } from './types';

export const INITIAL_AGENTS: Agent[] = [
  {
    role: 'operator',
    name: 'The Orchestrator',
    description: 'The central brain that coordinates all other agents to ensure a seamless experience.',
    status: 'idle'
  },
  {
    role: 'story_environment',
    name: 'World Builder',
    description: 'Manages the setting, atmosphere, and narrative flow of the math adventure.',
    status: 'idle'
  },
  {
    role: 'character',
    name: 'Persona Lead',
    description: 'Ensures digit characters stay in character and their personalities shine through.',
    status: 'idle'
  },
  {
    role: 'pedagogy',
    name: 'Curriculum Guide',
    description: 'Aligns all content with Alberta Grade 4 Math standards and educational goals.',
    status: 'idle'
  },
  {
    role: 'fact_checker',
    name: 'Math Sentry',
    description: 'Verifies every calculation and math concept for 100% accuracy.',
    status: 'idle'
  },
  {
    role: 'processor',
    name: 'Signal Master',
    description: 'Handles real-time input/output processing and multimodal synchronization.',
    status: 'idle'
  }
];
