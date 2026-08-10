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
    { name: 'John Kamau', phone: '0712345678', password: 'password', role: UserRole.CUSTOMER, houseNumber: '138', estate: 'viraj village' },
  ];

  for (const s of seeds) {
    const exists = await userModel.findOne({ where: { phone: s.phone } });
    if (!exists) {
      const passwordHash = await bcrypt.hash(s.password, 12);
      await userModel.create({ ...s, passwordHash });
      console.log(`Seeded: ${s.phone}`);
    } else {
      console.log(`Skipped (exists): ${s.phone}`);
    }
  }

  await app.close();
}
seed();
