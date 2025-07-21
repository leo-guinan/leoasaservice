import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface ContextSummary {
  userId: number;
  date: string;
  hasPreviousContext: boolean;
  hasCurrentContext: boolean;
  previousContext?: any;
  currentContext?: any;
  summary: string;
  changes: string[];
}

interface DailyContextSummaryProps {
  date?: string; // Optional date, defaults to today
  onDismiss?: () => void;
}

export default function DailyContextSummary({ 
  date = new Date().toISOString().split('T')[0], 
  onDismiss 
}: DailyContextSummaryProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();

  const { data: summary, isLoading, error, refetch } = useQuery<ContextSummary>({
    queryKey: [`/api/user/context-summary/${date}`],
    queryFn: async () => {
      const response = await fetch(`/api/user/context-summary/${date}`, {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch context summary");
      }
      const data = await response.json();
      return data.summary;
    },
    enabled: isVisible,
  });

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleRefresh = () => {
    refetch();
  };

  if (!isVisible) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">Loading Daily Context Summary...</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm text-blue-600">Fetching your research context updates...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">Error Loading Context Summary</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-red-600 hover:text-red-800"
          >
            ×
          </Button>
        </div>
        <p className="text-sm text-red-600 mb-2">
          Failed to load your daily context summary. Please try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="text-red-600 border-red-300 hover:bg-red-50"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Daily Context Summary - {new Date(date).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="text-blue-600 hover:text-blue-800"
            title="Refresh summary"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-blue-600 hover:text-blue-800"
            title="Dismiss"
          >
            ×
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Summary */}
        <div className="text-sm text-blue-800">
          <Markdown>{summary.summary}</Markdown>
        </div>

        {/* Changes */}
        {summary.changes.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-blue-800 mb-2">Changes Detected:</h4>
            <ul className="space-y-1">
              {summary.changes.map((change, index) => (
                <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Context Comparison */}
        {summary.hasPreviousContext && summary.hasCurrentContext && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-blue-800">Context Comparison:</h4>
            
            {/* Previous Context */}
            <div className="bg-white rounded border border-blue-100 p-3">
              <h5 className="text-xs font-medium text-gray-600 mb-2">Previous Context:</h5>
              <div className="text-xs text-gray-700 space-y-1">
                {summary.previousContext && (
                  <>
                    <div><strong>Research Interests:</strong> {summary.previousContext.researchInterests?.length || 0} items</div>
                    <div><strong>Current Projects:</strong> {summary.previousContext.currentProjects?.length || 0} items</div>
                    <div><strong>Knowledge Areas:</strong> {summary.previousContext.knowledgeAreas?.length || 0} items</div>
                    <div><strong>Recent Insights:</strong> {summary.previousContext.recentInsights?.length || 0} items</div>
                    <div><strong>Research Patterns:</strong> {summary.previousContext.researchPatterns?.length || 0} items</div>
                  </>
                )}
              </div>
            </div>

            {/* Current Context */}
            <div className="bg-blue-50 rounded border border-blue-200 p-3">
              <h5 className="text-xs font-medium text-blue-700 mb-2">Current Context:</h5>
              <div className="text-xs text-blue-800 space-y-1">
                {summary.currentContext && (
                  <>
                    <div><strong>Research Interests:</strong> {summary.currentContext.researchInterests?.length || 0} items</div>
                    <div><strong>Current Projects:</strong> {summary.currentContext.currentProjects?.length || 0} items</div>
                    <div><strong>Knowledge Areas:</strong> {summary.currentContext.knowledgeAreas?.length || 0} items</div>
                    <div><strong>Recent Insights:</strong> {summary.currentContext.recentInsights?.length || 0} items</div>
                    <div><strong>Research Patterns:</strong> {summary.currentContext.researchPatterns?.length || 0} items</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast({
                title: "Feedback Received",
                description: "Thank you for your feedback! We'll use this to improve your context.",
              });
              handleDismiss();
            }}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            Looks Good
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              toast({
                title: "Correction Requested",
                description: "We'll review and update your context based on your feedback.",
              });
              handleDismiss();
            }}
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
          >
            Needs Correction
          </Button>
        </div>
      </div>
    </div>
  );
} 