import { supabase } from '../../config/supabase.js';

export interface CampaignInput {
  name: string;
  campaign_type: 'cold_email' | 'outreach' | 'follow_up' | 'proposal' | 'custom';
  company_id: string; // The user's own company ID typically, but we use the first one available or hardcode for now
}

export interface CampaignStepInput {
  campaign_id: string;
  step_number: number;
  day_offset: number;
  channel: 'email' | 'whatsapp' | 'linkedin';
  template_subject?: string;
  template_body: string;
}

export interface EnrollmentInput {
  campaign_id: string;
  contact_id: string;
  company_id: string;
}

export class CampaignRepository {
  async getCampaigns() {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_steps (*),
        campaign_enrollments (count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }

    return data;
  }

  async createCampaign(campaign: CampaignInput) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaign])
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }

    return data;
  }

  async addCampaignSteps(steps: CampaignStepInput[]) {
    const { data, error } = await supabase
      .from('campaign_steps')
      .insert(steps)
      .select();

    if (error) {
      console.error('Error adding campaign steps:', error);
      throw error;
    }

    return data;
  }

  async enrollContacts(enrollments: EnrollmentInput[]) {
    const { data, error } = await supabase
      .from('campaign_enrollments')
      .upsert(enrollments, { onConflict: 'campaign_id,contact_id' })
      .select();

    if (error) {
      console.error('Error enrolling contacts:', error);
      throw error;
    }

    // Update target count in campaign
    if (enrollments.length > 0) {
      const campaignId = enrollments[0].campaign_id;
      await this.incrementCampaignStat(campaignId, 'target_count', enrollments.length);
    }

    return data;
  }

  async getDueEnrollments() {
    // In a real scenario, this would compare last_processed_at + day_offset <= NOW()
    // For simplicity in this demo, we just fetch active enrollments
    const { data, error } = await supabase
      .from('campaign_enrollments')
      .select(`
        *,
        campaigns (*),
        contacts (*),
        companies (*)
      `)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching due enrollments:', error);
      throw error;
    }

    return data;
  }

  async getCampaignStep(campaignId: string, stepNumber: number) {
    const { data, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('step_number', stepNumber)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error(`Error fetching campaign step ${stepNumber}:`, error);
      throw error;
    }

    return data;
  }

  async recordMessageAndActivity(
    campaignId: string, 
    contactId: string, 
    companyId: string,
    channel: string,
    subject: string | null,
    body: string
  ) {
    // 1. Create Message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert([{
        campaign_id: campaignId,
        contact_id: contactId,
        company_id: companyId,
        message_type: channel,
        status: 'sent',
        subject: subject,
        body: body,
        to_address: 'simulated@example.com',
        sent_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (messageError) throw messageError;

    // 2. Create Activity
    const { error: activityError } = await supabase
      .from('activities')
      .insert([{
        company_id: companyId,
        contact_id: contactId,
        campaign_id: campaignId,
        message_id: message?.id,
        activity_type: channel === 'email' ? 'email_sent' : 'note_added',
        description: `Sent Day X sequence via ${channel}`,
      }]);

    if (activityError) throw activityError;

    return message;
  }

  async updateEnrollment(id: string, updates: any) {
    const { data, error } = await supabase
      .from('campaign_enrollments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async incrementCampaignStat(campaignId: string, statColumn: string, amount: number = 1) {
    // We would ideally use an RPC for atomic increments, but we'll do a read-modify-write for the prototype
    const { data: campaign } = await supabase
      .from('campaigns')
      .select(statColumn)
      .eq('id', campaignId)
      .single();
      
    if (campaign) {
      const currentVal = campaign[statColumn as keyof typeof campaign] as number || 0;
      await supabase
        .from('campaigns')
        .update({ [statColumn]: currentVal + amount })
        .eq('id', campaignId);
    }
  }

  async trackMessageOpen(messageId: string) {
    // 1. Mark message as read
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .update({ is_read: true, opened_at: new Date().toISOString() })
      .eq('id', messageId)
      .select()
      .single();

    if (msgError) {
      console.error('Error tracking message open:', msgError);
      throw msgError;
    }

    if (!message) return null;

    // 2. Increment aggregate opened_count
    await this.incrementCampaignStat(message.campaign_id, 'opened_count', 1);

    // 3. Log activity
    await supabase.from('activities').insert([{
      company_id: message.company_id,
      contact_id: message.contact_id,
      campaign_id: message.campaign_id,
      message_id: message.id,
      activity_type: 'email_opened',
      description: 'Prospect opened the email.'
    }]);

    return message;
  }

  async trackMessageReply(messageId: string, replyBody?: string) {
    // 1. Mark message as replied
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .update({ is_replied: true, replied_at: new Date().toISOString() })
      .eq('id', messageId)
      .select()
      .single();

    if (msgError) {
      console.error('Error tracking message reply:', msgError);
      throw msgError;
    }

    if (!message) return null;

    // 2. Increment aggregate replied_count
    await this.incrementCampaignStat(message.campaign_id, 'replied_count', 1);

    // 3. Log activity
    await supabase.from('activities').insert([{
      company_id: message.company_id,
      contact_id: message.contact_id,
      campaign_id: message.campaign_id,
      message_id: message.id,
      activity_type: 'note_added',
      description: 'Prospect replied to the message.'
    }]);

    // 4. Update the enrollment status to 'replied' (which pauses the sequence)
    await supabase
      .from('campaign_enrollments')
      .update({ status: 'replied' })
      .eq('campaign_id', message.campaign_id)
      .eq('contact_id', message.contact_id);

    return message;
  }
}
