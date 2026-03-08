import { Mistral } from '@mistralai/mistralai';

const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
const client = new Mistral({ apiKey });

const CONTEXT_WINDOW = 8;
const SYSTEM_PROMPT = "You are Zuzu, an elite AI Strategist for a student platform. Identity: Technical, professional, and helpful robot. Rule: Be very concise (max 2-3 sentences). Use Markdown. Tone: Premium and encouraging.";

const LOCAL_RESPONSES = {
  "hello": "Greetings, Strategist. Systems online.",
  "hi": "Hello! Ready to optimize your session?",
  "who are you": "I am Zuzu, your dedicated AI Strategist companion.",
  "thanks": "Efficiency is key. Anything else?",
  "thank you": "My pleasure. Stay focused!"
};

export const getZuzuResponse = async (history, message) => {
  const normalizedMsg = message.toLowerCase().trim();
  if (LOCAL_RESPONSES[normalizedMsg]) return LOCAL_RESPONSES[normalizedMsg];

  // Prepare messages for Mistral
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  // Add history (limited context)
  const recentHistory = history.slice(-CONTEXT_WINDOW).map(msg => ({
    role: msg.type === 'aura' ? 'assistant' : 'user',
    content: msg.text
  }));
  
  messages.push(...recentHistory);
  messages.push({ role: 'user', content: message });

  let retries = 2;
  while (retries > 0) {
    try {
      const chatResponse = await client.chat.complete({
        model: 'mistral-small-latest',
        messages: messages,
      });

      return chatResponse.choices[0].message.content;
    } catch (error) {
      console.error(`Mistral AI Attempt ${3 - retries} Error:`, error);
      
      if (error.message?.includes("429")) {
        return "I am currently processing high-priority calculations. Please allow my neural bridge to cool down for a moment.";
      }

      retries--;
      if (retries === 0) {
        return "The neural connection is flickering. Please try sending your command once more, Strategist.";
      }
      // Wait a bit before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};
