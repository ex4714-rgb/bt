import { GoogleGenAI, Type } from "@google/genai";

export const generateSmartPlaylistTerms = async (mood: string): Promise<string[]> => {
  // Use the environment variable as per SDK requirement
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a list of 5 specific YouTube search queries for songs or videos that match this mood/request: "${mood}". 
      Return a JSON object with a property "terms" containing the list of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            terms: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const data = JSON.parse(text);
    return Array.isArray(data.terms) ? data.terms : [];
  } catch (error) {
    console.error("Gemini generation error:", error);
    return [];
  }
};