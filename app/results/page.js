"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";
import { Button } from "@ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@ui/dialog";
import { Input } from "@ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select";
import { Checkbox } from "@ui/checkbox";
import { Badge } from "@ui/badge";
import { useScrapeStore } from "@/hooks/useScrapeStore";
import { Download, FileText, FileJson, ArrowLeft, Trash2, Eye, ExternalLink, Search, Filter, SortAsc, SortDesc, Grid, List, ChevronLeft, ChevronRight } from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  
  // Table management state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [filterType, setFilterType] = useState("all");
  const [selectedItems, setSelectedItems] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const items = useScrapeStore((s) => s.items);
  const clearItems = useScrapeStore((s) => s.clear);

  useEffect(() => {
    // Check if we have items in the store
    if (Array.isArray(items) && items.length > 0) {
      setResults(items);
      setIsLoading(false);
    } else {
      // Check localStorage as fallback
      const storedData = localStorage.getItem('scrape-store');
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          if (parsed.state && Array.isArray(parsed.state.items) && parsed.state.items.length > 0) {
            setResults(parsed.state.items);
            setIsLoading(false);
          } else {
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error parsing stored data:', error);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }
  }, [items]);

  // Export functions
  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = ['Author', 'Headline', 'Type', 'Text', 'URL', 'Image'];
    const csvData = results.map(item => {
      const source = item?.resharedPost || item;
      const authorName = source?.authorName || (source?.author?.firstName && source?.author?.lastName ? `${source.author.firstName} ${source.author.lastName}` : "");
      const authorHeadline = source?.authorHeadline || source?.author?.occupation || "";
      const type = source?.type || source?.contentType || "";
      const text = (source?.text || "").toString().replace(/"/g, '""');
      const url = source?.url || source?.shareUrl || source?.postUrl || "";
      const image = (Array.isArray(source?.images) && source.images[0]) || source?.thumbnail || source?.authorProfilePicture || "";
      
      return [
        `"${authorName}"`,
        `"${authorHeadline}"`,
        `"${type}"`,
        `"${text}"`,
        `"${url}"`,
        `"${image}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `linkedin-scrape-results-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (results.length === 0) return;

    const jsonData = {
      exportDate: new Date().toISOString(),
      totalResults: results.length,
      results: results.map(item => {
        const source = item?.resharedPost || item;
        return {
          author: {
            name: source?.authorName || (source?.author?.firstName && source?.author?.lastName ? `${source.author.firstName} ${source.author.lastName}` : ""),
            headline: source?.authorHeadline || source?.author?.occupation || "",
            profilePicture: source?.authorProfilePicture || ""
          },
          content: {
            type: source?.type || source?.contentType || "",
            text: source?.text || "",
            url: source?.url || source?.shareUrl || source?.postUrl || "",
            images: Array.isArray(source?.images) ? source.images : (source?.thumbnail ? [source.thumbnail] : [])
          },
          engagement: {
            likes: source?.numLikes || 0,
            comments: source?.numComments || 0,
            shares: source?.numShares || 0
          },
          metadata: {
            postedAt: source?.postedAtISO || "",
            timeSincePosted: source?.timeSincePosted || ""
          }
        };
      })
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `linkedin-scrape-results-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearResults = () => {
    clearItems();
    setResults([]);
    localStorage.removeItem('scrape-store');
  };

  const openTextViewer = (post) => {
    setSelectedPost(post);
    setIsTextModalOpen(true);
  };

  // Group results by source URL
  const groupedResults = results.reduce((groups, item) => {
    const sourceUrl = item?.sourceUrl || 'Unknown Source';
    if (!groups[sourceUrl]) {
      groups[sourceUrl] = [];
    }
    groups[sourceUrl].push(item);
    return groups;
  }, {});

  // Get source URLs for display
  const sourceUrls = Object.keys(groupedResults);

  // Filter and sort function for individual groups
  const filterAndSortGroup = (groupItems) => {
    return groupItems
      .filter((item) => {
        const source = item?.resharedPost || item;
        const authorName = source?.authorName || (source?.author?.firstName && source?.author?.lastName ? `${source.author.firstName} ${source.author.lastName}` : "");
        const text = source?.text || "";
        const type = source?.type || source?.contentType || "";
        
        // Search filter
        const matchesSearch = searchTerm === "" || 
          authorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          type.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Type filter
        const matchesType = filterType === "all" || type.toLowerCase() === filterType.toLowerCase();
        
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        if (!sortField) return 0;
        
        const sourceA = a?.resharedPost || a;
        const sourceB = b?.resharedPost || b;
        
        let valueA, valueB;
        
        switch (sortField) {
          case "author":
            valueA = sourceA?.authorName || (sourceA?.author?.firstName && sourceA?.author?.lastName ? `${sourceA.author.firstName} ${sourceA.author.lastName}` : "");
            valueB = sourceB?.authorName || (sourceB?.author?.firstName && sourceB?.author?.lastName ? `${sourceB.author.firstName} ${sourceB.author.lastName}` : "");
            break;
          case "type":
            valueA = sourceA?.type || sourceA?.contentType || "";
            valueB = sourceB?.type || sourceB?.contentType || "";
            break;
          case "text":
            valueA = sourceA?.text || "";
            valueB = sourceB?.text || "";
            break;
          case "likes":
            valueA = sourceA?.numLikes || 0;
            valueB = sourceB?.numLikes || 0;
            break;
          case "date":
            valueA = new Date(sourceA?.postedAtISO || 0);
            valueB = new Date(sourceB?.postedAtISO || 0);
            break;
          default:
            return 0;
        }
        
        if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
        if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  };

  // Apply filtering and sorting to all groups
  const filteredGroupedResults = {};
  let totalFilteredItems = 0;
  
  sourceUrls.forEach(sourceUrl => {
    const filteredGroup = filterAndSortGroup(groupedResults[sourceUrl]);
    if (filteredGroup.length > 0) {
      filteredGroupedResults[sourceUrl] = filteredGroup;
      totalFilteredItems += filteredGroup.length;
    }
  });

  // Pagination for grouped results
  const totalPages = Math.ceil(totalFilteredItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Get paginated results from grouped data
  const getPaginatedGroupedResults = () => {
    const allItems = [];
    Object.entries(filteredGroupedResults).forEach(([sourceUrl, items]) => {
      items.forEach(item => {
        allItems.push({ ...item, sourceUrl });
      });
    });
    return allItems.slice(startIndex, endIndex);
  };

  const paginatedResults = getPaginatedGroupedResults();

  // Get unique types for filter
  const uniqueTypes = [...new Set(results.map(item => {
    const source = item?.resharedPost || item;
    return source?.type || source?.contentType || "";
  }).filter(Boolean))];

  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Handle selection
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedItems(paginatedResults.map((_, index) => startIndex + index));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (index, checked) => {
    const actualIndex = startIndex + index;
    if (checked) {
      setSelectedItems([...selectedItems, actualIndex]);
    } else {
      setSelectedItems(selectedItems.filter(i => i !== actualIndex));
    }
  };

  // Bulk actions
  const handleBulkDelete = () => {
    const indicesToRemove = selectedItems.sort((a, b) => b - a);
    const newResults = [...results];
    indicesToRemove.forEach(index => {
      newResults.splice(index, 1);
    });
    setResults(newResults);
    setSelectedItems([]);
  };

  const handleBulkExport = () => {
    const selectedResults = selectedItems.map(index => results[index]).filter(Boolean);
    if (selectedResults.length === 0) return;
    
    // Use existing export logic but with selected results
    const headers = ['Author', 'Headline', 'Type', 'Text', 'URL', 'Image'];
    const csvData = selectedResults.map(item => {
      const source = item?.resharedPost || item;
      const authorName = source?.authorName || (source?.author?.firstName && source?.author?.lastName ? `${source.author.firstName} ${source.author.lastName}` : "");
      const authorHeadline = source?.authorHeadline || source?.author?.occupation || "";
      const type = source?.type || source?.contentType || "";
      const text = (source?.text || "").toString().replace(/"/g, '""');
      const url = source?.url || source?.shareUrl || source?.postUrl || "";
      const image = (Array.isArray(source?.images) && source.images[0]) || source?.thumbnail || source?.authorProfilePicture || "";
      
      return [
        `"${authorName}"`,
        `"${authorHeadline}"`,
        `"${type}"`,
        `"${text}"`,
        `"${url}"`,
        `"${image}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `linkedin-selected-results-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="space-y-4 mb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-2xl font-semibold">
              Results ({totalFilteredItems} of {results.length})
            </h1>
          </div>
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={clearResults}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToCSV} className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Export All as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToJSON} className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    Export All as JSON
                  </DropdownMenuItem>
                  {selectedItems.length > 0 && (
                    <>
                      <DropdownMenuItem onClick={handleBulkExport} className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Export Selected ({selectedItems.length})
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>


        {/* Search and Filters */}
        {results.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">per page</span>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm font-medium">
              {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkExport}
              className="text-blue-600 hover:text-blue-700"
            >
              <Download className="h-4 w-4 mr-1" />
              Export Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedItems([])}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">Loading results...</span>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-sm text-muted-foreground mb-4">No results found.</div>
          <Button onClick={() => router.push('/')}>
            Run a new scrape
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(filteredGroupedResults).map(([sourceUrl, groupItems]) => (
            <div key={sourceUrl} className="border rounded-lg">
              {/* Source Header */}
              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h3 className="font-semibold text-sm truncate max-w-md" title={sourceUrl}>
                      {sourceUrl.includes('linkedin.com/company/') ? 
                        sourceUrl.split('/company/')[1]?.split('/')[0]?.replace(/-/g, ' ') || 'Company' :
                       sourceUrl.includes('linkedin.com/in/') ? 
                        sourceUrl.split('/in/')[1]?.split('/')[0]?.replace(/-/g, ' ') || 'Profile' :
                        sourceUrl.split('/').pop() || 'Source'}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Sub-table */}
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={groupItems.length > 0 && groupItems.every((_, idx) => 
                            selectedItems.includes(startIndex + idx)
                          )}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const newSelections = groupItems.map((_, idx) => startIndex + idx);
                              setSelectedItems([...selectedItems, ...newSelections]);
                            } else {
                              const groupIndices = groupItems.map((_, idx) => startIndex + idx);
                              setSelectedItems(selectedItems.filter(i => !groupIndices.includes(i)));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="whitespace-nowrap w-[150px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleSort('author')}
                      >
                        <div className="flex items-center gap-1">
                          Author
                          {sortField === 'author' && (
                            sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[300px]">Text</TableHead>
                      <TableHead 
                        className="whitespace-nowrap w-[100px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center gap-1">
                          Type
                          {sortField === 'type' && (
                            sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[200px]">Headline</TableHead>
                      <TableHead className="whitespace-nowrap w-[200px]">URL</TableHead>
                      <TableHead 
                        className="whitespace-nowrap w-[80px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => handleSort('likes')}
                      >
                        <div className="flex items-center gap-1">
                          Likes
                          {sortField === 'likes' && (
                            sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-[80px]">Image</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupItems.map((item, idx) => {
                      const source = item?.resharedPost || item;
                      const authorName = source?.authorName || (source?.author?.firstName && source?.author?.lastName ? `${source.author.firstName} ${source.author.lastName}` : "—");
                      const authorHeadline = source?.authorHeadline || source?.author?.occupation || "—";
                      const type = source?.type || source?.contentType || "—";
                      const text = (source?.text || "").toString().slice(0, 180);
                      const url = source?.url || source?.shareUrl || source?.postUrl || "";
                      const image = (Array.isArray(source?.images) && source.images[0]) || source?.thumbnail || source?.authorProfilePicture || "";
                      const likes = source?.numLikes || 0;
                      const isSelected = selectedItems.includes(startIndex + idx);
                      
                      return (
                        <TableRow key={`${sourceUrl}-${idx}`} className={isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""}>
                          <TableCell className="w-[50px]">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectItem(idx, checked)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top w-[150px]">
                            <div className="text-sm font-medium truncate" title={authorName || "—"}>
                              {authorName || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="align-top w-[300px]">
                            <div className="space-y-2">
                              <div className="text-sm line-clamp-3" title={text || "—"}>
                                {text || "—"}
                              </div>
                              {text && text.length > 100 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openTextViewer(source)}
                                  className="text-xs h-7 px-2"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View Full Text
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top w-[100px]">
                            <Badge variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top w-[200px]">
                            <div className="text-sm line-clamp-2" title={authorHeadline || "—"}>
                              {authorHeadline || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="align-top w-[200px]">
                            {url ? (
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-blue-600 hover:text-blue-800 text-xs break-all line-clamp-2 block"
                                title={url}
                              >
                                {url.length > 40 ? `${url.substring(0, 40)}...` : url}
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="align-top w-[80px] text-center">
                            {likes > 0 ? (
                              <span className="text-sm font-medium">👍 {likes}</span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="align-top w-[80px]">
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={image} alt="preview" className="w-10 h-10 object-cover rounded" />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {results.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, totalFilteredItems)} of {totalFilteredItems} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {/* Text Viewer Modal */}
      <Dialog open={isTextModalOpen} onOpenChange={setIsTextModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Post Content
            </DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Author Info */}
              <div className="border-b pb-4">
                <div className="flex items-center gap-3">
                  {selectedPost.authorProfilePicture && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={selectedPost.authorProfilePicture} 
                      alt="Author" 
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">
                      {selectedPost.authorName || 
                       (selectedPost.author?.firstName && selectedPost.author?.lastName 
                         ? `${selectedPost.author.firstName} ${selectedPost.author.lastName}` 
                         : "Unknown Author")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedPost.authorHeadline || selectedPost.author?.occupation || "No headline"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Post Type and Date */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  {selectedPost.type || selectedPost.contentType || "Post"}
                </span>
                {selectedPost.postedAtISO && (
                  <span>{new Date(selectedPost.postedAtISO).toLocaleDateString()}</span>
                )}
                {selectedPost.timeSincePosted && (
                  <span>{selectedPost.timeSincePosted}</span>
                )}
              </div>

              {/* Main Content */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Content:</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedPost.text || "No content available"}
                    </p>
                  </div>
                </div>

                {/* Images */}
                {selectedPost.images && Array.isArray(selectedPost.images) && selectedPost.images.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Images:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {selectedPost.images.map((image, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          key={idx}
                          src={image} 
                          alt={`Post image ${idx + 1}`}
                          className="w-full h-32 object-cover rounded"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Engagement Stats */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  {selectedPost.numLikes > 0 && (
                    <span>👍 {selectedPost.numLikes} likes</span>
                  )}
                  {selectedPost.numComments > 0 && (
                    <span>💬 {selectedPost.numComments} comments</span>
                  )}
                  {selectedPost.numShares > 0 && (
                    <span>🔄 {selectedPost.numShares} shares</span>
                  )}
                </div>

                {/* URL Link */}
                {(selectedPost.url || selectedPost.shareUrl || selectedPost.postUrl) && (
                  <div>
                    <h4 className="font-medium mb-2">Link:</h4>
                    <a 
                      href={selectedPost.url || selectedPost.shareUrl || selectedPost.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm break-all flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {selectedPost.url || selectedPost.shareUrl || selectedPost.postUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


