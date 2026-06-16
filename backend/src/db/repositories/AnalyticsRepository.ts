import { supabase } from '../../config/supabase.js';

export class AnalyticsRepository {
  async getDashboardMetrics() {
    // 1. Total Leads (Companies)
    const { count: totalLeads } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    // 2. Hot Leads (Companies with pipeline_stage beyond Discovered or high intent)
    const { count: hotLeads } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .in('pipeline_stage', ['Qualified', 'Contacted', 'Meeting Scheduled', 'Proposal Sent']);

    // 3. Pipeline Value (Mock for now, or based on revenue if available. Let's mock a value based on Hot Leads * 5000)
    const pipelineValue = (hotLeads || 0) * 5000;

    // 4. Conversion Rate (Won / Total)
    const { count: wonLeads } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('pipeline_stage', 'Won');

    const conversionRate = totalLeads ? ((wonLeads || 0) / totalLeads) * 100 : 0;

    // 5. Lead Sources (Using Industry as proxy)
    const { data: industries } = await supabase
      .from('companies')
      .select('industry');
      
    const industryCounts = industries?.reduce((acc: any, curr) => {
      const ind = curr.industry || 'Unknown';
      acc[ind] = (acc[ind] || 0) + 1;
      return acc;
    }, {});
    
    const leadSources = Object.keys(industryCounts || {}).map(key => ({
      name: key,
      value: industryCounts[key]
    }));

    // 6. Opportunity Scores (from company_signals intent_score)
    const { data: signals } = await supabase
      .from('company_signals')
      .select('intent_score, companies(name)');

    let avgOppScore = 0;
    let opportunityScores: {name: string, score: number}[] = [];
    if (signals && signals.length > 0) {
      avgOppScore = signals.reduce((sum, s) => sum + (s.intent_score || 0), 0) / signals.length;
      opportunityScores = signals.map(s => ({
        name: (s.companies as any)?.name || 'Unknown',
        score: s.intent_score || 0
      })).slice(0, 10); // Top 10 for chart
    }

    // 7. Lead Scores (Decision Maker Scores from contact_intelligence)
    const { data: contactIntel } = await supabase
      .from('contact_intelligence')
      .select('decision_maker_score, contacts(first_name, last_name)');
      
    let leadScores: {name: string, score: number}[] = [];
    if (contactIntel && contactIntel.length > 0) {
      leadScores = contactIntel.map(c => ({
        name: `${(c.contacts as any)?.first_name} ${(c.contacts as any)?.last_name}`,
        score: c.decision_maker_score || 0
      })).slice(0, 10);
    }

    return {
      metrics: {
        totalLeads: totalLeads || 0,
        hotLeads: hotLeads || 0,
        opportunityScore: Math.round(avgOppScore),
        pipelineValue: pipelineValue,
        conversionRate: conversionRate.toFixed(1)
      },
      charts: {
        leadSources,
        opportunityScores,
        leadScores
      }
    };
  }
}
