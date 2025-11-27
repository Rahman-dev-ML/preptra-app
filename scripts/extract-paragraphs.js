const fs = require('fs');
const path = require('path');

// Directory containing markdown files
const markdownDir = path.join(__dirname, '../public/data/markdown');
const outputDir = path.join(__dirname, '../public/data/paragraphs');

console.log('Markdown directory:', markdownDir);
console.log('Output directory:', outputDir);

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Function to extract paragraphs from markdown content
function extractParagraphs(content) {
  // Split by double newlines to get paragraphs
  const rawParagraphs = content.split(/\n\n+/);
  
  // Filter and clean paragraphs
  const paragraphs = rawParagraphs
    .map(p => p.trim())
    .filter(p => {
      // Remove empty paragraphs
      if (!p) return false;
      
      // Remove headings (lines starting with #)
      if (p.startsWith('#')) return false;
      
      // Remove lists (lines starting with - or *)
      if (p.startsWith('-') || p.startsWith('*') || /^\d+\./.test(p)) return false;
      
      // Remove code blocks
      if (p.startsWith('```') || p.includes('```')) return false;
      
      // Remove very short paragraphs (less than 50 characters)
      if (p.length < 50) return false;
      
      // Remove paragraphs that are mostly numbers or special characters
      const alphaRatio = (p.match(/[a-zA-Z]/g) || []).length / p.length;
      if (alphaRatio < 0.5) return false;
      
      return true;
    })
    // Clean up remaining paragraphs
    .map(p => {
      // Remove markdown formatting
      return p
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
        .replace(/`(.*?)`/g, '$1')       // Inline code
        .replace(/\n/g, ' ')             // Replace newlines with spaces
        .replace(/\s+/g, ' ')            // Multiple spaces to single
        .trim();
    })
    // Final filter for quality
    .filter(p => {
      // Ensure paragraph has substantive content
      const words = p.split(' ').length;
      return words >= 10 && words <= 300; // Between 10-300 words
    });
  
  return paragraphs;
}

// Process all markdown files
try {
  const files = fs.readdirSync(markdownDir);
  console.log(`Found ${files.length} files in markdown directory`);
  
  let processedCount = 0;
  
  files.forEach(file => {
    if (!file.endsWith('-analysis.md')) {
      console.log(`Skipping ${file} - not an analysis file`);
      return;
    }
    
    console.log(`Processing ${file}...`);
    const filePath = path.join(markdownDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract subject name from filename
    const subjectName = file.replace('-analysis.md', '');
    
    // Extract paragraphs
    const paragraphs = extractParagraphs(content);
    
    if (paragraphs.length > 0) {
      // Save as JSON
      const outputPath = path.join(outputDir, `${subjectName}_paragraphs.json`);
      fs.writeFileSync(outputPath, JSON.stringify(paragraphs, null, 2));
      
      console.log(`✓ Extracted ${paragraphs.length} paragraphs from ${file}`);
      processedCount++;
    } else {
      console.log(`✗ No suitable paragraphs found in ${file}`);
    }
  });
  
  console.log(`\nParagraph extraction complete! Processed ${processedCount} files.`);
} catch (error) {
  console.error('Error processing files:', error);
}