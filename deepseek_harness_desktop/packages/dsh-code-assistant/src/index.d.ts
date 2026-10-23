import type { IncomingMessage, ServerResponse } from 'node:http'
export type CodeAssistantHost = {
  root: string; toolsRoot: string; assets: string; workspace: any;
  projects: () => { path: string; name: string }[]; addProject: (path: string) => Promise<void>;
  authorize: (task: any, action: any) => void; resolveModel: (selected: string) => string;
  stream: (options: unknown) => AsyncIterable<unknown>; guidance?: (task: any) => string | Promise<string>;
}
export class CodeAssistantService {
  constructor(host: CodeAssistantHost)
  fork(id: string, target: string): Promise<{id:string}>
  init(): Promise<void>
  close(): Promise<void>
  routes(req: IncomingMessage, res: ServerResponse): Promise<void>
  activities(): { id: string; roleId: string; roleVersion: number; name: string; kind: string; status: string; componentIds: string[] }[]
  stopComponents(ids: string[]): Promise<void>
}
export function moduleAssets(): string
export const ENGINE_VERSION: string
