# PDF Quiz Generator

This application transforms a PDF or image document into an interactive quiz using the Gemini AI API. Upload a file, and the app will automatically generate a multiple-choice quiz for you to take, with both "Practice" and "JEE" (timed) modes.

## Features

- **Multi-File Upload**: Supports combining multiple PDFs and common image formats (PNG, JPG, WebP) into a single quiz.
- **AI-Powered Quiz Generation**: Uses Gemini to analyze the document(s) and create relevant multiple-choice questions.
- **Diagram Support**: Identifies questions based on diagrams and displays the relevant cropped image.
- **Two Quiz Modes**:
    - **Practice Mode**: Take the quiz at your own pace, check answers one by one.
    - **JEE Mode**: A timed exam simulation with a question palette for navigation.
- **Full Screen Mode**: An immersive, distraction-free mode is available. In JEE Mode, full screen is enabled automatically. The keyboard shortcuts work throughout the app:
    - Press **`f`** to toggle (enter or exit) full screen.
    - Press **`Esc`** to exit full screen.
- **Results Analysis**: Get a detailed score breakdown and review your answers.
- **Static & Serverless**: Runs entirely in the browser, making it easy to deploy.

## Deploying to Netlify

This app is optimized for deployment on modern static hosting platforms like Netlify. The process is simple and requires no build configuration.

1.  **Push to a Git Repository**: Make sure all your code is pushed to a repository on GitHub, GitLab, or Bitbucket.

2.  **Sign Up & Connect to Netlify**:
    - Create a free account on [Netlify](https://www.netlify.com/).
    - Log in and go to your **Sites** dashboard.
    - Click **"Add new site"** and then select **"Import an existing project"**.

3.  **Connect to Your Git Provider**:
    - Choose the Git provider where your repository is hosted (e.g., GitHub).
    - Authorize Netlify to access your repositories.

4.  **Select Your Repository**:
    - Find and select the repository for this quiz generator app.

5.  **Configure Deployment Settings**:
    - Netlify will automatically detect that this is a static site.
    - You can leave the deployment settings at their default values:
        - **Build command**: Leave this field **blank**.
        - **Publish directory**: This should be the root of your project (it will likely be pre-filled or can be left blank).
    - Click **"Deploy site"**.

6.  **Wait and Launch**:
    - Netlify will deploy your site in under a minute.
    - Once the "Published" badge appears, you can click the URL (e.g., `https://<random-name>.netlify.app`) to see your live app.

7.  **Use the App**:
    - Your Quiz Generator is now live!
    - The app will ask for your Google AI Studio API key. Paste it in to begin generating quizzes.