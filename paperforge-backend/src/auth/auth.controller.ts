import {
  BadRequestException, Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import { AuthGuard, type AuthedRequest } from './auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { username?: unknown; password?: unknown }) {
    const { username, password } = body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      throw new BadRequestException('Username and password are required');
    }
    const user = await this.users.verifyCredentials(username, password);
    if (!user) throw new UnauthorizedException('Invalid username or password');
    return { token: await this.jwt.signAsync({ sub: user.username }), user };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: AuthedRequest) {
    const user = await this.users.findByUsername(req.username);
    if (!user) throw new UnauthorizedException('Unknown user');
    return user;
  }
}
