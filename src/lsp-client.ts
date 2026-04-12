import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  InitializeRequest,
  InitializedNotification,
  ShutdownRequest,
  ExitNotification,
  DefinitionRequest,
  ReferencesRequest,
  HoverRequest,
  DocumentSymbolRequest,
  WorkspaceSymbolRequest,
  type InitializeParams,
  type Location,
  type Hover,
  type SymbolInformation,
  type DocumentSymbol,
  type TextDocumentPositionParams,
  type ReferenceParams,
  type DocumentSymbolParams,
  type WorkspaceSymbolParams,
  type Definition,
  type DefinitionLink,
  type ProtocolConnection,
  type WorkspaceSymbol,
} from 'vscode-languageserver-protocol/node.js';
import { pathToUri } from './utils.js';

export class LspClient {
  private process: ChildProcess | null = null;
  private connection: ProtocolConnection | null = null;
  private initialized = false;
  private rootUri: string;

  constructor(private rootPath: string) {
    this.rootUri = pathToUri(rootPath);
  }

  /**
   * Start the language server process and perform LSP initialization.
   */
  async start(): Promise<void> {
    if (this.initialized) return;

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const packageRoot = path.resolve(__dirname, '..');
    const serverBin = path.resolve(
      packageRoot,
      'node_modules/.bin/typescript-language-server',
    );

    this.process = spawn(serverBin, ['--stdio'], {
      cwd: this.rootPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!this.process.stdin || !this.process.stdout) {
      throw new Error('Failed to get stdin/stdout from language server process');
    }

    const reader = new StreamMessageReader(this.process.stdout);
    const writer = new StreamMessageWriter(this.process.stdin);
    this.connection = createProtocolConnection(reader, writer);

    this.connection.listen();

    const initParams: InitializeParams = {
      processId: process.pid,
      rootUri: this.rootUri,
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true,
          },
          definition: {
            dynamicRegistration: false,
            linkSupport: false,
          },
          references: {
            dynamicRegistration: false,
          },
          hover: {
            dynamicRegistration: false,
            contentFormat: ['plaintext'],
          },
          documentSymbol: {
            dynamicRegistration: false,
            hierarchicalDocumentSymbolSupport: true,
          },
        },
        workspace: {
          symbol: {
            dynamicRegistration: false,
          },
        },
      },
      workspaceFolders: [
        {
          uri: this.rootUri,
          name: path.basename(this.rootPath),
        },
      ],
    };

    await this.connection.sendRequest(InitializeRequest.type, initParams);
    this.connection.sendNotification(InitializedNotification.type, {});
    this.initialized = true;
  }

  /**
   * Get the underlying message connection (for sending notifications like didOpen/didChange).
   */
  getConnection(): ProtocolConnection {
    if (!this.connection) {
      throw new Error('LSP client not started');
    }
    return this.connection;
  }

  /**
   * Go to definition.
   */
  async definition(
    uri: string,
    line: number,
    character: number,
  ): Promise<Definition | DefinitionLink[] | null> {
    this.ensureInitialized();
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line, character },
    };
    return this.connection!.sendRequest(DefinitionRequest.type, params);
  }

  /**
   * Find all references.
   */
  async references(
    uri: string,
    line: number,
    character: number,
    includeDeclaration = true,
  ): Promise<Location[] | null> {
    this.ensureInitialized();
    const params: ReferenceParams = {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration },
    };
    return this.connection!.sendRequest(ReferencesRequest.type, params);
  }

  /**
   * Get hover information.
   */
  async hover(
    uri: string,
    line: number,
    character: number,
  ): Promise<Hover | null> {
    this.ensureInitialized();
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line, character },
    };
    return this.connection!.sendRequest(HoverRequest.type, params);
  }

  /**
   * Get document symbols.
   */
  async documentSymbol(
    uri: string,
  ): Promise<SymbolInformation[] | DocumentSymbol[] | null> {
    this.ensureInitialized();
    const params: DocumentSymbolParams = {
      textDocument: { uri },
    };
    return this.connection!.sendRequest(DocumentSymbolRequest.type, params);
  }

  /**
   * Search workspace symbols.
   */
  async workspaceSymbol(
    query: string,
  ): Promise<SymbolInformation[] | WorkspaceSymbol[] | null> {
    this.ensureInitialized();
    const params: WorkspaceSymbolParams = { query };
    return this.connection!.sendRequest(WorkspaceSymbolRequest.type, params);
  }

  /**
   * Shut down the LSP server and kill the process.
   */
  async shutdown(): Promise<void> {
    if (!this.connection || !this.process) return;

    const proc = this.process;
    const conn = this.connection;

    this.connection = null;
    this.process = null;
    this.initialized = false;

    // Suppress stream errors during shutdown
    proc.stdin?.on('error', () => {});
    proc.stdout?.on('error', () => {});
    proc.stderr?.on('error', () => {});

    try {
      await conn.sendRequest(ShutdownRequest.type);
      conn.sendNotification(ExitNotification.type);
    } catch {
      // Server may have already exited
    }

    // Wait briefly for the process to exit gracefully
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!proc.killed) proc.kill();
        resolve();
      }, 2000);

      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    conn.dispose();
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.connection) {
      throw new Error('LSP client not initialized. Call start() first.');
    }
  }
}
