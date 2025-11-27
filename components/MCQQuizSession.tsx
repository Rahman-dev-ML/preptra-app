'use client';

import { useState, useEffect } from 'react';
import { Brain, ChevronRight, Trophy, Target, CheckCircle, XCircle, BookOpen, TrendingUp, AlertCircle } from 'lucide-react';

interface MCQ {
  question: string;
  options: string[];
  correct: string;
  note?: string;
  sectionIndex?: number;
  relevance_score?: number;
  validation_status?: string;
  sectionInfo?: {
    totalSections: number;
    usedSections: number;
    currentSectionIndex: number;
  };
}

interface QuizSessionProps {
  subject: string;
}

export default function MCQQuizSession({ subject }: QuizSessionProps) {
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | null>(null);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [coverageInfo, setCoverageInfo] = useState<any>(null);

  const TOTAL_QUESTIONS = 10;
  
  // Remove coverage info fetching - not needed anymore
  useEffect(() => {
    // Coverage info removed - we generate from markdown directly
  }, []);

  const startQuizSession = async (selectedDifficulty: 'EASY' | 'MEDIUM' | 'HARD') => {
    setDifficulty(selectedDifficulty);
    setLoading(true);
    setSessionStarted(true);
    
    try {
      // Normalize subject name for API - convert & back to "and" and remove parentheses
      const normalizedSubject = subject
        .replace(/[()]/g, '') // Remove parentheses but keep their contents
        .replace(/\s+&\s+/g, ' and ') // Replace & with "and"
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // Prefer pool first: instant
      const poolRes = await fetch(`/api/mcqs?subject=${encodeURIComponent(normalizedSubject)}&difficulty=${selectedDifficulty}&count=${TOTAL_QUESTIONS}`);
      if (poolRes.ok) {
        const poolData = await poolRes.json();
        const poolMcqs = poolData.mcqs || [];
        if (poolMcqs.length > 0) {
          setMcqs(poolMcqs);
          setSelectedAnswers(new Array(poolMcqs.length).fill(''));
          // Show FOMO coverage message if available
          if (poolData.coverage?.usedSections) {
            setCoverageInfo({ subject, totalSections: poolData.coverage.targetedSections || 8, usedSections: poolData.coverage.usedSections });
          }
          setLoading(false);
          setLoadingProgress(100);
          return;
        }
      }

      // Prefer streaming: render as soon as first MCQ arrives
      const url = `/api/generate-mcq/stream?subject=${encodeURIComponent(subject)}&difficulty=${selectedDifficulty}&count=${TOTAL_QUESTIONS}`;
      const es = new EventSource(url);
      const streamed: MCQ[] = [];

      const done = new Promise<void>((resolve, reject) => {
        es.addEventListener('mcq', (evt: MessageEvent) => {
          try {
            const mcq = JSON.parse(evt.data);
            streamed.push(mcq);
            // Show first items immediately
            if (streamed.length <= 5) {
              setMcqs([...streamed]);
              setSelectedAnswers(new Array(streamed.length).fill(''));
            } else {
              // Update progress for later ones
              setLoadingProgress(Math.min(95, Math.round((streamed.length / TOTAL_QUESTIONS) * 100)));
            }
          } catch {}
        });
        es.addEventListener('end', (evt: MessageEvent) => {
          es.close();
          resolve();
        });
        es.addEventListener('error', () => {
          es.close();
          reject(new Error('stream error'));
        });
      });

      try {
        await done;
        if (streamed.length > 0) {
          // If we streamed some, finalize list
          setMcqs(streamed);
          setSelectedAnswers(new Array(streamed.length).fill(''));
          setLoading(false);
          setLoadingProgress(100);
          return;
        }
      } catch {
        // fallthrough to batch
      }

      // Fallback to batch API if streaming failed or yielded nothing
      setLoadingProgress(20);
      const res = await fetch('/api/generate-mcq', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, difficulty: selectedDifficulty, count: TOTAL_QUESTIONS })
      });
      setLoadingProgress(60);
      
      if (!res.ok) {
        const error = await res.json();
        console.error('Batch MCQ generation failed:', error);
        
        // Fallback to individual requests if batch fails
        console.log('Falling back to individual MCQ generation...');
        const validMcqs: MCQ[] = [];
        
        for (let i = 0; i < TOTAL_QUESTIONS && validMcqs.length < 10; i++) {
          setLoadingProgress(60 + Math.round((i / TOTAL_QUESTIONS) * 30));
          
          try {
            const fallbackRes = await fetch('/api/generate-mcq', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subject, difficulty: selectedDifficulty })
            });
            
            if (fallbackRes.ok) {
              const mcq = await fallbackRes.json();
            if (mcq && mcq.question && mcq.options && mcq.correct) {
              validMcqs.push(mcq);
              }
            }
            
            // Small delay between fallback requests
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`Fallback MCQ ${i + 1} error:`, err);
          }
        }
        
        if (validMcqs.length < 5) {
          throw new Error('Unable to generate enough MCQs. Please try again.');
        }
        
        setMcqs(validMcqs);
        setSelectedAnswers(new Array(validMcqs.length).fill(''));
        setLoadingProgress(100);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      const validMcqs = data.mcqs || [];
      
      if (validMcqs.length === 0) {
        throw new Error('Failed to generate any valid MCQs');
      }
      
      // If some MCQs failed after all retries
      if (validMcqs.length < TOTAL_QUESTIONS) {
        console.log(`Generated ${validMcqs.length} MCQs ${data.fromCache ? 'from cache' : ''} (requested: ${TOTAL_QUESTIONS})`);
      }
      
      // Extract coverage info from MCQs if available
      if (validMcqs.length > 0) {
        const mcqWithInfo = validMcqs.find((mcq: MCQ) => mcq.sectionInfo);
        if (mcqWithInfo?.sectionInfo) {
          setCoverageInfo({
            subject,
            totalSections: mcqWithInfo.sectionInfo.totalSections,
            usedSections: mcqWithInfo.sectionInfo.usedSections,
            coveragePercent: Math.round((mcqWithInfo.sectionInfo.usedSections / mcqWithInfo.sectionInfo.totalSections) * 100)
          });
        }
      }
      
      setMcqs(validMcqs);
      setSelectedAnswers(new Array(validMcqs.length).fill(''));
      setLoadingProgress(100);
    } catch (error: any) {
      console.error('Error loading quiz:', error);
      
      // Check if it's a missing analysis file error
      if (error.message?.includes('Analysis file not found') || 
          error.error?.includes('Analysis file not found')) {
        alert(`Sorry, the analysis for ${subject} is not available yet. Please try a different subject.`);
      } else {
        alert('Failed to load quiz. Please try again.');
      }
      
      setSessionStarted(false);
      setDifficulty(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentIndex] = answer;
    setSelectedAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentIndex < mcqs.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowResult(false);
    } else {
      // Quiz complete
      setQuizComplete(true);
    }
  };

  const submitAnswer = () => {
    setShowResult(true);
  };

  const calculateScore = () => {
    let correct = 0;
    mcqs.forEach((mcq, index) => {
      if (selectedAnswers[index] === mcq.correct) {
        correct++;
      }
    });
    return correct;
  };

  const getPerformanceMessage = (score: number) => {
    const percentage = (score / mcqs.length) * 100;
    if (percentage >= 80) return "Outstanding! You have excellent command of the subject.";
    if (percentage >= 60) return "Good job! Keep practicing to master the remaining topics.";
    return "Review the topics and practice more to improve.";
  };

  if (!sessionStarted) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <Brain className="w-20 h-20 text-gray-700 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {subject} - Complete Assessment
            </h2>
            <p className="text-gray-600 mb-4">
              15 carefully selected questions based on CSS exam patterns
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <BookOpen className="inline w-4 h-4 mr-2" />
              Our AI analyzes years of CSS past papers to bring you the most relevant practice questions
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 text-center mb-4">
              Select Difficulty Level
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => startQuizSession('EASY')}
                className="p-6 bg-green-50 border-2 border-green-200 rounded-lg hover:border-green-400 transition-colors"
              >
                <Target className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-green-700 mb-1">Easy</h4>
                <p className="text-sm text-green-600">Test fundamental concepts</p>
              </button>

              <button
                onClick={() => startQuizSession('MEDIUM')}
                className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg hover:border-yellow-400 transition-colors"
              >
                <Target className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-yellow-700 mb-1">Medium</h4>
                <p className="text-sm text-yellow-600">Apply your knowledge</p>
              </button>

              <button
                onClick={() => startQuizSession('HARD')}
                className="p-6 bg-red-50 border-2 border-red-200 rounded-lg hover:border-red-400 transition-colors"
              >
                <Target className="w-12 h-12 text-red-600 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-red-700 mb-1">Hard</h4>
                <p className="text-sm text-red-600">Analyze and evaluate</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-12">
          <div className="text-center space-y-4">
            <Brain className="w-20 h-20 text-indigo-600 animate-pulse mx-auto" />
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                Preparing Your CSS-Focused Quiz
              </h3>
              <p className="text-gray-600 mb-2">
                We're analyzing past paper patterns to generate 15 unique questions just for you.
              </p>
              <p className="text-sm text-gray-500">
                Progress: {loadingProgress}% - This may take up to 30 seconds...
              </p>
            </div>
            <div className="flex justify-center space-x-2 mt-6">
              <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    const score = calculateScore();
              const percentage = Math.round((score / mcqs.length) * 100);

    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>
            <div className="text-6xl font-bold text-gray-700 mb-4">
              {score}/{mcqs.length}
            </div>
            <div className="text-2xl text-gray-600 mb-4">{percentage}%</div>
            <p className="text-lg text-gray-700 mb-4">{getPerformanceMessage(score)}</p>
            

          </div>

          <div className="bg-gradient-to-r from-red-50 via-orange-50 to-yellow-50 rounded-lg mb-6 border-2 border-orange-200 overflow-hidden">
            <div className="bg-red-600 text-white text-center py-2">
              <p className="text-sm font-bold animate-pulse">
                ⏰ CSS EXAM APPROACHING - DON'T LEAVE GAPS IN YOUR PREPARATION!
              </p>
            </div>
            <div className="p-6">
              <div className="flex items-center mb-4">
                <AlertCircle className="w-6 h-6 text-red-600 mr-2 animate-pulse" />
                <h3 className="text-lg font-bold text-gray-800">⚠️ Important CSS Topics You Haven't Seen Yet!</h3>
              </div>
              {(() => {
                const totalTargeted = coverageInfo?.totalSections || 10;
                const practicedSectionIndices = Array.from(new Set(mcqs.map((m:any) => m.sectionIndex ?? m.sectionInfo?.currentSectionIndex)));
                const usedSections = practicedSectionIndices.length;
                const remaining = Math.max(0, totalTargeted - usedSections);
                
                // Section names for different subjects
                const gsaSectionNames = [
                  "Contributions of Muslim Scientists",
                  "Environmental Issues",
                  "Human Body Systems and Health",
                  "Earth Sciences",
                  "Astronomy and Space Science",
                  "Technology and Computing",
                  "Chemistry and Minerals",
                  "Mathematical Reasoning",
                  "Definitions and Terminology",
                  "Differentiation Concepts"
                ];
                
                const agriSectionNames = [
                  "Crop Production & Agronomy",
                  "Horticulture & Vegetables",
                  "Soil Science & Fertility",
                  "Agricultural Economics",
                  "Plant Protection & IPM",
                  "Genetics & Plant Breeding",
                  "Agricultural Engineering",
                  "Livestock & Animal Sciences",
                  "Forestry & Range Management",
                  "Agricultural Extension"
                ];
                
                const botanySectionNames = [
                  "Algal and Bryophyte Life Cycles",
                  "Plant Taxonomy and Classification",
                  "Plant Anatomy and Tissue Organization",
                  "Photosynthesis and Respiration",
                  "Plant Hormones and Growth",
                  "Ecology and Environmental Botany",
                  "Genetics and Evolution",
                  "Fungi and Lichens",
                  "Vascular Plants",
                  "Cell Biology and Molecular Processes"
                ];
                
                const englishSectionNames = [
                  "Grammar - Voice and Tense",
                  "Grammar - Reported Speech",
                  "Common Errors",
                  "Vocabulary - Synonyms",
                  "Vocabulary - Antonyms",
                  "Common Idioms",
                  "Word Pairs",
                  "Prepositions",
                  "Articles",
                  "Punctuation Basics"
                ];
                
                const islamicHistorySectionNames = [
                  "Pre-Islamic Arabia and Early Islam",
                  "Rightly Guided Caliphs (Khulafa-e-Rashideen)",
                  "Umayyad Dynasty",
                  "Abbasid Dynasty",
                  "Muslim Spain (Al-Andalus)",
                  "Ottoman Empire",
                  "Islamic Contributions to Science and Philosophy",
                  "Modern Muslim World",
                  "Sufism and Islamic Governance",
                  "Cultural and Architectural Heritage"
                ];
                
                const businessAdminSectionNames = [
                  "Management Fundamentals",
                  "Leadership and Motivation",
                  "Organizational Structure",
                  "Marketing Basics",
                  "Financial Management Fundamentals",
                  "Financial Analysis",
                  "Operations and Supply Chain",
                  "Human Resource Management",
                  "Strategic Management",
                  "Business Environment"
                ];
                
                const currentAffairsSectionNames = [
                  "National Politics & Governance",
                  "International Relations & Diplomacy",
                  "Economic Developments",
                  "Social Issues & Human Rights",
                  "Science & Technology Updates",
                  "Environmental & Climate Issues",
                  "Sports & Cultural Events",
                  "Defense & Security Affairs",
                  "Regional & Global Conflicts",
                  "Media & Communication"
                ];
                
                const pakistanAffairsSectionNames = [
                  "Constitutional & Legal Framework",
                  "Political History & System",
                  "Geography & Natural Resources",
                  "Economy & Development",
                  "Social Structure & Demographics",
                  "Education & Cultural Heritage",
                  "Foreign Policy & Relations",
                  "Defense & Security",
                  "Provincial Affairs & Local Govt",
                  "Contemporary Challenges"
                ];

                const physicsSectionNames = [
                  "Mechanics & Motion",
                  "Thermodynamics & Heat",
                  "Waves & Oscillations",
                  "Electricity & Magnetism",
                  "Optics & Light",
                  "Modern Physics & Quantum",
                  "Nuclear Physics",
                  "Atomic Structure",
                  "Electronics & Circuits",
                  "Relativity & Astrophysics"
                ];

                const chemistrySectionNames = [
                  "Organic Chemistry",
                  "Inorganic Chemistry",
                  "Physical Chemistry",
                  "Analytical Chemistry",
                  "Biochemistry",
                  "Environmental Chemistry",
                  "Industrial Chemistry",
                  "Chemical Bonding",
                  "Thermochemistry",
                  "Electrochemistry"
                ];

                const economicsSectionNames = [
                  "Microeconomics",
                  "Macroeconomics",
                  "Development Economics",
                  "International Trade",
                  "Public Finance",
                  "Monetary Economics",
                  "Economic Planning",
                  "Agricultural Economics",
                  "Industrial Economics",
                  "Economic Thought & Theory"
                ];

                const politicalScienceSectionNames = [
                  "Political Theory",
                  "Comparative Politics",
                  "International Relations",
                  "Public Administration",
                  "Constitutional Law",
                  "Political Parties & Systems",
                  "Democratic Institutions",
                  "Political Ideologies",
                  "Governance & Policy",
                  "Political Movements"
                ];

                const internationalRelationsSectionNames = [
                  "International Law",
                  "Diplomacy & Foreign Policy",
                  "International Organizations",
                  "Security Studies",
                  "Regional Studies",
                  "International Political Economy",
                  "Conflict Resolution",
                  "Global Governance",
                  "International Trade",
                  "Contemporary Issues"
                ];

                const computerScienceSectionNames = [
                  "Programming & Algorithms",
                  "Data Structures",
                  "Database Systems",
                  "Computer Networks",
                  "Operating Systems",
                  "Software Engineering",
                  "Computer Architecture",
                  "Artificial Intelligence",
                  "Web Technologies",
                  "Cybersecurity"
                ];

                const accountancySectionNames = [
                  "Financial Accounting",
                  "Cost Accounting",
                  "Management Accounting",
                  "Auditing Principles",
                  "Taxation",
                  "Corporate Accounting",
                  "Financial Analysis",
                  "Accounting Standards",
                  "Budgeting & Control",
                  "International Accounting"
                ];

                const psychologySectionNames = [
                  "Cognitive Psychology",
                  "Social Psychology",
                  "Developmental Psychology",
                  "Personality Theories",
                  "Abnormal Psychology",
                  "Research Methods",
                  "Learning & Memory",
                  "Psychological Testing",
                  "Clinical Psychology",
                  "Applied Psychology"
                ];

                const sociologySectionNames = [
                  "Social Theory",
                  "Social Institutions",
                  "Social Change",
                  "Social Stratification",
                  "Family & Marriage",
                  "Education & Society",
                  "Religion & Society",
                  "Urban Sociology",
                  "Rural Sociology",
                  "Social Research Methods"
                ];

                const philosophySectionNames = [
                  "Ancient Philosophy",
                  "Medieval Philosophy",
                  "Modern Philosophy",
                  "Ethics & Moral Philosophy",
                  "Logic & Reasoning",
                  "Metaphysics",
                  "Epistemology",
                  "Political Philosophy",
                  "Philosophy of Religion",
                  "Contemporary Philosophy"
                ];

                const geographySectionNames = [
                  "Physical Geography",
                  "Human Geography",
                  "Economic Geography",
                  "Political Geography",
                  "Urban Geography",
                  "Regional Geography",
                  "Environmental Geography",
                  "Population Geography",
                  "Agricultural Geography",
                  "Geographic Methods"
                ];

                const historySectionNames = [
                  "Ancient History",
                  "Medieval History",
                  "Modern History",
                  "Colonial Period",
                  "Independence Movement",
                  "Post-Independence Era",
                  "Social History",
                  "Economic History",
                  "Cultural History",
                  "Historical Methods"
                ];

                const islamicStudiesSectionNames = [
                  "Quran & Tafseer",
                  "Hadith & Sunnah",
                  "Islamic Jurisprudence (Fiqh)",
                  "Islamic History",
                  "Islamic Philosophy",
                  "Islamic Ethics",
                  "Comparative Religion",
                  "Islamic Economics",
                  "Islamic Political System",
                  "Contemporary Islamic Issues"
                ];

                const englishLiteratureSectionNames = [
                  "Poetry & Poets",
                  "Drama & Theatre",
                  "Novel & Fiction",
                  "Literary Criticism",
                  "Literary Movements",
                  "Shakespeare Studies",
                  "Modern Literature",
                  "Postcolonial Literature",
                  "Literary Theory",
                  "Comparative Literature"
                ];

                const urduLiteratureSectionNames = [
                  "Classical Poetry",
                  "Modern Poetry",
                  "Prose & Fiction",
                  "Drama & Theatre",
                  "Literary Criticism",
                  "Ghazal & Nazm",
                  "Short Stories",
                  "Literary Movements",
                  "Language & Linguistics",
                  "Contemporary Literature"
                ];

                const mathematicsSectionNames = [
                  "Algebra & Number Theory",
                  "Calculus & Analysis",
                  "Geometry & Trigonometry",
                  "Statistics & Probability",
                  "Linear Algebra",
                  "Differential Equations",
                  "Mathematical Logic",
                  "Applied Mathematics",
                  "Discrete Mathematics",
                  "Mathematical Methods"
                ];

                const statisticsSectionNames = [
                  "Descriptive Statistics",
                  "Inferential Statistics",
                  "Probability Theory",
                  "Hypothesis Testing",
                  "Regression Analysis",
                  "Sampling Methods",
                  "Statistical Distributions",
                  "Time Series Analysis",
                  "Multivariate Analysis",
                  "Applied Statistics"
                ];

                const publicAdministrationSectionNames = [
                  "Administrative Theory",
                  "Public Policy & Analysis",
                  "Human Resource Management",
                  "Financial Administration",
                  "Organizational Behavior",
                  "Governance & Ethics",
                  "Development Administration",
                  "Local Government",
                  "Administrative Law",
                  "Public Service Management"
                ];

                const anthropologySectionNames = [
                  "Physical Anthropology",
                  "Cultural Anthropology",
                  "Social Anthropology",
                  "Archaeological Methods",
                  "Linguistic Anthropology",
                  "Applied Anthropology",
                  "Kinship & Marriage",
                  "Religion & Belief Systems",
                  "Economic Anthropology",
                  "Political Anthropology"
                ];

                const journalismSectionNames = [
                  "News Writing & Reporting",
                  "Media Law & Ethics",
                  "Print Journalism",
                  "Broadcast Journalism",
                  "Digital Media",
                  "Public Relations",
                  "Media Research",
                  "Communication Theory",
                  "International Journalism",
                  "Media Management"
                ];

                const genderStudiesSectionNames = [
                  "Gender Theory",
                  "Women's Rights",
                  "Gender & Development",
                  "Feminist Movements",
                  "Gender & Politics",
                  "Gender & Economics",
                  "Gender & Education",
                  "Gender & Health",
                  "Gender & Law",
                  "Contemporary Gender Issues"
                ];

                const environmentalSciencesSectionNames = [
                  "Environmental Chemistry",
                  "Environmental Biology",
                  "Pollution Control",
                  "Climate Change",
                  "Natural Resource Management",
                  "Environmental Impact Assessment",
                  "Waste Management",
                  "Environmental Policy",
                  "Sustainable Development",
                  "Environmental Monitoring"
                ];

                const zoologySectionNames = [
                  "Animal Diversity",
                  "Animal Physiology",
                  "Animal Behavior",
                  "Ecology & Evolution",
                  "Developmental Biology",
                  "Genetics & Heredity",
                  "Animal Taxonomy",
                  "Conservation Biology",
                  "Parasitology",
                  "Animal Biotechnology"
                ];

                const geologySectionNames = [
                  "Mineralogy & Petrology",
                  "Structural Geology",
                  "Stratigraphy & Paleontology",
                  "Economic Geology",
                  "Environmental Geology",
                  "Hydrogeology",
                  "Geophysics",
                  "Geochemistry",
                  "Engineering Geology",
                  "Petroleum Geology"
                ];

                const lawSectionNames = [
                  "Constitutional Law",
                  "Criminal Law",
                  "Civil Law",
                  "International Law",
                  "Administrative Law",
                  "Commercial Law",
                  "Family Law",
                  "Property Law",
                  "Human Rights Law",
                  "Legal System & Jurisprudence"
                ];

                const criminologySectionNames = [
                  "Crime Theories",
                  "Criminal Justice System",
                  "Police & Law Enforcement",
                  "Courts & Legal Process",
                  "Corrections & Rehabilitation",
                  "Juvenile Justice",
                  "White Collar Crime",
                  "Victimology",
                  "Crime Prevention",
                  "Criminal Investigation"
                ];

                const governanceSectionNames = [
                  "Governance Theory",
                  "Public Policy Analysis",
                  "Policy Formulation",
                  "Policy Implementation",
                  "Good Governance",
                  "Democratic Governance",
                  "E-Governance",
                  "Policy Evaluation",
                  "Stakeholder Management",
                  "Governance Reforms"
                ];

                const townPlanningSectionNames = [
                  "Urban Planning Principles",
                  "Land Use Planning",
                  "Transportation Planning",
                  "Housing & Development",
                  "Infrastructure Planning",
                  "Environmental Planning",
                  "Zoning & Regulations",
                  "Smart Cities",
                  "Urban Design",
                  "Planning Law & Policy"
                ];

                const constitutionalLawSectionNames = [
                  "Constitutional Principles",
                  "Fundamental Rights",
                  "Separation of Powers",
                  "Federal Structure",
                  "Judicial Review",
                  "Constitutional Amendments",
                  "Emergency Provisions",
                  "Executive Powers",
                  "Legislative Process",
                  "Constitutional Interpretation"
                ];

                const internationalLawSectionNames = [
                  "Sources of International Law",
                  "State Sovereignty",
                  "Treaties & Agreements",
                  "International Organizations",
                  "Diplomatic Law",
                  "Human Rights Law",
                  "International Criminal Law",
                  "Law of the Sea",
                  "International Trade Law",
                  "Dispute Resolution"
                ];

                const punjabiSectionNames = [
                  "Punjabi Grammar",
                  "Classical Literature",
                  "Modern Poetry",
                  "Prose & Fiction",
                  "Folk Literature",
                  "Sufi Poetry",
                  "Translation Skills",
                  "Literary Criticism",
                  "Cultural Studies",
                  "Language Development"
                ];

                const sindhiSectionNames = [
                  "Sindhi Grammar",
                  "Classical Poetry",
                  "Modern Literature",
                  "Shah Latif's Poetry",
                  "Prose & Fiction",
                  "Folk Literature",
                  "Translation Skills",
                  "Literary Movements",
                  "Cultural Heritage",
                  "Language Studies"
                ];

                const pashtoSectionNames = [
                  "Pashto Grammar",
                  "Classical Poetry",
                  "Khushal Khan Khattak",
                  "Rahman Baba",
                  "Modern Literature",
                  "Folk Literature",
                  "Translation Skills",
                  "Literary Criticism",
                  "Cultural Studies",
                  "Pashto Proverbs"
                ];

                const balochiSectionNames = [
                  "Balochi Grammar",
                  "Classical Literature",
                  "Modern Poetry",
                  "Folk Literature",
                  "Oral Traditions",
                  "Translation Skills",
                  "Literary Development",
                  "Cultural Studies",
                  "Language Structure",
                  "Contemporary Literature"
                ];

                const persianSectionNames = [
                  "Persian Grammar",
                  "Classical Poetry",
                  "Hafez & Rumi",
                  "Persian Prose",
                  "Literary History",
                  "Translation Skills",
                  "Sufi Literature",
                  "Modern Persian",
                  "Literary Criticism",
                  "Cultural Context"
                ];

                const arabicSectionNames = [
                  "Arabic Grammar (Nahw)",
                  "Arabic Morphology (Sarf)",
                  "Classical Literature",
                  "Quranic Arabic",
                  "Poetry & Prose",
                  "Translation Skills",
                  "Modern Arabic",
                  "Literary Criticism",
                  "Arabic Rhetoric",
                  "Language Skills"
                ];

                // Subject detection
                const isGSA = subject.toLowerCase().includes('general science');
                const isAgri = subject.toLowerCase().includes('agriculture');
                const isBotany = subject.toLowerCase().includes('botany');
                const isEnglish = subject.toLowerCase().includes('english') && (subject.toLowerCase().includes('precis') || subject.toLowerCase().includes('composition'));
                const isIslamicHistory = subject.toLowerCase().includes('islamic history');
                const isBusinessAdmin = subject.toLowerCase().includes('business admin');
                const isCurrentAffairs = subject.toLowerCase().includes('current affairs');
                const isPakistanAffairs = subject.toLowerCase().includes('pakistan affairs');
                const isPhysics = subject.toLowerCase().includes('physics');
                const isChemistry = subject.toLowerCase().includes('chemistry');
                const isEconomics = subject.toLowerCase().includes('economics');
                const isPoliticalScience = subject.toLowerCase().includes('political science');
                const isInternationalRelations = subject.toLowerCase().includes('international relations');
                const isComputerScience = subject.toLowerCase().includes('computer science');
                const isAccountancy = subject.toLowerCase().includes('accountancy');
                const isPsychology = subject.toLowerCase().includes('psychology');
                const isSociology = subject.toLowerCase().includes('sociology');
                const isPhilosophy = subject.toLowerCase().includes('philosophy');
                const isGeography = subject.toLowerCase().includes('geography');
                const isHistory = subject.toLowerCase().includes('history') && !subject.toLowerCase().includes('islamic history');
                const isIslamicStudies = subject.toLowerCase().includes('islamic studies');
                const isEnglishLiterature = subject.toLowerCase().includes('english literature');
                const isUrduLiterature = subject.toLowerCase().includes('urdu literature');
                const isMathematics = subject.toLowerCase().includes('mathematics');
                const isStatistics = subject.toLowerCase().includes('statistics');
                const isPublicAdmin = subject.toLowerCase().includes('public admin');
                const isAnthropology = subject.toLowerCase().includes('anthropology');
                const isJournalism = subject.toLowerCase().includes('journalism');
                const isGenderStudies = subject.toLowerCase().includes('gender studies');
                const isEnvironmentalSciences = subject.toLowerCase().includes('environmental sciences');
                const isZoology = subject.toLowerCase().includes('zoology');
                const isGeology = subject.toLowerCase().includes('geology');
                const isLaw = subject.toLowerCase().includes('law') && !subject.toLowerCase().includes('constitutional law') && !subject.toLowerCase().includes('international law');
                const isCriminology = subject.toLowerCase().includes('criminology');
                const isGovernance = subject.toLowerCase().includes('governance') || subject.toLowerCase().includes('public polic');
                const isTownPlanning = subject.toLowerCase().includes('town planning') || subject.toLowerCase().includes('urban management');
                const isConstitutionalLaw = subject.toLowerCase().includes('constitutional law');
                const isInternationalLaw = subject.toLowerCase().includes('international law');
                const isPunjabi = subject.toLowerCase().includes('punjabi');
                const isSindhi = subject.toLowerCase().includes('sindhi');
                const isPashto = subject.toLowerCase().includes('pashto');
                const isBalochi = subject.toLowerCase().includes('balochi');
                const isPersian = subject.toLowerCase().includes('persian');
                const isArabic = subject.toLowerCase().includes('arabic');
                
                const sectionNames = isGSA ? gsaSectionNames : 
                                   isAgri ? agriSectionNames : 
                                   isBotany ? botanySectionNames :
                                   isEnglish ? englishSectionNames :
                                   isIslamicHistory ? islamicHistorySectionNames :
                                   isBusinessAdmin ? businessAdminSectionNames :
                                   isCurrentAffairs ? currentAffairsSectionNames :
                                   isPakistanAffairs ? pakistanAffairsSectionNames :
                                   isPhysics ? physicsSectionNames :
                                   isChemistry ? chemistrySectionNames :
                                   isEconomics ? economicsSectionNames :
                                   isPoliticalScience ? politicalScienceSectionNames :
                                   isInternationalRelations ? internationalRelationsSectionNames :
                                   isComputerScience ? computerScienceSectionNames :
                                   isAccountancy ? accountancySectionNames :
                                   isPsychology ? psychologySectionNames :
                                   isSociology ? sociologySectionNames :
                                   isPhilosophy ? philosophySectionNames :
                                   isGeography ? geographySectionNames :
                                   isHistory ? historySectionNames :
                                   isIslamicStudies ? islamicStudiesSectionNames :
                                   isEnglishLiterature ? englishLiteratureSectionNames :
                                   isUrduLiterature ? urduLiteratureSectionNames :
                                   isMathematics ? mathematicsSectionNames :
                                   isStatistics ? statisticsSectionNames :
                                   isPublicAdmin ? publicAdministrationSectionNames :
                                   isAnthropology ? anthropologySectionNames :
                                   isJournalism ? journalismSectionNames :
                                   isGenderStudies ? genderStudiesSectionNames :
                                   isEnvironmentalSciences ? environmentalSciencesSectionNames :
                                   isZoology ? zoologySectionNames :
                                   isGeology ? geologySectionNames :
                                   isLaw ? lawSectionNames :
                                   isCriminology ? criminologySectionNames :
                                   isGovernance ? governanceSectionNames :
                                   isTownPlanning ? townPlanningSectionNames :
                                   isConstitutionalLaw ? constitutionalLawSectionNames :
                                   isInternationalLaw ? internationalLawSectionNames :
                                   isPunjabi ? punjabiSectionNames :
                                   isSindhi ? sindhiSectionNames :
                                   isPashto ? pashtoSectionNames :
                                   isBalochi ? balochiSectionNames :
                                   isPersian ? persianSectionNames :
                                   isArabic ? arabicSectionNames :
                                   Array.from({length: 10}, (_, i) => `Section ${i + 1}`);
                
                if (true) {
                  return (
                    <>
                      {/* Simple Progress Card */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 mb-4 border border-gray-300">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-lg font-bold text-gray-800">📊 Your Progress</h4>
                          <span className="text-2xl font-bold text-blue-600">{usedSections}/{totalTargeted}</span>
                        </div>
                        <div className="w-full bg-gray-300 rounded-full h-3 mb-4">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((usedSections / totalTargeted) * 100, 100)}%` }}
                          />
                        </div>
                        
                        {/* Sections List */}
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-green-700 mb-2">✅ Practiced Sections ({usedSections}):</p>
                            <div className="flex flex-wrap gap-2">
                              {practicedSectionIndices.sort((a, b) => a - b).map(idx => (
                                <span key={idx} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-300">
                                  {sectionNames[idx] || `Section ${idx + 1}`}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {remaining > 0 && (
                            <div>
                              <p className="text-sm font-semibold text-red-700 mb-2">❌ Remaining Sections ({remaining}):</p>
                              <div className="flex flex-wrap gap-2">
                                {Array.from({length: totalTargeted}, (_, i) => i)
                                  .filter(idx => !practicedSectionIndices.includes(idx))
                                  .map(idx => (
                                    <span key={idx} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full border border-red-300">
                                      {sectionNames[idx] || `Section ${idx + 1}`}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    
                      {/* FOMO Message */}
                      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-5 text-center shadow-lg mb-4">
                        <p className="text-xl font-bold mb-2">
                          🚨 {remaining} Critical Sections Remaining!
                        </p>
                        <p className="text-sm opacity-95">
                          Each section contains unique MCQs from CSS past papers. Don't miss out!
                        </p>
                      </div>
                    
                      {/* Call to Action */}
                      <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 text-center">
                        <p className="text-blue-900 font-bold text-lg mb-2">
                          🔄 Ready for More?
                        </p>
                        <p className="text-blue-700 text-sm">
                          Take the quiz again to practice <span className="font-bold">different sections</span> with fresh questions.
                        </p>
                      </div>
                    </>
                  );
              } else {
                const targeted = coverageInfo?.totalSections || 10;
                const usedSects = coverageInfo?.usedSections || 0;
                const remaining = Math.max(0, targeted - usedSects);
                return (
                  <p className="text-gray-700 mb-2">
                    You attempted <strong>{usedSects}</strong> of <strong>{targeted}</strong> sections. <strong>{remaining}</strong> sections left. Take the quiz again to unlock <strong>unique, never-seen</strong> MCQs from the remaining sections based on past papers.
                  </p>
                );
                }
              })()}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Review Your Answers</h3>
            {mcqs.map((mcq, index) => {
              const userAnswer = selectedAnswers[index];
              const isCorrect = userAnswer === mcq.correct;
              
              return (
                <div key={index} className={`p-4 rounded-lg border ${
                  isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium">Question {index + 1}</span>
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-1">{mcq.question}</p>
                  {!isCorrect && (
                    <p className="text-sm text-gray-600">
                      Your answer: {userAnswer} | Correct: {mcq.correct}
                    </p>
                  )}
                  {mcq.note ? (
                    <p className="text-xs text-gray-600 mt-2 italic">
                      <strong>Note:</strong> {mcq.note}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* FOMO Section */}
          <div className="mt-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-xl font-bold mb-2 flex items-center">
                  <Trophy className="w-6 h-6 mr-2" />
                  You're on track to master {subject}!
                </h4>
                {(() => {
                  const totalTargeted = coverageInfo?.totalSections || 10;
                  const usedSections = coverageInfo?.usedSections || new Set(mcqs.map((m:any) => m.sectionIndex ?? m.sectionInfo?.currentSectionIndex)).size;
                  const remaining = Math.max(0, totalTargeted - usedSections);
                  
                  if (remaining > 0) {
                    return (
                      <div>
                    <p className="text-lg mb-1">
                      ⏰ Don't leave gaps: <span className="font-bold text-yellow-300">{remaining} sections</span> still unattempted.
                    </p>
                    <p className="text-sm opacity-90">
                      Take the quiz again to unlock new MCQs from the remaining sections.
                    </p>
                      </div>
                    );
                  } else {
                    return (
                      <div>
                        <p className="text-lg mb-2">
                          🌟 Excellent! All topics mastered!
                        </p>
                        <p className="text-sm opacity-90">
                          Keep practicing with fresh questions to maintain your competitive edge.
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              {(() => {
                const totalTargeted = coverageInfo?.totalSections || 10;
                const usedSections = coverageInfo?.usedSections || new Set(mcqs.map((m:any) => m.sectionIndex ?? m.sectionInfo?.currentSectionIndex)).size;
                const remaining = Math.max(0, totalTargeted - usedSections);
                
                if (remaining > 0) {
                  return (
                    <>
                      <button
                        onClick={() => window.location.reload()}
                        className="flex-1 bg-white text-purple-600 py-3 px-6 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg animate-pulse"
                      >
                        Unlock Remaining Topics NOW →
                      </button>
                      <button
                        onClick={() => window.location.href = '/css'}
                        className="flex-1 bg-purple-700 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-800 transition-colors"
                      >
                        Start Different Subject
                      </button>
                    </>
                  );
                } else {
                  return (
                    <>
                      <button
                        onClick={() => window.location.reload()}
                        className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                      >
                        Practice More Questions
                      </button>
                      <button
                        onClick={() => window.location.href = '/css'}
                        className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                      >
                        Start Different Subject
                      </button>
                    </>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentMCQ = mcqs[currentIndex];
  if (!currentMCQ) return null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Header */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">
            Question {currentIndex + 1} of {TOTAL_QUESTIONS}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {difficulty} Level
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          {currentMCQ.question}
        </h3>

        <div className="space-y-3 mb-6">
          {Array.isArray(currentMCQ.options) ? currentMCQ.options.map((option) => {
            const letter = (option || '').toString().charAt(0);
            const isSelected = selectedAnswers[currentIndex] === letter;
            const isCorrect = letter === currentMCQ.correct;
            
            return (
              <button
                key={option}
                onClick={() => handleAnswer(letter)}
                disabled={showResult}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  showResult 
                    ? isCorrect 
                      ? 'bg-green-50 border-green-500 text-green-800' 
                      : isSelected 
                        ? 'bg-red-50 border-red-500 text-red-800' 
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    : isSelected
                      ? 'bg-blue-50 border-blue-500 text-blue-800'
                      : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
                </div>
              </button>
            );
          }) : null}
        </div>

        {!showResult ? (
          <button
            onClick={submitAnswer}
            disabled={!selectedAnswers[currentIndex]}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              selectedAnswers[currentIndex]
                ? 'bg-gray-700 text-white hover:bg-gray-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Submit Answer
          </button>
        ) : (
          <>
            {currentMCQ.note ? (
            <div className={`p-4 rounded-lg mb-4 ${
              selectedAnswers[currentIndex] === currentMCQ.correct
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <p className="text-sm text-gray-700">
                <strong>Revision Note:</strong> {currentMCQ.note}
              </p>
            </div>
            ) : null}

            <button
              onClick={nextQuestion}
              className="w-full bg-gray-700 text-white py-3 rounded-lg hover:bg-gray-800 font-medium flex items-center justify-center"
            >
              {currentIndex < mcqs.length - 1 ? 'Next Question' : 'View Results'}
              <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}