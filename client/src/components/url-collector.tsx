import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import AddUrlModal from "./add-url-modal";
import type { Url } from "@shared/schema";

export default function UrlCollector() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const { getAuthHeaders } = useAuth();

  const { data: urls = [], isLoading } = useQuery<Url[]>({
    queryKey: ["/api/urls"],
    queryFn: async () => {
      const response = await fetch("/api/urls", {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch URLs");
      }
      return response.json();
    },
  });

  const deleteUrlMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/urls/${id}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to delete URL");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/urls"] });
      toast({
        title: "URL deleted",
        description: "The URL has been removed from your collection.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete URL. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUrlClick = (url: string) => {
    window.open(url, "_blank");
  };

  const handleDeleteUrl = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteUrlMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="w-1/4 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded animate-pulse mb-4"></div>
          <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 p-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mb-3 p-3 bg-slate-100 rounded-lg animate-pulse">
              <div className="h-4 bg-slate-200 rounded mb-2"></div>
              <div className="h-3 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-1/4 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Reference URLs</h2>
            <Button
              onClick={() => setIsModalOpen(true)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus size={16} className="mr-1" />
              Add URL
            </Button>
          </div>
          <div className="text-sm text-slate-600 mb-2">{urls.length} URLs saved</div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {urls.length === 0 ? (
            <div className="text-center text-slate-500 mt-8">
              <div className="text-lg mb-2">No URLs saved yet</div>
              <div className="text-sm">Click "Add URL" to start building your reference collection</div>
            </div>
          ) : (
            urls.map((url) => (
              <div
                key={url.id}
                className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors group cursor-pointer"
                onClick={() => handleUrlClick(url.url)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-slate-800 truncate text-sm">
                        {url.title || url.url}
                      </h3>
                      <ExternalLink size={12} className="text-slate-400 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-slate-600 truncate">{url.url}</p>
                    {url.notes && (
                      <p className="text-xs text-slate-500 mt-1">{url.notes}</p>
                    )}
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 ml-2 transition-opacity p-1"
                    onClick={(e) => handleDeleteUrl(e, url.id)}
                    disabled={deleteUrlMutation.isPending}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddUrlModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}
