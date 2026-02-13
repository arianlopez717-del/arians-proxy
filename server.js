const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for your frontend
app.use(cors());
app.use(express.json());

// Rewrite URLs in HTML to point back to proxy
function rewriteHTML(html, baseUrl) {
  const $ = cheerio.load(html);
  
  // Rewrite all links to go through proxy
  $('a').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      const absoluteUrl = new URL(href, baseUrl).href;
      $(elem).attr('href', '#');
      $(elem).attr('data-proxy-url', absoluteUrl);
      $(elem).addClass('proxy-link');
    }
  });
  
  // Rewrite forms to submit through proxy
  $('form').each((i, elem) => {
    const action = $(elem).attr('action');
    if (action) {
      const absoluteUrl = new URL(action, baseUrl).href;
      $(elem).attr('action', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
    }
  });
  
  // Fix images, scripts, stylesheets
  $('img').each((i, elem) => {
    const src = $(elem).attr('src');
    if (src && !src.startsWith('data:')) {
      $(elem).attr('src', new URL(src, baseUrl).href);
    }
  });
  
  $('link[rel="stylesheet"]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      $(elem).attr('href', new URL(href, baseUrl).href);
    }
  });
  
  $('script').each((i, elem) => {
    const src = $(elem).attr('src');
    if (src) {
      $(elem).attr('src', new URL(src, baseUrl).href);
    }
  });
  
  // Inject script to handle clicks
  const injectedScript = `
    <script>
      document.addEventListener('click', function(e) {
        const link = e.target.closest('a.proxy-link');
        if (link) {
          e.preventDefault();
          const url = link.getAttribute('data-proxy-url');
          if (url) {
            window.parent.postMessage({
              type: 'proxy-navigate',
              url: url
            }, '*');
          }
        }
      }, true);
    </script>
  `;
  
  $('body').append(injectedScript);
  
  return $.html();
}

// Main proxy endpoint
app.get('/api/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate URL
    let url;
    try {
      url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    // Fetch the page
    const response = await axios.get(url.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
      timeout: 10000,
    });
    
    // Get content type
    const contentType = response.headers['content-type'] || '';
    
    // If HTML, rewrite it
    if (contentType.includes('text/html')) {
      const rewrittenHTML = rewriteHTML(response.data, url.href);
      res.setHeader('Content-Type', 'text/html');
      res.send(rewrittenHTML);
    } else {
      // Pass through other content types
      res.setHeader('Content-Type', contentType);
      res.send(response.data);
    }
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json({ 
        error: `Failed to fetch: ${error.response.statusText}` 
      });
    } else if (error.code === 'ENOTFOUND') {
      res.status(404).json({ error: 'Website not found' });
    } else if (error.code === 'ETIMEDOUT') {
      res.status(408).json({ error: 'Request timeout' });
    } else {
      res.status(500).json({ error: 'Failed to fetch the page' });
    }
  }
});

// Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const engine = req.query.engine || 'duckduckgo';
    
    let searchUrl;
    switch(engine) {
      case 'google':
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        break;
      case 'bing':
        searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        break;
      default:
        searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    }
    
    res.redirect(`/api/proxy?url=${encodeURIComponent(searchUrl)}`);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`📡 Access at: http://localhost:${PORT}`);
});
