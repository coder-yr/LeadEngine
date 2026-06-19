import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Mail, Link as LinkIcon, Loader2 } from "lucide-react"
import { Company } from "@/types/company"

interface ContactsTabProps {
  company: Company;
}

export function ContactsTab({ company }: ContactsTabProps) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`http://localhost:3000/api/contacts/company/${company.id}`);
        setContacts(res.data);
      } catch (error) {
        console.error("Failed to fetch contacts", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (company?.id) {
      fetchContacts();
    }
  }, [company?.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading contacts...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card>
        <CardHeader>
          <CardTitle>Key Contacts</CardTitle>
          <CardDescription>Decision makers and points of contact at {company.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No contacts discovered yet.
              </div>
            ) : (
              contacts.map((contact, i) => {
                const initial = (contact.first_name?.[0] || "") + (contact.last_name?.[0] || "");
                const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
                
                return (
                  <div key={contact.id || i} className="flex items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {initial || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="text-sm font-semibold">{fullName || "Unknown Name"}</h4>
                        <p className="text-xs text-muted-foreground">{contact.title || "No Title"}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`}>
                          <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-secondary">
                            <Mail className="w-3 h-3" /> Email
                          </Badge>
                        </a>
                      )}
                      {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noreferrer">
                          <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-secondary">
                            <LinkIcon className="w-3 h-3" /> Profile
                          </Badge>
                        </a>
                      )}
                      {contact.contact_intelligence?.[0] && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          Score: {contact.contact_intelligence[0].decision_maker_score || 0}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
