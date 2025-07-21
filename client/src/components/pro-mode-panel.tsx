import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Settings, 
  Plus, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Users,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface ContextProfile {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  lastUpdated: string | null;
  version: number | null;
}

interface ProModeStatus {
  proMode: boolean;
}

export default function ProModePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDescription, setNewProfileDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check pro mode status
  const { data: proStatus } = useQuery<ProModeStatus>({
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

  // Get context profiles
  const { data: profilesData, isLoading: profilesLoading } = useQuery<{ profiles: ContextProfile[] }>({
    queryKey: ['/api/pro/profiles'],
    queryFn: async () => {
      const response = await fetch('/api/pro/profiles', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'list' }),
      });
      if (!response.ok) throw new Error('Failed to fetch profiles');
      const data = await response.json();
      return data;
    },
    enabled: proStatus?.proMode === true,
  });

  // Create profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const response = await fetch('/api/pro/profiles', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          profileName: name,
          description,
        }),
      });
      if (!response.ok) throw new Error('Failed to create profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/profiles'] });
      setNewProfileName("");
      setNewProfileDescription("");
      toast({
        title: "Profile Created",
        description: "New context profile created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create profile",
        variant: "destructive",
      });
    },
  });

  // Switch profile mutation
  const switchProfileMutation = useMutation({
    mutationFn: async (profileId: number) => {
      const response = await fetch('/api/pro/profiles', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'switch',
          profileId,
        }),
      });
      if (!response.ok) throw new Error('Failed to switch profile');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/profiles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/context'] });
      
      // Refresh related data when switching contexts
      queryClient.invalidateQueries({ queryKey: ['/api/urls'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/context-summary'] });
      
      // Show data loading information
      if (data.loadedData) {
        console.log(`Loaded ${data.loadedData.urls} URLs and ${data.loadedData.chatHistory} messages for context`);
      }
      
      toast({
        title: "Profile Switched",
        description: data.message,
      });
      
      // Close the modal after switching
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to switch profile",
        variant: "destructive",
      });
    },
  });

  // Delete profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: number) => {
      const response = await fetch('/api/pro/profiles', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          profileId,
        }),
      });
      if (!response.ok) throw new Error('Failed to delete profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/profiles'] });
      toast({
        title: "Profile Deleted",
        description: "Context profile deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete profile",
        variant: "destructive",
      });
    },
  });

  // Manual context update mutation
  const updateContextMutation = useMutation({
    mutationFn: async ({ date, forceUpdate }: { date: string; forceUpdate: boolean }) => {
      const response = await fetch('/api/pro/context-update', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date,
          forceUpdate,
        }),
      });
      if (!response.ok) throw new Error('Failed to update context');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pro/profiles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/context'] });
      toast({
        title: "Context Updated",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update context",
        variant: "destructive",
      });
    },
  });

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) {
      toast({
        title: "Error",
        description: "Profile name is required",
        variant: "destructive",
      });
      return;
    }
    createProfileMutation.mutate({
      name: newProfileName.trim(),
      description: newProfileDescription.trim(),
    });
  };

  const handleUpdateContext = (forceUpdate = false) => {
    updateContextMutation.mutate({
      date: selectedDate,
      forceUpdate,
    });
  };

  if (!proStatus?.proMode) {
    return null; // Don't show pro mode panel if user doesn't have pro mode
  }

  return (
    <>
      {/* Pro Mode Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Zap className="w-4 h-4" />
        Pro Mode
        <Settings className="w-4 h-4" />
      </Button>

      {/* Pro Mode Panel */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Pro Mode - Context Management
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                ×
              </Button>
            </div>

            <div className="space-y-6">
              {/* Create New Profile */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create New Context Profile
                </h3>
                <div className="space-y-3">
                  <Input
                    placeholder="Profile name (e.g., 'AI Research', 'Blockchain Project')"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Optional description"
                    value={newProfileDescription}
                    onChange={(e) => setNewProfileDescription(e.target.value)}
                    rows={2}
                  />
                  <Button
                    onClick={handleCreateProfile}
                    disabled={createProfileMutation.isPending}
                    className="w-full"
                  >
                    {createProfileMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Profile
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Context Profiles List */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Context Profiles
                </h3>
                {profilesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="ml-2">Loading profiles...</span>
                  </div>
                ) : profilesData?.profiles && profilesData.profiles.length > 0 ? (
                  <div className="space-y-3">
                    {profilesData.profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className={`border rounded-lg p-3 ${
                          profile.isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{profile.name}</h4>
                              {profile.isActive && (
                                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                                  Active
                                </span>
                              )}
                            </div>
                            {profile.description && (
                              <p className="text-sm text-gray-600 mt-1">{profile.description}</p>
                            )}
                            <div className="text-xs text-gray-500 mt-2">
                              Version: {profile.version || 0} | 
                              Last updated: {profile.lastUpdated ? new Date(profile.lastUpdated).toLocaleDateString() : 'Never'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!profile.isActive && (
                              <Button
                                size="sm"
                                onClick={() => switchProfileMutation.mutate(profile.id)}
                                disabled={switchProfileMutation.isPending}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {!profile.isActive && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete "${profile.name}"?`)) {
                                    deleteProfileMutation.mutate(profile.id);
                                  }
                                }}
                                disabled={deleteProfileMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    No context profiles found. Create your first profile above.
                  </div>
                )}
              </div>

              {/* Manual Context Update */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Manual Context Update
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleUpdateContext(false)}
                      disabled={updateContextMutation.isPending}
                      className="flex-1"
                    >
                      {updateContextMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Update Context
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateContext(true)}
                      disabled={updateContextMutation.isPending}
                    >
                      Force Update
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Update your active context profile with recent activity. Use "Force Update" to update even without new activity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 