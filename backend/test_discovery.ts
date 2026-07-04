import { ContactDiscoveryService } from './src/services/ContactDiscoveryService.js';

async function test() {
  const service = new ContactDiscoveryService();
  const url = "https://sabkadentist.com/about-us/";
  
  console.log(`Starting discovery test for ${url}...`);
  const result = await service.testDiscovery(url, { quickAudit: true });
  
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
