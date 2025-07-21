import { Brain, User, LogOut, Calendar, Settings } from "lucide-react";
import UrlCollector from "@/components/url-collector";
import AiChat from "@/components/ai-chat";
import AskLeo from "@/components/ask-leo";
import AdminDashboard from "@/components/admin-dashboard";
import AuthForm from "@/components/auth-form";
import ProModePanel from "@/components/pro-mode-panel";
import ProModeToggle from "@/components/pro-mode-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { getCalApi } from "@calcom/embed-react";
import { useEffect, useState } from "react";

export default function Workspace() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    (async function () {
      const cal = await getCalApi({"namespace":"leo-as-a-service"});
      cal("ui", {"hideEventTypeDetails":false,"layout":"month_view"});
    })();
  }, []);

  if (!isAuthenticated) {
    return <AuthForm onAuthSuccess={login} />;
  }

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
            <div className="text-sm text-slate-600">Welcome back, {user?.username}</div>
            <ProModeToggle />
            <ProModePanel />
            <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
              <User className="text-slate-600" size={16} />
            </div>
            {user?.role === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdmin(!showAdmin)}
                className="flex items-center gap-2"
              >
                <Settings size={14} />
                {showAdmin ? "Hide Admin" : "Admin"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center gap-2"
            >
              <LogOut size={14} />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex flex-1 overflow-hidden">
        {showAdmin ? (
          <AdminDashboard />
        ) : (
          <>
            <UrlCollector />
            <AiChat />
            <div className="w-1/3 flex flex-col">
              <div className="h-1/2">
                <AskLeo />
              </div>
              {/* Book a Call Section */}
              <div className="h-1/2 bg-white border-l border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <Calendar className="text-white" size={16} />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800">Book a Call</h2>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Need personalized help with your research? Book a 1-on-1 call with me to discuss your project, get feedback, or explore new ideas.
                  </p>
                  <Button
                    data-cal-namespace="leo-as-a-service"
                    data-cal-link="build-in-public-university/leo-as-a-service"
                    data-cal-config='{"layout":"month_view"}'
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Calendar size={16} className="mr-2" />
                    Schedule a Call
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
