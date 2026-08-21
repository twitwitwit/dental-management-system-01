import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Message = { role: "user" | "assistant"; content: string };

export default function PatientAiChatTab() {
  const ask = trpc.patientAi.ask.useMutation();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = question.trim();
    if (!value || ask.isPending) return;
    setMessages(current => [...current, { role: "user", content: value }]);
    setQuestion("");
    ask.mutate({ question: value }, { onSuccess: result => setMessages(current => [...current, { role: "assistant", content: result.answer }]) });
  };
  return <div className="mx-auto w-full max-w-3xl space-y-5"><div><p className="text-sm text-muted-foreground">Patient assistant</p><h1 className="flex items-center gap-2 text-2xl font-semibold"><Sparkles className="h-5 w-5 text-primary" />Ask the clinic assistant</h1><p className="mt-1 text-sm text-muted-foreground">Ask about clinic processes or appointment availability. The assistant cannot diagnose conditions or access your private chart.</p></div><div className="min-h-[360px] space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">{messages.length === 0 && <div className="flex h-72 flex-col items-center justify-center text-center text-sm text-muted-foreground"><Sparkles className="mb-3 h-8 w-8 text-primary" /><p>Try asking, “What should I bring to my appointment?”</p><p>For availability, include a date such as “Are there slots on June 15?”</p></div>}{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{message.content}</div></div>)}{ask.isPending && <div className="flex justify-start"><div className="rounded-2xl bg-muted px-4 py-3"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}{ask.error && <p className="text-sm text-destructive">{ask.error.message}</p>}</div><form onSubmit={submit} className="flex gap-2"><Input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a clinic question..." maxLength={1200} /><Button type="submit" disabled={ask.isPending || !question.trim()}><Send className="mr-2 h-4 w-4" />Send</Button></form></div>;
}
