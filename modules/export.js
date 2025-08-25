// Export functionality for MindKeep
class ExportManager {
    constructor() {
        this.exportFormats = ['markdown', 'html', 'json', 'txt'];
    }

    // Export single note
    async exportNote(note, format = 'markdown') {
        logger.info(`Exporting note "${note.title}" as ${format}`);
        
        switch (format.toLowerCase()) {
            case 'markdown':
                return this.exportAsMarkdown(note);
            case 'html':
                return this.exportAsHTML(note);
            case 'json':
                return this.exportAsJSON(note);
            case 'txt':
                return this.exportAsText(note);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    // Export multiple notes
    async exportNotes(notes, format = 'markdown') {
        logger.info(`Exporting ${notes.length} notes as ${format}`);
        
        const exports = await Promise.all(
            notes.map(note => this.exportNote(note, format))
        );

        if (format === 'json') {
            return JSON.stringify(notes, null, 2);
        }

        return exports.join('\n\n---\n\n');
    }

    // Export as Markdown
    exportAsMarkdown(note) {
        let markdown = `# ${note.title}\n\n`;
        
        if (note.description) {
            markdown += `*${note.description}*\n\n`;
        }

        if (note.tags && note.tags.length > 0) {
            markdown += `**Tags:** ${note.tags.map(tag => `#${tag}`).join(' ')}\n\n`;
        }

        if (note.category) {
            markdown += `**Category:** ${note.category}\n\n`;
        }

        markdown += `**Created:** ${new Date(note.createdAt).toLocaleDateString()}\n`;
        markdown += `**Updated:** ${new Date(note.updatedAt).toLocaleDateString()}\n\n`;
        
        markdown += '---\n\n';
        markdown += this.htmlToMarkdown(note.content);

        return markdown;
    }

    // Export as HTML
    exportAsHTML(note) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${this.escapeHtml(note.title)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
        h1 { color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 0.5rem; }
        .meta { background: #f5f5f5; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
        .tags { margin: 0.5rem 0; }
        .tag { background: #4a9eff; color: white; padding: 0.2rem 0.5rem; border-radius: 3px; margin-right: 0.5rem; font-size: 0.9rem; }
        .content { margin-top: 2rem; }
        code { background: #f0f0f0; padding: 0.2rem 0.4rem; border-radius: 3px; }
        pre { background: #f0f0f0; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>${this.escapeHtml(note.title)}</h1>
    
    <div class="meta">
        ${note.description ? `<p><strong>Description:</strong> ${this.escapeHtml(note.description)}</p>` : ''}
        ${note.category ? `<p><strong>Category:</strong> ${this.escapeHtml(note.category)}</p>` : ''}
        ${note.tags && note.tags.length > 0 ? `
            <div class="tags">
                <strong>Tags:</strong> 
                ${note.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
            </div>
        ` : ''}
        <p><strong>Created:</strong> ${new Date(note.createdAt).toLocaleDateString()}</p>
        <p><strong>Updated:</strong> ${new Date(note.updatedAt).toLocaleDateString()}</p>
    </div>
    
    <div class="content">
        ${note.content}
    </div>
</body>
</html>`;
        return html;
    }

    // Export as JSON
    exportAsJSON(note) {
        return JSON.stringify(note, null, 2);
    }

    // Export as plain text
    exportAsText(note) {
        let text = `${note.title}\n`;
        text += '='.repeat(note.title.length) + '\n\n';
        
        if (note.description) {
            text += `Description: ${note.description}\n\n`;
        }

        if (note.category) {
            text += `Category: ${note.category}\n`;
        }

        if (note.tags && note.tags.length > 0) {
            text += `Tags: ${note.tags.join(', ')}\n`;
        }

        text += `Created: ${new Date(note.createdAt).toLocaleDateString()}\n`;
        text += `Updated: ${new Date(note.updatedAt).toLocaleDateString()}\n\n`;
        
        text += '-'.repeat(50) + '\n\n';
        text += this.htmlToText(note.content);

        return text;
    }

    // Convert HTML to Markdown (basic conversion)
    htmlToMarkdown(html) {
        return html
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
            .replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_')
            .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
            .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<hr\s*\/?>/gi, '\n---\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
            .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
            .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
            .trim();
    }

    // Convert HTML to plain text
    htmlToText(html) {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n\n')
            .replace(/<[^>]+>/g, '') // Remove all HTML tags
            .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
            .trim();
    }

    // Escape HTML entities
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Download file
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logger.info(`File downloaded: ${filename}`);
    }

    // Get appropriate file extension for format
    getFileExtension(format) {
        const extensions = {
            markdown: 'md',
            html: 'html',
            json: 'json',
            txt: 'txt'
        };
        return extensions[format.toLowerCase()] || 'txt';
    }

    // Generate filename for export
    generateFilename(note, format, includeDate = true) {
        let filename = note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        if (includeDate) {
            const date = new Date().toISOString().split('T')[0];
            filename += `_${date}`;
        }
        
        filename += `.${this.getFileExtension(format)}`;
        return filename;
    }

    // Export and download note
    async exportAndDownload(note, format = 'markdown') {
        try {
            const content = await this.exportNote(note, format);
            const filename = this.generateFilename(note, format);
            const mimeTypes = {
                markdown: 'text/markdown',
                html: 'text/html',
                json: 'application/json',
                txt: 'text/plain'
            };
            
            this.downloadFile(content, filename, mimeTypes[format.toLowerCase()]);
            return { success: true, filename };
        } catch (error) {
            logger.error('Export failed', error);
            throw error;
        }
    }

    // Export and download multiple notes
    async exportAndDownloadMultiple(notes, format = 'markdown') {
        try {
            const content = await this.exportNotes(notes, format);
            const date = new Date().toISOString().split('T')[0];
            const filename = `mindkeep_export_${date}.${this.getFileExtension(format)}`;
            const mimeTypes = {
                markdown: 'text/markdown',
                html: 'text/html',
                json: 'application/json',
                txt: 'text/plain'
            };
            
            this.downloadFile(content, filename, mimeTypes[format.toLowerCase()]);
            return { success: true, filename, count: notes.length };
        } catch (error) {
            logger.error('Bulk export failed', error);
            throw error;
        }
    }
}

// Create global instance
const exportManager = new ExportManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExportManager, exportManager };
} else {
    window.ExportManager = ExportManager;
    window.exportManager = exportManager;
}
