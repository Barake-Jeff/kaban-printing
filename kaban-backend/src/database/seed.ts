import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/sequelize';
import { User, UserRole } from '../modules/users/models/user.model';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

// Dev/demo data only. Never seeds a production database, and never uses a known password:
// set SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD, or a random one is generated and printed once.
const randomPassword = () => randomBytes(12).toString('base64url'); // 16 chars

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production. Create staff accounts through the admin app.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<typeof User>(getModelToken(User));

  const seeds = [
    { name: 'Admin',      phone: '0700000000', password: process.env.SEED_ADMIN_PASSWORD,    role: UserRole.ADMIN,    houseNumber: 'N/A', estate: 'N/A' },
    { name: 'John Kamau', phone: '0712345678', password: process.env.SEED_CUSTOMER_PASSWORD, role: UserRole.CUSTOMER, houseNumber: '138', estate: 'viraj village' },
  ];

  for (const { password, ...s } of seeds) {
    const exists = await userModel.findOne({ where: { phone: s.phone } });
    if (!exists) {
      const plain = password || randomPassword();
      const passwordHash = await bcrypt.hash(plain, 12);
      await userModel.create({ ...s, passwordHash });
      console.log(`Seeded: ${s.phone} (${s.role})${password ? '' : ` password: ${plain}`}`);
    } else {
      console.log(`Skipped (exists): ${s.phone}`);
    }
  }

  await app.close();
}
seed();
