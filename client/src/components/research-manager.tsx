import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useToast } from '../hooks/use-toast';

interface ResearchRequest {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface ResearchReport {
  id: number;
  title: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
}

interface ResearchReportDetail {
  title: string;
  executiveSummary: string;
  localKnowledgeSection: string;
  internetResearchSection: string;
  keyFindings: string[];
  recommendations: string[];
}

export function ResearchManager() {
  const [requests, setRequests] = useState<ResearchRequest[]>([]);
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ResearchReportDetail | null>(null);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    researchAreas: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    profileId: 0,
  });
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const { toast } = useToast();

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchRequests();
    fetchReports();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/research/requests', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching research requests:', error);
      toast({
        title: "Error",
        description: "Failed to fetch research requests",
        variant: "destructive",
      });
    }
  };

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/research/reports', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error fetching research reports:', error);
      toast({
        title: "Error",
        description: "Failed to fetch research reports",
        variant: "destructive",
      });
    }
  };

  const createRequest = async () => {
    if (!newRequest.title || !newRequest.description) {
      toast({
        title: "Error",
        description: "Title and description are required",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingRequest(true);
    try {
      const response = await fetch('/api/research/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newRequest),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: data.message,
        });
        setNewRequest({
          title: '',
          description: '',
          researchAreas: [],
          priority: 'medium',
          profileId: 0,
        });
        setIsCreatingRequest(false);
        fetchRequests();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create research request');
      }
    } catch (error) {
      console.error('Error creating research request:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create research request',
        variant: "destructive",
      });
    } finally {
      setIsCreatingRequest(false);
    }
  };

  const generateReport = async (requestId: number) => {
    setIsGeneratingReport(true);
    try {
      const response = await fetch('/api/research/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: data.message,
        });
        setSelectedReport(data.report);
        fetchReports();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate research report');
      }
    } catch (error) {
      console.error('Error generating research report:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to generate research report',
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Research Manager</h2>
        <Button onClick={() => setIsCreatingRequest(!isCreatingRequest)}>
          {isCreatingRequest ? 'Cancel' : 'New Research Request'}
        </Button>
      </div>

      {/* Create Research Request Form */}
      {isCreatingRequest && (
        <Card>
          <CardHeader>
            <CardTitle>Create Research Request</CardTitle>
            <CardDescription>
              Create a new research request that will be processed after daily context updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newRequest.title}
                onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                placeholder="Enter research title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newRequest.description}
                onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                placeholder="Describe what you want to research"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={newRequest.priority}
                onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') =>
                  setNewRequest({ ...newRequest, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={createRequest} disabled={isCreatingRequest}>
                Create Request
              </Button>
              <Button variant="outline" onClick={() => setIsCreatingRequest(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Research Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Research Requests</CardTitle>
            <CardDescription>Your pending and active research requests</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-muted-foreground">No research requests found.</p>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{request.title}</h3>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(request.priority)}>
                          {request.priority}
                        </Badge>
                        <Badge className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{request.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Created: {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                      {request.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => generateReport(request.id)}
                          disabled={isGeneratingReport}
                        >
                          {isGeneratingReport && selectedRequestId === request.id
                            ? 'Generating...'
                            : 'Generate Report'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Research Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Research Reports</CardTitle>
            <CardDescription>Generated research reports</CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-muted-foreground">No research reports found.</p>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{report.title}</h3>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Created: {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                      {report.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          Completed: {new Date(report.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Selected Report Detail */}
      {selectedReport && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedReport.title}</CardTitle>
            <CardDescription>Research Report Details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Executive Summary</h3>
              <p className="text-sm">{selectedReport.executiveSummary}</p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Local Knowledge Section</h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{selectedReport.localKnowledgeSection}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Internet Research Section</h3>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{selectedReport.internetResearchSection}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Key Findings</h3>
              <ul className="list-disc list-inside space-y-1">
                {selectedReport.keyFindings.map((finding, index) => (
                  <li key={index} className="text-sm">{finding}</li>
                ))}
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Recommendations</h3>
              <ul className="list-disc list-inside space-y-1">
                {selectedReport.recommendations.map((recommendation, index) => (
                  <li key={index} className="text-sm">{recommendation}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 