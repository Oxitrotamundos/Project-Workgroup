import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const firebaseUid = process.env.SEED_ADMIN_UID ?? 'dev-admin-placeholder';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.local';

  const admin = await prisma.user.upsert({
    where: { firebaseUid },
    update: { role: 'admin' },
    create: {
      firebaseUid,
      email,
      displayName: 'Dev Admin',
      role: 'admin',
    },
  });

  // Mantiene la invariante "cada user real tiene un resource enlazado".
  await prisma.resource.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      name: admin.displayName,
      email: admin.email,
      kind: 'user',
      userId: admin.id,
    },
  });

  console.log('Seeded admin user and resource');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
