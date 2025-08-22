declare module '@modelcontextprotocol/sdk/server/index.js' {
  export class Server {
    constructor(
      info: { name: string; version: string },
      options: { capabilities: { tools: Record<string, any> } }
    );
    setRequestHandler<T, R>(schema: any, handler: (request: T) => Promise<R>): void;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    onerror: (error: Error) => void;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    constructor();
  }
}

declare module '@modelcontextprotocol/sdk/types.js' {
  export const ListToolsRequestSchema: any;
  export const CallToolRequestSchema: any;
  export const ListPromptsRequestSchema: any;
  export const GetPromptRequestSchema: any;

  export interface Tool {
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  }

  export enum ErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
  }

  export class McpError extends Error {
    constructor(code: ErrorCode, message: string);
  }

  export interface TextContent {
    type: 'text';
    text: string;
    isError?: boolean;
  }
}
