import { LocalAiGateway } from './LocalAiGateway.js';

export class NerService {
    static async extractEntities(text: string) {
        const result = await LocalAiGateway.query('ner', {
            inputs: text
        });
        
        // Post-processing could go here to merge BERT subtokens or filter by confidence
        return result;
    }
}

