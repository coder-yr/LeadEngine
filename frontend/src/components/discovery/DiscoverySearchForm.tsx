import { useState, useEffect } from "react";
import { Search, MapPin, ChevronDown, ChevronUp, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";

const STANDARD_SOURCES = [
  { id: "google_maps", label: "Google Maps" },
  { id: "duckduckgo", label: "DuckDuckGo" },
  { id: "website_search", label: "Website Search" },
  { id: "grotal", label: "Grotal" },
  { id: "asklaila", label: "AskLaila" },
];

const EXPERIMENTAL_SOURCES = [
  { id: "yellowpages", label: "YellowPages" },
  { id: "hotfrog", label: "Hotfrog" },
];

const ALL_SOURCES = [...STANDARD_SOURCES, ...EXPERIMENTAL_SOURCES];

interface DiscoverySearchFormProps {
  onJobStarted: () => void;
}

export function DiscoverySearchForm({ onJobStarted }: DiscoverySearchFormProps) {
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [maxResults, setMaxResults] = useState([50]);
  const [sources, setSources] = useState<string[]>(ALL_SOURCES.map((s) => s.id));
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

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
      await api.post(`/discovery/search`, {
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

  const setExample = (kw: string, loc: string) => {
    setKeyword(kw);
    setCity(loc);
  };

  return (
    <Card className="relative overflow-hidden shadow-xl border-slate-200/60 bg-white/80 backdrop-blur-xl transition-all duration-500">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      <CardContent className="p-8">
        <form onSubmit={handleSearch} className="space-y-6">
          
          <div className="flex flex-col mb-4">
            <h3 className="text-xl font-bold text-slate-900 mb-1">What businesses are you looking for?</h3>
            <p className="text-slate-500 text-sm">Our hybrid engine checks existing intelligence before running live external discovery.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold text-sm">Keyword or Industry</Label>
              <div className="relative group">
                <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <Input 
                  placeholder="e.g. Dentists" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-12 h-14 text-lg bg-slate-50/50 border-slate-200 focus-visible:ring-indigo-500/50 text-slate-900 rounded-xl shadow-sm"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold text-sm">City / Location</Label>
              <div className="relative group">
                <MapPin className="absolute left-4 top-4 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <Input 
                  placeholder="e.g. Mumbai" 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pl-12 h-14 text-lg bg-slate-50/50 border-slate-200 focus-visible:ring-indigo-500/50 text-slate-900 rounded-xl shadow-sm"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {!isLoading && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Examples:</span>
              <button type="button" onClick={() => setExample("Dentists", "Mumbai")} className="text-indigo-600 hover:underline">Dentists in Mumbai</button>
              <span className="text-slate-300">•</span>
              <button type="button" onClick={() => setExample("Software companies", "Pune")} className="text-indigo-600 hover:underline">Software in Pune</button>
              <span className="text-slate-300">•</span>
              <button type="button" onClick={() => setExample("Gyms", "Thane")} className="text-indigo-600 hover:underline">Gyms in Thane</button>
            </div>
          )}

          {/* Advanced Options Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              disabled={isLoading}
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Advanced options
            </button>
          </div>

          {/* Advanced Options Content */}
          {showAdvanced && (
            <div className="space-y-6 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="space-y-3">
                <Label className="text-slate-700">Data Sources</Label>
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-500 text-xs uppercase tracking-wider mb-2 block">Standard Sources</Label>
                    <div className="flex flex-wrap gap-2">
                      {STANDARD_SOURCES.map((source) => (
                        <div key={source.id} className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => handleSourceToggle(source.id)}>
                          <Checkbox 
                            id={`source-${source.id}`}
                            checked={sources.includes(source.id)}
                            onCheckedChange={() => handleSourceToggle(source.id)}
                            className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 w-4 h-4"
                            disabled={isLoading}
                          />
                          <Label 
                            htmlFor={`source-${source.id}`}
                            className="cursor-pointer text-xs font-medium text-slate-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {source.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-slate-500 text-xs uppercase tracking-wider mb-2 block">Experimental Sources</Label>
                    <div className="flex flex-wrap gap-2">
                      {EXPERIMENTAL_SOURCES.map((source) => (
                        <div key={source.id} className="flex items-center space-x-2 bg-amber-50/50 px-3 py-1.5 rounded-full border border-amber-100 hover:border-amber-300 transition-colors cursor-pointer" onClick={() => handleSourceToggle(source.id)}>
                          <Checkbox 
                            id={`source-${source.id}`}
                            checked={sources.includes(source.id)}
                            onCheckedChange={() => handleSourceToggle(source.id)}
                            className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 w-4 h-4"
                            disabled={isLoading}
                          />
                          <Label 
                            htmlFor={`source-${source.id}`}
                            className="cursor-pointer text-xs font-medium text-slate-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {source.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-w-sm">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-700">Max Results</Label>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold">
                    {maxResults[0]}
                  </span>
                </div>
                <Slider 
                  value={maxResults}
                  onValueChange={setMaxResults}
                  max={200}
                  min={10}
                  step={10}
                  disabled={isLoading}
                  className="cursor-pointer"
                />
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all duration-300 rounded-xl"
            disabled={isLoading || !keyword.trim() || !city.trim()}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Finding companies...
              </span>
            ) : (
              "Find Companies"
            )}
          </Button>

          {/* Animated Loading Progress */}
          {isLoading && (
            <div className="pt-4 px-2 space-y-3 animate-in fade-in duration-500">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                {loadingStep >= 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <CircleDashed className="w-5 h-5 text-slate-300 animate-spin" />}
                <span className={loadingStep >= 0 ? "font-medium text-slate-900" : ""}>Checking existing LeadEngine intelligence</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                {loadingStep >= 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : (loadingStep === 0 ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /> : <CircleDashed className="w-5 h-5 text-slate-300" />)}
                <span className={loadingStep >= 1 ? "font-medium text-slate-900" : (loadingStep === 0 ? "text-indigo-600 font-medium" : "")}>Searching for additional companies</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                {loadingStep >= 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : (loadingStep === 1 ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /> : <CircleDashed className="w-5 h-5 text-slate-300" />)}
                <span className={loadingStep >= 2 ? "font-medium text-slate-900" : (loadingStep === 1 ? "text-indigo-600 font-medium" : "")}>Resolving identities & removing duplicates</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                {loadingStep >= 3 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : (loadingStep === 2 ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /> : <CircleDashed className="w-5 h-5 text-slate-300" />)}
                <span className={loadingStep >= 3 ? "font-medium text-slate-900" : (loadingStep === 2 ? "text-indigo-600 font-medium" : "")}>Preparing results</span>
              </div>
            </div>
          )}

        </form>
      </CardContent>
    </Card>
  );
}

