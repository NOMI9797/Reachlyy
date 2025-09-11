"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";
import { Button } from "@ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui/dropdown-menu";
import { useScrapeStore } from "@/hooks/useScrapeStore";
import { Download, FileText, FileJson } from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState([]);
  const items = useScrapeStore((s) => s.items);

  useEffect(() => {
    if (Array.isArray(items) && items.length > 0) {
      setResults(items);
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Results ({results.length})</h1>
        {results.length > 0 && (
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
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToJSON} className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {results.length === 0 ? (
        <div className="text-sm text-muted-foreground">No results found. Please run a scrape first.</div>
      ) : (
        <div className="overflow-auto border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Author</TableHead>
                <TableHead className="whitespace-nowrap">Headline</TableHead>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Text</TableHead>
                <TableHead className="whitespace-nowrap">URL</TableHead>
                <TableHead className="whitespace-nowrap">Image</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item, idx) => {
                const source = item?.resharedPost || item;
                const authorName = source?.authorName || (source?.author?.firstName && source?.author?.lastName ? `${source.author.firstName} ${source.author.lastName}` : "—");
                const authorHeadline = source?.authorHeadline || source?.author?.occupation || "—";
                const type = source?.type || source?.contentType || "—";
                const text = (source?.text || "").toString().slice(0, 180);
                const url = source?.url || source?.shareUrl || source?.postUrl || "";
                const image = (Array.isArray(source?.images) && source.images[0]) || source?.thumbnail || source?.authorProfilePicture || "";
                return (
                  <TableRow key={idx}>
                    <TableCell className="whitespace-nowrap align-top">{authorName || "—"}</TableCell>
                    <TableCell className="align-top">{authorHeadline || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap align-top">{type}</TableCell>
                    <TableCell className="align-top">{text || "—"}</TableCell>
                    <TableCell className="align-top max-w-[260px]">
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-words">
                          {url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="preview" className="w-12 h-12 object-cover rounded" />
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
      )}
    </div>
  );
}


