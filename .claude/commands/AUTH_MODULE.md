# Auth Module — Implementation Guide

> All decisions in this file are locked. Do not re-debate them.
> Build exactly what is described here.
> ORM: Sequelize via `@nestjs/sequelize` + `sequelize-typescript`

---

## Decisions locked in

| Decision                   | Choice                                               |
|----------------------------|------------------------------------------------------|
| Login routes               | Two separate routes — customer + admin               |
| OTP verification at signup | No — phone + password only (add OTP later)           |
| Access token lifetime      | 1 hour                                               |
| Refresh token lifetime     | 30 days                                              |
| Token storage (frontend)   | localStorage                                         |
| Admin/clerk creation       | Admin-created only — no self-registration for staff  |
| Password hashing           | bcrypt, salt rounds 12                               |
| JWT payload                | `{ sub: userId, role: UserRole, phone: string }`     |

---

## Module folder structure

```
src/modules/auth/
  dto/
    customer-register.dto.ts
    customer-login.dto.ts
    admin-login.dto.ts
    refresh-token.dto.ts
    create-staff.dto.ts
  models/
    refresh-token.model.ts
  strategies/
    jwt.strategy.ts
  auth.controller.ts          ← customer routes
  admin-auth.controller.ts    ← admin routes
  auth.service.ts
  auth.module.ts

src/modules/users/
  models/
    user.model.ts
```

---

## Endpoints to build

### Customer-facing

```
POST /api/auth/register    → self-registration, role always 'customer'
POST /api/auth/login       → phone + password → tokens
POST /api/auth/refresh     → { refreshToken } → new accessToken
POST /api/auth/logout      → revoke refresh token (requires JWT auth)
```

### Admin-facing

```
POST /api/admin/auth/login        → phone + password, role must be 'clerk' or 'admin'
POST /api/admin/auth/create-staff → create clerk or admin account (admin role only)
```

Both controllers are in the same `auth.module.ts` but on different route prefixes:

```typescript
@Controller('auth')         // CustomerAuthController
@Controller('admin/auth')   // AdminAuthController
```

Both inject the same `AuthService`.

---

## Response shapes

### POST /api/auth/register → POST /api/auth/login

```typescript
{
  accessToken:  string,   // JWT, expires 1 hour
  refreshToken: string,   // JWT, expires 30 days
  user: {
    id:          string,
    name:        string,
    phone:       string,
    houseNumber: string,
    estate:      string,
    role:        'customer',
  }
}
```

### POST /api/admin/auth/login

```typescript
{
  accessToken:  string,
  refreshToken: string,
  user: {
    id:    string,
    name:  string,
    phone: string,
    role:  'clerk' | 'admin',
  }
}
```

### POST /api/auth/refresh

```typescript
{ accessToken: string }
```

### POST /api/auth/logout

```typescript
{ success: true }
```

### POST /api/admin/auth/create-staff

```typescript
{ id: string, name: string, phone: string, role: 'clerk' | 'admin' }
```

---

## DTOs

### customer-register.dto.ts

```typescript
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class CustomerRegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @IsString()
  @Matches(/^(\+254|0)[17]\d{8}$/, { message: 'Phone must be a valid Kenyan number (e.g. 0712345678)' })
  phone: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  houseNumber: string;

  @IsString() @IsNotEmpty() @MaxLength(255)
  estate: string;

  @IsString() @MinLength(8) @MaxLength(100)
  password: string;
}
```

### customer-login.dto.ts

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class CustomerLoginDto {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() password: string;
}
```

### admin-login.dto.ts

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class AdminLoginDto {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() password: string;
}
```

### refresh-token.dto.ts

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsString() @IsNotEmpty() refreshToken: string;
}
```

### create-staff.dto.ts

```typescript
import { IsString, IsNotEmpty, IsEnum, MinLength, Matches } from 'class-validator';
import { UserRole } from '../../users/models/user.model';

export class CreateStaffDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString()
  @Matches(/^(\+254|0)[17]\d{8}$/, { message: 'Phone must be a valid Kenyan number' })
  phone: string;

  @IsString() @MinLength(8)
  password: string;

  @IsEnum([UserRole.CLERK, UserRole.ADMIN])
  role: UserRole.CLERK | UserRole.ADMIN;
}
```

---

## User model

```typescript
// src/modules/users/models/user.model.ts
import {
  Table, Column, Model, DataType, Default, Unique,
} from 'sequelize-typescript';

export enum UserRole {
  CUSTOMER = 'customer',
  CLERK    = 'clerk',
  ADMIN    = 'admin',
}

@Table({ tableName: 'users', timestamps: true, underscored: true })
export class User extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  name: string;

  @Unique
  @Column({ type: DataType.STRING(20), allowNull: false })
  phone: string;

  @Column({ type: DataType.STRING(20), allowNull: false, field: 'house_number' })
  houseNumber: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  estate: string;

  @Column({ type: DataType.STRING(255), allowNull: false, field: 'password_hash' })
  passwordHash: string;

  @Default(UserRole.CUSTOMER)
  @Column({ type: DataType.ENUM(...Object.values(UserRole)) })
  role: UserRole;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: 'notif_sms' })
  notifSms: boolean;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: 'notif_whatsapp' })
  notifWhatsapp: boolean;

  @Default(0.00)
  @Column({ type: DataType.DECIMAL(10, 2), field: 'credit_balance' })
  creditBalance: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, field: 'loyalty_points' })
  loyaltyPoints: number;
}
```

---

## RefreshToken model

```typescript
// src/modules/auth/models/refresh-token.model.ts
import {
  Table, Column, Model, DataType, ForeignKey, BelongsTo, Default, Unique,
} from 'sequelize-typescript';
import { User } from '../../users/models/user.model';

@Table({ tableName: 'refresh_tokens', timestamps: false })
export class RefreshToken extends Model {
  @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
  id: string;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Unique
  @Column({ type: DataType.STRING(255), allowNull: false, field: 'token_hash' })
  tokenHash: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'expires_at' })
  expiresAt: Date;

  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  revoked: boolean;

  @Column({ type: DataType.DATE, defaultValue: DataType.NOW, field: 'created_at' })
  createdAt: Date;
}
```

---

## AuthService

```typescript
// auth.service.ts
import {
  Injectable, UnauthorizedException, ConflictException,
  ForbiddenException,
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

  private normalizePhone(phone: string): string {
    return phone.replace(/^\+254/, '0').replace(/\s/g, '');
  }
}
```

---

## JWT Strategy

```typescript
// strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../users/models/user.model';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      config.get('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: string; role: string; phone: string }) {
    const user = await this.userModel.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return user;   // attached to request.user
  }
}
```

---

## Controllers

```typescript
// auth.controller.ts — customer routes
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CustomerRegisterDto } from './dto/customer-register.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class CustomerAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: CustomerRegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: CustomerLoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
```

```typescript
// admin-auth.controller.ts — admin routes
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/models/user.model';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('create-staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() user) {
    return this.authService.createStaff(dto, user);
  }
}
```

---

## AuthModule

```typescript
// auth.module.ts
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

@Module({
  imports: [
    SequelizeModule.forFeature([User, RefreshToken]),
    PassportModule,
    JwtModule.register({}),   // secrets injected per-call via ConfigService
  ],
  controllers: [CustomerAuthController, AdminAuthController],
  providers:   [AuthService, JwtStrategy],
  exports:     [AuthService],
})
export class AuthModule {}
```

---

## Seed script

```typescript
// src/database/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/sequelize';
import { User, UserRole } from '../modules/users/models/user.model';
import * as bcrypt from 'bcrypt';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<typeof User>(getModelToken(User));

  const seeds = [
    { name: 'Admin',      phone: '0700000000', password: 'admin',    role: UserRole.ADMIN,    houseNumber: 'N/A', estate: 'N/A' },
    { name: 'John Kamau', phone: '0712345678', password: 'password', role: UserRole.CUSTOMER, houseNumber: '14B', estate: 'Westlands Gardens' },
  ];

  for (const s of seeds) {
    const exists = await userModel.findOne({ where: { phone: s.phone } });
    if (!exists) {
      const passwordHash = await bcrypt.hash(s.password, 12);
      await userModel.create({ ...s, passwordHash });
      console.log(`✓ Seeded: ${s.phone}`);
    } else {
      console.log(`– Skipped (exists): ${s.phone}`);
    }
  }

  await app.close();
}
seed();
```

Add to `package.json`:
```json
"scripts": {
  "seed": "ts-node src/database/seed.ts"
}
```

---

## npm packages required

```bash
# Sequelize (ORM)
npm install @nestjs/sequelize sequelize sequelize-typescript mysql2
npm install @types/sequelize --save-dev

# Auth
npm install @nestjs/passport @nestjs/jwt passport passport-jwt
npm install bcrypt
npm install @types/bcrypt @types/passport-jwt --save-dev
```

---

## Key Sequelize vs TypeORM differences to remember

| TypeORM                                    | Sequelize equivalent                                  |
|--------------------------------------------|-------------------------------------------------------|
| `@InjectRepository(User)`                  | `@InjectModel(User)`                                  |
| `private repo: Repository<User>`           | `private model: typeof User`                          |
| `repo.findOne({ where: ... })`             | `model.findOne({ where: ... })`                       |
| `repo.create(data)` + `repo.save(entity)`  | `model.create(data)` — saves immediately              |
| `repo.update({ id }, data)`                | `model.update(data, { where: { id } })` — args swapped|
| `entity.field`                             | `instance.field` or `instance.toJSON().field`         |
| `getRepositoryToken(User)`                 | `getModelToken(User)`                                 |
| `TypeOrmModule.forFeature([User])`         | `SequelizeModule.forFeature([User])`                  |

---

## Definition of done

- [ ] `npm run start:dev` starts with no TypeScript errors
- [ ] `POST /api/auth/register` creates a customer and returns tokens
- [ ] `POST /api/auth/login` returns tokens for valid customer credentials
- [ ] `POST /api/auth/login` returns 401 for wrong credentials
- [ ] `POST /api/admin/auth/login` works for admin/clerk, returns 403 for customers
- [ ] `POST /api/auth/refresh` returns a new access token
- [ ] `POST /api/auth/logout` revokes the refresh token in the DB
- [ ] A route with `@UseGuards(JwtAuthGuard)` returns 401 without a token
- [ ] `POST /api/admin/auth/create-staff` works for admin role, returns 403 for others
- [ ] `npm run seed` creates the two development users
- [ ] No `passwordHash` field appears in any API response
