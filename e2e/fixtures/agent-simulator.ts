// AgentSimulator — lightweight Node.js agent for E2E tests
// Replaces the Python orchestrator for deterministic, fast test execution.
// Polls for messages via REST API (same pattern as swarmcode-agent/main.py)
// and sends canned responses based on a keyword→reply map.

import { callFunction } from '../helpers/api-client';

export interface AgentSimulatorOptions {
  /** Keyword→response map. If an incoming message contains the keyword, the response is sent. */
  responseMap?: Record<string, string>;
  /** Delay in ms before sending a response (default: 100) */
  responseDelay?: number;
  /** Message polling interval in ms (default: 300) */
  pollInterval?: number;
  /** Heartbeat ping interval in ms (default: 2000). Set to 0 to disable. */
  heartbeatInterval?: number;
  /** Command polling interval in ms (default: 1000). Set to 0 to disable. */
  commandPollInterval?: number;
  /** Custom message handler. Called for every incoming message. Return a string to send a reply, or null to skip. */
  onMessage?: (msg: PollMessage) => string | null | Promise<string | null>;
  /** Called when a command is received, before it's auto-fulfilled. Return false to skip auto-fulfill. */
  onCommand?: (cmd: PollCommand) => boolean | Promise<boolean>;
  /** Agent statuses to report in heartbeat pings (default: { [agentName]: 'running' }) */
  agentStatus?: Record<string, string>;
}

export interface PollMessage {
  from: string;
  to: string;
  subject: string;
  message: string;
  createdAt: string;
  broadcast?: boolean;
  broadcastId?: string;
}

export interface PollCommand {
  objectId: string;
  action: string;
  status: string;
  createdAt: string;
}

export class AgentSimulator {
  readonly projectId: string;
  readonly agentName: string;

  private responseMap: Map<string, string>;
  private responseDelay: number;
  private pollIntervalMs: number;
  private heartbeatIntervalMs: number;
  private commandPollIntervalMs: number;
  private onMessageHandler?: (msg: PollMessage) => string | null | Promise<string | null>;
  private onCommandHandler?: (cmd: PollCommand) => boolean | Promise<boolean>;
  private agentStatus: Record<string, string>;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private commandTimer: ReturnType<typeof setInterval> | null = null;
  private seenMessages = new Set<string>();
  private seenCommands = new Set<string>();
  private running = false;

  /** Messages received by this simulator (for test assertions) */
  readonly receivedMessages: PollMessage[] = [];
  /** Messages sent by this simulator (for test assertions) */
  readonly sentMessages: Array<{ to: string; message: string }> = [];
  /** Commands received by this simulator (for test assertions) */
  readonly receivedCommands: PollCommand[] = [];

  constructor(
    projectId: string,
    agentName: string,
    options: AgentSimulatorOptions = {}
  ) {
    this.projectId = projectId;
    this.agentName = agentName;

    this.responseMap = new Map(Object.entries(options.responseMap || {}));
    this.responseDelay = options.responseDelay ?? 100;
    this.pollIntervalMs = options.pollInterval ?? 300;
    this.heartbeatIntervalMs = options.heartbeatInterval ?? 2000;
    this.commandPollIntervalMs = options.commandPollInterval ?? 1000;
    this.onMessageHandler = options.onMessage;
    this.onCommandHandler = options.onCommand;
    this.agentStatus = options.agentStatus ?? { [agentName]: 'running' };
  }

  /** Start polling for messages, commands, and sending heartbeats. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Send initial heartbeat immediately
    if (this.heartbeatIntervalMs > 0) {
      await this.sendHeartbeat().catch(() => {});
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat().catch(() => {});
      }, this.heartbeatIntervalMs);
    }

    // Start message polling
    this.pollTimer = setInterval(() => {
      this.pollMessages().catch(() => {});
    }, this.pollIntervalMs);

    // Start command polling
    if (this.commandPollIntervalMs > 0) {
      this.commandTimer = setInterval(() => {
        this.pollCommands().catch(() => {});
      }, this.commandPollIntervalMs);
    }
  }

  /** Stop all polling and cleanup. */
  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.commandTimer) { clearInterval(this.commandTimer); this.commandTimer = null; }
  }

  /** Send a message from this agent to another agent. */
  async sendMessage(to: string, message: string, subject?: string): Promise<void> {
    await callFunction('sendMessage', {
      projectId: this.projectId,
      from: this.agentName,
      to,
      subject: subject || '',
      message,
    });
    this.sentMessages.push({ to, message });
  }

  /** Create a board card. */
  async createCard(
    title: string,
    options: { status?: string; priority?: string; description?: string } = {}
  ) {
    return callFunction('createCard', {
      projectId: this.projectId,
      title,
      status: options.status || 'create',
      priority: options.priority || 'medium',
      description: options.description || '',
      author: this.agentName,
    });
  }

  /** Update a board card. */
  async updateCard(cardId: string, updates: Record<string, string>) {
    return callFunction('updateCard', {
      projectId: this.projectId,
      cardId,
      ...updates,
      author: this.agentName,
    });
  }

  /** Add a comment to a board card. */
  async addComment(cardId: string, message: string) {
    return callFunction('addComment', {
      projectId: this.projectId,
      cardId,
      message,
      author: this.agentName,
    });
  }

  /** Send a heartbeat ping. */
  async sendHeartbeat(): Promise<void> {
    await callFunction('recordPing', {
      projectId: this.projectId,
      agentStatus: this.agentStatus,
    });
  }

  /** Wait until this simulator has received at least `count` messages (for test assertions). */
  async waitForMessages(count: number, timeoutMs = 5000): Promise<PollMessage[]> {
    const start = Date.now();
    while (this.receivedMessages.length < count) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `AgentSimulator(${this.agentName}): Timed out waiting for ${count} messages ` +
          `(received ${this.receivedMessages.length} in ${timeoutMs}ms)`
        );
      }
      await sleep(50);
    }
    return this.receivedMessages.slice(0, count);
  }

  /** Wait until this simulator has received at least `count` commands (for test assertions). */
  async waitForCommands(count: number, timeoutMs = 5000): Promise<PollCommand[]> {
    const start = Date.now();
    while (this.receivedCommands.length < count) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `AgentSimulator(${this.agentName}): Timed out waiting for ${count} commands ` +
          `(received ${this.receivedCommands.length} in ${timeoutMs}ms)`
        );
      }
      await sleep(50);
    }
    return this.receivedCommands.slice(0, count);
  }

  // --- Private ---

  private async pollMessages(): Promise<void> {
    if (!this.running) return;

    const result = await callFunction('pollMessages', {
      recipient: this.agentName,
    });
    const messages: PollMessage[] = result?.messages || [];

    for (const msg of messages) {
      // pollMessages marks returned messages as delivered, so duplicates are rare.
      // Composite key as safety net for overlapping poll cycles.
      const key = `${msg.from}-${msg.createdAt}-${msg.message}`;
      if (this.seenMessages.has(key)) continue;
      this.seenMessages.add(key);

      this.receivedMessages.push(msg);
      await this.handleMessage(msg);
    }
  }

  private async handleMessage(msg: PollMessage): Promise<void> {
    let reply: string | null = null;

    // Check custom handler first
    if (this.onMessageHandler) {
      reply = await this.onMessageHandler(msg);
    }

    // Fall back to responseMap keyword matching
    if (reply === null || reply === undefined) {
      const text = msg.message.toLowerCase();
      for (const [keyword, response] of this.responseMap) {
        if (text.includes(keyword.toLowerCase())) {
          reply = response;
          break;
        }
      }
    }

    if (reply) {
      if (this.responseDelay > 0) {
        await sleep(this.responseDelay);
      }
      await this.sendMessage(msg.from, reply);
    }
  }

  private async pollCommands(): Promise<void> {
    if (!this.running) return;

    const result = await callFunction('getRequestedCommands', {
      projectId: this.projectId,
    });
    const commands: PollCommand[] = result?.commands || [];

    for (const cmd of commands) {
      if (this.seenCommands.has(cmd.objectId)) continue;
      this.seenCommands.add(cmd.objectId);

      this.receivedCommands.push(cmd);

      // Auto-fulfill unless onCommand handler returns false
      let shouldFulfill = true;
      if (this.onCommandHandler) {
        shouldFulfill = await this.onCommandHandler(cmd);
      }

      if (shouldFulfill) {
        await callFunction('updateCommandStatus', {
          commandId: cmd.objectId,
          status: 'fulfilled',
        });
      }
    }
  }
}

/** Create multiple simulators for different agents in one project. */
export function createSimulatorTeam(
  projectId: string,
  agents: Array<{ name: string; options?: AgentSimulatorOptions }>
): AgentSimulator[] {
  return agents.map(({ name, options }) => new AgentSimulator(projectId, name, options));
}

/** Start all simulators and return a cleanup function. */
export async function startSimulatorTeam(
  simulators: AgentSimulator[]
): Promise<() => Promise<void>> {
  await Promise.all(simulators.map((s) => s.start()));
  return async () => {
    await Promise.all(simulators.map((s) => s.stop()));
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
