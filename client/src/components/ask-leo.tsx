import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { LeoQuestion } from "@shared/schema";

export default function AskLeo() {
  const [question, setQuestion] = useState("");
  const { toast } = useToast();
  const { getAuthHeaders } = useAuth();

  const { data: questions = [], isLoading } = useQuery<LeoQuestion[]>({
    queryKey: ["/api/leo/questions"],
    queryFn: async () => {
      const response = await fetch("/api/leo/questions", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }
      return response.json();
    },
  });

  const submitQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await fetch("/api/leo/questions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ question }),
      });
      if (!response.ok) {
        throw new Error("Failed to submit question");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leo/questions"] });
      setQuestion("");
      toast({
        title: "Question submitted",
        description: "Your question has been sent to Leo. You'll receive a response soon.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit question. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitQuestion = () => {
    const trimmedQuestion = question.trim();
    if (trimmedQuestion && !submitQuestionMutation.isPending) {
      submitQuestionMutation.mutate(trimmedQuestion);
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const questionTime = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - questionTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min${diffInMinutes > 1 ? "s" : ""} ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) > 1 ? "s" : ""} ago`;
    return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) > 1 ? "s" : ""} ago`;
  };

  if (isLoading) {
    return (
      <div className="w-1/4 bg-white border-l border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 p-4">
          <div className="h-24 bg-slate-100 rounded animate-pulse mb-4"></div>
          <div className="h-10 bg-slate-100 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-1/4 bg-white border-l border-slate-200 flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Ask Leo</h2>
        <p className="text-sm text-slate-600 mt-1">Get expert guidance from Leo</p>
      </div>
      
      <div className="flex-1 p-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Your Question
          </label>
          <Textarea
            placeholder="Ask Leo a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full h-24 resize-none"
            disabled={submitQuestionMutation.isPending}
          />
        </div>
        
        <Button
          onClick={handleSubmitQuestion}
          disabled={!question.trim() || submitQuestionMutation.isPending}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        >
          <Send size={16} className="mr-2" />
          {submitQuestionMutation.isPending ? "Sending..." : "Send to Leo"}
        </Button>
        
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Recent Questions</h3>
          
          {questions.length === 0 ? (
            <div className="text-center text-slate-500 mt-4">
              <div className="text-sm">No questions submitted yet</div>
              <div className="text-xs mt-1">Ask Leo your first question above</div>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <Badge
                      variant={q.status === "answered" ? "default" : "secondary"}
                      className={
                        q.status === "answered"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                      }
                    >
                      {q.status === "answered" ? "Answered" : "Pending"}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {formatTimestamp(q.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-2">{q.question}</p>
                  {q.answer && (
                    <div className="text-xs text-slate-600 p-2 bg-white rounded border-l-2 border-emerald-500">
                      {q.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
