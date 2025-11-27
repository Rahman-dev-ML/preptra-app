# PrepTra - Tech Stack & Document Display Guide

## 🛠️ Current Tech Stack

### Frontend Framework
- **Next.js 14** (App Router) - React framework with server-side rendering
- **TypeScript** - Type-safe JavaScript
- **React** - UI library

### Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide Icons** - Icon library

### PWA Features
- **next-pwa** - Progressive Web App plugin
- Service workers for offline functionality
- Web manifest for installability

### Development Tools
- **Node.js & npm** - Package management
- **ESLint** - Code linting
- **PostCSS** - CSS processing

## 📄 Document Display Options for DOCX Files

### Option 1: Google Drive Integration (RECOMMENDED)
**Best for:** Easy implementation, no storage costs, familiar to users

**How it works:**
1. Upload DOCX files to Google Drive
2. Set sharing to "Anyone with link can view"
3. Store the share links in your data files
4. Display options:
   - Direct link to Google Drive viewer
   - Embedded iframe (limited customization)

**Example Implementation:**
```typescript
// In your data file
export const pastPapers = {
  botany: {
    2023: {
      googleDriveLink: "https://drive.google.com/file/d/YOUR_FILE_ID/view",
      embedLink: "https://drive.google.com/file/d/YOUR_FILE_ID/preview"
    }
  }
};

// In your component
<iframe 
  src={paper.embedLink}
  width="100%" 
  height="600px"
  className="rounded-lg"
/>
```

### Option 2: Convert to PDF + Host on GitHub
**Best for:** Full control, GitHub Pages hosting

**Steps:**
1. Convert DOCX to PDF (use MS Word or online converter)
2. Create a separate GitHub repository for PDFs
3. Enable GitHub Pages
4. Link to PDFs directly

**Example:**
```typescript
const pdfUrl = "https://yourusername.github.io/css-papers/botany-2023.pdf";
```

### Option 3: Static HTML/Markdown Conversion
**Best for:** SEO, fast loading, searchable content

**Process:**
1. Convert DOCX to Markdown using Pandoc
2. Store in your data folder
3. Use react-markdown to render

**Example:**
```bash
pandoc input.docx -t markdown -o output.md
```

### Option 4: Third-Party Document Viewers
**Services:**
- **Google Docs Viewer**: `https://docs.google.com/viewer?url=YOUR_PDF_URL&embedded=true`
- **Microsoft Office Online**: For direct DOCX viewing
- **ViewerJS**: Self-hosted option

## 🎯 Recommended Approach

For PrepTra, I recommend a **hybrid approach**:

1. **For Analytical Work**: Keep as structured data (current approach)
2. **For Past Papers**: Use Google Drive links
3. **For Books/PDFs**: GitHub hosting or Google Drive

### Implementation Example:

```typescript
// data/past-papers.ts
export const pastPapers = {
  botany: [
    {
      year: 2023,
      type: "CSS Past Paper",
      displayOptions: {
        googleDrive: "https://drive.google.com/file/d/xxx/view",
        downloadLink: "https://drive.google.com/uc?export=download&id=xxx",
        embedPreview: "https://drive.google.com/file/d/xxx/preview"
      }
    }
  ]
};

// In your component
<div className="space-y-4">
  <button 
    onClick={() => window.open(paper.displayOptions.googleDrive, '_blank')}
    className="bg-gray-700 text-white px-4 py-2 rounded"
  >
    View on Google Drive
  </button>
  
  <button 
    onClick={() => window.open(paper.displayOptions.downloadLink, '_blank')}
    className="bg-gray-600 text-white px-4 py-2 rounded"
  >
    Download PDF
  </button>
</div>
```

## 📱 Mobile Optimization Tips

1. **Avoid iframes on mobile** - Use direct links instead
2. **Provide download options** - For offline study
3. **Consider file sizes** - Compress PDFs for mobile users
4. **Progressive loading** - Show document metadata first

## 🚀 Next Steps

1. **Set up Google Drive folder** for past papers
2. **Create data structure** for paper links
3. **Add loading states** for document viewers
4. **Implement offline caching** for downloaded papers

## 📌 Quick Decision Guide

| Content Type | Recommended Method |
|-------------|-------------------|
| Past Papers | Google Drive Links |
| Analytical Work | Structured Data (current) |
| Reference Books | Google Drive or GitHub |
| Quick Notes | Markdown in repo |
| Large PDFs | External hosting | 