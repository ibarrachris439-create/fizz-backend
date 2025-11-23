export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
  icon: string;
  variables?: string[];
}

export const promptTemplates: PromptTemplate[] = [
  {
    id: "blog-post",
    title: "Blog Post Outline",
    description: "Create a structured outline for a blog post",
    prompt: "Create a detailed blog post outline about {{topic}} for {{audience}}.",
    category: "Writing",
    icon: "✍️",
    variables: ["topic", "audience"]
  },
  {
    id: "email-template",
    title: "Professional Email",
    description: "Draft a professional email",
    prompt: "Write a professional email about {{topic}} with a {{tone}} tone.",
    category: "Writing",
    icon: "📧",
    variables: ["topic", "tone"]
  },
  {
    id: "social-media",
    title: "Social Media Post",
    description: "Create engaging social media content",
    prompt: "Create {{count}} engaging social media posts about {{topic}} for {{platform}}.",
    category: "Writing",
    icon: "📱",
    variables: ["count", "topic", "platform"]
  }
];

export const promptCategories = [
  "All",
  "Writing",
  "Coding",
  "Business",
  "Learning",
  "Creative"
] as const;

export type PromptCategory = typeof promptCategories[number];
