import { WebsiteIntelligenceService } from './src/ai-engine/WebsiteIntelligenceService.js';
import { ContactIntelligenceService } from './src/ai-engine/ContactIntelligenceService.js';

async function test() {
    try {
        console.log('Crawling...');
        const doc = await WebsiteIntelligenceService.crawl('sabkadentist.com', true); // true = bypass cache
        console.log(`Word count: ${doc.qualityMetrics?.wordCount}`);
        console.log(`Raw text length: ${doc.rawText?.length}`);
        
        console.log('Extracting contacts...');
        const contacts = await ContactIntelligenceService.extractContacts(doc);
        console.log('--- RESULTS ---');
        console.log(JSON.stringify(contacts.businessContacts, null, 2));
        console.log(`Metrics:`, contacts.metrics);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
