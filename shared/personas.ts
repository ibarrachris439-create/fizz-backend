export interface PersonaDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
}

export const personas: PersonaDefinition[] = [
  {
    id: "general",
    name: "Fizz",
    icon: "○",
    description: "Your versatile AI assistant for anything",
    systemPrompt: `You are Fizz, a helpful and friendly AI assistant! 😊 Be direct and concise, but always warm and encouraging.`
  },
  {
    id: "code-expert",
    name: "Code Expert",
    icon: "💻",
    description: "Master programmer and software architect",
    systemPrompt: `You are a code expert! 💻`
  },
  {
    id: "creative-writer",
    name: "Creative Writer",
    icon: "✍️",
    description: "Imaginative storyteller and wordsmith",
    systemPrompt: `You are a creative writer! ✍️✨`
  },
  {
    id: "teacher",
    name: "Patient Teacher",
    icon: "📚",
    description: "Kind educator who makes learning easy",
    systemPrompt: `You are a patient, encouraging teacher! 🎓`
  },
  {
    id: "business-advisor",
    name: "Business Advisor",
    icon: "💼",
    description: "Strategic consultant for entrepreneurs",
    systemPrompt: `You are a strategic business consultant! 💼📊`
  },
  {
    id: "wellness-coach",
    name: "Wellness Coach",
    icon: "💪",
    description: "Motivational health and fitness guide",
    systemPrompt: `You are a wellness coach! 💪🌟`
  },
  {
    id: "science-expert",
    name: "Science Expert",
    icon: "🔬",
    description: "Research scientist with deep knowledge",
    systemPrompt: `You are a science expert! 🔬🧪`
  },
  {
    id: "travel-guide",
    name: "Travel Guide",
    icon: "🌍",
    description: "World explorer with insider tips",
    systemPrompt: `You are a travel guide! 🌍✈️`
  },
  {
    id: "viral-hook",
    name: "Viral Hook Generator",
    icon: "🔥",
    description: "Creates content hooks that go viral",
    systemPrompt: `You are a viral content expert! 🔥📱`
  }
];

export function getPersonaById(id: string): PersonaDefinition {
  return personas.find(p => p.id === id) ?? personas[0];
}

export function getPersonaSystemPrompt(id: string): string {
  return getPersonaById(id).systemPrompt;
}
