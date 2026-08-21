import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';

async function check() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL as string,
  });
  const prisma = new PrismaClient({ adapter });
  const counts = {
    Branch: await prisma.branch.count(),
    Roles: await prisma.role.count(),
    Permissions: await prisma.permission.count(),
    RolePermissions: await prisma.rolePermission.count(),
    Users: await prisma.user.count(),
  };
  console.log('Counts:', counts);
  await prisma.$disconnect();
}
check();
