import { Logger } from '@nestjs/common';
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
import { EquipmentGpsService, PositionInput } from './equipment-gps.service';

interface SocketAuthContext {
  sub: string;
  scope: 'user' | 'admin';
}

/**
 * socket.io transport for LIVE equipment GPS tracking.
 *
 * Reuses the notification gateway's namespaced/JWT-handshake pattern. Two
 * namespaces on the same server:
 *   - `/rt/user`  — farmer viewer (user JWT, `scope === 'user'`)
 *   - `/rt/admin` — admin oversight (admin JWT, `scope === 'admin'`)
 *
 * Rooms are per-booking: `track:<bookingId>`.
 *
 * Two client roles:
 *   - VIEWER (farmer / admin) — authenticated by the socket JWT. Joins
 *     `track:<bookingId>` via `equipment:tracking:subscribe` after an ownership
 *     (user) / admin check, then receives `equipment:position:new` broadcasts.
 *   - OPERATOR — pushes `equipment:position` carrying the per-booking
 *     `trackingToken` (NOT a JWT). The server validates the token + booking
 *     state, appends to the trail, sets currentPosition, then broadcasts to the
 *     room on BOTH namespaces so the farmer AND admins see it live. Geofence /
 *     overspeed alerts fan out `equipment:alert` to admins.
 */
@WebSocketGateway({
  namespace: /^\/rt\/(user|admin)$/,
  cors: { origin: true, credentials: true },
})
export class EquipmentGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EquipmentGateway.name);

  @WebSocketServer()
  private server: Server;

  /** Resolves the ROOT socket.io Server (see NotificationGateway for rationale). */
  private get io(): Server {
    return ((this.server as any)?.server as Server) ?? this.server;
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly gpsService: EquipmentGpsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle — viewers authenticate via JWT (operator uses token).
  // ---------------------------------------------------------------------------

  async handleConnection(client: Socket): Promise<void> {
    const namespace = client.nsp.name; // '/rt/user' | '/rt/admin'
    const plane: 'user' | 'admin' =
      namespace === '/rt/admin' ? 'admin' : 'user';

    const token = this.extractToken(client);
    // A JWT is optional here: operator-only sockets may connect with just the
    // trackingToken. If a JWT is present, verify it and attach the viewer ctx.
    if (token) {
      const ctx = await this.verify(token, plane);
      if (ctx) {
        client.data.auth = ctx;
      }
    }
    // No disconnect on missing JWT — operator pushes are token-authorized per
    // message. Viewer actions are gated by client.data.auth existing.
  }

  // ---------------------------------------------------------------------------
  // Viewer subscription
  // ---------------------------------------------------------------------------

  /** Viewer joins a booking's tracking room after an ownership/admin check. */
  @SubscribeMessage('equipment:tracking:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { bookingId?: string },
  ): Promise<void> {
    const ctx: SocketAuthContext | undefined = client.data?.auth;
    const bookingId = (body?.bookingId || '').toString();
    if (!ctx || !bookingId) {
      client.emit('equipment:tracking:error', {
        bookingId,
        message: 'Authentication required',
      });
      return;
    }
    const allowed = await this.gpsService.canViewTracking(bookingId, ctx);
    if (!allowed) {
      client.emit('equipment:tracking:error', {
        bookingId,
        message: 'Access denied',
      });
      return;
    }
    client.join(`track:${bookingId}`);
    client.emit('equipment:tracking:subscribed', { bookingId });
  }

  @SubscribeMessage('equipment:tracking:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { bookingId?: string },
  ): void {
    const bookingId = (body?.bookingId || '').toString();
    if (!bookingId) return;
    client.leave(`track:${bookingId}`);
    client.emit('equipment:tracking:unsubscribed', { bookingId });
  }

  // ---------------------------------------------------------------------------
  // Operator push
  // ---------------------------------------------------------------------------

  /**
   * Operator → server: a live position. Authorized by the per-booking
   * `trackingToken` in the payload (never by the socket JWT). On success the
   * fix is persisted and broadcast to the booking room on BOTH namespaces.
   */
  @SubscribeMessage('equipment:position')
  async handlePosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PositionInput,
  ): Promise<void> {
    if (
      !body ||
      !body.bookingId ||
      !body.trackingToken ||
      typeof body.lat !== 'number' ||
      typeof body.lng !== 'number'
    ) {
      client.emit('equipment:position:error', { code: 'EQP_013' });
      return;
    }

    const result = await this.gpsService.ingestPosition(body);
    if (!result.ok) {
      client.emit('equipment:position:error', { code: result.error });
      return;
    }

    const payload = {
      bookingId: body.bookingId,
      lat: result.position!.lat,
      lng: result.position!.lng,
      heading: result.position!.heading,
      speed: result.position!.speed,
      at: result.position!.at,
    };
    // Broadcast the new position to the room on both planes (farmer + admins).
    this.broadcastToRoom(body.bookingId, 'equipment:position:new', payload);

    // Ack the operator.
    client.emit('equipment:position:ack', {
      bookingId: body.bookingId,
      at: result.position!.at,
    });

    // Fan out any alerts raised on this fix to admins.
    if (result.alerts && result.alerts.length > 0 && result.booking) {
      for (const alert of result.alerts) {
        this.emitToAdmins('equipment:alert', {
          bookingId: body.bookingId,
          equipmentId: result.booking.equipmentId.toString(),
          type: alert.type,
          detail: alert.detail,
          position: { lat: payload.lat, lng: payload.lng },
          at: payload.at,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Emit helpers
  // ---------------------------------------------------------------------------

  private broadcastToRoom(
    bookingId: string,
    event: string,
    payload: any,
  ): void {
    if (!this.server) return;
    const room = `track:${bookingId}`;
    this.io.of('/rt/user').to(room).emit(event, payload);
    this.io.of('/rt/admin').to(room).emit(event, payload);
  }

  private emitToAdmins(event: string, payload: any): void {
    if (!this.server) return;
    this.io.of('/rt/admin').to('admins').emit(event, payload);
  }

  // ---------------------------------------------------------------------------
  // Internals (JWT handshake — mirrors NotificationGateway/ContributionsGateway)
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
      if (payload?.scope !== plane || !payload.sub) {
        return null;
      }
      return { sub: payload.sub, scope: plane };
    } catch {
      return null;
    }
  }
}
