import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  // async validate(payload: { sub: string }) {
  //    console.log("JWT SUB:", payload.sub);
  //   const user = await this.users.findById(payload.sub);
  //    console.log("FOUND USER:", user);
  //   if (!user) throw new UnauthorizedException('Invalid token');
  //   return user; // req.user
  // }


  async validate(payload: any) {
 

  const user = await this.users.findById(payload.sub);

 

  if (!user) throw new UnauthorizedException('Invalid token');

  return user;
}
}
