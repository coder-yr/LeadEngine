import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Loader2, Sparkles, Mail, MessageSquare, FileText } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIAgentTab({ companyId }: { companyId: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your AI Sales Agent. I've analyzed this company's profile. How can I help you engage them?" }
  ]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("qwen3:8b");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const newMessages = [...messages, { role: "user", content: text } as Message];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:3000/api/agent/chat", {
        companyId,
        message: text,
        model
      });

      setMessages([...newMessages, { role: "assistant", content: res.data.response }]);
    } catch (error) {
      console.error("Agent error:", error);
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I encountered an error. Make sure Ollama is running locally." }]);
    } finally {
      setLoading(false);
    }
  };

  const QuickAction = ({ icon: Icon, label, prompt }: { icon: any, label: string, prompt: string }) => (
    <Button 
      variant="outline" 
      size="sm" 
      className="bg-background text-xs" 
      onClick={() => sendMessage(prompt)}
      disabled={loading}
    >
      <Icon className="w-3.5 h-3.5 mr-1.5 text-primary" />
      {label}
    </Button>
  );

  return (
    <Card className="h-[600px] flex flex-col border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-md">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">AI Sales Agent</CardTitle>
            <p className="text-xs text-muted-foreground">Context-aware outreach assistant</p>
          </div>
        </div>
        <div className="w-40">
          <Select value={model} onValueChange={setModel} disabled={loading}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qwen3:8b">qwen3:8b</SelectItem>
              <SelectItem value="deepseek-r1:8b">deepseek-r1:8b</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4 bg-muted/5" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border"}`}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`p-3 rounded-xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none whitespace-pre-wrap"}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-muted text-foreground border border-border flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 rounded-xl text-sm bg-card border border-border rounded-tl-none flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border bg-card">
        <div className="flex flex-wrap gap-2 mb-3">
          <QuickAction icon={Sparkles} label="Analyze Company" prompt="Analyze this company's profile and summarize their digital weaknesses." />
          <QuickAction icon={Mail} label="Draft Email" prompt="Write a cold email addressing their pain points to request a meeting." />
          <QuickAction icon={MessageSquare} label="Draft WhatsApp" prompt="Write a short, engaging WhatsApp pitch." />
          <QuickAction icon={FileText} label="Proposal Summary" prompt="Write an executive summary for a proposal targeting their needs." />
        </div>
        <form 
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <Input 
            placeholder="Ask the agent to write a pitch or analyze data..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-background"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || loading}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
