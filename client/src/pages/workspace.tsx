import { Brain, User } from "lucide-react";
import UrlCollector from "@/components/url-collector";
import AiChat from "@/components/ai-chat";
import AskLeo from "@/components/ask-leo";

export default function Workspace() {
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Brain className="text-white" size={16} />
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Research Workspace</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">Welcome back, Alex</div>
            <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
              <User className="text-slate-600" size={16} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex flex-1 overflow-hidden">
        <UrlCollector />
        <AiChat />
        <AskLeo />
      </main>
    </div>
  );
}
