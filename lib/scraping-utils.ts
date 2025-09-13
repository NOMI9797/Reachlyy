// Utility functions for processing scraped data

export interface ScrapedPost {
  id?: string;
  content?: string;
  text?: string;
  description?: string;
  timestamp?: string;
  date?: string;
  createdAt?: string;
  numLikes?: string | number;
  likes?: string | number;
  likeCount?: string | number;
  numComments?: string | number;
  comments?: string | number;
  commentCount?: string | number;
  numShares?: string | number;
  reposts?: string | number;
  repostCount?: string | number;
  shares?: string | number;
  authorName?: string;
  name?: string;
  authorHeadline?: string;
  headline?: string;
  title?: string;
  authorProfilePicture?: string;
  authorImage?: string;
  profilePicture?: string;
  avatar?: string;
  authorCompany?: string;
  company?: string;
  authorLocation?: string;
  location?: string;
  url?: string;
  link?: string;
  sourceUrl?: string;
}

export interface ExtractedLeadInfo {
  name: string;
  title: string;
  company: string;
  profilePicture: string;
  location?: string;
}

/**
 * Extract lead information from scraped posts
 * Uses multiple posts to get the most complete and accurate information
 */
export function extractLeadInfo(scrapedPosts: ScrapedPost[]): ExtractedLeadInfo {
  if (!scrapedPosts || scrapedPosts.length === 0) {
    return {
      name: "Unknown",
      title: "Unknown",
      company: "Unknown",
      profilePicture: ""
    };
  }

  // Collect all possible values for each field
  const names = new Set<string>();
  const titles = new Set<string>();
  const companies = new Set<string>();
  const profilePictures = new Set<string>();
  const locations = new Set<string>();

  scrapedPosts.forEach(post => {
    // Extract name variations
    if (post.authorName) names.add(post.authorName.trim());
    if (post.name) names.add(post.name.trim());

    // Extract title/headline variations
    if (post.authorHeadline) titles.add(post.authorHeadline.trim());
    if (post.headline) titles.add(post.headline.trim());
    if (post.title) titles.add(post.title.trim());

    // Extract company variations
    if (post.authorCompany) companies.add(post.authorCompany.trim());
    if (post.company) companies.add(post.company.trim());

    // Extract profile picture variations
    if (post.authorProfilePicture) profilePictures.add(post.authorProfilePicture.trim());
    if (post.authorImage) profilePictures.add(post.authorImage.trim());
    if (post.profilePicture) profilePictures.add(post.profilePicture.trim());
    if (post.avatar) profilePictures.add(post.avatar.trim());

    // Extract location variations
    if (post.authorLocation) locations.add(post.authorLocation.trim());
    if (post.location) locations.add(post.location.trim());
  });

  // Remove empty strings and "Unknown" values
  const cleanSet = (set: Set<string>) => {
    const filtered = Array.from(set).filter(val => 
      val && 
      val !== "Unknown" && 
      val !== "unknown" && 
      val.length > 0
    );
    return filtered;
  };

  const cleanNames = cleanSet(names);
  const cleanTitles = cleanSet(titles);
  const cleanCompanies = cleanSet(companies);
  const cleanProfilePictures = cleanSet(profilePictures);
  const cleanLocations = cleanSet(locations);

  // Choose the best values (most common or first valid)
  const bestName = cleanNames.length > 0 ? cleanNames[0] : "Unknown";
  const bestTitle = cleanTitles.length > 0 ? cleanTitles[0] : "Unknown";
  const bestCompany = cleanCompanies.length > 0 ? cleanCompanies[0] : "Unknown";
  const bestProfilePicture = cleanProfilePictures.length > 0 ? cleanProfilePictures[0] : "";
  const bestLocation = cleanLocations.length > 0 ? cleanLocations[0] : undefined;

  return {
    name: bestName,
    title: bestTitle,
    company: bestCompany,
    profilePicture: bestProfilePicture,
    location: bestLocation
  };
}

/**
 * Validate and clean scraped post data
 */
export function cleanScrapedPosts(scrapedPosts: ScrapedPost[]): ScrapedPost[] {
  if (!Array.isArray(scrapedPosts)) {
    return [];
  }

  return scrapedPosts
    .filter(post => post && (post.content || post.text || post.description))
    .map(post => ({
      ...post,
      content: post.content || post.text || post.description || 'No content available',
      timestamp: post.timestamp || post.date || post.createdAt || new Date().toISOString(),
      numLikes: normalizeNumber(post.numLikes || post.likes || post.likeCount),
      numComments: normalizeNumber(post.numComments || post.comments || post.commentCount),
      numShares: normalizeNumber(post.numShares || post.reposts || post.repostCount || post.shares)
    }));
}

/**
 * Normalize number values from scraped data
 */
function normalizeNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return Math.max(0, value);
  if (typeof value === 'string') {
    const parsed = parseInt(value.replace(/[^\d]/g, ''));
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  return 0;
}

/**
 * Calculate engagement score for a post
 */
export function calculateEngagement(post: ScrapedPost): number {
  const likes = normalizeNumber(post.numLikes || post.likes || post.likeCount);
  const comments = normalizeNumber(post.numComments || post.comments || post.commentCount);
  const shares = normalizeNumber(post.numShares || post.reposts || post.repostCount || post.shares);
  
  // Weighted engagement calculation
  return likes + (comments * 2) + (shares * 3);
}

/**
 * Normalize LinkedIn URL for duplicate detection
 */
export function normalizeLinkedInUrl(url: string): string {
  if (!url) return '';
  
  // Convert to lowercase and trim
  let normalized = url.toLowerCase().trim();
  
  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');
  
  // Ensure it has the proper LinkedIn domain
  if (!normalized.includes('linkedin.com')) {
    return normalized;
  }
  
  // Handle different LinkedIn URL formats
  // Convert mobile URLs to standard format
  normalized = normalized.replace('m.linkedin.com', 'www.linkedin.com');
  
  // Remove query parameters and fragments first
  normalized = normalized.split('?')[0].split('#')[0];
  
  // Remove trailing slashes again after query removal
  normalized = normalized.replace(/\/+$/, '');
  
  // Normalize protocol and www
  if (normalized.startsWith('http://')) {
    normalized = normalized.replace('http://', 'https://');
  }
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }
  
  // Ensure consistent www format
  if (normalized.includes('linkedin.com') && !normalized.includes('www.linkedin.com')) {
    normalized = normalized.replace('linkedin.com', 'www.linkedin.com');
  }
  
  return normalized;
}

/**
 * Remove duplicate URLs from an array
 */
export function removeDuplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const url of urls) {
    const normalized = normalizeLinkedInUrl(url);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      unique.push(url); // Keep original format for display
    }
  }
  
  return unique;
}

/**
 * Check if a URL already exists in a list of URLs
 */
export function isUrlDuplicate(url: string, existingUrls: string[]): boolean {
  const normalizedUrl = normalizeLinkedInUrl(url);
  const normalizedExisting = existingUrls.map(normalizeLinkedInUrl);
  return normalizedExisting.includes(normalizedUrl);
}
