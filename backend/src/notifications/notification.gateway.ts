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
import { NotificationService } from './notification.service';

interface SocketAuthContext {
  sub: string;
  scope: 'user' | 'admin';
}

/**
 * socket.io real-time transport for in-app notifications and support chat.
 *
 * Two namespaces on the same server:
 *   - `/rt/user`  — end-user plane (user JWT, `scope === 'user'`)
 *   - `/rt/admin` — admin plane   (admin JWT, `scope === 'admin'`)
 *
 * Rooms:
 *   - user  → `user:<sub>`
 *   - admin → `admin:<sub>` AND the shared `admins` room (broadcast fan-out)
 *
 * The JWT is read from `client.handshake.auth.token` (fallback: the
 * `Authorization: Bearer <token>` header). Connections that fail verification
 * are disconnected immediately.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class NotificationGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
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
      this.logger.warn(`Socket ${client.id} rejected: no token`);
      client.disconnect(true);
      return;
    }

    const ctx = await this.verify(token, plane);
    if (!ctx) {
      this.logger.warn(`Socket ${client.id} rejected: invalid ${plane} token`);
      client.disconnect(true);
      return;
    }

    client.data.auth = ctx;

    if (ctx.scope === 'admin') {
      client.join(`admin:${ctx.sub}`);
      client.join('admins');
    } else {
      client.join(`user:${ctx.sub}`);
    }

    // Push an initial unread count so the client can hydrate its badge.
    try {
      const count = await this.notificationService.unreadCount(
        ctx.scope,
        ctx.sub,
      );
      client.emit('notification:unread_count', { count });
    } catch {
      // best-effort hydration; ignore failures
    }
  }

  // ---------------------------------------------------------------------------
  // Support chat
  // ---------------------------------------------------------------------------

  /** user → admins: a support message from the end user. */
  @SubscribeMessage('support:message')
  async handleSupportMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { message?: string; data?: Record<string, any> },
  ): Promise<void> {
    const ctx: SocketAuthContext | undefined = client.data?.auth;
    if (!ctx || ctx.scope !== 'user') {
      return;
    }
    const message = (body?.message || '').toString();
    if (!message.trim()) {
      return;
    }

    const payload = {
      fromUserId: ctx.sub,
      message,
      data: body?.data || {},
      at: new Date().toISOString(),
    };

    this.emitToAllAdmins('support:message', payload);

    // Persist as an admin-facing notification (fan-out, best-effort).
    this.notificationService
      .notifyAdmins({
        event: 'support.message',
        type: 'info',
        title: 'New support message',
        body: message.slice(0, 240),
        data: { fromUserId: ctx.sub, ...(body?.data || {}) },
      })
      .catch(() => undefined);
  }

  /** admin → user: a reply targeted at a specific user. */
  @SubscribeMessage('support:reply')
  handleSupportReply(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      targetUserId?: string;
      message?: string;
      data?: Record<string, any>;
    },
  ): void {
    const ctx: SocketAuthContext | undefined = client.data?.auth;
    if (!ctx || ctx.scope !== 'admin') {
      return;
    }
    const targetUserId = (body?.targetUserId || '').toString();
    const message = (body?.message || '').toString();
    if (!targetUserId || !message.trim()) {
      return;
    }

    this.emitToUser(targetUserId, 'support:reply', {
      fromAdminId: ctx.sub,
      message,
      data: body?.data || {},
      at: new Date().toISOString(),
    });
  }

  // ---------------------------------------------------------------------------
  // Emit helpers (used by NotificationService)
  // ---------------------------------------------------------------------------

  emitToUser(userId: string, event: string, data: any): void {
    if (!this.server) {
      return;
    }
    this.server.of('/rt/user').to(`user:${userId}`).emit(event, data);
  }

  emitToAdmin(adminId: string, event: string, data: any): void {
    if (!this.server) {
      return;
    }
    this.server.of('/rt/admin').to(`admin:${adminId}`).emit(event, data);
  }

  emitToAllAdmins(event: string, data: any): void {
    if (!this.server) {
      return;
    }
    this.server.of('/rt/admin').to('admins').emit(event, data);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

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
      if (payload?.scope !== plane) {
        return null;
      }
      if (!payload.sub) {
        return null;
      }
      return { sub: payload.sub, scope: plane };
    } catch {
      return null;
    }
  }
}
