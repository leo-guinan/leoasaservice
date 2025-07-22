import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { useToast } from '../hooks/use-toast';

interface ContextProfile {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ContextProfileManager() {
  const [profiles, setProfiles] = useState<ContextProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    description: '',
    isActive: false,
  });
  const { toast } = useToast();

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/context/profiles', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch context profiles",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Error",
        description: "Failed to fetch context profiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    if (!newProfile.name.trim()) {
      toast({
        title: "Error",
        description: "Profile name is required",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/context/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newProfile),
      });

      if (response.ok) {
        const createdProfile = await response.json();
        setProfiles([...profiles, createdProfile]);
        setNewProfile({ name: '', description: '', isActive: false });
        setShowCreateForm(false);
        toast({
          title: "Success",
          description: "Context profile created successfully",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to create profile",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      toast({
        title: "Error",
        description: "Failed to create profile",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleLock = async (profileId: number) => {
    try {
      const response = await fetch(`/api/context/profiles/${profileId}/toggle-lock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setProfiles(profiles.map(profile => 
          profile.id === profileId 
            ? { ...profile, isLocked: result.profile.isLocked }
            : profile
        ));
        toast({
          title: "Success",
          description: result.message,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to toggle lock",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling lock:', error);
      toast({
        title: "Error",
        description: "Failed to toggle lock",
        variant: "destructive",
      });
    }
  };

  const updateProfile = async (profileId: number, updates: Partial<ContextProfile>) => {
    try {
      const response = await fetch(`/api/context/profiles/${profileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfiles(profiles.map(profile => 
          profile.id === profileId ? updatedProfile : profile
        ));
        toast({
          title: "Success",
          description: "Profile updated successfully",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to update profile",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Context Profiles</CardTitle>
          <CardDescription>Manage your research context profiles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading profiles...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Context Profiles</CardTitle>
              <CardDescription>Manage your research context profiles and lock them to prevent automatic updates</CardDescription>
            </div>
            <Button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              variant={showCreateForm ? "outline" : "default"}
            >
              {showCreateForm ? "Cancel" : "Create Profile"}
            </Button>
          </div>
        </CardHeader>
        
        {showCreateForm && (
          <CardContent className="space-y-4 border-t pt-6">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Profile Name *</Label>
              <Input
                id="profile-name"
                value={newProfile.name}
                onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                placeholder="e.g., AI Research, Blockchain Project"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="profile-description">Description</Label>
              <Textarea
                id="profile-description"
                value={newProfile.description}
                onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                placeholder="Optional description of this research context"
                rows={3}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="profile-active"
                checked={newProfile.isActive}
                onCheckedChange={(checked) => setNewProfile({ ...newProfile, isActive: checked })}
              />
              <Label htmlFor="profile-active">Set as active profile</Label>
            </div>
            
            <Button onClick={createProfile} disabled={creating || !newProfile.name.trim()}>
              {creating ? "Creating..." : "Create Profile"}
            </Button>
          </CardContent>
        )}
      </Card>

      <div className="space-y-4">
        {profiles.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <div className="text-muted-foreground">No context profiles found</div>
                <div className="text-sm text-muted-foreground">
                  Create your first profile to start organizing your research contexts
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-lg">{profile.name}</CardTitle>
                    {profile.isActive && (
                      <Badge variant="default">Active</Badge>
                    )}
                    {profile.isLocked && (
                      <Badge variant="destructive">Locked</Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleLock(profile.id)}
                      disabled={profile.isActive && profile.isLocked}
                    >
                      {profile.isLocked ? "Unlock" : "Lock"}
                    </Button>
                  </div>
                </div>
                {profile.description && (
                  <CardDescription>{profile.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`active-${profile.id}`}
                      checked={profile.isActive}
                      onCheckedChange={(checked) => updateProfile(profile.id, { isActive: checked })}
                      disabled={profile.isLocked}
                    />
                    <Label htmlFor={`active-${profile.id}`}>Active Profile</Label>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Created: {new Date(profile.createdAt).toLocaleDateString()}</div>
                    <div>Updated: {new Date(profile.updatedAt).toLocaleDateString()}</div>
                  </div>
                  
                  {profile.isLocked && (
                    <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                      <strong>Context Locked:</strong> This profile's context will not be automatically updated by the system.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
} 