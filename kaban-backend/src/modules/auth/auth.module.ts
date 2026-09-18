import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CustomerAuthController } from './auth.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/models/user.model';
import { RefreshToken } from './models/refresh-token.model';
import { PasswordResetRequest } from './models/password-reset-request.model';

@Module({
  imports: [
    SequelizeModule.forFeature([User, RefreshToken, PasswordResetRequest]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [CustomerAuthController, AdminAuthController],
  providers:   [AuthService, JwtStrategy],
  exports:     [AuthService],
})
export class AuthModule {}
