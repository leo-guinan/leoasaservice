import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bot, User, Send, Circle, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { ChatMessage } from "@shared/schema";
import { Markdown } from "@/components/ui/markdown";
import DailyContextSummary from "@/components/daily-context-summary";
import ProModePanel from "@/components/pro-mode-panel";

export default function AiChat() {
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showDailySummary, setShowDailySummary] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { getAuthHeaders } = useAuth();

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
    queryFn: async () => {
      const response = await fetch("/api/chat/messages", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      return response.json();
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ content, role: "user" }),
      });
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      setMessage("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("pdf", file);
      
      const response = await fetch("/api/upload/pdf", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload PDF");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      toast({
        title: "PDF uploaded",
        description: `Successfully uploaded and processed PDF (${data.extractedTextLength} characters extracted)`,
      });
      setIsUploading(false);
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload PDF. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(trimmedMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive",
        });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: "Please select a PDF file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setIsUploading(true);
      uploadPdfMutation.mutate(file);
    }
  };

  const handleUploadClick = () => {
    // Check if S3 is configured (this will be handled server-side, but we can show a helpful message)
    fileInputRef.current?.click();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const messageTime = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) > 1 ? "s" : ""} ago`;
    return messageTime.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="w-1/2 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 p-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mb-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-16 bg-slate-100 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-1/2 bg-white flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">AI Assistant</h2>
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
            <span className="text-sm text-slate-600">Online</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Daily Context Summary */}
        {showDailySummary && (
          <DailyContextSummary 
            onDismiss={() => setShowDailySummary(false)}
          />
        )}
        
        {messages.length === 0 ? (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="text-white" size={16} />
            </div>
            <div className="flex-1">
              <div className="bg-slate-100 rounded-lg p-3 max-w-md">
                <div className="text-sm text-slate-800">
                  <Markdown>{`Hello! I'm your **AI research assistant**. I can help you:

• **Analyze research materials** and saved URLs
• **Answer questions** about your research
• **Assist with writing** and research tasks
• **Process PDF files** (use the file icon below)

I also have access to your **research context**, so I can provide personalized insights based on your interests and current projects.

What would you like to explore today?`}</Markdown>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-1">Just now</div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""
                }`}
            >
              {msg.content && (<>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user"
                    ? "bg-slate-300"
                    : "bg-blue-600"
                  }`}>
                  {msg.role === "user" ? (
                    <User className="text-slate-600" size={16} />
                  ) : (
                    <Bot className="text-white" size={16} />
                  )}
                </div>
                <div className="flex-1">
                  <div className={`rounded-lg p-3 max-w-md ${msg.role === "user"
                      ? "bg-blue-600 text-white ml-auto"
                      : "bg-slate-100"
                    }`}>
                    {msg.role === "user" ? (
                      <p className="text-sm text-white">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="text-sm text-slate-800">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                  </div>
                  <div className={`text-xs text-slate-500 mt-1 ${msg.role === "user" ? "text-right" : ""
                    }`}>
                    {formatTimestamp(msg.createdAt)}
                  </div>
                </div>
              </>
              )}
            </div>

          ))
        )}

        {sendMessageMutation.isPending && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="text-white" size={16} />
            </div>
            <div className="flex-1">
              <div className="bg-slate-100 rounded-lg p-3 max-w-md">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Ask me anything about your research..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sendMessageMutation.isPending || isUploading}
              className="w-full"
            />
          </div>
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <Button
            onClick={handleUploadClick}
            disabled={sendMessageMutation.isPending || isUploading}
            variant="outline"
            className="border-slate-300 hover:bg-slate-50"
            title="Upload PDF"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileText size={16} />
            )}
          </Button>
          
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending || isUploading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
