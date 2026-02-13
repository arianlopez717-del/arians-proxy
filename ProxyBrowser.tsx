import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  RefreshCw, 
  Home, 
  ArrowLeft, 
  ArrowRight,
  Search,
  Plus,
  Globe,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Your deployed proxy server URL
const PROXY_SERVER = 'https://arians-proxy.onrender.com';

interface Tab {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
}

export default function ProxyBrowser() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', url: '', title: 'New Tab', isLoading: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [searchInput, setSearchInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const searchEngines = {
    google: 'google',
    duckduckgo: 'duckduckgo',
    bing: 'bing',
  };
  const [searchEngine, setSearchEngine] = useState<keyof typeof searchEngines>('duckduckgo');

  // Check if input is a URL or search query
  const isUrl = (input: string): boolean => {
    try {
      new URL(input.startsWith('http') ? input : `https://${input}`);
      return input.includes('.') && !input.includes(' ');
    } catch {
      return false;
    }
  };

  // Build proxy URL
  const buildProxyUrl = (url: string): string => {
    if (!url) return '';
    
    // If it's a search query
    if (!isUrl(url)) {
      return `${PROXY_SERVER}/api/search?q=${encodeURIComponent(url)}&engine=${searchEngine}`;
    }
    
    // If it's a URL
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    return `${PROXY_SERVER}/api/proxy?url=${encodeURIComponent(formattedUrl)}`;
  };

  // Navigate to URL
  const navigateTo = (url: string) => {
    if (!activeTab || !url) return;
    
    setError('');
    const proxyUrl = buildProxyUrl(url);
    
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, url: proxyUrl, isLoading: true }
        : tab
    ));
    
    setSearchInput(url);
    
    // Add to history
    setHistory([...history.slice(0, historyIndex + 1), url]);
    setHistoryIndex(historyIndex + 1);
  };

  // Handle form submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(searchInput);
  };

  // Listen for navigation from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'proxy-navigate') {
        navigateTo(event.data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [historyIndex, history]);

  // Create new tab
  const createNewTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      url: '',
      title: 'New Tab',
      isLoading: false
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setSearchInput('');
    setError('');
  };

  // Close tab
  const closeTab = (tabId: string) => {
    if (tabs.length === 1) {
      setTabs([{ id: Date.now().toString(), url: '', title: 'New Tab', isLoading: false }]);
      setSearchInput('');
      setError('');
      return;
    }
    
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    if (tabId === activeTabId) {
      const newActiveTab = newTabs[Math.max(0, tabIndex - 1)];
      setActiveTabId(newActiveTab.id);
      setSearchInput(history[historyIndex] || '');
    }
  };

  // Navigation
  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevUrl = history[newIndex];
      setHistoryIndex(newIndex);
      setSearchInput(prevUrl);
      
      const proxyUrl = buildProxyUrl(prevUrl);
      setTabs(tabs.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, url: proxyUrl, isLoading: true }
          : tab
      ));
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextUrl = history[newIndex];
      setHistoryIndex(newIndex);
      setSearchInput(nextUrl);
      
      const proxyUrl = buildProxyUrl(nextUrl);
      setTabs(tabs.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, url: proxyUrl, isLoading: true }
          : tab
      ));
    }
  };

  const refresh = () => {
    if (!activeTab?.url) return;
    
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, isLoading: true }
        : tab
    ));
    
    if (iframeRef.current) {
      iframeRef.current.src = activeTab.url;
    }
  };

  const goHome = () => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { id: tab.id, url: '', title: 'New Tab', isLoading: false }
        : tab
    ));
    setSearchInput('');
    setError('');
  };

  const handleIframeLoad = () => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, isLoading: false }
        : tab
    ));
  };

  const handleIframeError = () => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, isLoading: false }
        : tab
    ));
    setError('Failed to load page. The site might be blocking proxies or the proxy server is down.');
  };

  // Update input when switching tabs
  useEffect(() => {
    if (activeTab && historyIndex >= 0) {
      setSearchInput(history[historyIndex] || '');
    }
  }, [activeTabId]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-2 pt-2 bg-muted/50 border-b">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`
              group flex items-center gap-2 px-3 py-2 rounded-t-md cursor-pointer
              min-w-[120px] max-w-[200px] transition-colors
              ${tab.id === activeTabId 
                ? 'bg-background border-t border-x' 
                : 'bg-muted/30 hover:bg-muted/60'}
            `}
          >
            <Globe className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{tab.title}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={createNewTab}
          className="p-2 hover:bg-muted rounded-md transition-colors"
          title="New tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-card border-b">
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-30"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-30"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={refresh}
            disabled={!activeTab?.url}
            className="p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-30"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={goHome}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-background border rounded-lg focus-within:ring-2 focus-within:ring-primary">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search or enter URL"
              className="flex-1 bg-transparent outline-none text-sm"
              autoFocus
            />
            {activeTab?.isLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Go
          </button>
        </form>

        <select
          value={searchEngine}
          onChange={(e) => setSearchEngine(e.target.value as keyof typeof searchEngines)}
          className="px-3 py-2 bg-background border rounded-lg text-sm cursor-pointer hover:bg-accent"
        >
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="google">Google</option>
          <option value="bing">Bing</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 relative bg-muted">
        {activeTab?.url ? (
          <iframe
            ref={iframeRef}
            src={activeTab.url}
            className="w-full h-full border-0"
            title={activeTab.title}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="max-w-2xl w-full text-center space-y-8">
              <div>
                <h1 className="text-4xl font-bold mb-4">School Proxy Browser</h1>
                <p className="text-muted-foreground">
                  Search or enter any URL - everything stays embedded
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'YouTube', url: 'youtube.com' },
                  { name: 'Reddit', url: 'reddit.com' },
                  { name: 'Wikipedia', url: 'wikipedia.org' },
                  { name: 'Twitter', url: 'twitter.com' },
                ].map(link => (
                  <button
                    key={link.name}
                    onClick={() => navigateTo(link.url)}
                    className="p-6 bg-card border rounded-lg hover:bg-accent transition-colors text-center"
                  >
                    <Globe className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <div className="font-medium">{link.name}</div>
                  </button>
                ))}
              </div>

              <div className="text-xs text-muted-foreground bg-muted p-4 rounded-lg">
                <p>⚡ Powered by server-side proxy - all navigation stays in this window</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
