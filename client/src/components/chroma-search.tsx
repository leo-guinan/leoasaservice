import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Loader2, Search, MessageSquare, Link, FileText } from 'lucide-react';

interface SearchResult {
  ids: string[][];
  documents: string[][];
  metadatas: any[][];
  distances: number[][];
}

interface AllSearchResults {
  chatMessages: SearchResult;
  urlContent: SearchResult;
  urlAnalysis: SearchResult;
}

export function ChromaSearch() {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AllSearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchAll = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/all?query=${encodeURIComponent(query)}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const searchChat = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/chat?query=${encodeURIComponent(query)}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults({ chatMessages: data, urlContent: { ids: [], documents: [], metadatas: [], distances: [] }, urlAnalysis: { ids: [], documents: [], metadatas: [], distances: [] } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const searchUrls = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/urls?query=${encodeURIComponent(query)}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults({ chatMessages: { ids: [], documents: [], metadatas: [], distances: [] }, urlContent: data, urlAnalysis: { ids: [], documents: [], metadatas: [], distances: [] } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const searchAnalysis = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/analysis?query=${encodeURIComponent(query)}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResults({ chatMessages: { ids: [], documents: [], metadatas: [], distances: [] }, urlContent: { ids: [], documents: [], metadatas: [], distances: [] }, urlAnalysis: data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const renderResults = (searchResult: SearchResult, type: string) => {
    if (!searchResult.ids?.[0]?.length) {
      return <p className="text-muted-foreground">No results found</p>;
    }

    return (
      <div className="space-y-4">
        {searchResult.ids[0].map((id, index) => (
          <Card key={id} className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {type === 'chatMessages' && <MessageSquare className="w-3 h-3 mr-1" />}
                      {type === 'urlContent' && <Link className="w-3 h-3 mr-1" />}
                      {type === 'urlAnalysis' && <FileText className="w-3 h-3 mr-1" />}
                      {type}
                    </Badge>
                    {searchResult.distances?.[0]?.[index] && (
                      <Badge variant="outline" className="text-xs">
                        Score: {(1 - searchResult.distances[0][index]).toFixed(3)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {searchResult.metadatas?.[0]?.[index]?.timestamp && 
                      new Date(searchResult.metadatas[0][index].timestamp).toLocaleDateString()}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {searchResult.documents[0][index]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            ChromaDB Vector Search
          </CardTitle>
          <CardDescription>
            Search through your chat messages, URL content, and URL analysis using semantic search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Enter your search query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchAll()}
              />
            </div>
            <div className="w-24">
              <Input
                type="number"
                placeholder="Limit"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 5)}
                min="1"
                max="20"
              />
            </div>
            <Button onClick={searchAll} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search All
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={searchChat} disabled={loading || !query.trim()}>
              Chat Messages
            </Button>
            <Button variant="outline" size="sm" onClick={searchUrls} disabled={loading || !query.trim()}>
              URL Content
            </Button>
            <Button variant="outline" size="sm" onClick={searchAnalysis} disabled={loading || !query.trim()}>
              URL Analysis
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Results</TabsTrigger>
            <TabsTrigger value="chat">Chat Messages</TabsTrigger>
            <TabsTrigger value="urls">URL Content</TabsTrigger>
            <TabsTrigger value="analysis">URL Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <div className="grid gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Chat Messages ({results.chatMessages.ids?.[0]?.length || 0})
                </h3>
                {renderResults(results.chatMessages, 'chatMessages')}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  URL Content ({results.urlContent.ids?.[0]?.length || 0})
                </h3>
                {renderResults(results.urlContent, 'urlContent')}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  URL Analysis ({results.urlAnalysis.ids?.[0]?.length || 0})
                </h3>
                {renderResults(results.urlAnalysis, 'urlAnalysis')}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="chat">
            {renderResults(results.chatMessages, 'chatMessages')}
          </TabsContent>

          <TabsContent value="urls">
            {renderResults(results.urlContent, 'urlContent')}
          </TabsContent>

          <TabsContent value="analysis">
            {renderResults(results.urlAnalysis, 'urlAnalysis')}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
} 