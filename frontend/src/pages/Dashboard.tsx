import { useState, useEffect } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Flame, Target, DollarSign, TrendingUp } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Area, AreaChart } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/analytics/dashboard");
        setData(res.data);
      } catch (error) {
        console.error("Failed to fetch analytics", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

  const renderKPI = (title: string, value: string | number, icon: any, colorClass: string) => (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-full ${colorClass} bg-opacity-10`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Overview of your lead pipeline, opportunity scores, and conversion metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {renderKPI("Total Leads", data?.metrics?.totalLeads, <Users className="h-4 w-4 text-blue-500" />, "bg-blue-500 text-blue-500")}
        {renderKPI("Hot Leads", data?.metrics?.hotLeads, <Flame className="h-4 w-4 text-orange-500" />, "bg-orange-500 text-orange-500")}
        {renderKPI("Avg. Opportunity Score", `${data?.metrics?.opportunityScore || 0}/100`, <Target className="h-4 w-4 text-indigo-500" />, "bg-indigo-500 text-indigo-500")}
        {renderKPI("Pipeline Value", `$${(data?.metrics?.pipelineValue || 0).toLocaleString()}`, <DollarSign className="h-4 w-4 text-emerald-500" />, "bg-emerald-500 text-emerald-500")}
        {renderKPI("Conversion Rate", `${data?.metrics?.conversionRate || 0}%`, <TrendingUp className="h-4 w-4 text-purple-500" />, "bg-purple-500 text-purple-500")}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Lead Sources Pie Chart */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="text-lg">Lead Sources (Industries)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (data?.charts?.leadSources?.length || 0) > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.leadSources}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.charts.leadSources.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
                No source data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Scores Bar Chart */}
        <Card className="hover:shadow-md transition-shadow duration-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Top Lead Scores (Decision Makers)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (data?.charts?.leadScores?.length || 0) > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.leadScores} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
                No lead score data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Opportunity Scores Area Chart */}
        <Card className="hover:shadow-md transition-shadow duration-200 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Opportunity Scores (Intent)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (data?.charts?.opportunityScores?.length || 0) > 0 ? (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.opportunityScores}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} height={60} angle={-45} textAnchor="end" />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
                No opportunity score data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
