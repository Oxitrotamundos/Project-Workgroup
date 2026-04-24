import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const firebaseUid = process.env.SEED_ADMIN_UID ?? 'dev-admin-placeholder';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.local';

  await prisma.user.upsert({
    where: { firebaseUid },
    update: { role: 'admin' },
    create: {
      firebaseUid,
      email,
      displayName: 'Dev Admin',
      role: 'admin',
    },
  });

  console.log(`Seeded admin ${email} (firebaseUid=${firebaseUid})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
