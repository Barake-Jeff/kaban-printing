import {
  Injectable, UnauthorizedException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../users/models/user.model';
import { RefreshToken } from './models/refresh-token.model';
import { CustomerRegisterDto } from './dto/customer-register.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { normalizeKenyanPhone } from '../../common/utils/phone.util';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(RefreshToken)
    private readonly refreshTokenModel: typeof RefreshToken,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: CustomerRegisterDto) {
    const phone = this.normalizePhone(dto.phone);
    const existing = await this.userModel.findOne({ where: { phone } });
    if (existing) throw new ConflictException('Phone number already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      name: dto.name, phone, houseNumber: dto.houseNumber,
      estate: dto.estate, passwordHash, role: UserRole.CUSTOMER,
    });
    return this.issueTokens(user);
  }

  async login(dto: CustomerLoginDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.userModel.findOne({ where: { phone } });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid phone number or password');
    }
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Please use the admin login');
    }
    return this.issueTokens(user);
  }

  async adminLogin(dto: AdminLoginDto) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.userModel.findOne({ where: { phone } });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('Access denied');
    }
    return this.issueTokens(user);
  }

  async createStaff(dto: CreateStaffDto, requestingUser: User) {
    if (requestingUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create staff accounts');
    }
    const phone = this.normalizePhone(dto.phone);
    const existing = await this.userModel.findOne({ where: { phone } });
    if (existing) throw new ConflictException('Phone number already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      name: dto.name, phone, houseNumber: 'N/A',
      estate: 'N/A', passwordHash, role: dto.role,
    });

    const { passwordHash: _, ...safeUser } = user.toJSON();
    return safeUser;
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenModel.findOne({
      where: { tokenHash, revoked: false },
    });
    if (!stored) throw new UnauthorizedException('Refresh token revoked or not found');

    const user = await this.userModel.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');

    return { accessToken: this.issueAccessToken(user) };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokenModel.update({ revoked: true }, { where: { tokenHash } });
    return { success: true };
  }

  private async issueTokens(user: User) {
    const accessToken  = this.issueAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user);
    const { passwordHash, ...safeUser } = user.toJSON();
    return { accessToken, refreshToken, user: safeUser };
  }

  private issueAccessToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, role: user.role, phone: user.phone },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: '1h' },
    );
  }

  private async issueRefreshToken(user: User): Promise<string> {
    const token = this.jwtService.sign(
      { sub: user.id },
      { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '30d' },
    );
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenModel.create({ userId: user.id, tokenHash, expiresAt });
    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Login DTOs deliberately carry no format rule, so this is the only thing
  // making "+254712345678" / "254 712 345 678" match a stored "0712345678".
  private normalizePhone(phone: string): string {
    return normalizeKenyanPhone(phone) as string;
  }
}
