const fs = require('fs');
const path = require('path');

const markdownDir = path.join(__dirname, '../public/data/markdown');
const outputDir = path.join(__dirname, '../public/data/paragraphs');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function extractActualContent(content) {
  const paragraphs = [];
  
  // Split content into lines
  const lines = content.split('\n');
  let currentParagraph = '';
  let inContentSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (currentParagraph && inContentSection) {
        // Clean and add paragraph if it contains actual content
        const cleaned = currentParagraph.trim();
        if (cleaned.length > 50 && 
            !cleaned.match(/^\d{4}:/) && // Skip year references
            !cleaned.match(/^Q\.\d+/) && // Skip question numbers
            !cleaned.match(/^Example \d+:/) && // Skip example numbers
            !cleaned.includes('Example Questions:') &&
            !cleaned.includes('Past paper') &&
            !cleaned.includes('CSS exam') &&
            !cleaned.includes('asked in') &&
            !cleaned.includes('question types')) {
          paragraphs.push(cleaned);
        }
        currentParagraph = '';
      }
      continue;
    }
    
    // Look for content sections
    if (line.includes('Recurring Themes:') || 
        line.includes('Key Themes') || 
        line.includes('Topics:') ||
        line.includes('Core Concepts:') ||
        line.includes('Important Areas:')) {
      inContentSection = true;
      continue;
    }
    
    // Stop at example questions section
    if (line.includes('Example Questions:') || 
        line.includes('Past Questions:') ||
        line.includes('Previous Years:')) {
      inContentSection = false;
      continue;
    }
    
    // If we're in a content section, accumulate the paragraph
    if (inContentSection) {
      // Check if this is a topic header (ends with colon)
      if (line.endsWith(':') && line.split(':').length === 2) {
        // This is a topic header, extract the content after it
        const topic = line.slice(0, -1);
        
        // Look ahead for the description
        let description = '';
        let j = i + 1;
        while (j < lines.length && lines[j].trim() && !lines[j].trim().endsWith(':')) {
          description += lines[j].trim() + ' ';
          j++;
        }
        
        if (description.trim().length > 30) {
          paragraphs.push(`${topic}: ${description.trim()}`);
        }
        i = j - 1; // Skip processed lines
      } else {
        currentParagraph += line + ' ';
      }
    }
    
    // Also look for bullet points with actual content
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      const bulletContent = line.substring(1).trim();
      if (bulletContent.length > 50 && 
          !bulletContent.match(/^\d{4}:/) &&
          !bulletContent.match(/^Q\.\d+/) &&
          !bulletContent.includes('asked in') &&
          !bulletContent.includes('question')) {
        paragraphs.push(bulletContent);
      }
    }
  }
  
  // Also extract any remaining paragraph
  if (currentParagraph && inContentSection) {
    const cleaned = currentParagraph.trim();
    if (cleaned.length > 50) {
      paragraphs.push(cleaned);
    }
  }
  
  // If we didn't find much, try a different approach - look for descriptive paragraphs
  if (paragraphs.length < 5) {
    const altParagraphs = content
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => {
        return p.length > 100 && // Longer paragraphs
               !p.match(/^\d{4}:/) && // No year refs
               !p.match(/^Q\.\d+/) && // No question numbers
               !p.includes('Example Questions') &&
               !p.includes('asked in') &&
               !p.includes('CSS exam') &&
               !p.includes('Previous years') &&
               p.split(' ').length > 15; // At least 15 words
      });
    
    paragraphs.push(...altParagraphs);
  }
  
  return paragraphs;
}

// Process all markdown files
const files = fs.readdirSync(markdownDir);
let processedCount = 0;

files.forEach(file => {
  if (!file.endsWith('-analysis.md')) return;
  
  const filePath = path.join(markdownDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const subjectName = file.replace('-analysis.md', '');
  const paragraphs = extractActualContent(content);
  
  if (paragraphs.length > 0) {
    const outputPath = path.join(outputDir, `${subjectName}_paragraphs.json`);
    fs.writeFileSync(outputPath, JSON.stringify(paragraphs, null, 2));
    console.log(`✓ Extracted ${paragraphs.length} content paragraphs from ${file}`);
    console.log(`  Sample: "${paragraphs[0].substring(0, 100)}..."`);
    processedCount++;
  } else {
    console.log(`✗ No suitable content found in ${file}`);
  }
});

console.log(`\nProcessed ${processedCount} files successfully.`);