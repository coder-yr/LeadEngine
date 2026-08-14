import { Link } from "react-router-dom";
import { ArrowRight, Search, Zap, Target, RefreshCw, BarChart3, Users, Building2, BrainCircuit, LineChart, Globe, Mail, ChevronRight, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "../contexts/AuthContext";

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/40 blur-[120px] mix-blend-multiply" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/40 blur-[120px] mix-blend-multiply" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] rounded-full bg-blue-200/30 blur-[120px] mix-blend-multiply" />
      </div>

      {/* HEADER */}
      <header className="relative z-50 py-6 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-bold text-white text-xl">L</span>
          </div>
          <span className="font-bold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">LeadEngine</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-600">
          <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How it Works</a>
          <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
          <a href="#use-cases" className="hover:text-indigo-600 transition-colors">Use Cases</a>
        </nav>
        <div className="flex items-center gap-4">
          {user ? (
            <Link to="/dashboard">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 rounded-full px-6">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors hidden sm:block">
                Log in
              </Link>
              <Link to="/signup">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 rounded-full px-6">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10">
        
        {/* HERO SECTION */}
        <section className="pt-24 pb-32 px-6 text-center max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium mb-8">
            <SparklesIcon className="w-4 h-4" />
            Introducing LeadEngine V3
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1] max-w-5xl mx-auto">
            Find your next customer <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 animate-gradient-x">
              before your competitors do.
            </span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            The intelligent B2B discovery platform that automatically finds, enriches, and analyzes companies tailored to your ideal customer profile.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {user ? (
            <Link to="/dashboard">
              <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 h-14 text-lg w-full sm:w-auto shadow-xl shadow-slate-900/20">
                Go to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          ) : (
            <Link to="/signup">
              <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 h-14 text-lg w-full sm:w-auto shadow-xl shadow-slate-900/20">
                Start Discovering
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          )}
            <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-lg w-full sm:w-auto border-slate-200 hover:bg-slate-50 text-slate-700 bg-white/50 backdrop-blur-sm">
              View Demo
            </Button>
          </div>

          {/* Hero Visual Video */}
          <div className="mt-20 relative mx-auto w-full max-w-6xl z-40 transform hover:scale-[1.01] transition-transform duration-500">
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 rounded-[2rem] blur-3xl opacity-20 animate-pulse" />
            <div className="relative rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/20">
              <video 
                src="/discovery_demo.mp4" 
                autoPlay 
                loop 
                muted 
                playsInline 
                className="w-full h-auto rounded-2xl brightness-[1.15] contrast-[1.05] saturate-110"
              />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-24 bg-white relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How LeadEngine Works</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">An automated pipeline that turns a simple search into a deeply analyzed list of high-converting prospects.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              <div className="hidden md:block absolute top-12 left-24 right-24 h-0.5 bg-gradient-to-r from-indigo-100 via-indigo-300 to-indigo-100 z-0" />
              
              {[
                { icon: Search, title: "1. Discover", desc: "Search across Google Maps, Yelp, and search engines instantly." },
                { icon: Database, title: "2. Enrich", desc: "We pull contact info, social links, and website data automatically." },
                { icon: BrainCircuit, title: "3. Analyze", desc: "AI reads their website and scores them against your ICP." },
                { icon: Target, title: "4. Convert", desc: "Export to CRM or reach out directly with AI-generated proposals." }
              ].map((step, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-2xl bg-white border-2 border-indigo-100 shadow-xl shadow-indigo-100/50 flex items-center justify-center mb-6 text-indigo-600">
                    <step.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DISCOVERY FLYWHEEL */}
        <section className="py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-slate-900 rounded-3xl p-10 md:p-16 relative overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center gap-12">
              <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen -translate-y-1/2 translate-x-1/3" />
              
              <div className="flex-1 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-sm font-medium mb-6">
                  <RefreshCw className="w-4 h-4" />
                  The Flywheel Effect
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">A database that gets smarter with every search.</h2>
                <p className="text-lg text-slate-400 mb-8 max-w-xl leading-relaxed">
                  LeadEngine doesn't just scrape the web—it builds a proprietary intelligence graph. If a prospect was found previously, you get their historical data instantly. Over time, your private database becomes an unstoppable asset.
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-4xl font-bold text-white mb-2">0s</div>
                    <div className="text-slate-400 text-sm">Latency for Known Leads</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-white mb-2">100%</div>
                    <div className="text-slate-400 text-sm">Duplicate Prevention</div>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 relative z-10 w-full">
                <div className="relative mx-auto w-72 h-72">
                  <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
                  <div className="absolute inset-4 border-4 border-dashed border-purple-500/30 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <Database className="w-12 h-12 text-white mb-2" />
                    <span className="text-white font-bold tracking-widest text-sm uppercase">Global Index</span>
                  </div>
                  {/* Orbits */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600 rounded-full shadow-lg shadow-indigo-500/50 flex items-center justify-center text-white">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="absolute bottom-1/4 -right-4 w-12 h-12 bg-purple-600 rounded-full shadow-lg shadow-purple-500/50 flex items-center justify-center text-white">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="absolute bottom-1/4 -left-4 w-12 h-12 bg-blue-600 rounded-full shadow-lg shadow-blue-500/50 flex items-center justify-center text-white">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FEATURES */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Powerful Core Features</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">Everything you need to discover, qualify, and convert leads in one unified platform.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { icon: Search, title: "Hybrid Discovery", desc: "Combines real-time web scraping with a lightning-fast local cache to prevent duplicates and deliver immediate results." },
                { icon: Building2, title: "Company Intelligence", desc: "Aggregates tech stack, employee count, location, and industry data into a beautiful, centralized profile." },
                { icon: Users, title: "Contact Discovery", desc: "Automatically extracts emails, phone numbers, and social profiles directly from company domains." },
                { icon: BrainCircuit, title: "AI Analysis", desc: "Our AI agents read the prospect's website and generate a customized analysis of their needs and gaps." },
                { icon: BarChart3, title: "Lead Scoring", desc: "Custom scoring algorithms rank prospects based on their digital maturity and fit with your ICP." },
                { icon: LineChart, title: "Pipeline Management", desc: "Built-in CRM features to move leads from Discovery through to Proposal and Closed Won." }
              ].map((f, i) => (
                <Card key={i} className="border border-slate-200/60 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group bg-slate-50/50">
                  <CardContent className="p-8">
                    <div className="w-14 h-14 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <f.icon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section id="use-cases" className="py-24 relative bg-slate-50 border-t border-slate-200/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row gap-16 items-center">
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Built for growth teams.</h2>
                <div className="space-y-6">
                  {[
                    { title: "Marketing Agencies", desc: "Find businesses with outdated websites, no SSL, or poor SEO, and pitch them exactly what they need." },
                    { title: "Sales Teams", desc: "Stop manually googling prospects. Generate hundreds of qualified accounts in your territory in minutes." },
                    { title: "Business Development", desc: "Identify strategic partners and unearth their leadership contact information effortlessly." }
                  ].map((uc, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="mt-1">
                        <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-lg mb-1">{uc.title}</h4>
                        <p className="text-slate-600">{uc.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full">
                {/* Mock UI Preview */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden rotate-2 hover:rotate-0 transition-transform duration-500">
                  <div className="h-10 border-b border-slate-100 bg-slate-50 flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-xl">A</div>
                        <div>
                          <h4 className="font-bold text-slate-900">Apex Marketing Group</h4>
                          <div className="flex items-center text-xs text-slate-500 mt-1">
                            <Globe className="w-3 h-3 mr-1" /> apexmarketing.com
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-500">Lead Score</div>
                        <div className="text-2xl font-bold text-emerald-500">94</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="h-24 bg-slate-50 rounded-xl border border-slate-100 p-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">AI Insights</div>
                        <div className="w-full h-2 bg-slate-200 rounded-full mb-2" />
                        <div className="w-3/4 h-2 bg-slate-200 rounded-full mb-2" />
                        <div className="w-5/6 h-2 bg-slate-200 rounded-full" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="h-12 border border-slate-100 rounded-lg flex items-center px-3 gap-3">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <div className="w-20 h-2 bg-slate-200 rounded-full" />
                        </div>
                        <div className="h-12 border border-slate-100 rounded-lg flex items-center px-3 gap-3">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <div className="w-24 h-2 bg-slate-200 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-slate-900 z-0" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 z-0 mix-blend-overlay" />
          
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to fill your pipeline?</h2>
            <p className="text-xl text-indigo-200 mb-10 max-w-2xl mx-auto">
              Join the smart sales teams using LeadEngine to automate their outbound discovery and intelligence gathering.
            </p>
            {user ? (
              <Link to="/dashboard">
                <Button size="lg" className="bg-white hover:bg-slate-50 text-indigo-900 rounded-full px-10 h-14 text-lg shadow-2xl shadow-indigo-500/20">
                  Go to Dashboard
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            ) : (
              <Link to="/signup">
                <Button size="lg" className="bg-white hover:bg-slate-50 text-indigo-900 rounded-full px-10 h-14 text-lg shadow-2xl shadow-indigo-500/20">
                  Get Started for Free
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-12 px-6 border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-sm">L</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-white">LeadEngine</span>
          </div>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 text-sm text-center md:text-left text-slate-600">
          &copy; {new Date().getFullYear()} LeadEngine Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function SparklesIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function CheckCircleIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function Database(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
  )
}
