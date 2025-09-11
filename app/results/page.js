"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";
import { useScrapeStore } from "@/hooks/useScrapeStore";

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState([]);
  const items = useScrapeStore((s) => s.items);

  useEffect(() => {
    if (Array.isArray(items) && items.length > 0) {
      setResults(items);
    }
  }, [items]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Results</h1>
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


