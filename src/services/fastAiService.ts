import { GoogleGenAI, Type } from "@google/genai";

export class FastAiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async getQuickHelp(query: string): Promise<string | undefined> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: query,
        config: {
          systemInstruction: "You are a quick math assistant for Grade 4 students. Give very short, encouraging, and clear answers. Use the personified number characters if relevant.",
        },
      });

      return response.text;
    } catch (error) {
      console.error("Fast AI Error:", error);
      return undefined;
    }
  }
}

export const fastAiService = new FastAiService();
