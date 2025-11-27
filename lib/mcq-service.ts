import fs from 'fs';
import path from 'path';
import { apiKeyManager } from './api-key-manager';

interface MCQResponse {
  question: string;
  options: string[];
  correct: string;
  note: string;
}

interface SubjectCursor {
  [subject: string]: number;
}

// Single cursor per subject - all difficulties use same content pool
const cursors: SubjectCursor = {};

// Per-model simple concurrency limit to avoid org TPM spikes
const modelInFlight: Record<string, number> = {
  'llama3-8b-8192': 0,
  'llama3-70b-8192': 0,
  'gemma2-9b-it': 0,
};
const modelMaxConcurrent: Record<string, number> = {
  'llama3-8b-8192': 1,
  'llama3-70b-8192': 1,
  'gemma2-9b-it': 1,
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Organization-wide cooldown after any TPM hit
let perOrgCooldownUntil = 0;

async function acquireModelSlot(model: string): Promise<() => void> {
  if (!(model in modelInFlight)) {
    modelInFlight[model] = 0;
    modelMaxConcurrent[model] = 1;
  }
  // Respect org-wide cooldown
  const now = Date.now();
  if (perOrgCooldownUntil > now) {
    await delay(perOrgCooldownUntil - now);
  }
  while (modelInFlight[model] >= (modelMaxConcurrent[model] || 1)) {
    await delay(100);
  }
  modelInFlight[model]++;
  return () => {
    modelInFlight[model] = Math.max(0, (modelInFlight[model] || 1) - 1);
  };
}

export class MCQService {
  private apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(apiKey?: string) {
    // API key is now managed by APIKeyManager
  }

  // Reserve N chunks atomically for a subject and advance the cursor
  reserveContentChunks(subject: string, count: number): { chunks: string[]; totalSections: number; startIndex: number } {
    const allChunks = this.loadMarkdownContent(subject);
    if (allChunks.length === 0) {
      throw new Error(`No suitable content found for ${subject} in markdown file`);
    }

    const normalizedSubject = subject.toLowerCase().replace(/\s+&\s+/g, '-and-').replace(/\s+/g, '-');
    if (!cursors[normalizedSubject]) {
      cursors[normalizedSubject] = 0;
    }

    // Spread picks across the file to maximize diversity
    const total = allChunks.length;
    const startIndex = cursors[normalizedSubject];
    const step = Math.max(1, Math.floor(total / Math.max(1, count)));
    const offset = (startIndex + Math.floor(Math.random() * step)) % total;
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      indices.push((offset + i * step) % total);
    }
    // Shuffle lightly
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const reserved = indices.map(i => allChunks[i]);

    // Advance cursor
    cursors[normalizedSubject] = (startIndex + count) % total;

    return { chunks: reserved, totalSections: total, startIndex };
  }

  // Choose model based on content complexity and volume
  private selectModelForContent(content: string): { model: string; temperature: number } {
    const length = content.length;
    const complex = /compare|contrast|implication|evaluate|analysis|theory|framework|policy|impact|cause|effect/i.test(content);
    if (length > 1200 && complex) return { model: 'llama3-70b-8192', temperature: 0.3 };
    if (length < 600 && !complex) return { model: 'gemma2-9b-it', temperature: 0.25 };
    return { model: 'llama3-8b-8192', temperature: 0.35 };
  }

  private alternateModelsForContent(content: string, primary: string): string[] {
    const order = ['llama3-8b-8192', 'gemma2-9b-it', 'llama3-70b-8192'];
    // prefer switching away from the current one to spread TPM
    return order.filter(m => m !== primary);
  }

  // Validate MCQ relevance: fast lexical first, LLM only if needed
  private async validateRelevance(content: string, mcq: MCQResponse): Promise<{ score: number; valid: boolean }> {
    // Fast lexical similarity
    const normalize = (s: string) => s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['that','this','with','from','have','were','their','there','about','which'].includes(w));

    const contentWords = new Set(normalize(content));
    const mcqText = `${mcq.question} ${mcq.options.join(' ')}`;
    const mcqWordsArr = normalize(mcqText);
    let overlap = 0;
    for (const w of mcqWordsArr) {
      if (contentWords.has(w)) overlap++;
    }
    const lexicalScore = Math.min(100, Math.round((overlap / Math.max(10, mcqWordsArr.length)) * 200));

    if (lexicalScore >= 70) {
      return { score: lexicalScore, valid: true };
    }

    // Skip LLM validator for stability; use lexical only
    return { score: lexicalScore, valid: lexicalScore >= 50 };
  }

  // Read content directly from markdown analysis files
  private loadMarkdownContent(subject: string): string[] {
    try {
      // Normalize subject name to match file naming
      const normalizedSubject = subject
        .toLowerCase()
        .replace(/\s+&\s+/g, '-and-')
        .replace(/\s+/g, '-');

      // Read markdown file directly
      const filePath = path.join(process.cwd(), 'public', 'data', 'markdown', `${normalizedSubject}-analysis.md`);
      
      console.log(`Loading content for ${subject} from: ${filePath}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        throw new Error(`Analysis file not found for ${subject}`);
      }
      
      // Read file
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`File loaded successfully, size: ${content.length} chars`);
      
      // Split content into meaningful chunks
      const chunks: string[] = [];
      const lines = content.split('\n');
      let currentChunk = '';
      let inExampleSection = false;
      
      for (const line of lines) {
        // Skip empty lines
        if (!line.trim()) {
          if (currentChunk.trim() && currentChunk.split(/\s+/).length >= 30) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = '';
          continue;
        }
        
        // Skip certain headers
        if (line.includes('Example Questions') || 
            line.includes('Patterns and Repeating Questions') ||
            line.includes('Exam Strategy')) {
          inExampleSection = true;
          continue;
        }
        
        // Reset example section flag on new main headers
        if (line.startsWith('#') && !line.includes('Example')) {
          inExampleSection = false;
        }
        
        // Skip if we're in an example section
        if (inExampleSection) {
          continue;
        }
        
        // Extract content from bullet points and regular text
        const cleanedLine = line
          .replace(/^[-*•]\s*/, '') // Remove bullet points
          .replace(/^\d+\.\s*/, '') // Remove numbered lists
          .replace(/\*\*/g, '') // Remove bold markers
          .trim();
        
        // Skip lines that are just years or question references
        if (cleanedLine.match(/^(19|20)\d{2}:?$/) || 
            cleanedLine.match(/^Q\.\d+/) ||
            cleanedLine.includes('Frequency:') ||
            cleanedLine.includes('asked in')) {
          continue;
        }
        
        // Add meaningful content
        if (cleanedLine.length > 20) {
          currentChunk += cleanedLine + ' ';
        }
        
        // If chunk is large enough, save it
        if (currentChunk.split(/\s+/).length >= 80) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
      
      // Add any remaining chunk
      if (currentChunk.trim() && currentChunk.split(/\s+/).length >= 30) {
        chunks.push(currentChunk.trim());
      }
      
      // If no good chunks found, try a more lenient approach
      if (chunks.length === 0) {
        console.log('No chunks found with strict filtering, trying lenient approach...');
        
        // Split by paragraphs and take any substantial content
        const paragraphs = content.split(/\n\n+/);
        for (const para of paragraphs) {
          const cleaned = para
            .replace(/^#+\s*/gm, '') // Remove headers
            .replace(/^[-*•]\s*/gm, '') // Remove bullets
            .replace(/\*\*/g, '') // Remove bold
            .trim();
          
          // Take any paragraph with enough content
          if (cleaned.length > 100 && !cleaned.includes('Example Questions')) {
            chunks.push(cleaned);
          }
        }
      }
      
      let filteredChunks = chunks.filter(chunk => chunk.length > 50);

      // If too few chunks, create fixed-size windows to ensure multiple chunks
      if (filteredChunks.length < 5) {
        const text = content.replace(/\n+/g, ' ').trim();
        const windowSize = 1200;
        const step = 1000;
        const windows: string[] = [];
        for (let i = 0; i < text.length; i += step) {
          const slice = text.slice(i, i + windowSize);
          if (slice.split(/\s+/).length >= 25) windows.push(slice);
          if (windows.length >= 20) break;
        }
        if (windows.length > 0) filteredChunks = windows;
      }

      console.log(`Extracted ${filteredChunks.length} content chunks from ${subject}`);
      return filteredChunks;
    } catch (error) {
      console.error('Error loading markdown content:', error);
      if (error instanceof Error && error.message.includes('Analysis file not found')) {
        throw error;
      }
      throw new Error(`Failed to load content for ${subject}`);
    }
  }

  // Get the next content chunk for a subject
  async getNextContentChunk(subject: string): Promise<string> {
    try {
      const chunks = this.loadMarkdownContent(subject);
      
      if (chunks.length === 0) {
        throw new Error(`No suitable content found for ${subject} in markdown file`);
      }

      // Initialize cursor if needed
      const normalizedSubject = subject.toLowerCase().replace(/\s+&\s+/g, '-and-').replace(/\s+/g, '-');
      if (!cursors[normalizedSubject]) {
        cursors[normalizedSubject] = 0;
      }

      // Get current cursor position
      const currentIndex = cursors[normalizedSubject];
      
      // Get chunk and update cursor
      const chunk = chunks[currentIndex % chunks.length];
      cursors[normalizedSubject] = (currentIndex + 1) % chunks.length;
      
      return chunk;
    } catch (error) {
      console.error('Error getting content chunk:', error);
      throw error;
    }
  }

  // Generate MCQ using Groq API
  async generateMCQ(
    subject: string, 
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
    apiKeyOverride?: string,
    overrideContent?: string,
    attempt: number = 0
  ): Promise<MCQResponse> {
    try {
      // Use pre-reserved content if provided; else get next chunk
      const content = overrideContent ?? (await this.getNextContentChunk(subject));

      // Difficulty affects HOW we ask, not WHAT content we use
      const difficultyInstructions = {
        EASY: `Create a SIMPLE FACTUAL question that tests basic knowledge. Ask about:
- Definitions (What is X?)
- Basic facts (Who/What/When/Where)
- Simple identification
- Direct information from the text`,
        
        MEDIUM: `Create an APPLICATION question that tests understanding. Ask about:
- Why something happens
- How concepts relate
- Significance or importance
- Cause and effect relationships`,
        
        HARD: `Create an ANALYTICAL question that requires deeper thinking. Ask about:
- Comparing/contrasting concepts
- Evaluating effectiveness
- Analyzing implications
- Critical assessment`
      };

      const systemInstruction = `You are an expert tutor generating MCQs for ${subject}.
Your questions MUST test real subject knowledge from the content.
Forbidden: any mention of exams, CSS, years, frequency, trends, diagrams, past papers, what appears in exams, or meta-discussion about papers.
Focus only on concepts, definitions, applications, analysis within the content.`;
      
      const promptContent = content.slice(0, 1500);
      const userInstruction = `Based on this content from ${subject}, create ONE ${difficulty} multiple-choice question:

${difficultyInstructions[difficulty]}

CONTENT:
"${promptContent}"

IMPORTANT RULES:
1. Extract the MAIN TOPIC or CONCEPT from the content
2. Create a question that tests knowledge of that topic (never exam meta)
3. Never ask about trends, frequency, years, diagrams, exam patterns, past papers
4. Make the question clear and specific; options plausible with one correct
5. The correct answer must be grounded in the content
6. Add a brief revision note explaining the concept

For example:
- If content mentions "Tawheed", ask about its meaning or significance
- If it mentions "CPEC", ask about its objectives or importance
- If it mentions a theory, ask about its definition or application
- If it mentions a historical figure, ask about their contributions

Return JSON:
{
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct": "A",
  "note": "..."
}`;

      // Select model intelligently based on content
      let { model, temperature } = this.selectModelForContent(content);
      // Get next available API key
      let apiKey = apiKeyOverride || apiKeyManager.getNextKey();
      
      const release = await acquireModelSlot(model);
      let response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: 160,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userInstruction }
          ]
        })
      });

      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after') || undefined;
        const error = await response.text();
        console.error('Groq API error:', error);
        
        // Check for rate limit and mark the key
        if (error.includes('rate_limit_exceeded')) {
          apiKeyManager.markRateLimitedRetryAfter(apiKey, retryAfter);
          const ra = retryAfter ? parseFloat(retryAfter) : 8;
          perOrgCooldownUntil = Math.max(perOrgCooldownUntil, Date.now() + Math.ceil(ra * 1000));
          // Try alternates with a different key once
          const alternates = this.alternateModelsForContent(content, model);
          for (const alt of alternates) {
            try {
              // switch model slot
              release();
              model = alt;
              const releaseAlt = await acquireModelSlot(model);
              apiKey = apiKeyManager.getNextKey();
              response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: alt,
                  temperature,
                  max_tokens: 160,
                  messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: userInstruction }
                  ]
                })
              });
              releaseAlt();
              if (response.ok) break;
              const altError = await response.text();
              console.error('Groq API alt model error:', altError);
              if (altError.includes('rate_limit_exceeded')) {
                apiKeyManager.markRateLimitedRetryAfter(apiKey, response.headers.get('retry-after') || undefined);
                continue;
              }
            } catch {}
          }
          if (!response.ok) {
            release();
            throw new Error(`Groq API error: ${error}`);
          }
        }
        
        release();
        throw new Error(`API request failed: ${error}`);
      }

      const data = await response.json();
      release();
      const mcqText = data.choices[0].message.content;
      
      // Parse the JSON response
      let mcq: MCQResponse;
      try {
        // Try to extract JSON from the response
        const jsonMatch = mcqText.match(/\{[\s\S]*\}/); 
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        mcq = JSON.parse(jsonMatch[0]);
        
        // Handle different correct answer formats
        if (mcq.correct && mcq.correct.includes(')')) {
          // Extract just the letter from "B) A renowned mathematician" format
          mcq.correct = mcq.correct.split(')')[0].trim();
        }
      } catch (parseError) {
        console.error('Failed to parse MCQ response:', mcqText);
        throw new Error('Invalid MCQ format received');
      }

      // Validate MCQ quality and forbidden patterns
      if (this.isLowQualityQuestion(mcq)) {
        if (attempt >= 2) return mcq; // stop retrying
        return this.generateMCQ(subject, difficulty, apiKeyOverride, undefined, attempt + 1);
      }

      // Validate relevance with a second pass
      const relevance = await this.validateRelevance(content, mcq);
      if (!relevance.valid) {
        if (attempt >= 2) return mcq;
        return this.generateMCQ(subject, difficulty, apiKeyOverride, undefined, attempt + 1);
      }

      return mcq;
    } catch (error) {
      console.error('Error generating MCQ:', error);
      throw error;
    }
  }

  // Check if question is low quality
  private isLowQualityQuestion(mcq: MCQResponse): boolean {
    const lowQualityPatterns = [
      'which year',
      'when was',
      'in what year',
      'exam pattern',
      'question number',
      'asked in',
      'CSS exam',
      'past paper'
    ];

    const questionLower = mcq.question.toLowerCase();
    return lowQualityPatterns.some(pattern => questionLower.includes(pattern));
  }

  // Reset cursor for a subject
  resetCursor(subject: string): void {
    const normalizedSubject = subject.toLowerCase().replace(/\s+&\s+/g, '-and-').replace(/\s+/g, '-');
    delete cursors[normalizedSubject];
  }
}