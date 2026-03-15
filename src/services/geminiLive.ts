import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { findOutcomesForQuery, getConceptForOutcome, getPedagogyForConcept, getStorySkeleton, getDigitCharacters, buildStoryContext, planLesson, getArtifactsForConcept } from "./mathTools";
import { Type } from "@google/genai";

// Audio processing utilities
export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private sampleRate: number = 24000;
  private activeSources: AudioBufferSourceNode[] = [];

  constructor() {}

  async start() {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.nextStartTime = this.audioContext.currentTime;
  }

  stop() {
    this.clearQueue();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  clearQueue() {
    this.activeSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source might have already stopped
      }
    });
    this.activeSources = [];
    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  addChunk(base64Data: string) {
    if (!this.audioContext) return;

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pcmData = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      this.activeSources = this.activeSources.filter(s => s !== source);
    };
  }
}

export const tools = [
  {
    functionDeclarations: [
      {
        name: "findOutcomesForQuery",
        description: "Find Alberta Grade 4 math outcomes based on a student query.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "The student's question or topic of interest." }
          },
          required: ["query"]
        }
      },
      {
        name: "getConceptForOutcome",
        description: "Get the conceptual logic for a specific outcome code.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            outcomeCode: { type: Type.STRING, description: "The outcome code (e.g., '4N3')." }
          },
          required: ["outcomeCode"]
        }
      },
      {
        name: "getArtifactsForConcept",
        description: "Get visual artifacts (animations, characters, cues) for a concept.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            conceptId: { type: Type.STRING, description: "The concept ID." }
          },
          required: ["conceptId"]
        }
      },
      {
        name: "showArtifact",
        description: "Trigger a visual artifact to be displayed in the student's view.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            artifactId: { type: Type.STRING, description: "The ID of the artifact to show." },
            message: { type: Type.STRING, description: "A short caption or explanation for the artifact." }
          },
          required: ["artifactId"]
        }
      },
      {
        name: "getPedagogyForConcept",
        description: "Get the pedagogical plan for a concept.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            conceptId: { type: Type.STRING, description: "The concept ID." }
          },
          required: ["conceptId"]
        }
      },
      {
        name: "getStorySkeleton",
        description: "Get the story skeleton for a concept.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            conceptId: { type: Type.STRING, description: "The concept ID." }
          },
          required: ["conceptId"]
        }
      },
      {
        name: "getDigitCharacters",
        description: "Get the digit characters for a set of digits.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            digits: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Array of digits." }
          },
          required: ["digits"]
        }
      },
      {
        name: "buildStoryContext",
        description: "Build the full story context with personalization.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            conceptId: { type: Type.STRING },
            userInputs: {
              type: Type.OBJECT,
              properties: {
                verbs: { type: Type.ARRAY, items: { type: Type.STRING } },
                nouns: { type: Type.ARRAY, items: { type: Type.STRING } },
                mood: { type: Type.STRING },
                place: { type: Type.STRING },
                sidekick: { type: Type.STRING }
              }
            }
          },
          required: ["conceptId", "userInputs"]
        }
      }
    ]
  }
];

export const handleToolCall = (name: string, args: any) => {
  switch (name) {
    case "findOutcomesForQuery":
      return findOutcomesForQuery(args.query);
    case "getConceptForOutcome":
      return getConceptForOutcome(args.outcomeCode);
    case "getArtifactsForConcept":
      return getArtifactsForConcept(args.conceptId);
    case "showArtifact":
      // This will be handled in the App.tsx by listening to tool calls
      return { status: "showing", artifactId: args.artifactId };
    case "getPedagogyForConcept":
      return getPedagogyForConcept(args.conceptId);
    case "getStorySkeleton":
      return getStorySkeleton(args.conceptId);
    case "getDigitCharacters":
      return getDigitCharacters(args.digits);
    case "buildStoryContext":
      // Mock user profile for now
      const mockProfile = {
        id: "user-1",
        preferences: { theme: "adventure", sidekick: "Robo-Dog" },
        readingLevel: "onLevel",
        humorLevel: 5,
        modalityPrefs: ["audio", "visual"]
      };
      return buildStoryContext(args.conceptId, mockProfile, args.userInputs);
    default:
      return { error: "Tool not found" };
  }
};
