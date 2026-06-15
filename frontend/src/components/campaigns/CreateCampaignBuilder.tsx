import { useState, useEffect } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Mail, Phone, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function CreateCampaignBuilder({ onCampaignCreated }: { onCampaignCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState("outreach");
  const [companyId, setCompanyId] = useState("");
  const [steps, setSteps] = useState<any[]>([
    { step_number: 1, day_offset: 1, channel: "email", template_subject: "Quick question about {{name}}", template_body: "Hi {{name}},\n\nSaw your work and wanted to connect." }
  ]);

  useEffect(() => {
    if (open) {
      axios.get("http://localhost:3000/api/companies").then((res) => {
        setCompanies(res.data);
        if (res.data.length > 0) setCompanyId(res.data[0].id);
      });
    }
  }, [open]);

  const addStep = () => {
    const nextStep = steps.length + 1;
    const nextDay = steps.length > 0 ? steps[steps.length - 1].day_offset + 2 : 1;
    setSteps([...steps, { 
      step_number: nextStep, 
      day_offset: nextDay, 
      channel: "linkedin", 
      template_subject: "", 
      template_body: "Just following up on my previous message." 
    }]);
  };

  const removeStep = (index: number) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    // Re-index step numbers
    setSteps(newSteps.map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !companyId || steps.length === 0) return;

    setLoading(true);
    try {
      await axios.post("http://localhost:3000/api/campaigns", {
        name,
        campaign_type: type,
        company_id: companyId,
        steps
      });
      setOpen(false);
      setName("");
      setSteps([{ step_number: 1, day_offset: 1, channel: "email", template_subject: "", template_body: "" }]);
      onCampaignCreated();
    } catch (error) {
      console.error("Failed to create campaign", error);
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    if (channel === 'email') return <Mail className="w-4 h-4" />;
    if (channel === 'linkedin') return <Users className="w-4 h-4" />;
    return <MessageSquare className="w-4 h-4" />;
  };

  // Mock icons for rendering below
  const Users = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Build Sequence</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Outreach Sequence</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Q3 Founders Outreach" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Campaign Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outreach">Multi-channel Outreach</SelectItem>
                  <SelectItem value="cold_email">Cold Email</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Sequence Steps</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-1">
                <Plus className="w-3 h-3" /> Add Step
              </Button>
            </div>
            
            <div className="space-y-4 pl-2 border-l-2 border-muted ml-2">
              {steps.map((step, index) => (
                <Card key={index} className="relative">
                  <div className="absolute -left-6 top-6 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold border-4 border-background">
                    {step.step_number}
                  </div>
                  <CardContent className="p-4 pt-5 space-y-4">
                    <div className="flex gap-4 items-start">
                      <div className="w-24 space-y-1.5">
                        <Label className="text-xs">Day Offset</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={step.day_offset} 
                          onChange={(e) => updateStep(index, 'day_offset', parseInt(e.target.value))} 
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="w-32 space-y-1.5">
                        <Label className="text-xs">Channel</Label>
                        <Select value={step.channel} onValueChange={(val) => updateStep(index, 'channel', val)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {step.channel === 'email' && (
                          <>
                            <Label className="text-xs">Subject</Label>
                            <Input 
                              value={step.template_subject || ''} 
                              onChange={(e) => updateStep(index, 'template_subject', e.target.value)} 
                              className="h-8 text-sm"
                              placeholder="Subject line..."
                            />
                          </>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 mt-6" onClick={() => removeStep(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex justify-between">
                        <span>Message Body</span>
                        <span className="text-muted-foreground">Variables: {"{{name}}"}</span>
                      </Label>
                      <Textarea 
                        value={step.template_body} 
                        onChange={(e) => updateStep(index, 'template_body', e.target.value)}
                        className="text-sm min-h-[80px]"
                        placeholder="Write your message..."
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button type="submit" disabled={loading || steps.length === 0}>
              {loading ? "Creating..." : "Launch Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
