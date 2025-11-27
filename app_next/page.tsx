import Link from 'next/link'
import { BookOpen, FileText, Brain, Edit, ChevronLeft, CheckCircle } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-gray-900">PrepTra</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Prepare. Perform. Prevail. Prosper.
          </h1>
        </div>

        {/* CSS Preparation Card */}
        <div className="max-w-6xl mx-auto mb-12">
          <Link href="/css" className="block">
            <div className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden border border-gray-200">
              <div className="bg-gradient-to-r from-gray-900 to-gray-700 p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">CSS Preparation</h2>
                <p className="text-gray-200">Central Superior Services - Complete Study Platform</p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-700">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-gray-600 mt-1 mr-3 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">All 46 CSS Subjects with Deep Analysis</div>
                      <div className="text-sm text-gray-600">Comprehensive coverage of all subjects with expert insights</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-gray-600 mt-1 mr-3 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">AI MCQs Based on Past Paper Patterns</div>
                      <div className="text-sm text-gray-600">Smart practice questions matching actual CSS exam style</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-gray-600 mt-1 mr-3 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">25 Years Past Papers with Insights</div>
                      <div className="text-sm text-gray-600">Complete archive with analysis and trend identification</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-gray-600 mt-1 mr-3 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Expert Analysis & Study Resources</div>
                      <div className="text-sm text-gray-600">Curated materials linked to past paper topics</div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-gray-700 font-semibold">Start Your CSS Journey</span>
                  <ChevronLeft className="w-6 h-6 text-gray-400 transform rotate-180" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Why Choose PrepTra Section */}
        <div className="container mx-auto px-4 py-12 mt-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">WHY PREPTRA</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            <div className="bg-white rounded-none shadow-sm p-6 sm:p-8 text-center border border-gray-300 hover:border-gray-500 transition-all duration-200">
              <div className="w-16 sm:w-20 h-16 sm:h-20 bg-gray-100 rounded-none flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl sm:text-3xl text-gray-700">📊</span>
              </div>
              <h4 className="font-bold text-lg mb-2 text-gray-800">Exclusive Past Paper Analysis</h4>
              <p className="text-gray-600 text-sm sm:text-base">
                Deep analysis of 20 years of CSS papers revealing hidden patterns, recurring themes, and examiner preferences - insights unavailable anywhere else
              </p>
            </div>
            
            <div className="bg-white rounded-none shadow-sm p-6 sm:p-8 text-center border border-gray-300 hover:border-gray-500 transition-all duration-200">
              <div className="w-16 sm:w-20 h-16 sm:h-20 bg-gray-100 rounded-none flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl sm:text-3xl text-gray-700">🎯</span>
              </div>
              <h4 className="font-bold text-lg mb-2 text-gray-800">AI MCQs From Real Papers</h4>
              <p className="text-gray-600 text-sm sm:text-base">
                AI generates practice questions based on actual CSS exam patterns and topics - not random MCQs, but targeted practice that matches real exam style
              </p>
            </div>
            
            <div className="bg-white rounded-none shadow-sm p-6 sm:p-8 text-center border border-gray-300 hover:border-gray-500 transition-all duration-200">
              <div className="w-16 sm:w-20 h-16 sm:h-20 bg-gray-100 rounded-none flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl sm:text-3xl text-gray-700">📚</span>
              </div>
              <h4 className="font-bold text-lg mb-2 text-gray-800">Paper-Based Study Resources</h4>
              <p className="text-gray-600 text-sm sm:text-base">
                Curated articles, PDFs, and videos selected based on actual CSS paper topics - every resource directly helps with questions that have appeared in exams
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
