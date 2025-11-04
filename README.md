# PDF Quiz Generator

This application transforms a PDF or image document into an interactive quiz using the Gemini AI API. Upload a file, and the app will automatically generate a multiple-choice quiz for you to take, with both "Practice" and "JEE" (timed) modes.

## Features

- **File Upload**: Supports PDF and common image formats (PNG, JPG, WebP).
- **AI-Powered Quiz Generation**: Uses Gemini to analyze the document and create relevant multiple-choice questions.
- **Diagram Support**: Identifies questions based on diagrams and displays the relevant cropped image.
- **Two Quiz Modes**:
    - **Practice Mode**: Take the quiz at your own pace, check answers one by one.
    - **JEE Mode**: A timed exam simulation with a question palette for navigation.
- **Results Analysis**: Get a detailed score breakdown and review your answers.
- **Static & Serverless**: Runs entirely in the browser, making it easy to deploy.

## Deploying to GitHub Pages

This app is optimized for deployment on static hosting platforms like GitHub Pages.

1.  **Push to GitHub**: Make sure all the code is pushed to your GitHub repository.

2.  **Enable GitHub Pages**:
    - Go to your repository on GitHub.
    - Click on the **Settings** tab.
    - In the left sidebar, click on **Pages**.
    - Under "Build and deployment", for the **Source**, select **Deploy from a branch**.
    - Select your branch (e.g., `main`) and the folder (`/ (root)`).
    - Click **Save**.

3.  **Wait for Deployment**: GitHub will start a deployment process. It usually takes a few minutes. Once it's done, you'll see a URL at the top of the Pages settings, like `https://<your-username>.github.io/<your-repo-name>/`.

4.  **Use the App**:
    - Navigate to the provided URL.
    - The app will ask for your Google AI Studio API key. Paste it in to begin generating quizzes.

That's it! Your Quiz Generator is now live.
