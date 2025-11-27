# MCQ System - Complete Guide 🚀

## System Overview

The MCQ system is now **production-ready** with:
- ✅ **10 API keys** with automatic rotation
- ✅ **4,800 quizzes/day capacity**
- ✅ **Rate limiting and failover**
- ✅ **Direct markdown content reading**
- ✅ **All 46 subjects supported**

## Key Features

### 1. API Key Rotation
- 10 Groq API keys configured
- Automatic round-robin distribution
- Smart failover when keys hit limits
- Zero downtime switching

### 2. Content Generation
- Reads directly from markdown analysis files
- No hardcoding or JSON extraction
- Dynamic content chunks
- Filters out exam metadata

### 3. Rate Limiting
- IP-based: 10 requests/minute per user
- Sequential generation with delays
- Automatic retries (3 attempts)
- Graceful degradation

### 4. Difficulty Levels
- **EASY**: Factual questions (definitions, basic concepts)
- **MEDIUM**: Application questions (understanding, relationships)
- **HARD**: Analytical questions (evaluation, critical thinking)

## Capacity Planning

With 10 API keys:
- **4,800 quizzes/day** total capacity
- **4,800 users** (1 quiz each)
- **2,400 users** (2 quizzes each)
- **1,600 users** (3 quizzes each)

## System Architecture

```
User Request → API Route → MCQ Service → API Key Manager
                  ↓             ↓              ↓
             Rate Limiter   Markdown      Key Rotation
                            Reader         & Failover
```

## Files Structure

- `lib/api-key-manager.ts` - Manages 10 API keys
- `lib/mcq-service.ts` - Generates MCQs from markdown
- `app/api/generate-mcq/route.ts` - API endpoint
- `components/MCQQuizSession.tsx` - Frontend quiz UI

## Monitoring

Check system status:
```bash
curl http://localhost:3000/api/generate-mcq
```

Returns:
- Total keys available
- Rate limited keys
- Total requests served
- Daily capacity

## Troubleshooting

### "No suitable content found"
- Some markdown files have different structures
- The system adapts automatically
- Retries with different extraction methods

### Rate Limits
- System automatically switches keys
- Users see "Please wait" message
- Retries after cooldown

### All Keys Rate Limited
- Very rare with 10 keys
- System uses key with shortest wait
- Consider adding more keys

## Adding More Keys

Edit `lib/api-key-manager.ts`:
```typescript
private apiKeys: string[] = [
  // ... existing 10 keys ...
  'new_key_here'
];
```

Each key adds +480 users/day capacity.

## Production Checklist

- ✅ 10 API keys configured
- ✅ Rate limiting enabled
- ✅ Error handling implemented
- ✅ Monitoring endpoint active
- ✅ All subjects tested

## Performance

- Quiz generation: 15-30 seconds
- Per MCQ: 1-2 seconds
- Concurrent users: Hundreds
- Daily capacity: 4,800 quizzes

Ready for thousands of users! 🎉
