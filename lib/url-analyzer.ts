/**
 * URL Analyzer Service
 * Analyzes websites and extracts metadata for app generation
 */

export interface WebsiteMetadata {
  url: string
  title: string
  description: string
  icon: string
  primaryColor: string
  hasAPI: boolean
  isResponsive: boolean
  contentType: 'static' | 'dynamic' | 'spa'
  frameworks: string[]
  screenshots: string[]
}

export interface AnalysisResult {
  success: boolean
  metadata: WebsiteMetadata | null
  error?: string
}

/**
 * Analyzes a URL and extracts metadata for app generation
 */
export async function analyzeURL(url: string): Promise<AnalysisResult> {
  try {
    // Validate URL
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        success: false,
        metadata: null,
        error: 'Invalid URL protocol. Only HTTP and HTTPS are supported.'
      }
    }

    // Fetch and analyze the website
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MornScience-Bot/1.0; +https://mornscience.biz)'
      },
      redirect: 'follow'
    })

    if (!response.ok) {
      return {
        success: false,
        metadata: null,
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`
      }
    }

    const html = await response.text()
    
    // Extract metadata from HTML
    const metadata = extractMetadataFromHTML(html, url)

    return {
      success: true,
      metadata
    }
  } catch (error) {
    console.error('Error analyzing URL:', error)
    return {
      success: false,
      metadata: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Extracts metadata from HTML content
 */
function extractMetadataFromHTML(html: string, url: string): WebsiteMetadata {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const description = descMatch ? descMatch[1].trim() : `Native app for ${title}`

  // Extract favicon/icon
  const iconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i)
  let icon = iconMatch ? iconMatch[1] : '/favicon.ico'
  
  // Make icon URL absolute
  if (icon && !icon.startsWith('http')) {
    const baseUrl = new URL(url)
    icon = new URL(icon, baseUrl.origin).toString()
  }

  // Detect primary color from meta theme-color
  const colorMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
  const primaryColor = colorMatch ? colorMatch[1] : '#007AFF'

  // Detect if it's a SPA (Single Page Application)
  const isSPA = html.includes('react') || html.includes('vue') || html.includes('angular') || 
                html.includes('__NEXT_DATA__') || html.includes('nuxt')

  // Detect frameworks
  const frameworks: string[] = []
  if (html.includes('react')) frameworks.push('React')
  if (html.includes('__NEXT_DATA__')) frameworks.push('Next.js')
  if (html.includes('vue')) frameworks.push('Vue')
  if (html.includes('nuxt')) frameworks.push('Nuxt')
  if (html.includes('angular')) frameworks.push('Angular')

  // Check if responsive
  const isResponsive = html.includes('viewport') && html.includes('width=device-width')

  // Detect if it has API endpoints
  const hasAPI = html.includes('/api/') || html.includes('graphql') || html.includes('rest')

  return {
    url,
    title,
    description,
    icon,
    primaryColor,
    hasAPI,
    isResponsive,
    contentType: isSPA ? 'spa' : hasAPI ? 'dynamic' : 'static',
    frameworks,
    screenshots: [] // Would be populated by actual screenshot service
  }
}

/**
 * Validates if a URL is accessible and suitable for app conversion
 */
export async function validateURL(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parsedUrl = new URL(url)
    
    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are supported' }
    }

    // Try to fetch with a HEAD request first (faster)
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MornScience-Bot/1.0)'
      }
    })

    if (!response.ok) {
      return { valid: false, error: `URL returned status ${response.status}` }
    }

    return { valid: true }
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid URL'
    }
  }
}

