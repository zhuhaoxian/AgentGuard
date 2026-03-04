import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkJsonStorage() {
  const logs = await prisma.agentLog.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      requestBody: true,
      responseBody: true,
    }
  });

  console.log('=== Checking JSON Storage ===\n');

  for (const log of logs) {
    console.log(`Log ID: ${log.id}`);
    console.log(`requestBody type: ${typeof log.requestBody}`);
    console.log(`requestBody value:`, log.requestBody);
    console.log(`requestBody JSON:`, JSON.stringify(log.requestBody, null, 2));
    console.log('\n---\n');
  }

  await prisma.$disconnect();
}

checkJsonStorage().catch(console.error);
