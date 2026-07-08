import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ContributionsService } from './contributions.service';

interface SocketAuthContext {
  sub: string;
  scope: 'user' | 'admin';
}

/**
 * socket.io real-time transport for contribution-group chat + live activity.
 *
 * Reuses the notification gateway's namespaced/JWT-handshake pattern. Two
 * namespaces on the same server:
 *   - `/rt/user`  — end-user plane (user JWT, `scope === 'user'`)
 *   - `/rt/admin` — admin plane   (admin JWT, `scope === 'admin'`)
 *
 * Rooms are per-group: `group:<groupId>` (joined within the connecting socket's
 * own namespace). Broadcasts fan out across BOTH namespaces so admins in a
 * group see user chat and vice-versa.
 */
@WebSocketGateway({
  namespace: /^\/rt\/(user|admin)$/,
  cors: { origin: true, credentials: true },
})
export class ContributionsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ContributionsGateway.name);

  @WebSocketServer()
  private server: Server;

  /** Resolves the ROOT socket.io Server (see NotificationGateway for rationale). */
  private get io(): Server {
    return ((this.server as any)?.server as Server) ?? this.server;
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ContributionsService))
    private readonly contributionsService: ContributionsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  async handleConnection(client: Socket): Promise<void> {
    const namespace = client.nsp.name; // '/rt/user' | '/rt/admin'
    const plane: 'user' | 'admin' =
      namespace === '/rt/admin' ? 'admin' : 'user';

    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    const ctx = await this.verify(token, plane);
    if (!ctx) {
      client.disconnect(true);
      return;
    }

    client.data.auth = ctx;
  }

  // ---------------------------------------------------------------------------
  // Group chat
  // ---------------------------------------------------------------------------

  /** Join a group room. Users must be ACTIVE members; admins may join any group. */
  @SubscribeMessage('group:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { groupId?: string },
  ): Promise<void> {
    const ctx: SocketAuthContext | undefined = client.data?.auth;
    const groupId = (body?.groupId || '').toString();
    if (!ctx || !groupId) {
      return;
    }

    const allowed = await this.canAccessGroup(ctx, groupId);
    if (!allowed) {
      client.emit('group:error', { groupId, message: 'Access denied' });
      return;
    }

    client.join(`group:${groupId}`);
    client.emit('group:joined', { groupId });
  }

  @SubscribeMessage('group:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { groupId?: string },
  ): void {
    const groupId = (body?.groupId || '').toString();
    if (!groupId) {
      return;
    }
    client.leave(`group:${groupId}`);
    client.emit('group:left', { groupId });
  }

  /** Persist a chat message and broadcast it to the group room on both planes. */
  @SubscribeMessage('group:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { groupId?: string; message?: string },
  ): Promise<void> {
    const ctx: SocketAuthContext | undefined = client.data?.auth;
    const groupId = (body?.groupId || '').toString();
    const message = (body?.message || '').toString().trim();
    if (!ctx || !groupId || !message) {
      return;
    }

    const allowed = await this.canAccessGroup(ctx, groupId);
    if (!allowed) {
      client.emit('group:error', { groupId, message: 'Access denied' });
      return;
    }

    try {
      const saved = await this.contributionsService.persistChatMessage(
        groupId,
        ctx.scope,
        ctx.sub,
        message,
      );
      this.emitGroupMessage(groupId, saved);
    } catch (error: any) {
      this.logger.warn(`group:message persist failed: ${error?.message}`);
      client.emit('group:error', { groupId, message: 'Send failed' });
    }
  }

  // ---------------------------------------------------------------------------
  // Emit helpers (used by services + this gateway)
  // ---------------------------------------------------------------------------

  /** Broadcast a saved chat message to the group room on BOTH namespaces. */
  emitGroupMessage(groupId: string, message: any): void {
    this.broadcastToGroup(groupId, 'group:message:new', { groupId, message });
  }

  /** Push a live activity-feed entry to the group room on BOTH namespaces. */
  emitGroupActivity(groupId: string, activity: any): void {
    this.broadcastToGroup(groupId, 'group:activity', { groupId, activity });
  }

  private broadcastToGroup(groupId: string, event: string, payload: any): void {
    if (!this.server) {
      return;
    }
    const room = `group:${groupId}`;
    this.io.of('/rt/user').to(room).emit(event, payload);
    this.io.of('/rt/admin').to(room).emit(event, payload);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async canAccessGroup(
    ctx: SocketAuthContext,
    groupId: string,
  ): Promise<boolean> {
    if (ctx.scope === 'admin') {
      return true;
    }
    return this.contributionsService.isActiveMember(groupId, ctx.sub);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake?.auth?.token;
    if (typeof authToken === 'string' && authToken) {
      return authToken.replace(/^Bearer\s+/i, '');
    }
    const header =
      client.handshake?.headers?.authorization ||
      (client.handshake?.headers?.Authorization as string | undefined);
    if (typeof header === 'string' && header) {
      return header.replace(/^Bearer\s+/i, '');
    }
    return undefined;
  }

  private async verify(
    token: string,
    plane: 'user' | 'admin',
  ): Promise<SocketAuthContext | null> {
    const secretPath =
      plane === 'admin'
        ? 'configuration.adminJwt.secret'
        : 'configuration.jwt.secret';
    const secret = this.configService.get<string>(secretPath);

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        scope?: string;
      }>(token, { secret });
      if (payload?.scope !== plane || !payload.sub) {
        return null;
      }
      return { sub: payload.sub, scope: plane };
    } catch {
      return null;
    }
  }
}
