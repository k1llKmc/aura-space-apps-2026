import { Body, Controller, Get, HttpCode, HttpException, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../../common/validation';
import { AuthService } from './auth.service';
import { Public, AuthRequest } from './auth.guard';
const credentials = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,64}$/), password: z.string().min(12).max(128) }).strict();
const createUser = credentials.extend({ role: z.enum(['COMMANDER', 'MEDICAL_OFFICER', 'CREW_MEMBER']), crewMemberId: z.string().uuid().optional() })
  .refine((value) => value.role !== 'CREW_MEMBER' || !!value.crewMemberId, 'Crew Member requires crewMemberId.');
@Controller('auth')
export class AuthController {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: AuthRequest) {
    // Bounded, single-node limit: 20 attempts per IP in 15 minutes, including successes.
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    const ip = request.ip || 'unknown';
    const entry = this.attempts.get(ip) ?? { count: 0, until: now + 900000 };
    if (entry.count >= 20 || (!this.attempts.has(ip) && this.attempts.size >= 10000)) throw new HttpException('Too many login attempts. Try again later.', 429);
    entry.count += 1;
    this.attempts.set(ip, entry);
    const input = parse(credentials, body);
    return this.auth.login(input.username, input.password);
  }
  @Get('me')
  me(@Req() request: AuthRequest) { return request.user; }
  @Post('logout')
  @HttpCode(200)
  logout(@Req() request: AuthRequest) { return this.auth.logout(request.user); }
  @Post('users')
  create(@Body() body: unknown, @Req() request: AuthRequest) { return this.auth.createUser(request.user, parse(createUser, body)); }
}
