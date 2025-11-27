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

// Function to extract meaningful content from markdown
function extractContent(content) {
  const contentPieces = [];
  
  // Split by lines for better control
  const lines = content.split('\n');
  let currentPiece = '';
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (currentPiece.length > 100) {
        contentPieces.push(currentPiece.trim());
        currentPiece = '';
      }
      continue;
    }
    
    // Skip headers
    if (line.startsWith('#')) {
      if (currentPiece.length > 100) {
        contentPieces.push(currentPiece.trim());
        currentPiece = '';
      }
      continue;
    }
    
    // Handle bullet points and lists
    if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
      // Extract the content after the bullet/number
      const bulletContent = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
      
      // If it's a substantial bullet point, treat it as content
      if (bulletContent.length > 50) {
        if (currentPiece.length > 100) {
          contentPieces.push(currentPiece.trim());
          currentPiece = '';
        }
        currentPiece = bulletContent;
      } else if (bulletContent.includes(':')) {
        // Handle bullet points with descriptions
        currentPiece += ' ' + bulletContent;
      }
      inList = true;
    } else {
      // Regular paragraph content
      if (inList && currentPiece.length > 100) {
        contentPieces.push(currentPiece.trim());
        currentPiece = '';
        inList = false;
      }
      currentPiece += ' ' + line;
    }
  }
  
  // Don't forget the last piece
  if (currentPiece.length > 100) {
    contentPieces.push(currentPiece.trim());
  }
  
  // Process and clean the content pieces
  return contentPieces
    .map(piece => {
      // Clean up markdown formatting
      return piece
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
        .replace(/`(.*?)`/g, '$1')       // Inline code
        .replace(/\\/g, '')              // Escape characters
        .replace(/\s+/g, ' ')            // Multiple spaces to single
        .trim();
    })
    .filter(piece => {
      // Quality filters
      const words = piece.split(' ').length;
      const hasSubstance = words >= 15; // At least 15 words
      const notTooLong = words <= 300;  // Not more than 300 words
      const hasLetters = (piece.match(/[a-zA-Z]/g) || []).length > piece.length * 0.6;
      
      return hasSubstance && notTooLong && hasLetters;
    });
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
    
    // Extract content pieces
    const contentPieces = extractContent(content);
    
    if (contentPieces.length > 0) {
      // Save as JSON
      const outputPath = path.join(outputDir, `${subjectName}_paragraphs.json`);
      fs.writeFileSync(outputPath, JSON.stringify(contentPieces, null, 2));
      
      console.log(`✓ Extracted ${contentPieces.length} content pieces from ${file}`);
      console.log(`  Sample: "${contentPieces[0].substring(0, 100)}..."`);
      processedCount++;
    } else {
      console.log(`✗ No suitable content found in ${file}`);
    }
  });
  
  console.log(`\nContent extraction complete! Processed ${processedCount} files.`);
} catch (error) {
  console.error('Error processing files:', error);
}