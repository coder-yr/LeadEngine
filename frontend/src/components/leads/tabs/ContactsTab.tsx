import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Mail, Link as LinkIcon } from "lucide-react"
import { Company } from "@/types/company"

interface ContactsTabProps {
  company: Company;
}

export function ContactsTab({ company }: ContactsTabProps) {
  // Mock contacts
  const contacts = [
    { name: "Sarah Jenkins", role: "Chief Marketing Officer", email: "sarah@example.com", initial: "SJ" },
    { name: "Michael Chen", role: "VP of Digital", email: "michael@example.com", initial: "MC" },
    { name: "Emily Watson", role: "Operations Lead", email: "emily@example.com", initial: "EW" }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card>
        <CardHeader>
          <CardTitle>Key Contacts</CardTitle>
          <CardDescription>Decision makers and points of contact at {company.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contacts.map((contact, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{contact.initial}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-sm font-semibold">{contact.name}</h4>
                    <p className="text-xs text-muted-foreground">{contact.role}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-secondary"><Mail className="w-3 h-3" /> Email</Badge>
                  <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-secondary"><LinkIcon className="w-3 h-3" /> Profile</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
