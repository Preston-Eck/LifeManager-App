
import { GoogleGenAI, Type } from "@google/genai";
import { Task, Urgency, Importance, TaskStatus, Book } from "../types";

// Helper for ID generation since we don't have uuid package
const generateId = () => Math.random().toString(36).substr(2, 9);

const getApiKey = () => {
    // In local dev, use process.env. In GAS, use injected window variable.
    return process.env.API_KEY || (window as any).GEMINI_API_KEY;
}

export const parseBrainDump = async (text: string, currentTasks: Task[]): Promise<Task[]> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("No API KEY provided");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `
    You are a helpful assistant for a busy campground manager and father. 
    Analyze the user's brain dump text and extract actionable tasks. 
    Return a JSON array of tasks. 
    Infer importance and urgency based on the context.
    If a location is mentioned, populate 'where'.
    If a specific person or entity is mentioned, populate 'forWho'.
    Set status to 'To Do' by default.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              shortDescription: { type: Type.STRING },
              longDescription: { type: Type.STRING },
              forWho: { type: Type.STRING },
              where: { type: Type.STRING },
              importance: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
              urgency: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
            },
            required: ["shortDescription", "importance", "urgency"]
          }
        }
      }
    });

    const rawTasks = JSON.parse(response.text || "[]");

    // Map raw AI response to our application Type
    const newTasks: Task[] = rawTasks.map((t: any) => ({
      id: generateId(),
      shortDescription: t.shortDescription,
      longDescription: t.longDescription || '',
      forWho: t.forWho || 'General',
      where: t.where || '',
      when: undefined, // Let user assign in week view
      importance: t.importance as Importance,
      urgency: t.urgency as Urgency,
      status: TaskStatus.TODO,
      attachments: [],
      boardId: 'general'
    }));

    return newTasks;

  } catch (error) {
    console.error("Error parsing brain dump:", error);
    throw error;
  }
};

/**
 * Extracts an ISBN from a base64 image using Gemini Vision.
 */
export const extractISBNFromImage = async (base64Image: string): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Assuming jpeg for simplicity, or detect from source
              data: base64Image
            }
          },
          {
            text: "Look at this image. If you see a book barcode or an ISBN number written on the back cover, extract the ISBN-13 (13 digit number). Return ONLY the number. If no ISBN is found, return 'NOT_FOUND'."
          }
        ]
      }
    });

    const text = response.text?.trim() || '';
    const isbnMatch = text.match(/\d{13}/);
    if (isbnMatch) return isbnMatch[0];
    
    // Fallback for ISBN-10 if 13 not found
    const isbn10Match = text.match(/\d{9}[\d|X]/);
    if (isbn10Match) return isbn10Match[0];

    return null;
  } catch (error) {
    console.error("Error extracting ISBN:", error);
    return null;
  }
};

/**
 * Fetches Book details from Google Books API and generates a Core Focus using Gemini.
 */
export const lookupBookDetails = async (isbn: string): Promise<Partial<Book> | null> => {
  try {
    // 1. Fetch from Google Books API (Public endpoint)
    const booksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
    const booksResponse = await fetch(booksUrl);
    const booksData = await booksResponse.json();

    if (booksData.totalItems > 0 && booksData.items) {
      const volumeInfo = booksData.items[0].volumeInfo;

      const title = volumeInfo.title || '';
      const subtitle = volumeInfo.subtitle || '';
      const authors = (volumeInfo.authors && volumeInfo.authors.join(', ')) || '';
      const description = volumeInfo.description || '';
      const pageCount = volumeInfo.pageCount || 0;
      const categories = (volumeInfo.categories && volumeInfo.categories.join(', ')) || '';
      let coverImageURL = (volumeInfo.imageLinks && volumeInfo.imageLinks.thumbnail) || '';
      if (coverImageURL) {
        coverImageURL = coverImageURL.replace('http://', 'https://');
      }

      // 2. Generate Core Focus with Gemini
      let coreFocus = "AI Summary Pending";
      const apiKey = getApiKey();
      if (apiKey && description) {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Based on the following book information, generate a concise "Core Focus" of 5-10 words. The Core Focus should capture the main theme, purpose, or genre of the book. Examples of good Core Focus summaries are: "Building Scalable Business Systems", "Intellectual Foundations of Christian Faith", "Modern Epic Fantasy & World-Building". Do not include quotation marks or any introductory text in your response.

          Book Information:
          - Title: "${title}"
          - Author: "${authors}"
          - Description: "${description}"
          
          Core Focus:`;

        const geminiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });
        
        coreFocus = geminiResponse.text?.trim() || "AI Summary Failed";
      }

      return {
        title,
        subtitle,
        author: authors,
        totalPages: pageCount,
        category: categories,
        coverUrl: coverImageURL,
        coreFocus: coreFocus,
        isbn: isbn
      };
    } else {
        return null;
    }
  } catch (error) {
    console.error("Error looking up book:", error);
    return null;
  }
};
