import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { AuthUser, CreateUserRequest, LoginResponse } from '@aura/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';

@Injectable()
export class AuthService {
  private readonly jwt: JwtService;
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
    this.jwt = new JwtService({ secret, signOptions: { algorithm: 'HS256', issuer: 'aura-api', audience: 'aura-client', expiresIn: 900 } });
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const account = await this.prisma.user.findUnique({ where: { username } });
    // Perform the same password derivation for unknown accounts.
    const valid = await verifyPassword(password, account?.passwordHash ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`);
    if (!account || !valid || account.disabled) throw new UnauthorizedException('Invalid username or password.');
    const user = this.publicUser(account);
    const accessToken = await this.jwt.signAsync({ sub: account.id, ver: account.tokenVersion });
    return { accessToken, tokenType: 'Bearer', expiresIn: 900, user };
  }

  async authenticate(token: string): Promise<AuthUser> {
    let claims: { sub: string; ver: number; exp: number };
    try {
      claims = await this.jwt.verifyAsync(token, { algorithms: ['HS256'], issuer: 'aura-api', audience: 'aura-client' });
      if (typeof claims.sub !== 'string' || !Number.isInteger(claims.ver) || !Number.isInteger(claims.exp)) throw new Error('Invalid claims');
    } catch { throw new UnauthorizedException('Invalid or expired access token.'); }
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.disabled || user.tokenVersion !== claims.ver) throw new UnauthorizedException('Session is no longer valid.');
    if (user.crewMemberId) {
      const member = await this.prisma.crewMember.findFirst({ where: { id: user.crewMemberId, missionId: user.missionId } });
      if (!member) throw new UnauthorizedException('Account mission assignment is invalid.');
    } else if (user.role === 'CREW_MEMBER') throw new UnauthorizedException('Crew account has no linked profile.');
    return this.publicUser(user);
  }

  async logout(user: AuthUser): Promise<{ success: true }> {
    await this.prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
    return { success: true };
  }

  async createUser(actor: AuthUser, input: CreateUserRequest): Promise<AuthUser> {
    if (actor.role !== 'COMMANDER') throw new ForbiddenException('Commander role is required.');
    if (input.crewMemberId) await this.requireCrew(input.crewMemberId, actor);
    const passwordHash = await hashPassword(input.password);
    try {
      return this.publicUser(await this.prisma.user.create({ data: { username: input.username, passwordHash,
        role: input.role, missionId: actor.missionId, crewMemberId: input.crewMemberId ?? null } }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Username is already in use.');
      throw error;
    }
  }

  async requireCrew(id: string, actor: AuthUser): Promise<void> {
    if (actor.role === 'CREW_MEMBER' && actor.crewMemberId !== id) throw new ForbiddenException('Access to another crew profile is forbidden.');
    const crew = await this.prisma.crewMember.findFirst({ where: { id, missionId: actor.missionId } });
    if (!crew) throw new ForbiddenException('Crew profile is outside your mission.');
  }

  private publicUser(user: AuthUser): AuthUser {
    return { id: user.id, username: user.username, role: user.role, missionId: user.missionId, crewMemberId: user.crewMemberId };
  }
}
