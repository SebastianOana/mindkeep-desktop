// Modern text editor utilities to replace deprecated document.execCommand
class TextEditor {
    constructor(element) {
        this.element = element;
    }

    // Get current selection
    getSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;
        return selection.getRangeAt(0);
    }

    // Insert HTML at cursor position
    insertHTML(html) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const fragment = range.createContextualFragment(html);
        range.insertNode(fragment);

        // Move cursor to end of inserted content
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Wrap selection with tags
    wrapSelection(startTag, endTag = null) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText) {
            const wrapper = endTag ? `${startTag}${selectedText}${endTag}` : `${startTag}${selectedText}${startTag}`;
            this.insertHTML(wrapper);
        } else {
            // If no selection, just insert the tags
            const wrapper = endTag ? `${startTag}${endTag}` : `${startTag}${startTag}`;
            this.insertHTML(wrapper);
        }
    }

    // Format text with modern approach
    formatText(command) {
        switch (command) {
            case 'bold':
                this.wrapSelection('<strong>', '</strong>');
                break;
            case 'italic':
                this.wrapSelection('<em>', '</em>');
                break;
            case 'underline':
                this.wrapSelection('<u>', '</u>');
                break;
            case 'strikeThrough':
                this.wrapSelection('<s>', '</s>');
                break;
            case 'insertUnorderedList':
                this.insertList('ul');
                break;
            case 'insertOrderedList':
                this.insertList('ol');
                break;
            default:
                console.warn(`Unsupported format command: ${command}`);
        }
        this.element.focus();
    }

    // Insert list
    insertList(type) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        let listHTML;
        if (selectedText) {
            const lines = selectedText.split('\n').filter(line => line.trim());
            const items = lines.map(line => `<li>${line.trim()}</li>`).join('');
            listHTML = `<${type}>${items}</${type}>`;
        } else {
            listHTML = `<${type}><li></li></${type}>`;
        }

        this.insertHTML(listHTML);
    }

    // Format heading
    formatHeading(tag) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        // Find the current block element
        let blockElement = range.commonAncestorContainer;

        // If it's a text node, get its parent
        if (blockElement.nodeType === Node.TEXT_NODE) {
            blockElement = blockElement.parentNode;
        }

        // Find the closest block-level element
        while (blockElement && blockElement !== this.element &&
               !this.isBlockElement(blockElement)) {
            blockElement = blockElement.parentNode;
        }

        // If we found a block element within our editor
        if (blockElement && blockElement !== this.element) {
            // Get the current content
            const content = blockElement.innerHTML;

            // Create new heading element
            const newElement = document.createElement(tag);
            newElement.innerHTML = content;

            // Replace the old element
            blockElement.parentNode.replaceChild(newElement, blockElement);

            // Restore selection to the new element
            const newRange = document.createRange();
            newRange.selectNodeContents(newElement);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // No block element found, create a new heading
            const selectedText = range.toString();
            if (selectedText) {
                this.insertHTML(`<${tag}>${selectedText}</${tag}>`);
            } else {
                this.insertHTML(`<${tag}>Heading</${tag}>`);
            }
        }

        this.element.focus();
    }

    // Helper function to check if element is block-level
    isBlockElement(element) {
        const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'LI'];
        return blockElements.includes(element.tagName);
    }

    // Insert code block
    insertCodeBlock() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText) {
            this.insertHTML(`<pre><code>${selectedText}</code></pre>`);
        } else {
            this.insertHTML('<pre><code></code></pre><p>&nbsp;</p>');
        }
        this.element.focus();
    }

    // Insert horizontal rule
    insertHorizontalRule() {
        this.insertHTML('<hr>');
        this.element.focus();
    }

    // Align text (modern approach using CSS)
    alignText(alignment) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        let container = range.commonAncestorContainer;

        // Find the closest block element
        while (container && container.nodeType !== Node.ELEMENT_NODE) {
            container = container.parentNode;
        }

        if (container && container !== this.element) {
            // Find the closest block-level element
            while (container && container.parentNode !== this.element && 
                   !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(container.tagName)) {
                container = container.parentNode;
            }

            if (container && container !== this.element) {
                container.style.textAlign = alignment;
            }
        }
        this.element.focus();
    }

    // Undo/Redo using browser's built-in functionality
    undoRedo(action) {
        if (action === 'undo') {
            document.execCommand('undo', false, null);
        } else if (action === 'redo') {
            document.execCommand('redo', false, null);
        }
        this.element.focus();
    }

    // Highlight text with background color
    highlightText(color = '#ffff00') {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText) {
            this.insertHTML(`<span style="background-color: ${color}">${selectedText}</span>`);
        }
        this.element.focus();
    }

    // Insert inline code
    insertInlineCode() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText) {
            this.insertHTML(`<code>${selectedText}</code>`);
        } else {
            this.insertHTML('<code></code>');
        }
        this.element.focus();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextEditor;
} else {
    window.TextEditor = TextEditor;
}
