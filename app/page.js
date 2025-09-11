"use client";
import { useState } from "react";
import { Button } from "@ui/button";
import { Textarea } from "@ui/textarea";
import { Label } from "@ui/label";
import { Alert, AlertTitle, AlertDescription } from "@ui/alert";
import { Switch } from "@ui/switch";
import { Input } from "@ui/input";
import { Checkbox } from "@ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/card";
import { Separator } from "@ui/separator";
import { useRouter } from "next/navigation";
import { useScrapeStore } from "@/hooks/useScrapeStore";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const setItems = useScrapeStore((s) => s.setItems);

  const form = useForm({
    defaultValues: {
      urlsText: "",
      deepScrape: false,
      limitPerSource: 2,
      rawData: false,
    },
  });

  const onSubmit = async (values) => {
    setError("");
    setResults([]);
    setIsLoading(true);
    try {
      const urls = values.urlsText
        .split(/\n|,/)
        .map((u) => u.trim())
        .filter(Boolean);
      if (urls.length === 0) {
        setError("Please enter at least one URL.");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          limitPerSource: Number(values.limitPerSource) || 2,
          deepScrape: !!values.deepScrape,
          rawData: !!values.rawData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }
      const items = Array.isArray(data.items) ? data.items : [];
      setResults(items);
      setItems(items);
      router.push("/results");
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">LinkedIn Scraper</h1>
      </div>
      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>URLs to Scrape</CardTitle>
            <CardDescription>Enter LinkedIn URLs (comma or newline separated)</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="urlsText"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      className="min-h-[140px]"
                      placeholder="https://www.linkedin.com/company/amazon\nhttps://www.linkedin.com/search/results/content/?datePosted=%22past-24h%22&keywords=ai"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="deepScrape">Deep Scrape</Label>
                  <p className="text-sm text-muted-foreground">Enable deep scraping for more detailed data</p>
                </div>
                <FormField
                  control={form.control}
                  name="deepScrape"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch id="deepScrape" checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
        </div>

              <div className="space-y-2">
                <Label htmlFor="limitPerSource">Limit Per Source</Label>
                <FormField
                  control={form.control}
                  name="limitPerSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          id="limitPerSource"
                          type="number"
                          min="1"
                          max="100"
                          className="w-32"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Maximum number of items to scrape per URL</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="rawData"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox id="rawData" checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <Label htmlFor="rawData">Raw Data</Label>
                      <FormDescription>Include raw HTML data in results</FormDescription>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Scraping..." : "Run Scraper"}
        </Button>
      </form>
      </Form>

      {error && (
        <Alert className="mt-4" variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Results</h2>
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
                  const authorName = source?.authorName || source?.author?.firstName && source?.author?.lastName ? `${source.author.firstName} ${source.author.lastName}` : "—";
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
        </div>
      )}
    </div>
  );
}


