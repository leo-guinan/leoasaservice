import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, MessageSquare, Link, HelpCircle, Eye, Crown, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface UserStats {
  user: {
    id: number;
    username: string;
    role: string;
  };
  urlCount: number;
  messageCount: number;
  questionCount: number;
}

export default function AdminDashboard() {
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const { getAuthHeaders } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userStats = [], isLoading, error } = useQuery<UserStats[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Admin access required");
        }
        throw new Error("Failed to fetch user statistics");
      }
      return response.json();
    },
    retry: false,
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: "user" | "admin" }) => {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        throw new Error("Failed to update user role");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRoleToggle = (userId: number, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    updateUserRoleMutation.mutate({ userId, role: newRole as "user" | "admin" });
  };

  if (error) {
    return (
      <div className="w-full bg-white border-l border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Admin Dashboard</h2>
          <p className="text-sm text-slate-600 mt-1">System administration</p>
        </div>
        <div className="flex-1 p-4">
          <div className="text-center text-red-600">
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm mt-1">You don't have permission to access the admin dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full bg-white border-l border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-4">
            <div className="h-32 bg-slate-100 rounded animate-pulse"></div>
            <div className="h-32 bg-slate-100 rounded animate-pulse"></div>
            <div className="h-32 bg-slate-100 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  const totalUsers = userStats.length;
  const totalUrls = userStats.reduce((sum, stat) => sum + Number(stat.urlCount), 0);
  const totalMessages = userStats.reduce((sum, stat) => sum + Number(stat.messageCount), 0);
  const totalQuestions = userStats.reduce((sum, stat) => sum + Number(stat.questionCount), 0);

  // Debug logging
  console.log('Admin Dashboard Data:', {
    userStats,
    totalUsers,
    totalUrls,
    totalMessages,
    totalQuestions
  });

  return (
    <div className="w-full bg-white border-l border-slate-200 flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Admin Dashboard</h2>
        <p className="text-sm text-slate-600 mt-1">System administration and user management</p>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="h-4 w-4 text-slate-500 mr-2" />
                <span className="text-2xl font-bold text-slate-900">{totalUsers}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total URLs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Link className="h-4 w-4 text-slate-500 mr-2" />
                <span className="text-2xl font-bold text-slate-900">{totalUrls}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <MessageSquare className="h-4 w-4 text-slate-500 mr-2" />
                <span className="text-2xl font-bold text-slate-900">{totalMessages}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <HelpCircle className="h-4 w-4 text-slate-500 mr-2" />
                <span className="text-2xl font-bold text-slate-900">{totalQuestions}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">User Statistics</h3>
          
          {userStats.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              <p>No users found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userStats.map((stat) => (
                <Card key={stat.user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-slate-900">{stat.user.username}</h4>
                          <Badge 
                            variant={stat.user.role === "admin" ? "default" : "secondary"}
                            className={
                              stat.user.role === "admin"
                                ? "bg-purple-100 text-purple-800 hover:bg-purple-100"
                                : "bg-slate-100 text-slate-800 hover:bg-slate-100"
                            }
                          >
                            {stat.user.role === "admin" ? (
                              <>
                                <Crown className="h-3 w-3 mr-1" />
                                Admin
                              </>
                            ) : (
                              <>
                                <Shield className="h-3 w-3 mr-1" />
                                User
                              </>
                            )}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            ID: {stat.user.id}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-6 mt-2 text-sm text-slate-600">
                          <div className="flex items-center">
                            <Link className="h-3 w-3 mr-1" />
                            {stat.urlCount} URLs
                          </div>
                          <div className="flex items-center">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {stat.messageCount} messages
                          </div>
                          <div className="flex items-center">
                            <HelpCircle className="h-3 w-3 mr-1" />
                            {stat.questionCount} questions
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRoleToggle(stat.user.id, stat.user.role)}
                          disabled={updateUserRoleMutation.isPending}
                          className={
                            stat.user.role === "admin"
                              ? "text-orange-600 border-orange-200 hover:bg-orange-50"
                              : "text-purple-600 border-purple-200 hover:bg-purple-50"
                          }
                        >
                          {stat.user.role === "admin" ? "Remove Admin" : "Make Admin"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(stat)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Context
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* User Context Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  User Context: {selectedUser.user.username}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-3 bg-slate-50 rounded">
                    <div className="font-medium text-slate-900">{selectedUser.urlCount}</div>
                    <div className="text-slate-600">URLs</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded">
                    <div className="font-medium text-slate-900">{selectedUser.messageCount}</div>
                    <div className="text-slate-600">Messages</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded">
                    <div className="font-medium text-slate-900">{selectedUser.questionCount}</div>
                    <div className="text-slate-600">Questions</div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium text-slate-900 mb-2">User Knowledge Context</h4>
                  <div className="bg-slate-50 rounded-lg p-4 border">
                    <div className="text-slate-600 text-sm">
                      <p className="mb-2">This feature will display a summarized view of the user's current knowledge based on:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>URLs they've saved and analyzed</li>
                        <li>Chat conversations and insights</li>
                        <li>Questions they've asked Leo</li>
                        <li>Research patterns and interests</li>
                      </ul>
                      <div className="mt-4 p-3 bg-white rounded border-l-2 border-blue-500">
                        <p className="text-xs text-slate-500 italic">
                          User context summarization will be implemented in a future update. 
                          This will provide an AI-generated summary of the user's research 
                          knowledge and current understanding.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 