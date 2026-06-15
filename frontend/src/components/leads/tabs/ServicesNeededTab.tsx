import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Company } from "@/types/company"
import { Wand2, PlusCircle } from "lucide-react"

interface ServicesNeededTabProps {
  company: Company;
}

export function ServicesNeededTab({ company }: ServicesNeededTabProps) {
  const services = company.intelligence?.recommendedServices || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-primary" />
                AI Service Recommendations
              </CardTitle>
              <CardDescription>
                Services automatically identified based on the website audit and digital footprint.
              </CardDescription>
            </div>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Generate Proposal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {services.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {services.map((service, idx) => (
                <Badge key={idx} variant="secondary" className="px-4 py-2 text-sm font-medium">
                  {service}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No specific services recommended at this time.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
