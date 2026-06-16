import { useState } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";

const SOURCES = [
  { id: "google_maps", label: "Google Maps" },
  { id: "justdial", label: "JustDial" },
  { id: "indiamart", label: "IndiaMart" },
  { id: "tradeindia", label: "TradeIndia" },
  { id: "sulekha", label: "Sulekha" },
];

interface DiscoverySearchFormProps {
  onJobStarted: () => void;
}

export function DiscoverySearchForm({ onJobStarted }: DiscoverySearchFormProps) {
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [maxResults, setMaxResults] = useState([50]);
  const [sources, setSources] = useState<string[]>(SOURCES.map((s) => s.id));
  const [isLoading, setIsLoading] = useState(false);

  const handleSourceToggle = (sourceId: string) => {
    setSources((current) =>
      current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId]
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !city.trim()) {
      alert("Please provide both keyword and city.");
      return;
    }

    if (sources.length === 0) {
      alert("Please select at least one source.");
      return;
    }

    setIsLoading(true);
    try {
      await axios.post("http://localhost:3000/api/discovery/search", {
        keyword: keyword.trim(),
        city: city.trim(),
        sources,
        max_results: maxResults[0],
      });
      
      setKeyword("");
      onJobStarted();
    } catch (error: any) {
      alert(error.response?.data?.error || "Could not start discovery.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative overflow-hidden shadow-xl border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl flex items-center gap-2 font-bold text-slate-900">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Search className="w-5 h-5 text-indigo-600" />
          </div>
          New Discovery Run
        </CardTitle>
        <CardDescription className="text-slate-500 text-sm mt-2">
          Launch intelligent multi-source web scrapers to discover fresh, targeted leads for your pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-slate-700">Keyword or Industry</Label>
              <div className="relative group">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <Input 
                  placeholder="e.g. Dentists, SaaS" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-indigo-500/50 text-slate-900"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">City / Location</Label>
              <div className="relative group">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <Input 
                  placeholder="e.g. Mumbai, New York" 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-indigo-500/50 text-slate-900"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-700">Data Sources</Label>
            <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 shadow-inner">
              {SOURCES.map((source) => (
                <div key={source.id} className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer" onClick={() => handleSourceToggle(source.id)}>
                  <Checkbox 
                    id={`source-${source.id}`}
                    checked={sources.includes(source.id)}
                    onCheckedChange={() => handleSourceToggle(source.id)}
                    className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                  <Label 
                    htmlFor={`source-${source.id}`}
                    className="cursor-pointer text-sm font-medium text-slate-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {source.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex justify-between items-center">
              <Label className="text-slate-700">Max Results per Source</Label>
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-mono font-bold">
                {maxResults[0]}
              </span>
            </div>
            <Slider 
              value={maxResults}
              onValueChange={setMaxResults}
              max={200}
              min={10}
              step={10}
              className="py-2 cursor-pointer"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-md font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all duration-300"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                Initializing Engines...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Start Discovery
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
