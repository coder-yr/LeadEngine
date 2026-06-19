import { useState, useEffect } from "react";
import axios from "axios";
import { CreateCampaignBuilder } from "@/components/campaigns/CreateCampaignBuilder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Users, Mail, MousePointerClick, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:3000/api/campaigns");
      setCampaigns(res.data);
    } catch (error) {
      console.error("Failed to fetch campaigns", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const renderKPI = (title: string, value: number, icon: any, colorClass: string) => (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        </div>
        <div className={`p-3 rounded-full ${colorClass} bg-opacity-10`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outreach Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Build multi-channel sequences and track engagement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchCampaigns} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <CreateCampaignBuilder onCampaignCreated={fetchCampaigns} />
        </div>
      </div>

      {campaigns.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/50 rounded-xl">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Target className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">No Active Campaigns</h2>
          <p className="text-muted-foreground text-center max-w-sm">
            You haven't launched any outreach sequences yet. Build your first multi-channel sequence to start engaging with leads automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {campaigns.map(campaign => {
            const targets = campaign.target_count || 0;
            const sent = campaign.sent_count || 0;
            const opened = campaign.opened_count || 0;
            const clicked = campaign.clicked_count || 0;
            const replied = campaign.replied_count || 0;

            return (
              <Card key={campaign.id} className="overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {campaign.name}
                        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                          {campaign.status}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {campaign.campaign_steps?.length || 0} Step Sequence • Created {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={async () => {
                      try {
                        const res = await axios.get(`http://localhost:3000/api/contacts/company/${campaign.company_id}`);
                        const contacts = res.data;
                        if (!contacts || contacts.length === 0) {
                          alert("No contacts found for this company to enroll.");
                          return;
                        }
                        
                        const enrollments = contacts.map((c: any) => ({
                          contact_id: c.id,
                          company_id: campaign.company_id
                        }));

                        await axios.post(`http://localhost:3000/api/campaigns/${campaign.id}/enroll`, {
                          contacts: enrollments
                        });
                        
                        fetchCampaigns();
                      } catch (error) {
                        console.error("Failed to enroll contacts", error);
                        alert("Failed to enroll contacts.");
                      }
                    }}>
                      <Target className="w-4 h-4 mr-2" />
                      Enroll Company Contacts
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {renderKPI("Enrolled", targets, <Users className="w-5 h-5 text-blue-500" />, "bg-blue-500 text-blue-500")}
                    {renderKPI("Sent", sent, <Send className="w-5 h-5 text-indigo-500" />, "bg-indigo-500 text-indigo-500")}
                    {renderKPI("Opened", opened, <Mail className="w-5 h-5 text-amber-500" />, "bg-amber-500 text-amber-500")}
                    {renderKPI("Clicked", clicked, <MousePointerClick className="w-5 h-5 text-emerald-500" />, "bg-emerald-500 text-emerald-500")}
                    {renderKPI("Replied", replied, <CheckCircle2 className="w-5 h-5 text-green-500" />, "bg-green-500 text-green-500")}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
