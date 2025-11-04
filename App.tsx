
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, Question, QuizMode, QuestionStatus } from './types';
import { generateQuiz } from './services/geminiService';

// This declaration is necessary because these libraries are loaded from a CDN.
declare const pdfjsLib: any;
declare const jspdf: any;
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

const FullScreenEnterIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
  </svg>
);

const FullScreenExitIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25" />
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

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <div className="flex items-center justify-center my-4">
        <label htmlFor="toggle-switch" className="flex items-center cursor-pointer">
            <div className="relative">
                <input
                    id="toggle-switch"
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <div className={`block w-14 h-8 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'transform translate-x-6' : ''}`}></div>
            </div>
            <div className="ml-3 text-gray-700 font-medium">{label}</div>
        </label>
    </div>
);


export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [apiKey, setApiKey] = useState<string>('AIzaSyBbn0bFilIVdZTk7RJ5fhEmw8v4MPX2BnQ');
  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [quiz, setQuiz] = useState<Question[] | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]); // Current selection
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
  
  // Practice Mode State
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [savedAnswers, setSavedAnswers] = useState<boolean[]>([]); // Tracks if answer is locked in Practice mode

  // JEE Mode State
  const [jeeSavedAnswers, setJeeSavedAnswers] = useState<string[]>([]); // Tracks answers submitted for evaluation
  const [markedQuestions, setMarkedQuestions] = useState<boolean[]>([]);
  const [visitedQuestions, setVisitedQuestions] = useState<boolean[]>([]);
  const [questionStatuses, setQuestionStatuses] = useState<QuestionStatus[]>([]);
  
  // State for drag and drop
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // State for separate answer key
  const [useSeparateAnswerKey, setUseSeparateAnswerKey] = useState<boolean>(false);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Full Screen State
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const intervalRef = useRef<number | null>(null);

  const resetState = useCallback(() => {
    setAppState(AppState.IDLE);
    setInputFiles([]);
    setQuiz(null);
    setUserAnswers([]);
    setSavedAnswers([]);
    setJeeSavedAnswers([]);
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
    setUseSeparateAnswerKey(false);
    setAnswerKeyFile(null);
    setIsGeneratingPdf(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  const handleRetest = () => {
    if (!quiz) return;
    
    setUserAnswers(new Array(quiz.length).fill(''));
    setSavedAnswers(new Array(quiz.length).fill(false));
    setJeeSavedAnswers(new Array(quiz.length).fill(''));
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
    
    if (quizMode === 'JEE') {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
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
        const isAnswered = quizMode === 'JEE' 
            ? jeeSavedAnswers[index] !== '' 
            : userAnswers[index] !== '';
        
        const isMarked = markedQuestions[index];
        const isVisited = visitedQuestions[index];

        if (isAnswered && isMarked) return 'answeredAndMarked';
        if (isAnswered) return 'answered';
        if (isMarked) return 'marked';
        if (isVisited) return 'notAnswered';
        return 'notVisited';
    });

    setQuestionStatuses(statuses);
}, [userAnswers, jeeSavedAnswers, markedQuestions, visitedQuestions, quiz, quizMode]);


  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      setInputFiles([]);
      return;
    }

    const validFiles: File[] = [];
    const errors: string[] = [];
    const maxSize = 100 * 1024 * 1024; // 100 MB

    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        errors.push(`File "${file.name}" exceeds 100MB.`);
        continue;
      }
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        validFiles.push(file);
      } else {
        errors.push(`File "${file.name}" has an unsupported type.`);
      }
    }

    setInputFiles(validFiles);

    if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      setError(null);
    }
  };


  const handleAnswerKeyFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAnswerKeyFile(null);
      return;
    }

    // 10MB limit for answer key
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setAnswerKeyFile(null);
      setError('Answer key file size exceeds 10MB. Please select a smaller file.');
      return;
    }

    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      setAnswerKeyFile(file);
      setError(null);
    } else {
      setAnswerKeyFile(null);
      setError('Please select a valid PDF or image file for the answer key.');
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
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
    handleFiles(event.dataTransfer.files);
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
  
  const processFileAndGenerateQuiz = async () => {
    if (inputFiles.length === 0) {
      setError('No files selected.');
      return;
    }

    setAppState(AppState.PROCESSING);
    setError(null);

    // Helper function to process a file (PDF or image) and return its parts.
    const processFileToParts = async (fileToProcess: File, onProgress: (msg: string) => void): Promise<{ parts: any[], images: string[] }> => {
        const fileParts: any[] = [];
        const fileImages: string[] = [];

        if (fileToProcess.type === 'application/pdf') {
            onProgress(`Loading ${fileToProcess.name}...`);
            const typedArray = new Uint8Array(await fileToProcess.arrayBuffer());
            const pdf = await pdfjsLib.getDocument(typedArray).promise;

            const pagePromises = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                pagePromises.push(
                    (async (pageNum) => {
                        onProgress(`Analyzing page ${pageNum} of ${pdf.numPages} from ${fileToProcess.name}...`);
                        const page = await pdf.getPage(pageNum);
                        const viewport = page.getViewport({ scale: 1.5 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        if (!context) throw new Error("Could not create canvas context.");
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: context, viewport: viewport }).promise;
                        const mimeType = 'image/jpeg';
                        const quality = 0.9;
                        const base64Image = canvas.toDataURL(mimeType, quality).split(',')[1];
                        return { 
                            part: { inlineData: { data: base64Image, mimeType } }, 
                            image: `data:${mimeType};base64,${base64Image}`,
                            pageNum: pageNum
                        };
                    })(i)
                );
            }
            const processedPages = await Promise.all(pagePromises);
            processedPages.sort((a,b) => a.pageNum - b.pageNum); // Ensure order
            
            processedPages.forEach(p => {
                fileParts.push(p.part);
                fileImages.push(p.image);
            });

        } else if (fileToProcess.type.startsWith('image/')) {
            onProgress(`Processing image ${fileToProcess.name}...`);
            const base64Image = await fileToBase64(fileToProcess);
            fileParts.push({ inlineData: { data: base64Image, mimeType: fileToProcess.type } });
            fileImages.push(`data:${fileToProcess.type};base64,${base64Image}`);
        } else {
            throw new Error(`Unsupported file type for ${fileToProcess.name}.`);
        }

        return { parts: fileParts, images: fileImages };
    };

    try {
      let generatedQuiz: Question[] | null = null;
      const parts: any[] = [];
      let localPageImages: string[] = [];
      
      let basePrompt = `
        You are an expert quiz creator. Analyze the following document (provided as one or more images) and generate a multiple-choice quiz based on its content.
        For each question, you MUST provide:
        1. The question text.
        2. An array of exactly four options.
        3. The correct answer.
        4. A 'pageNumber' (1-indexed) indicating which page the question is from. For single-image documents, this should be 1.
        5. A boolean flag 'isDiagramBased' set to true ONLY if the question specifically refers to a diagram, chart, or visual element that requires seeing the image to answer. Otherwise, it should be false.
        6. If 'isDiagramBased' is true, you MUST also provide a 'diagramBoundingBox' object with the normalized (0-1 scale) coordinates (x, y, width, height) that tightly crops the area containing both the question text and the visual element it refers to. This provides essential context for the user.
      `;

      if (useSeparateAnswerKey && answerKeyFile) {
        basePrompt = `
          You are an expert quiz creator. You will be provided with two documents. The first is the question paper, and the second is the answer key.
          Your task is to:
          1. Analyze the question paper to generate multiple-choice questions.
          2. For each question generated, refer to the provided answer key to determine the correct answer.
          3. It is crucial that the 'correctAnswer' field in your response is populated using the information from the answer key document, not your own knowledge.

          For each question, you MUST provide:
          - The question text.
          - An array of exactly four options.
          - The correct answer, identified from the answer key.
          - A 'pageNumber' (1-indexed) indicating which page the question is from in the question paper.
          - A boolean 'isDiagramBased' set to true if the question requires a diagram to be answered.
          - A 'diagramBoundingBox' if 'isDiagramBased' is true, which should tightly crop the area containing both the question text and the visual element it refers to.
        `;
      }
      
      parts.push({ text: basePrompt });
      
      for (const file of inputFiles) {
        const fileResult = await processFileToParts(file, setLoadingMessage);
        parts.push(...fileResult.parts);
        localPageImages.push(...fileResult.images);
      }
      
      if (useSeparateAnswerKey && answerKeyFile) {
        parts.push({ text: "--- END OF QUESTION PAPER, ANSWER KEY STARTS HERE ---" });
        const answerKeyResult = await processFileToParts(answerKeyFile, setLoadingMessage);
        parts.push(...answerKeyResult.parts);
      }

      setPageImages(localPageImages);
      setLoadingMessage('Generating your quiz with Gemini AI...');
      generatedQuiz = await generateQuiz(parts, apiKey);

      if (generatedQuiz && generatedQuiz.length > 0) {
        setQuiz(generatedQuiz);
        setUserAnswers(new Array(generatedQuiz.length).fill(''));
        setSavedAnswers(new Array(generatedQuiz.length).fill(false));
        setJeeSavedAnswers(new Array(generatedQuiz.length).fill(''));
        setMarkedQuestions(new Array(generatedQuiz.length).fill(false));
        const initialVisited = new Array(generatedQuiz.length).fill(false);
        initialVisited[0] = true;
        setVisitedQuestions(initialVisited);
        
        if (quizMode === 'JEE') {
            setAppState(AppState.QUIZ_READY);
        } else {
            setAppState(AppState.QUIZ);
        }
      } else {
        throw new Error('The AI could not generate a quiz from this file. It might be blank or have incompatible formatting.');
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("API key not valid") || err.message.includes("API key is missing"))) {
        setError("Your API key appears to be invalid. Please enter a valid key to continue.");
        setApiKey(''); // Force re-entry of the key
      } else {
        setError(err.message || 'An unexpected error occurred.');
      }
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
  
  const handleSaveAnswerPractice = () => {
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

      if (quizMode === 'JEE') {
          const newSaved = [...jeeSavedAnswers];
          newSaved[currentQuestionIndex] = '';
          setJeeSavedAnswers(newSaved);
      } else {
          const newSaved = [...savedAnswers];
          newSaved[currentQuestionIndex] = false;
          setSavedAnswers(newSaved);
      }
      setShowAnswer(false);
  };

  const handleMarkForReviewPractice = () => {
      const newMarked = [...markedQuestions];
      newMarked[currentQuestionIndex] = !newMarked[currentQuestionIndex];
      setMarkedQuestions(newMarked);
  };
  
  // For both "Mark for Review & Next" and "Unmark & Next"
  const handleMarkAndNext = () => {
    const newMarked = [...markedQuestions];
    newMarked[currentQuestionIndex] = !newMarked[currentQuestionIndex];
    setMarkedQuestions(newMarked);
    goToNextQuestion();
  };

  // For "Save & Next" button in JEE Mode
  const handleSaveAndNextJEE = () => {
      if (userAnswers[currentQuestionIndex]) {
          const newSaved = [...jeeSavedAnswers];
          newSaved[currentQuestionIndex] = userAnswers[currentQuestionIndex];
          setJeeSavedAnswers(newSaved);
      }
      goToNextQuestion();
  };

  // For "Save & Mark for Review" button in JEE Mode
  const handleSaveAndMarkForReviewJEE = () => {
      if (userAnswers[currentQuestionIndex]) {
          const newSaved = [...jeeSavedAnswers];
          newSaved[currentQuestionIndex] = userAnswers[currentQuestionIndex];
          setJeeSavedAnswers(newSaved);
          
          const newMarked = [...markedQuestions];
          if (!newMarked[currentQuestionIndex]) { // Only mark, don't unmark with this button
              newMarked[currentQuestionIndex] = true;
              setMarkedQuestions(newMarked);
          }
      }
      goToNextQuestion();
  };


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

  // --- Full Screen Logic ---
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'f') {
        toggleFullScreen();
      }
      // The 'Escape' key is handled natively by browsers to exit fullscreen.
      // We explicitly listen for it here to make the functionality clear and robust.
      if (key === 'escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
    };

    if (appState === AppState.QUIZ) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [appState, toggleFullScreen]);

  const ApiKeySetup: React.FC<{ onApiKeySubmit: (key: string) => void }> = ({ onApiKeySubmit }) => {
    const [localKey, setLocalKey] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localKey.trim()) {
            onApiKeySubmit(localKey.trim());
        }
    };
    
    return (
      <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 text-center flex flex-col items-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to the PDF Quiz Generator</h1>
        <p className="text-gray-600 mb-6">
          To get started, please enter your Google AI Studio API key below.
        </p>
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <input
            type="password"
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            placeholder="AIzaSy... (example)"
            className="w-full px-4 py-3 mb-4 text-gray-800 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            aria-label="API Key Input"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-indigo-500/50 disabled:bg-indigo-300 disabled:cursor-not-allowed"
            disabled={!localKey.trim()}
          >
            Start Generating
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-4">
          You can get your API key from your{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Google AI Studio settings
          </a>.
        </p>
      </div>
    );
  };

  const renderIdleState = () => {
    const isGenerateDisabled = useSeparateAnswerKey && !answerKeyFile;
    return (
    <div 
      className="w-full max-w-4xl mx-auto rounded-2xl shadow-lg border border-gray-200 p-8 text-center flex flex-col items-center"
      style={{backgroundColor: '#fffbe6'}}
    >
      {inputFiles.length > 0 ? (
        <div className="w-full flex flex-col items-center">
          <p className="text-xl text-gray-800 mb-2 font-semibold break-words">
             Ready to generate a quiz for:
          </p>
          <div className="text-lg font-bold text-indigo-600 mb-6 flex flex-col items-center space-y-1">
            {inputFiles.map((file, index) => <span key={index}>{file.name}</span>)}
          </div>

          <ToggleSwitch
            checked={useSeparateAnswerKey}
            onChange={(checked) => {
                setUseSeparateAnswerKey(checked);
                if (!checked) {
                    setAnswerKeyFile(null); // Clear answer key file if toggled off
                }
            }}
            label="Provide separate answer key"
          />

          {useSeparateAnswerKey && (
              <div className="mt-2 mb-6 w-full max-w-md">
                  {answerKeyFile ? (
                      <div className="text-center">
                          <p className="text-green-700 font-semibold">Answer key: {answerKeyFile.name}</p>
                          <button onClick={() => setAnswerKeyFile(null)} className="text-sm text-red-500 hover:underline">Remove</button>
                      </div>
                  ) : (
                      <label 
                        htmlFor="answer-key-upload" 
                        className={`w-full cursor-pointer bg-white/80 hover:bg-white border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all duration-300 border-gray-300`}
                      >
                        <span className="text-gray-700 text-sm font-semibold">Click to upload answer key</span>
                        <span className="text-xs text-gray-400 mt-1">PDF or Image (Max 10MB)</span>
                      </label>
                  )}
                  <input id="answer-key-upload" type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={handleAnswerKeyFileChange} />
              </div>
          )}

          <p className="text-gray-700 mb-6">Choose your quiz mode:</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                  onClick={handleSelectPracticeMode}
                  disabled={isGenerateDisabled}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-blue-500/50 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
              >
                  Practice Mode
              </button>
              <button
                  onClick={handleSelectJeeMode}
                  disabled={isGenerateDisabled}
                  className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold py-3 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-red-500/50 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
              >
                  JEE Mode
              </button>
          </div>
          <button onClick={() => setInputFiles([])} className="text-gray-500 hover:text-indigo-600 mt-8 text-sm font-semibold transition-colors">
            Choose different files
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
              <span className="text-gray-700 text-lg font-semibold">Click to upload PDF(s) or Image(s)</span>
              <span className="text-gray-500 font-normal mt-1">or drag and drop</span>
              <span className="text-xs text-gray-400 mt-2">Max file size: 100MB per file</span>
            </label>
            <input id="file-upload" type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} multiple />
          </div>
        </>
      )}
      {error && <p className="text-red-500 mt-4 font-semibold bg-red-100 p-3 rounded-lg whitespace-pre-line">{error}</p>}
    </div>
    );
  };

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

  const handleEnterQuizFullScreen = () => {
    document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
    setAppState(AppState.QUIZ);
  };

  const renderQuizReadyState = () => (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 text-center flex flex-col items-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Your Quiz is Ready!</h2>
        <p className="text-gray-600 mb-8">
            JEE Mode will start in a distraction-free full-screen environment.
        </p>
        <button
            onClick={handleEnterQuizFullScreen}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-indigo-500/50"
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
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold">{quizMode === 'JEE' ? 'JEE Mode' : 'Practice Mode'}</h1>
                        <button onClick={toggleFullScreen} className="text-gray-500 hover:text-gray-800" title={isFullScreen ? "Exit Full Screen (f or Esc)" : "Enter Full Screen (f)"}>
                          {isFullScreen ? <FullScreenExitIcon className="w-6 h-6" /> : <FullScreenEnterIcon className="w-6 h-6" />}
                        </button>
                    </div>
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
                            
                            {isCropping && <div className="text-center p-4 text-gray-600">Extracting question context...</div>}
                            {croppedImage && !isCropping && (
                                <div className="my-4 p-2 border rounded-lg bg-gray-50 flex flex-col items-center">
                                    <img 
                                    src={croppedImage} 
                                    alt="Question Context" 
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
                                    const isSavedPractice = quizMode === 'PRACTICE' && savedAnswers[currentQuestionIndex];
                                    
                                    let optionClass = `flex items-center p-4 rounded-lg border-2 transition-colors`;
                                    if (showAnswer) {
                                      if (isCorrect) optionClass += ' bg-green-100 border-green-400';
                                      else if (isSelected && !isCorrect) optionClass += ' bg-red-100 border-red-400';
                                      else optionClass += ' bg-white border-gray-300 opacity-60';
                                    } else if (isSavedPractice) {
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
                                            disabled={showAnswer || isSavedPractice}
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
                            {quizMode === 'PRACTICE' ? (
                                <>
                                    <div>
                                        <button onClick={handleMarkForReviewPractice} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg transition-colors">
                                            {markedQuestions[currentQuestionIndex] ? 'Unmark' : 'Mark for Review'}
                                        </button>
                                        <button onClick={handleClearResponse} className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg ml-4 transition-colors">
                                            Clear Response
                                        </button>
                                    </div>
                                    <div className="flex-1 text-center">
                                        {!savedAnswers[currentQuestionIndex] && (
                                        <button onClick={handleSaveAnswerPractice} disabled={!userAnswers[currentQuestionIndex]} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                            Save Answer
                                        </button>
                                        )}
                                        {savedAnswers[currentQuestionIndex] && !showAnswer && (
                                        <button onClick={() => setShowAnswer(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                            View Answer
                                        </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={goToPrevQuestion} disabled={currentQuestionIndex === 0} className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors">
                                            Previous
                                        </button>
                                        {currentQuestionIndex === quiz.length - 1 ? (
                                            <button onClick={handleSubmitQuiz} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Finish & Submit</button>
                                        ) : (
                                            <button onClick={goToNextQuestion} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Next</button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <> {/* JEE Mode Buttons */}
                                    <div className="flex items-center gap-4">
                                        <button onClick={goToPrevQuestion} disabled={currentQuestionIndex === 0} className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors">
                                            Previous
                                        </button>
                                        <button onClick={handleClearResponse} className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                            Clear Response
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={handleMarkAndNext} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg transition-colors">
                                            {markedQuestions[currentQuestionIndex] ? 'Unmark & Next' : 'Mark for Review & Next'}
                                        </button>
                                        <button onClick={handleSaveAndMarkForReviewJEE} disabled={!userAnswers[currentQuestionIndex]} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                            Save & Mark for Review
                                        </button>
                                        {currentQuestionIndex === quiz.length - 1 ? (
                                            <button onClick={handleSubmitQuiz} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                                Finish & Submit
                                            </button>
                                        ) : (
                                            <button onClick={handleSaveAndNextJEE} disabled={!userAnswers[currentQuestionIndex]} className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                                                Save & Next
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
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

  const handleDownloadPdf = async () => {
    if (!quiz) return;
    setIsGeneratingPdf(true);
    try {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const margin = 15;
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = margin;

        const checkPageBreak = (heightNeeded: number) => {
            if (y + heightNeeded > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
        };
        
        const answersForScoring = quizMode === 'JEE' ? jeeSavedAnswers : userAnswers;
        const answeredQuestions = answersForScoring.filter(a => a !== '').length;
        const correctAnswers = answersForScoring.reduce((acc, answer, index) => (answer !== '' && answer === quiz[index].correctAnswer) ? acc + 1 : acc, 0);
        const incorrectAnswers = answeredQuestions - correctAnswers;
        const jeeScore = (correctAnswers * 4) - incorrectAnswers;
        
        const sourceFileName = inputFiles.length > 0 
            ? inputFiles.map(f => f.name).join(', ').substring(0, 50) 
            : 'Unknown File';

        // --- Cover Page ---
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('Quiz Performance Report', pageWidth / 2, y, { align: 'center' });
        y += 20;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(`Source File(s): ${sourceFileName}`, pageWidth / 2, y, { align: 'center' });
        y += 10;
        
        doc.text(`Report Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
        y += 20;

        // --- Summary Box ---
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 3, 3, 'FD');
        y += 10;
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        
        if (quizMode === 'JEE') {
            doc.text(`Final JEE Score: ${jeeScore}`, pageWidth / 2, y, { align: 'center' }); y += 10;
        } else {
            const percentage = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;
            doc.text(`Final Score: ${correctAnswers} / ${answeredQuestions} (${percentage}%)`, pageWidth / 2, y, { align: 'center' }); y += 10;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Correct: ${correctAnswers} | Incorrect: ${incorrectAnswers} | Answered: ${answeredQuestions}/${quiz.length}`, pageWidth / 2, y, { align: 'center' });
        y += 25; // Move below the box

        // --- Question Breakdown ---
        doc.addPage();
        y = margin;
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Question Analysis', margin, y);
        y += 10;

        for (let i = 0; i < quiz.length; i++) {
            const question = quiz[i];
            const userAnswer = answersForScoring[i];
            const isCorrect = userAnswer === question.correctAnswer;

            // Question Text
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            const questionTextLines = doc.splitTextToSize(`${i + 1}. ${question.question}`, pageWidth - margin * 2);
            checkPageBreak(questionTextLines.length * 5 + 10);
            doc.text(questionTextLines, margin, y);
            y += questionTextLines.length * 5 + 2;

            // Diagram Image
            if (question.isDiagramBased && question.pageNumber && question.diagramBoundingBox) {
                try {
                    const fullImageSrc = pageImages[question.pageNumber - 1];
                    const croppedSrc = await cropImage(fullImageSrc, question.diagramBoundingBox);
                    const img = new Image();
                    img.src = croppedSrc;
                    await new Promise(resolve => { img.onload = resolve });
                    const aspectRatio = img.width / img.height;
                    const pdfImgWidth = Math.min(80, pageWidth - margin * 2);
                    const pdfImgHeight = pdfImgWidth / aspectRatio;
                    checkPageBreak(pdfImgHeight + 5);
                    doc.addImage(croppedSrc, 'JPEG', margin, y, pdfImgWidth, pdfImgHeight);
                    y += pdfImgHeight + 5;
                } catch (e) { console.error("Could not add image to PDF", e); }
            }
            
            // Options
            doc.setFontSize(10);
            question.options.forEach((option, idx) => {
                const prefix = `${optionLabels[idx]}) `;
                
                let textColor = '#000000'; // Black
                if (option === userAnswer && !isCorrect) textColor = '#dc2626'; // Red
                if (option === question.correctAnswer) textColor = '#16a34a'; // Green
                
                doc.setTextColor(textColor);
                const optionLines = doc.splitTextToSize(prefix + option, pageWidth - margin * 2 - 5);
                checkPageBreak(optionLines.length * 4 + 2);
                doc.text(optionLines, margin + 5, y);
                y += optionLines.length * 4 + 2;
            });

            // Reset color
            doc.setTextColor('#000000');
            
            // Result Summary
            if (userAnswer) {
              if (!isCorrect) {
                  const summary = `Your Answer: ${userAnswer} (Incorrect)`;
                  checkPageBreak(5);
                  doc.setFont('helvetica', 'italic');
                  doc.setTextColor('#dc2626');
                  doc.text(summary, margin, y);
                  y += 5;
                  doc.setTextColor('#000000');
              }
            } else {
                checkPageBreak(5);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor('#6b7280'); // Gray
                doc.text('You did not answer this question.', margin, y);
                y+=5;
                doc.setTextColor('#000000');
            }

            // Separator
            y += 5;
            checkPageBreak(5);
            if (i < quiz.length - 1) {
              doc.setDrawColor(220, 220, 220);
              doc.line(margin, y, pageWidth - margin, y);
              y += 5;
            }
        }
        
        const firstFileName = inputFiles[0]?.name.replace(/\.[^/.]+$/, "") || "quiz";
        const additionalFilesInfo = inputFiles.length > 1 ? `_and_${inputFiles.length - 1}_more` : "";
        const finalFileName = `result_${firstFileName}${additionalFilesInfo}.pdf`;
        doc.save(finalFileName);

    } catch (err) {
        console.error("Failed to generate PDF:", err);
        setError("Sorry, there was an error creating the PDF.");
    } finally {
        setIsGeneratingPdf(false);
    }
};


  const renderResultsState = () => {
    if (!quiz) return null;

    const answersForScoring = quizMode === 'JEE' ? jeeSavedAnswers : userAnswers;

    const correctAnswers = answersForScoring.reduce((acc, answer, index) => {
        const isAnswered = answer !== '';
        if (isAnswered && answer === quiz[index].correctAnswer) {
            return acc + 1;
        }
        return acc;
    }, 0);
    
    const answeredQuestions = answersForScoring.filter(a => a !== '').length;
    const incorrectAnswers = answeredQuestions - correctAnswers;
    const notVisitedCount = visitedQuestions.filter(v => !v).length;
    const markedForReviewCount = markedQuestions.filter((m, i) => m && answersForScoring[i] === '').length;

    const percentage = answeredQuestions > 0 ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;
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
            const userAnswer = answersForScoring[index];
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
          <button 
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors w-full sm:w-auto disabled:bg-green-300 disabled:cursor-wait"
          >
              {isGeneratingPdf ? 'Generating PDF...' : 'Download Results (PDF)'}
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
      case AppState.QUIZ_READY:
        return renderQuizReadyState();
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
      {apiKey ? renderContent() : <ApiKeySetup onApiKeySubmit={setApiKey} />}
    </main>
  );
}
