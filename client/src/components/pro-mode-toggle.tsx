import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface ProModeStatus {
  proMode: boolean;
}

export default function ProModeToggle() {
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get pro mode status
  const { data: proStatus, isLoading } = useQuery<ProModeStatus>({
    queryKey: ['/api/pro/status'],
    queryFn: async () => {
      const response = await fetch('/api/pro/status', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch pro mode status');
      const data = await response.json();
      return data;
    },
  });

  // Toggle pro mode mutation
  const toggleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pro/toggle', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to toggle pro mode');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pro/profiles'] });
      toast({
        title: "Pro Mode Updated",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle pro mode",
        variant: "destructive",
      });
    },
  });

  const handleToggle = () => {
    toggleMutation.mutate();
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Zap className="w-4 h-4 animate-pulse" />
        Loading...
      </Button>
    );
  }

  const isProMode = proStatus?.proMode || false;

  return (
    <Button
      variant={isProMode ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={toggleMutation.isPending}
      className={`flex items-center gap-2 ${
        isProMode 
          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
          : 'text-gray-600 hover:text-gray-800'
      }`}
      title={isProMode ? 'Disable Pro Mode' : 'Enable Pro Mode'}
    >
      {toggleMutation.isPending ? (
        <>
          <Zap className="w-4 h-4 animate-spin" />
          Toggling...
        </>
      ) : isProMode ? (
        <>
          <Zap className="w-4 h-4" />
          Pro Mode
        </>
      ) : (
        <>
          <ZapOff className="w-4 h-4" />
          Enable Pro
        </>
      )}
    </Button>
  );
} 