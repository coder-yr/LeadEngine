import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const jobs = await prisma.discoveryJob.findMany({
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
                companies: {
                    select: {
                        id: true,
                        businessName: true,
                        source: true
                    }
                }
            }
        });

        for (const job of jobs) {
            console.log(`Job: ${job.id} | Query: ${job.keyword} ${job.city} | Status: ${job.status} | Total Companies: ${job.companies.length}`);
            
            // Count sources
            const sourceCounts: Record<string, number> = {};
            for (const company of job.companies) {
                sourceCounts[company.source] = (sourceCounts[company.source] || 0) + 1;
            }
            console.log(sourceCounts);
            console.log('---');
        }
    } catch (e) {
        console.error("Prisma error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
