
# PDF Quiz Generator

This application transforms a PDF or image document into an interactive quiz using the Gemini AI API. Upload a file, and the app will automatically generate a multiple-choice quiz for you to take, with both "Practice" and "JEE" (timed) modes.

## Features

- **Multi-File Upload**: Supports combining multiple PDFs and common image formats (PNG, JPG, WebP) into a single quiz.
- **AI-Powered Quiz Generation**: Uses Gemini to analyze the document(s) and create relevant multiple-choice questions.
- **Local Quiz Drive**: Save completed quizzes to your browser's local storage. You can access your "Drive" from the home screen to retake or delete quizzes at any time. (Note: Saved quizzes are specific to the browser and device you use).
- **Diagram Support**: Identifies questions based on diagrams and displays the relevant cropped image.
- **Two Quiz Modes**:
    - **Practice Mode**: Take the quiz at your own pace, check answers one by one.
    - **JEE Mode**: A timed exam simulation with a question palette for navigation.
- **Full Screen Mode**: An immersive, distraction-free mode is available. In JEE Mode, full screen is enabled automatically. The keyboard shortcuts work throughout the app:
    - Press **`f`** to toggle (enter or exit) full screen.
    - Press **`Esc`** to exit full screen.
- **Results Analysis**: Get a detailed score breakdown and review your answers.
- **Downloadable Reports**: Save your quiz results as a detailed PDF report.
- **Static & Serverless**: Runs entirely in the browser, making it easy to host on any static web server or run locally.