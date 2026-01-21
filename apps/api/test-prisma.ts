import { PrismaClient } from './node_modules/.prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing user_commissions aggregate...');
    const result = await prisma.user_commissions.aggregate({
      _sum: {
        commission_amount: true,
      },
    });
    console.log('Result:', result);
    console.log('Sum:', result._sum.commission_amount);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
