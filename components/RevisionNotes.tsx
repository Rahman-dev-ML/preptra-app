'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, BookOpen, ExternalLink, FileText, Video, Globe, Star, Search, Filter } from 'lucide-react';
import { SubjectRevisionNotes, RevisionNote, Resource } from '@/types/revision-notes';

interface RevisionNotesProps {
  subject: string;
}

export default function RevisionNotes({ subject }: RevisionNotesProps) {
  const [notes, setNotes] = useState<SubjectRevisionNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImportance, setSelectedImportance] = useState<string>('all');

  useEffect(() => {
    const loadNotes = async () => {
      try {
        setLoading(true);
        // Normalize subject name for file path
        let normalizedSubject = subject
          .toLowerCase()
          .replace(/\s+&\s+/g, '-and-')
          .replace(/\s+/g, '-')
          .replace(/[()]/g, '');
        
        const response = await fetch(`/data/revision-notes/${normalizedSubject}.json`);
        if (response.ok) {
          const data: SubjectRevisionNotes = await response.json();
          setNotes(data);
        } else {
          console.log(`No revision notes found for ${subject}`);
        }
      } catch (error) {
        console.error('Error loading revision notes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [subject]);

  const toggleNote = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const getResourceIcon = (type: Resource['type']) => {
    switch (type) {
      case 'book': return <BookOpen className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'website': return <Globe className="w-4 h-4" />;
      default: return <ExternalLink className="w-4 h-4" />;
    }
  };

  const getImportanceColor = (importance?: string) => {
    switch (importance) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getImportanceBadge = (importance?: string) => {
    switch (importance) {
      case 'high': return { text: 'High Priority', icon: '🔴' };
      case 'medium': return { text: 'Medium Priority', icon: '🟡' };
      case 'low': return { text: 'Low Priority', icon: '🟢' };
      default: return null;
    }
  };

  // Filter notes based on category, importance, and search query
  const filteredNotes = notes?.notes.filter(note => {
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    const matchesImportance = selectedImportance === 'all' || note.importance === selectedImportance;
    const matchesSearch = searchQuery === '' || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.keyTakeaways?.some(kt => kt.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesImportance && matchesSearch;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (!notes || notes.notes.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Revision Notes Available</h3>
        <p className="text-gray-500">Revision notes for {subject} will be added soon.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-2xl font-bold text-gray-800">{subject} Revision Notes</h2>
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
            <ExternalLink className="w-4 h-4" />
            With Online Resources
          </span>
        </div>
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-medium flex items-center gap-2">
            <span className="text-xl">🔗</span>
            <span>Comprehensive revision notes enriched with curated online resources - articles, PDFs, videos, and primary sources!</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 bg-white text-gray-700"
            />
          </div>

          {/* Category Filter */}
          {notes.categories && notes.categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 bg-white text-gray-700"
            >
              <option value="all">All Categories</option>
              {notes.categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          {/* Importance Filter */}
          <select
            value={selectedImportance}
            onChange={(e) => setSelectedImportance(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 bg-white text-gray-700"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredNotes.length} of {notes.notes.length} notes
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.map((note) => {
          const isExpanded = expandedNotes.has(note.id);
          const importanceBadge = getImportanceBadge(note.importance);

          return (
            <div
              key={note.id}
              className={`bg-white rounded-lg shadow-md border-2 ${getImportanceColor(note.importance)} overflow-hidden`}
            >
              {/* Note Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleNote(note.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {isExpanded ? 
                        <ChevronDown className="w-5 h-5 text-gray-600" /> : 
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      }
                      <h3 className="text-lg font-semibold text-gray-800">{note.title}</h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {importanceBadge && (
                        <span className="flex items-center gap-1">
                          <span>{importanceBadge.icon}</span>
                          <span className="font-medium">{importanceBadge.text}</span>
                        </span>
                      )}
                      {note.category && (
                        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                          {note.category}
                        </span>
                      )}
                      {note.topics && note.topics.length > 0 && (
                        <span className="text-gray-600">
                          {note.topics.length} topic{note.topics.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview text when collapsed */}
                {!isExpanded && (
                  <>
                    <p className="mt-2 text-gray-600 line-clamp-2">{note.content}</p>
                    
                    {/* Resource Preview */}
                    {note.resources && note.resources.length > 0 && (
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-blue-700">
                            📚 {note.resources.length} Resources:
                          </span>
                          <div className="flex items-center gap-3">
                            {note.resources.filter(r => r.type === 'article').length > 0 && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <FileText className="w-4 h-4" />
                                {note.resources.filter(r => r.type === 'article').length}
                              </span>
                            )}
                            {note.resources.filter(r => r.type === 'pdf').length > 0 && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <FileText className="w-4 h-4 text-red-600" />
                                {note.resources.filter(r => r.type === 'pdf').length}
                              </span>
                            )}
                            {note.resources.filter(r => r.type === 'video').length > 0 && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <Video className="w-4 h-4 text-red-600" />
                                {note.resources.filter(r => r.type === 'video').length}
                              </span>
                            )}
                            {note.resources.filter(r => r.type === 'book').length > 0 && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <BookOpen className="w-4 h-4 text-green-600" />
                                {note.resources.filter(r => r.type === 'book').length}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-blue-600 font-medium">Click to view all →</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200">
                  {/* Main Content */}
                  <div className="mt-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>

                  {/* Topics */}
                  {note.topics && note.topics.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-gray-800 mb-2">Related Topics:</h4>
                      <div className="flex flex-wrap gap-2">
                        {note.topics.map((topic, idx) => (
                          <span key={idx} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Takeaways */}
                  {note.keyTakeaways && note.keyTakeaways.length > 0 && (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <Star className="w-5 h-5" />
                        Key Takeaways
                      </h4>
                      <ul className="space-y-1">
                        {note.keyTakeaways.map((takeaway, idx) => (
                          <li key={idx} className="text-blue-800 flex items-start">
                            <span className="mr-2">•</span>
                            <span>{takeaway}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resources */}
                  {note.resources && note.resources.length > 0 && (
                    <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <span className="text-xl">🔗</span>
                        Online Resources ({note.resources.length} available)
                      </h4>
                      <div className="space-y-2">
                        {note.resources.map((resource, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors border border-gray-200">
                            <div className="mt-1">{getResourceIcon(resource.type)}</div>
                            <div className="flex-1">
                              {resource.url ? (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {resource.title}
                                </a>
                              ) : (
                                <span className="font-medium text-gray-800">{resource.title}</span>
                              )}
                              {resource.description && (
                                <p className="text-sm text-gray-600 mt-1">{resource.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* No results message */}
      {filteredNotes.length === 0 && (
        <div className="text-center py-8">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No notes found matching your filters.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedImportance('all');
            }}
            className="mt-2 text-blue-600 hover:text-blue-800 underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

