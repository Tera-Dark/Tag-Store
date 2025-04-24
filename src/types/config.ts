export interface WeightTemplate {
  id: string;
  name: string;
  template: string;
  tagFormat: string;
  separator: string;
  description?: string;
}

export interface AppConfig {
  version: string;
  templates: WeightTemplate[];
  defaultWeights: Record<string, number>;
  defaultBrackets: Record<string, string>;
} 