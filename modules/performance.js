// Performance optimization utilities for MindKeep
class VirtualList {
    constructor(container, itemHeight = 60, bufferSize = 5) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.bufferSize = bufferSize;
        this.items = [];
        this.visibleItems = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.renderFunction = null;
        
        this.setupScrollListener();
    }

    setItems(items) {
        this.items = items;
        this.updateVisibleItems();
    }

    setRenderFunction(fn) {
        this.renderFunction = fn;
    }

    setupScrollListener() {
        this.container.addEventListener('scroll', () => {
            this.scrollTop = this.container.scrollTop;
            this.updateVisibleItems();
        });

        // Update container height on resize
        const resizeObserver = new ResizeObserver(() => {
            this.containerHeight = this.container.clientHeight;
            this.updateVisibleItems();
        });
        resizeObserver.observe(this.container);
    }

    updateVisibleItems() {
        if (!this.items.length || !this.renderFunction) return;

        this.containerHeight = this.container.clientHeight;
        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.floor((this.scrollTop + this.containerHeight) / this.itemHeight) + this.bufferSize
        );

        this.visibleItems = this.items.slice(startIndex, endIndex + 1);
        this.render(startIndex);
    }

    render(startIndex) {
        const totalHeight = this.items.length * this.itemHeight;
        const offsetY = startIndex * this.itemHeight;

        this.container.innerHTML = `
            <div style="height: ${totalHeight}px; position: relative;">
                <div style="transform: translateY(${offsetY}px);">
                    ${this.visibleItems.map(item => this.renderFunction(item)).join('')}
                </div>
            </div>
        `;
    }
}

// Debounce utility for search and other frequent operations
class Debouncer {
    constructor() {
        this.timeouts = new Map();
    }

    debounce(key, fn, delay = 300) {
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
        }

        const timeout = setTimeout(() => {
            fn();
            this.timeouts.delete(key);
        }, delay);

        this.timeouts.set(key, timeout);
    }

    cancel(key) {
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
            this.timeouts.delete(key);
        }
    }

    cancelAll() {
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts.clear();
    }
}

// Cache manager for frequently accessed data
class CacheManager {
    constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    set(key, value, customTtl = null) {
        const expiry = Date.now() + (customTtl || this.ttl);
        
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, { value, expiry });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    // Clean expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
            }
        }
    }

    // Get cache statistics
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttl: this.ttl
        };
    }
}

// Search index for fast text searching
class SearchIndex {
    constructor() {
        this.index = new Map();
        this.documents = new Map();
    }

    // Add document to index
    addDocument(id, content, metadata = {}) {
        this.documents.set(id, { content, metadata });
        
        // Tokenize and index
        const tokens = this.tokenize(content);
        tokens.forEach(token => {
            if (!this.index.has(token)) {
                this.index.set(token, new Set());
            }
            this.index.get(token).add(id);
        });
    }

    // Remove document from index
    removeDocument(id) {
        const doc = this.documents.get(id);
        if (!doc) return;

        const tokens = this.tokenize(doc.content);
        tokens.forEach(token => {
            const docSet = this.index.get(token);
            if (docSet) {
                docSet.delete(id);
                if (docSet.size === 0) {
                    this.index.delete(token);
                }
            }
        });

        this.documents.delete(id);
    }

    // Search for documents with improved scoring and fuzzy matching
    search(query, limit = 50) {
        const tokens = this.tokenize(query);
        if (tokens.length === 0) return [];

        const scores = new Map();
        const queryLower = query.toLowerCase();

        // Score documents based on multiple criteria
        this.documents.forEach((doc, id) => {
            const content = doc.content.toLowerCase();
            const metadata = doc.metadata;
            let score = 0;

            // Exact phrase match (highest priority)
            if (content.includes(queryLower)) {
                score += 100;
                // Bonus for title matches
                if (metadata.title && metadata.title.toLowerCase().includes(queryLower)) {
                    score += 50;
                }
            }

            // Token-based scoring
            let tokenMatches = 0;
            tokens.forEach(token => {
                if (content.includes(token)) {
                    tokenMatches++;
                    score += 10;

                    // Bonus for title token matches
                    if (metadata.title && metadata.title.toLowerCase().includes(token)) {
                        score += 20;
                    }
                }
            });

            // Fuzzy matching for partial words
            tokens.forEach(token => {
                const fuzzyMatches = this.findFuzzyMatches(content, token);
                score += fuzzyMatches * 2;
            });

            // Bonus for complete token coverage
            if (tokenMatches === tokens.length) {
                score += 25;
            }

            // Recency bonus (newer documents get slight boost)
            if (metadata.updatedAt) {
                const daysSinceUpdate = (Date.now() - new Date(metadata.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
                score += Math.max(0, 5 - daysSinceUpdate * 0.1);
            }

            if (score > 0) {
                scores.set(id, score);
            }
        });

        // Sort by score and return top results
        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id]) => id);
    }

    // Find fuzzy matches for better search results
    findFuzzyMatches(content, token) {
        let matches = 0;
        const words = content.split(/\s+/);

        words.forEach(word => {
            if (word.length >= 3 && token.length >= 3) {
                // Check if token is a substring of word or vice versa
                if (word.includes(token) || token.includes(word)) {
                    matches++;
                } else {
                    // Simple edit distance check for very similar words
                    const similarity = this.calculateSimilarity(word, token);
                    if (similarity > 0.7) {
                        matches += similarity;
                    }
                }
            }
        });

        return matches;
    }

    // Calculate similarity between two strings (simplified)
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    // Calculate Levenshtein distance
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    // Tokenize text for indexing with improved handling
    tokenize(text) {
        if (!text) return [];

        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 1) // Allow 2+ character tokens
            .concat(
                // Also include the original text as a single token for phrase matching
                text.toLowerCase().replace(/[^\w\s]/g, ' ').trim()
            )
            .filter(token => token.length > 0);
    }

    // Clear the index
    clear() {
        this.index.clear();
        this.documents.clear();
    }

    // Get index statistics
    getStats() {
        return {
            documentsCount: this.documents.size,
            tokensCount: this.index.size,
            averageTokensPerDocument: this.documents.size > 0 ? 
                Array.from(this.documents.values())
                    .reduce((sum, doc) => sum + this.tokenize(doc.content).length, 0) / this.documents.size : 0
        };
    }
}

// Batch processor for handling multiple operations efficiently
class BatchProcessor {
    constructor(batchSize = 50, delay = 100) {
        this.batchSize = batchSize;
        this.delay = delay;
        this.queue = [];
        this.processing = false;
    }

    add(operation) {
        this.queue.push(operation);
        if (!this.processing) {
            this.process();
        }
    }

    async process() {
        this.processing = true;

        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, this.batchSize);
            
            // Process batch
            await Promise.all(batch.map(op => this.executeOperation(op)));
            
            // Small delay to prevent blocking the UI
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }

        this.processing = false;
    }

    async executeOperation(operation) {
        try {
            if (typeof operation === 'function') {
                await operation();
            } else if (operation.fn) {
                await operation.fn(...(operation.args || []));
            }
        } catch (error) {
            console.error('Batch operation failed:', error);
        }
    }
}

// Create global instances
const debouncer = new Debouncer();
const cacheManager = new CacheManager();
const searchIndex = new SearchIndex();
const batchProcessor = new BatchProcessor();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        VirtualList, 
        Debouncer, 
        CacheManager, 
        SearchIndex, 
        BatchProcessor,
        debouncer,
        cacheManager,
        searchIndex,
        batchProcessor
    };
} else {
    window.VirtualList = VirtualList;
    window.Debouncer = Debouncer;
    window.CacheManager = CacheManager;
    window.SearchIndex = SearchIndex;
    window.BatchProcessor = BatchProcessor;
    window.debouncer = debouncer;
    window.cacheManager = cacheManager;
    window.searchIndex = searchIndex;
    window.batchProcessor = batchProcessor;
}
