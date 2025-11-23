import { Router } from "express";

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
  // Writing & Content
  {
    id: "blog-post",
    title: "Blog Post Outline",
    description: "Create a structured outline for a blog post",
    prompt: "Create a detailed blog post outline about {{topic}} for {{audience}}. Include:\n- Attention-grabbing headline\n- Introduction hook\n- 3-5 main sections with subpoints\n- Conclusion\n- Call to action",
    category: "Writing",
    icon: "✍️",
    variables: ["topic", "audience"],
  },
  {
    id: "email-template",
    title: "Professional Email",
    description: "Draft a professional email",
    prompt: "Write a professional email about {{topic}}. Make it {{tone}} and concise. Include a clear subject line.",
    category: "Writing",
    icon: "📧",
    variables: ["topic", "tone"],
  },
  {
    id: "social-media",
    title: "Social Media Post",
    description: "Create engaging social media content",
    prompt: "Create {{count}} engaging social media posts about {{topic}} for {{platform}}. Make them attention-grabbing and include relevant hashtags.",
    category: "Writi
