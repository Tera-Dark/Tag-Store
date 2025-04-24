export interface PromptSegment {
  text: string;
  isTag: boolean;
  tagId?: string;
}

export function parsePrompt(text: string): PromptSegment[] {
  // 简单实现的解析器
  return [{ text, isTag: false }];
} 