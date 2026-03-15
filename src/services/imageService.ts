import { GoogleGenAI } from "@google/genai";

export class ImageService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async generateImage(prompt: string): Promise<string | undefined> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A magical, child-friendly illustration for a Grade 4 math story: ${prompt}. Style: Vibrant, whimsical, clean lines, educational.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
      return undefined;
    } catch (error) {
      console.error("Image Generation Error:", error);
      return undefined;
    }
  }
}

export const imageService = new ImageService();
