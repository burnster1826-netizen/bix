import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, Question, QuizMode, QuestionStatus } from './types';
import { generateQuiz } from './services/geminiService';

// This declaration is necessary because pdfjsLib is loaded from a CDN.
declare const pdfjsLib: any;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;


const FileUploadIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V6.75a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6.75v10.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 17.25z" />
  </svg>
);

const CheckIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

const Spinner: React.FC = () => (
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
);

const optionLabels = ['A', 'B', 'C', 'D'];

const SolutionFinder: React.FC<{ question: Question }> = ({ question }) => {
    return (
        <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="font-semibold text-xs mb-2 text-gray-500">SOLUTION</p>
            <div className="flex flex-wrap gap-2 items-center">
                <button
                    onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(question.question)}`, '_blank')}
                    className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-blue-200 transition-colors"
                >
                    Search on Google
                </button>
            </div>
        </div>
    );
};


export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [quiz, setQuiz] = useState<Question[] | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [showFullImageModal, setShowFullImageModal] = useState<boolean>(false);

  const [quizMode, setQuizMode] = useState<QuizMode | null>(null);
  const [timer, setTimer] = useState<number | null>(null); // total duration in seconds
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // remaining time in seconds
  const [stopwatchTime, setStopwatchTime] = useState(0); // elapsed time in seconds for practice
  const [customTime, setCustomTime] = useState<string>('60');
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [savedAnswers, setSavedAnswers] = useState<boolean[]>([]);
  
  // State for JEE Mode UI
  const [markedQuestions, setMarkedQuestions] = useState<boolean[]>([]);
  const [visitedQuestions, setVisitedQuestions] = useState<boolean[]>([]);
  const [questionStatuses, setQuestionStatuses] = useState<QuestionStatus[]>([]);
  
  // State for drag and drop
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const intervalRef = useRef<number | null>(null);


  const resetState = useCallback(() => {
    setAppState(AppState.IDLE);
    setInputFile(null);
    setQuiz(null);
    setUserAnswers([]);
    setSavedAnswers([]);
    setCurrentQuestionIndex(0);
    setError(null);
    setLoadingMessage('');
    setPageImages([]);
    setCroppedImage(null);
    setIsCropping(false);
    setShowFullImageModal(false);
    setQuizMode(null);
    setTimer(null);
    setTimeLeft(null);
    setStopwatchTime(0);
    setShowAnswer(false);
    setMarkedQuestions([]);
    setVisitedQuestions([]);
    setQuestionStatuses([]);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  const handleRetest = () => {
    if (!quiz) return;
    
    setUserAnswers(new Array(quiz.length).fill(''));
    setSavedAnswers(new Array(quiz.length).fill(false));
    setCurrentQuestionIndex(0);
    setTimeLeft(timer);
    setStopwatchTime(0);
    setShowAnswer(false);
    setMarkedQuestions(new Array(quiz.length).fill(false));
    
    const initialVisited = new Array(quiz.length).fill(false);
    initialVisited[0] = true;
    setVisitedQuestions(initialVisited);
    
    setQuestionStatuses(new Array(quiz.length).fill('notVisited'));
    
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
    }
    
    setAppState(AppState.QUIZ);
  };


  useEffect(() => {
    if (appState === AppState.QUIZ && quizMode === 'JEE' && timeLeft !== null) {
      if (timeLeft <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        handleSubmitQuiz();
        return;
      }
      intervalRef.current = window.setInterval(() => {
        setTimeLeft(prevTime => (prevTime ? prevTime - 1 : 0));
      }, 1000);
      return () => {
        if(intervalRef.current) clearInterval(intervalRef.current)
      };
    }
  }, [appState, quizMode, timeLeft]);

  useEffect(() => {
    if (appState === AppState.QUIZ && quizMode === 'PRACTICE') {
      intervalRef.current = window.setInterval(() => {
        setStopwatchTime(prevTime => prevTime + 1);
      }, 1000);
      return () => {
        if(intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [appState, quizMode]);
  
  useEffect(() => {
    if (!quiz) return;
    
    const statuses = quiz.map((_, index) => {
        const isAnswered = userAnswers[index] !== '';
        const isMarked = markedQuestions[index];
        const isVisited = visitedQuestions[index];

        if (isAnswered && isMarked) return 'answeredAndMarked';
        if (isAnswered) return 'answered';
        if (isMarked) return 'marked';
        if (isVisited) return 'notAnswered';
        return 'notVisited';
    });

    setQuestionStatuses(statuses);
}, [userAnswers, markedQuestions, visitedQuestions, quiz]);

  const handleFile = (file: File | undefined) => {
    if (file && (file.type === 'application/pdf' || file.type.startsWith('image/'))) {
      setInputFile(file);
      setError(null);
    } else {
      setInputFile(null);
      setError('Please select a valid PDF or image file (PNG, JPG, WebP).');
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
  
  const processFileAndGenerateQuiz = async () => {
    if (!inputFile) {
      setError('No file selected.');
      return;
    }

    setAppState(AppState.PROCESSING);
    setError(null);

    try {
      let generatedQuiz: Question[] | null = null;
      const parts: any[] = [];
      const localPageImages: string[] = [];

      const basePrompt = `
        You are an expert quiz creator. Analyze the following document (provided as one or more images) and generate a multiple-choice quiz based on its content.
        For each question, you MUST provide:
        1. The question text.
        2. An array of exactly four options.
        3. The correct answer.
        4. A 'pageNumber' (1-indexed) indicating which page the question is from. For single-image documents, this should be 1.
        5. A boolean flag 'isDiagramBased' set to true ONLY if the question specifically refers to a diagram, chart, or visual element that requires seeing the image to answer. Otherwise, it should be false.
        6. If 'isDiagramBased' is true, you MUST also provide a 'diagramBoundingBox' object with the normalized (0-1 scale) coordinates (x, y, width, height) of the diagram on the page. If there is no specific diagram, do not include this field.
      `;
      parts.push({ text: basePrompt });
      
      if (inputFile.type === 'application/pdf') {
        setLoadingMessage('Loading your PDF...');
        const typedArray = new Uint8Array(await inputFile.arrayBuffer());
        const pdf = await pdfjsLib.getDocument(typedArray).promise;

        if (pdf.numPages > 10) {
          throw new Error("This PDF has too many pages. Please use a document with 10 pages or less for best results.");
        }

        for (let i = 1; i <= pdf.numPages; i++) {
          setLoadingMessage(`Analyzing page ${i} of ${pdf.numPages}...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error("Could not create canvas context.");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          const mimeType = 'image/jpeg';
          const base64Image = canvas.toDataURL(mimeType).split(',')[1];
          parts.push({ inlineData: { data: base64Image, mimeType } });
          localPageImages.push(`data:${mimeType};base64,${base64Image}`);
        }

      } else if (inputFile.type.startsWith('image/')) {
        setLoadingMessage('Processing your image...');
        const base64Image = await fileToBase64(inputFile);
        parts.push({ inlineData: { data: base64Image, mimeType: inputFile.type } });
        localPageImages.push(`data:${inputFile.type};base64,${base64Image}`);

      } else {
        throw new Error("Unsupported file type.");
      }

      setPageImages(localPageImages);
      setLoadingMessage('Generating your quiz with Gemini AI...');
      generatedQuiz = await generateQuiz(parts);

      if (generatedQuiz && generatedQuiz.length > 0) {
        setQuiz(generatedQuiz);
        setUserAnswers(new Array(generatedQuiz.length).fill(''));
        setSavedAnswers(new Array(generatedQuiz.length).fill(false));
        setMarkedQuestions(new Array(generatedQuiz.length).fill(false));
        const initialVisited = new Array(generatedQuiz.length).fill(false);
        initialVisited[0] = true;
        setVisitedQuestions(initialVisited);
        setAppState(AppState.QUIZ);
      } else {
        throw new Error('The AI could not generate a quiz from this file. It might be blank or have incompatible formatting.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setAppState(AppState.IDLE);
    }
  };

  const cropImage = useCallback((imageSrc: string, box: { x: number; y: number; width: number; height: number; }): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');

            const sx = box.x * img.width;
            const sy = box.y * img.height;
            const sWidth = box.width * img.width;
            const sHeight = box.height * img.height;
            
            if (sWidth <= 0 || sHeight <= 0) return reject('Invalid bounding box dimensions');

            canvas.width = sWidth;
            canvas.height = sHeight;

            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = (err) => reject(err);
        img.src = imageSrc;
    });
  }, []);

  useEffect(() => {
    const processImage = async () => {
      if (!quiz) return;
      
      const currentQuestion = quiz[currentQuestionIndex];
      const { isDiagramBased, pageNumber, diagramBoundingBox } = currentQuestion;
      
      setCroppedImage(null); // Reset on question change

      if (isDiagramBased && pageNumber && pageImages[pageNumber - 1]) {
          const fullImageSrc = pageImages[pageNumber - 1];
          if (diagramBoundingBox) {
              setIsCropping(true);
              try {
                  const croppedSrc = await cropImage(fullImageSrc, diagramBoundingBox);
                  setCroppedImage(croppedSrc);
              } catch (error) {
                  console.error("Failed to crop image, falling back to full image.", error);
                  setCroppedImage(fullImageSrc); // Fallback to full image on crop error
              } finally {
                  setIsCropping(false);
              }
          } else {
              setCroppedImage(fullImageSrc); // Show full image if no bounding box
          }
      }
    };
    
    processImage();
  }, [currentQuestionIndex, quiz, pageImages, cropImage]);

  const handleSelectPracticeMode = () => {
    setQuizMode('PRACTICE');
    processFileAndGenerateQuiz();
  };

  const handleSelectJeeMode = () => {
    setQuizMode('JEE');
    setAppState(AppState.JEE_TIMER_SETUP);
  };

  const handleStartJeeQuiz = (durationInMinutes: number) => {
    if (durationInMinutes > 0) {
        const durationInSeconds = durationInMinutes * 60;
        setTimer(durationInSeconds);
        setTimeLeft(durationInSeconds);
        processFileAndGenerateQuiz();
    } else {
        setError("Please enter a valid time duration.");
    }
  };
  
  const handleAnswerSelect = (option: string) => {
    if (showAnswer || (quizMode === 'PRACTICE' && savedAnswers[currentQuestionIndex])) return;
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = option;
    setUserAnswers(newAnswers);
  };
  
  const handleSaveAnswer = () => {
      if (userAnswers[currentQuestionIndex]) {
          const newSavedAnswers = [...savedAnswers];
          newSavedAnswers[currentQuestionIndex] = true;
          setSavedAnswers(newSavedAnswers);
      }
  };

  const updateVisited = (index: number) => {
    if (!visitedQuestions[index]) {
        const newVisited = [...visitedQuestions];
        newVisited[index] = true;
        setVisitedQuestions(newVisited);
    }
  };

  const goToNextQuestion = () => {
    if (quiz && currentQuestionIndex < quiz.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      updateVisited(nextIndex);
      setShowAnswer(false);
    }
  };

  const goToPrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIndex);
      updateVisited(prevIndex);
      setShowAnswer(false);
    }
  };

  const jumpToQuestion = (index: number) => {
    if (index >= 0 && quiz && index < quiz.length) {
        setCurrentQuestionIndex(index);
        updateVisited(index);
        setShowAnswer(false);
    }
  };

  const handleClearResponse = () => {
      const newAnswers = [...userAnswers];
      newAnswers[currentQuestionIndex] = '';
      setUserAnswers(newAnswers);
      const newSaved = [...savedAnswers];
      newSaved[currentQuestionIndex] = false;
      setSavedAnswers(newSaved);
      setShowAnswer(false);
  };

  const handleMarkForReview = () => {
      const newMarked = [...markedQuestions];
      newMarked[currentQuestionIndex] = !newMarked[currentQuestionIndex];
      setMarkedQuestions(newMarked);
  };
  
  const handleMarkAndNext = () => {
    const newMarked = [...markedQuestions];
    newMarked[currentQuestionIndex] = !newMarked[currentQuestionIndex];
    setMarkedQuestions(newMarked);
    goToNextQuestion();
  }


  const handleSubmitQuiz = () => {
    if(intervalRef.current) clearInterval(intervalRef.current);
    setAppState(AppState.RESULTS);
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 0) return "00:00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderIdleState = () => (
    <div 
      className="w-full max-w-4xl mx-auto rounded-2xl shadow-lg border border-gray-200 p-8 text-center flex flex-col items-center"
      style={{backgroundColor: '#fffbe6'}}
    >
      {inputFile ? (
        <div className="w-full">
          <p className="text-xl text-gray-800 mb-2 font-semibold break-words">
             Ready to generate a quiz for:
          </p>
          <p className="text-2xl font-bold text-indigo-600 mb-6">{inputFile.name}</p>

          <p className="text-gray-700 mb-6">Choose your quiz mode:</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                  onClick={handleSelectPracticeMode}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-blue-500/50"
              >
                  Practice Mode
              </button>
              <button
                  onClick={handleSelectJeeMode}
                  className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-red-500/50"
              >
                  JEE Mode
              </button>
          </div>
          <button onClick={() => setInputFile(null)} className="text-gray-500 hover:text-indigo-600 mt-8 text-sm font-semibold transition-colors">
            Choose a different file
          </button>
        </div>
      ) : (
        <>
          <h1
            className="text-6xl font-black mb-12 text-center"
            style={{ color: '#FFC000', textShadow: '3px 3px 0px black' }}
          >
            quiz generater
          </h1>
          <div className="w-full max-w-lg">
            <label 
              htmlFor="file-upload" 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full cursor-pointer bg-white/80 hover:bg-white border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-300 ${isDragging ? 'border-indigo-500 scale-105 shadow-xl' : 'border-gray-300'}`}
            >
              <FileUploadIcon className="w-12 h-12 text-gray-400 mb-4" />
              <span className="text-gray-700 text-lg font-semibold">Click to upload a PDF or Image</span>
              <span className="text-gray-500 font-normal mt-1">or drag and drop</span>
              <span className="text-xs text-gray-400 mt-2">Max file size: 10MB</span>
            </label>
            <input id="file-upload" type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
          </div>
        </>
      )}
      {error && <p className="text-red-500 mt-4 font-semibold bg-red-100 p-3 rounded-lg">{error}</p>}
    </div>
  );

  const renderJeeTimerSetupState = () => (
    <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-center flex flex-col items-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Set JEE Mode Timer</h2>
        <p className="text-gray-600 mb-8">Choose a preset or enter a custom time in minutes.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 w-full">
            {[30, 60, 120, 180].map(time => (
                <button key={time} onClick={() => handleStartJeeQuiz(time)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-2 rounded-lg transition-colors">
                    {time === 60 ? '1 hr' : time > 60 ? `${time/60} hrs` : `${time} min`}
                </button>
            ))}
        </div>

        <div className="flex items-center justify-center gap-2 mb-8 w-full max-w-xs">
            <input 
                type="number"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="bg-gray-100 text-gray-800 border border-gray-300 rounded-lg p-3 text-center w-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Custom time"
            />
            <span className="text-gray-600">minutes</span>
        </div>
        
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <button 
            onClick={() => handleStartJeeQuiz(parseInt(customTime, 10))}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-12 rounded-lg text-lg transition-all transform hover:scale-105"
        >
            Start Quiz
        </button>
    </div>
  );


  const renderProcessingState = () => (
    <div className="flex flex-col items-center justify-center text-gray-800">
        <Spinner />
        <p className="mt-4 text-lg font-medium">{loadingMessage}</p>
    </div>
  );
  
  const renderQuizState = () => {
    if (!quiz) return null;
    const currentQuestion = quiz[currentQuestionIndex];

    const statusColors: { [key in QuestionStatus]: string } = {
        answered: 'bg-green-600 text-white',
        notAnswered: 'bg-red-600 text-white',
        marked: 'bg-purple-600 text-white',
        answeredAndMarked: 'bg-purple-600 text-white',
        notVisited: 'bg-white border border-gray-300 text-gray-700',
    };

    const LegendItem: React.FC<{color: string, text: string, hasIcon?: boolean}> = ({color, text, hasIcon}) => (
        <div className="flex items-center text-xs">
            <div className={`w-5 h-5 rounded-md ${color} mr-2 flex items-center justify-center`}>
              {hasIcon && <CheckIcon className="w-3 h-3 text-white"/>}
            </div>
            <span>{text}</span>
        </div>
    );
    
    return (
        <>
            <div className="w-full h-screen max-w-screen-2xl mx-auto flex flex-col text-gray-800 p-2">
                {/* Header */}
                <header className="bg-white rounded-t-lg p-3 flex justify-between items-center border-b border-gray-200">
                    <h1 className="text-xl font-bold">{quizMode === 'JEE' ? 'JEE Mode' : 'Practice Mode'}</h1>
                    {quizMode === 'JEE' && (
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Time Left</p>
                            <p className={`font-mono text-lg ${timeLeft !== null && timeLeft <= 60 ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}>
                                {timeLeft !== null ? formatTime(timeLeft) : '00:00:00'}
                            </p>
                        </div>
                    )}
                    {quizMode === 'PRACTICE' && (
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Time Elapsed</p>
                            <p className="font-mono text-lg text-gray-800">
                                {formatTime(stopwatchTime)}
                            </p>
                        </div>
                    )}
                </header>
                
                {/* Main Content */}
                <div className="flex flex-grow bg-gray-100 min-h-0">
                    {/* Left Panel: Question */}
                    <div className="w-3/4 p-6 flex flex-col overflow-y-auto">
                        <div className="bg-white p-4 rounded-lg mb-4 border border-gray-200">
                            <h2 className="text-lg font-semibold">Question No. {currentQuestionIndex + 1} of {quiz.length}</h2>
                        </div>
                        <div className="flex-grow space-y-5">
                            <p className="text-xl leading-relaxed">{currentQuestion.question}</p>
                            
                            {isCropping && <div className="text-center p-4 text-gray-600">Cropping diagram...</div>}
                            {croppedImage && !isCropping && (
                                <div className="my-4 p-2 border rounded-lg bg-gray-50 flex flex-col items-center">
                                    <img 
                                    src={croppedImage} 
                                    alt="Question Diagram" 
                                    className="rounded-md max-w-full h-auto max-h-80 object-contain cursor-pointer transition-transform hover:scale-105"
                                    onClick={() => setShowFullImageModal(true)}
                                    />
                                    <button onClick={() => setShowFullImageModal(true)} className="text-sm text-blue-600 hover:underline mt-2">
                                    View full page
                                    </button>
                                </div>
                            )}

                            <div className="space-y-3">
                                {currentQuestion.options.map((option, index) => {
                                    const isSelected = userAnswers[currentQuestionIndex] === option;
                                    const isCorrect = option === currentQuestion.correctAnswer;
                                    const isSaved = quizMode === 'PRACTICE' && savedAnswers[currentQuestionIndex];
                                    
                                    let optionClass = `flex items-center p-4 rounded-lg border-2 transition-colors`;
                                    if (showAnswer) {
                                      if (isCorrect) optionClass += ' bg-green-100 border-green-400';
                                      else if (isSelected && !isCorrect) optionClass += ' bg-red-100 border-red-400';
                                      else optionClass += ' bg-white border-gray-300 opacity-60';
                                    } else if (isSaved) {
                                      if (isSelected) optionClass += ' bg-cyan-100 border-cyan-400 opacity-70';
                                      else optionClass += ' bg-white border-gray-300 opacity-60';
                                    } else {
                                      if (isSelected) optionClass += ' bg-cyan-100 border-cyan-400';
                                      else optionClass += ' bg-white border-gray-300 hover:bg-gray-50 cursor-pointer';
                                    }

                                    return (
                                    <label key={index} className={optionClass}>
                                        <input
                                            type="radio"
                                            name="option"
                                            value={option}
                                            checked={isSelected}
                                            onChange={() => handleAnswerSelect(option)}
                                            className="hidden"
                                            disabled={showAnswer || isSaved}
                                        />
                                        <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mr-4 flex items-center justify-center ${isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-gray-400'}`}>
                                            {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                        </div>
                                        <span className="text-lg font-semibold mr-2">{optionLabels[index]})</span>
                                        <span className="text-lg">{option}</span>
                                    </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="border-t border-gray-300 mt-6 pt-4 flex items-center justify-between">
                            <div>
                              <button onClick={quizMode === 'JEE' ? handleMarkAndNext : handleMarkForReview} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg transition-colors">
                                    {markedQuestions[currentQuestionIndex] ? 'Unmark' : (quizMode === 'JEE' ? 'Mark for Review & Next' : 'Mark for Review')}
                                </button>
                                <button onClick={handleClearResponse} className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg ml-4 transition-colors">
                                    Clear Response
                                </button>
                            </div>

                            <div className="flex-1 text-center">
                              {quizMode === 'PRACTICE' && (
                                <>
                                  {!savedAnswers[currentQuestionIndex] && (
                                    <button 
                                      onClick={handleSaveAnswer}
                                      disabled={!userAnswers[currentQuestionIndex]}
                                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors"
                                    >
                                      Save Answer
                                    </button>
                                  )}
                                  {savedAnswers[currentQuestionIndex] && !showAnswer && (
                                    <button onClick={() => setShowAnswer(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                      View Answer
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <button onClick={goToPrevQuestion} disabled={currentQuestionIndex === 0} className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors">
                                    Previous
                                </button>
                                {currentQuestionIndex === quiz.length - 1 ? (
                                    <button onClick={handleSubmitQuiz} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                    Finish & Submit
                                    </button>
                                ) : (
                                    <button onClick={goToNextQuestion} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                    {quizMode === 'JEE' ? 'Save & Next' : 'Next'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Palette */}
                    <div className="w-1/4 bg-white p-4 flex flex-col border-l border-gray-200">
                        <div className="mb-4">
                            <p className="font-bold mb-3 text-center text-gray-700">Question Palette</p>
                            <div className="grid grid-cols-2 gap-3 text-gray-600">
                                <LegendItem color="bg-green-600" text="Answered" />
                                <LegendItem color="bg-red-600" text="Not Answered" />
                                <LegendItem color="bg-purple-600" text="Marked" />
                                <LegendItem color="border border-gray-300" text="Not Visited" />
                                <LegendItem color="bg-purple-600" text="Answered & Marked" hasIcon={true}/>
                            </div>
                        </div>
                        <div className="flex-grow overflow-y-auto border-t border-b border-gray-200 py-4">
                            <div className="grid grid-cols-5 gap-2">
                                {quiz.map((_, index) => {
                                    const status = questionStatuses[index] || 'notVisited';
                                    const isCurrent = index === currentQuestionIndex;
                                    return (
                                        <button 
                                            key={index}
                                            onClick={() => jumpToQuestion(index)}
                                            className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold transition-transform transform hover:scale-110 ${statusColors[status]} ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-white ring-cyan-400' : ''}`}
                                        >
                                            {status === 'answeredAndMarked' ? <CheckIcon className="w-5 h-5 text-white" /> : index + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="mt-4 text-center">
                            <button onClick={handleSubmitQuiz} className="bg-blue-600 hover:bg-blue-700 w-full text-white font-bold py-3 px-4 rounded-lg transition-colors">
                                Submit Test
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {showFullImageModal && quiz && currentQuestion.pageNumber && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowFullImageModal(false)}>
                <img 
                src={pageImages[currentQuestion.pageNumber - 1]} 
                alt="Full page view" 
                className="max-w-full max-h-full object-contain rounded-lg bg-white"
                onClick={(e) => e.stopPropagation()} // Prevent modal from closing when clicking image
                />
            </div>
            )}
        </>
    );
  }

  const renderResultsState = () => {
    if (!quiz) return null;

    const correctAnswers = userAnswers.reduce((acc, answer, index) => {
        const isAnswered = answer !== '';
        if (isAnswered && answer === quiz[index].correctAnswer) {
            return acc + 1;
        }
        return acc;
    }, 0);
    
    const answeredQuestions = userAnswers.filter(a => a !== '').length;
    const incorrectAnswers = answeredQuestions - correctAnswers;
    const notVisitedCount = visitedQuestions.filter(v => !v).length;
    const markedForReviewCount = markedQuestions.filter((m, i) => m && userAnswers[i] === '').length;

    const percentage = quiz.length > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;
    const jeeScore = (correctAnswers * 4) - incorrectAnswers;

    const StatCard: React.FC<{label:string, value: number | string, color: string}> = ({label, value, color}) => (
      <div className={`bg-gray-100 p-4 rounded-lg text-center`}>
          <p className="text-3xl font-bold" style={{color: color}}>{value}</p>
          <p className="text-sm text-gray-600">{label}</p>
      </div>
    );

    const getOptionLabel = (options: string[], answer: string): string => {
        const index = options.indexOf(answer);
        return index !== -1 ? `${optionLabels[index]})` : '';
    };

    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-gray-800">
        <h2 className="text-3xl font-bold text-center mb-2">Quiz Completed!</h2>
        
        {quizMode === 'JEE' ? (
          <p className="text-center text-xl text-gray-600 mb-6">
            Your JEE Mode Score is <span className="text-purple-600 font-bold">{jeeScore}</span>
          </p>
        ) : (
          <p className="text-center text-xl text-gray-600 mb-6">
            You scored <span className="text-purple-600 font-bold">{correctAnswers}</span> out of <span className="text-purple-600 font-bold">{answeredQuestions}</span> ({percentage}%)
          </p>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Correct Answers" value={correctAnswers} color="#16a34a"/>
            <StatCard label="Incorrect Answers" value={incorrectAnswers} color="#dc2626"/>
            <StatCard label="Marked for Review" value={markedForReviewCount} color="#9333ea"/>
            <StatCard label="Not Visited" value={notVisitedCount} color="#6b7280"/>
        </div>

        <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-4 border-t pt-4">
          {quiz.map((question, index) => {
            const userAnswer = userAnswers[index];
            const isCorrect = userAnswer === question.correctAnswer;
            const userAnswerLabel = getOptionLabel(question.options, userAnswer);
            const correctAnswerLabel = getOptionLabel(question.options, question.correctAnswer);

            return (
              <div key={index} className={`p-4 rounded-lg border ${!userAnswer ? 'bg-gray-50 border-gray-200' : isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className="font-semibold text-lg mb-2">{index + 1}. {question.question}</p>
                <p className={`text-sm font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  Your answer: {userAnswer ? `${userAnswerLabel} ${userAnswer}` : "Not Answered"}
                </p>
                {!isCorrect && userAnswer && <p className="text-sm font-medium text-blue-700">Correct answer: {correctAnswerLabel} {question.correctAnswer}</p>}
                
                <SolutionFinder question={question} />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
          <button onClick={handleRetest} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors w-full sm:w-auto">
            Retest
          </button>
          <button onClick={resetState} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors w-full sm:w-auto">
            Try Another File
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.JEE_TIMER_SETUP:
        return renderJeeTimerSetupState();
      case AppState.PROCESSING:
        return renderProcessingState();
      case AppState.QUIZ:
        return renderQuizState();
      case AppState.RESULTS:
        return renderResultsState();
      case AppState.IDLE:
      default:
        return renderIdleState();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 text-gray-800 flex items-center justify-center p-4">
      {renderContent()}
    </main>
  );
}