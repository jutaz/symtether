export class ApiClient {
  fetchData(url: string): Promise<string> {
    return Promise.resolve(url);
  }

  fetchAgentData(id: string): Promise<string> {
    return Promise.resolve(id);
  }

  render(): void {}
}

export class Widget {
  render(): void {}
}

export function parseConfig(raw: string): Record<string, string> {
  return JSON.parse(raw) as Record<string, string>;
}

export const withRetry = (attempts: number) => attempts;

export interface AgentSkill {
  name: string;
}
