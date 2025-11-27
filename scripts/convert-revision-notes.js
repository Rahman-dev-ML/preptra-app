const fs = require('fs');
const path = require('path');

// Your input data (paste the JSON array here)
const inputData = [
  {
    "title": "Core Definitions & Scope of Anthropology",
    "takeaways": [
      "Anthropology is the holistic study of humans across time and space.",
      "The four main subfields: Cultural/Social, Biological/Physical, Linguistic, Archaeology.",
      "Methods: ethnography and participant observation distinguish anthropology from related disciplines.",
      "Holistic and comparative approach integrates natural and social sciences."
    ],
    "resources": [
      {
        "title": "Northwestern – Four Subfields of Anthropology",
        "url": "https://anthropology.northwestern.edu/subfields/",
        "type": "article",
        "tag": "Authoritative"
      },
      {
        "title": "Indiana University – Four Fields of Study",
        "url": "https://anthropology.indiana.edu/about/four-fields-of-study/index.html",
        "type": "article",
        "tag": "Authoritative"
      },
      {
        "title": "UC Davis – What is Anthropology?",
        "url": "https://anthropology.ucdavis.edu/undergraduate/what-is-anthropology",
        "type": "article",
        "tag": "Overview"
      },
      {
        "title": "Stanford – Participant Observation (PDF)",
        "url": "https://web.stanford.edu/class/ed260sp07/ParticipantObservation.pdf",
        "type": "pdf",
        "tag": "Deep Dive"
      },
      {
        "title": "SAGE – Participant Observation (PDF)",
        "url": "https://methods.sagepub.com/reference/the-sage-encyclopedia-of-communication-research-methods/i11062.xml",
        "type": "article",
        "tag": "Method"
      },
      {
        "title": "YouTube – The 4 Fields of Anthropology",
        "url": "https://www.youtube.com/watch?v=zRm68Ff_MV0",
        "type": "video",
        "tag": "Quick Watch"
      },
      {
        "title": "YouTube – Four Subdisciplines of American Anthropology",
        "url": "https://www.youtube.com/watch?v=kiZP0Iqj1Xk",
        "type": "video",
        "tag": "Lecture"
      }
    ]
  },
  // Add all other items here...
];

// Function to determine category based on title
function determineCategory(title) {
  if (title.includes('Core Definitions') || title.includes('Scope')) return 'Fundamentals';
  if (title.includes('Religion') || title.includes('Evolution')) return 'Theory & Evolution';
  if (title.includes('Research') || title.includes('Methodology')) return 'Research Methods';
  if (title.includes('Kinship') || title.includes('Family') || title.includes('Marriage')) return 'Social Organization';
  if (title.includes('Economic') || title.includes('Political')) return 'Political Economy';
  if (title.includes('Cultural Concepts') || title.includes('Culture')) return 'Cultural Theory';
  if (title.includes('Pakistan')) return 'Contemporary Issues';
  if (title.includes('Anthropologists') || title.includes('Theories')) return 'Key Thinkers';
  if (title.includes('Short Notes')) return 'Key Terms';
  return 'General';
}

// Function to determine importance based on content
function determineImportance(title, takeaways) {
  if (title.includes('Core') || title.includes('Definitions') || title.includes('Major')) return 'high';
  if (title.includes('Short Notes') || title.includes('Contemporary')) return 'medium';
  return 'medium';
}

// Function to extract topics from title and takeaways
function extractTopics(title, takeaways) {
  const topics = [];
  
  // Extract from title
  if (title.includes('Kinship')) topics.push('Kinship');
  if (title.includes('Religion')) topics.push('Religion');
  if (title.includes('Culture')) topics.push('Culture');
  if (title.includes('Economic')) topics.push('Economic Systems');
  if (title.includes('Political')) topics.push('Political Systems');
  if (title.includes('Research')) topics.push('Research Methods');
  if (title.includes('Pakistan')) topics.push('Pakistan Studies');
  
  // Extract key concepts from takeaways
  takeaways.forEach(takeaway => {
    if (takeaway.includes('Tylor')) topics.push('Edward Tylor');
    if (takeaway.includes('Geertz')) topics.push('Clifford Geertz');
    if (takeaway.includes('participant observation')) topics.push('Participant Observation');
    if (takeaway.includes('thick description')) topics.push('Thick Description');
  });
  
  return [...new Set(topics)]; // Remove duplicates
}

// Convert the data
function convertToRevisionNotesFormat(inputData, subjectName) {
  const categories = [...new Set(inputData.map(item => determineCategory(item.title)))];
  
  const notes = inputData.map((item, index) => {
    // Create content from takeaways
    const content = item.takeaways.join('\n\n');
    
    // Transform resources
    const resources = item.resources.map(resource => ({
      title: resource.title,
      url: resource.url,
      type: resource.type === 'article' ? 'article' : 
            resource.type === 'pdf' ? 'pdf' : 
            resource.type === 'video' ? 'video' : 
            resource.type === 'book' ? 'book' : 'website',
      description: resource.tag || ''
    }));
    
    return {
      id: (index + 1).toString(),
      title: item.title,
      content: content,
      keyTakeaways: item.takeaways,
      resources: resources,
      importance: determineImportance(item.title, item.takeaways),
      category: determineCategory(item.title),
      topics: extractTopics(item.title, item.takeaways)
    };
  });
  
  return {
    subject: subjectName,
    lastUpdated: new Date().toISOString().split('T')[0],
    totalNotes: notes.length,
    categories: categories,
    notes: notes
  };
}

// Process for a specific subject
const subjectName = 'Anthropology'; // Change this for different subjects
const outputData = convertToRevisionNotesFormat(inputData, subjectName);

// Write to file
const outputDir = path.join(__dirname, '../public/data/revision-notes');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputFile = path.join(outputDir, 'anthropology.json');
fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));

console.log(`✅ Converted revision notes saved to: ${outputFile}`);
console.log(`📊 Total notes: ${outputData.totalNotes}`);
console.log(`📁 Categories: ${outputData.categories.join(', ')}`);

