export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
  icon: string;
  variables?: string[]; // e.g., ["topic", "audience"]
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
    category: "Writing",
    icon: "📱",
    variables: ["count", "topic", "platform"],
  },
  
  // Coding & Development
  {
    id: "code-review",
    title: "Code Review",
    description: "Get a thorough code review",
    prompt: "Review this code for:\n- Best practices\n- Potential bugs\n- Performance issues\n- Security concerns\n- Suggestions for improvement\n\n```{{language}}\n{{code}}\n```",
    category: "Coding",
    icon: "👨‍💻",
    variables: ["language", "code"],
  },
  {
    id: "debug-help",
    title: "Debug Assistant",
    description: "Help debugging code issues",
    prompt: "I'm getting this error:\n{{error}}\n\nIn this code:\n```{{language}}\n{{code}}\n```\n\nHelp me understand what's wrong and how to fix it.",
    category: "Coding",
    icon: "🐛",
    variables: ["error", "language", "code"],
  },
  {
    id: "api-docs",
    title: "API Documentation",
    description: "Generate API documentation",
    prompt: "Create clear API documentation for this {{language}} function:\n\n```{{language}}\n{{code}}\n```\n\nInclude:\n- Purpose\n- Parameters\n- Return value\n- Example usage\n- Edge cases",
    category: "Coding",
    icon: "📚",
    variables: ["language", "code"],
  },
  
  // Business & Productivity
  {
    id: "meeting-agenda",
    title: "Meeting Agenda",
    description: "Create a structured meeting agenda",
    prompt: "Create a meeting agenda for {{topic}} with these attendees: {{attendees}}. The meeting is {{duration}} minutes. Include:\n- Objectives\n- Discussion points\n- Time allocation\n- Action items section",
    category: "Business",
    icon: "📅",
    variables: ["topic", "attendees", "duration"],
  },
  {
    id: "project-plan",
    title: "Project Plan",
    description: "Outline a project plan",
    prompt: "Create a project plan for {{project}}. Include:\n- Project goals\n- Key milestones\n- Timeline estimate\n- Required resources\n- Potential risks\n- Success metrics",
    category: "Business",
    icon: "📊",
    variables: ["project"],
  },
  {
    id: "swot-analysis",
    title: "SWOT Analysis",
    description: "Perform a SWOT analysis",
    prompt: "Conduct a SWOT analysis for {{company}} in the {{industry}} industry. Analyze:\n- Strengths\n- Weaknesses\n- Opportunities\n- Threats\nProvide specific examples for each category.",
    category: "Business",
    icon: "📈",
    variables: ["company", "industry"],
  },
  
  // Learning & Education
  {
    id: "explain-concept",
    title: "Explain Like I'm 5",
    description: "Simplify complex concepts",
    prompt: "Explain {{concept}} in simple terms that a beginner can understand. Use analogies and real-world examples.",
    category: "Learning",
    icon: "🎓",
    variables: ["concept"],
  },
  {
    id: "study-guide",
    title: "Study Guide",
    description: "Create a comprehensive study guide",
    prompt: "Create a study guide for {{topic}}. Include:\n- Key concepts and definitions\n- Important formulas or principles\n- Practice questions\n- Common misconceptions\n- Memory aids and mnemonics",
    category: "Learning",
    icon: "📖",
    variables: ["topic"],
  },
  {
    id: "quiz-generator",
    title: "Quiz Generator",
    description: "Generate quiz questions",
    prompt: "Generate {{count}} quiz questions about {{topic}} at {{difficulty}} difficulty level. Include:\n- Multiple choice questions\n- True/false questions\n- Short answer questions\nProvide answer keys.",
    category: "Learning",
    icon: "✅",
    variables: ["count", "topic", "difficulty"],
  },
  
  // Creative & Brainstorming
  {
    id: "brainstorm",
    title: "Brainstorm Ideas",
    description: "Generate creative ideas",
    prompt: "Brainstorm {{count}} creative ideas for {{topic}}. Make them:\n- Innovative and unique\n- Practical and actionable\n- Diverse in approach\nProvide brief descriptions for each idea.",
    category: "Creative",
    icon: "💡",
    variables: ["count", "topic"],
  },
  {
    id: "story-prompt",
    title: "Story Generator",
    description: "Create a story prompt",
    prompt: "Create a {{genre}} story about {{theme}}. Include:\n- Compelling characters\n- An engaging plot\n- Vivid descriptions\n- A satisfying conclusion\nTarget length: {{length}} words.",
    category: "Creative",
    icon: "📝",
    variables: ["genre", "theme", "length"],
  },
];

export const promptCategories = [
  "All",
  "Writing",
  "Coding",
  "Business",
  "Learning",
  "Creative",
] as const;

export type PromptCategory = typeof promptCategories[number];
