import { SavedQuiz } from '../types';
declare const gapi: any;

// IMPORTANT: Replace with your actual Google Cloud credentials
// To get these, create a project at https://console.cloud.google.com/,
// enable the Google Drive API, and create an API Key and an OAuth 2.0 Client ID for a Web Application.
export const CLIENT_ID = '[YOUR_CLIENT_ID]';
export const API_KEY = '[YOUR_API_KEY]';

// The scope specifies that this app can only see and manage files it creates itself.
export const SCOPES = 'https://www.googleapis.com/auth/drive.file';
export const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

const APP_FOLDER_NAME = 'PDF Quiz Generator Quizzes';
let appFolderId: string | null = null;

export const signIn = () => {
  gapi.auth2.getAuthInstance().signIn();
};

export const signOut = () => {
  gapi.auth2.getAuthInstance().signOut();
};

/**
 * Finds or creates the dedicated application folder in Google Drive.
 * @returns {Promise<string>} The ID of the application folder.
 */
const getAppFolderId = async (): Promise<string> => {
  if (appFolderId) {
    return appFolderId;
  }

  const response = await gapi.client.drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
    fields: 'files(id, name)',
  });

  if (response.result.files.length > 0) {
    appFolderId = response.result.files[0].id;
    return appFolderId as string;
  } else {
    const fileMetadata = {
      'name': APP_FOLDER_NAME,
      'mimeType': 'application/vnd.google-apps.folder'
    };
    const folderResponse = await gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });
    appFolderId = folderResponse.result.id;
    return appFolderId as string;
  }
};

/**
 * Lists all quiz files in the application folder.
 * @returns {Promise<{id: string, name: string}[]>} A list of quiz files.
 */
export const listQuizzes = async (): Promise<{id: string, name: string}[]> => {
  const folderId = await getAppFolderId();
  const response = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
    fields: 'files(id, name)',
    orderBy: 'createdTime desc'
  });
  return response.result.files;
};

/**
 * Saves a quiz to Google Drive.
 * @param {Omit<SavedQuiz, 'id'>} quizData - The quiz data to save.
 * @returns {Promise<any>} The response from the Google Drive API.
 */
export const saveQuiz = async (quizData: Omit<SavedQuiz, 'id'>): Promise<any> => {
  const folderId = await getAppFolderId();
  const quizContent = JSON.stringify(quizData);
  const fileName = `${quizData.name}.json`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([quizContent], { type: 'application/json' }));

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': `Bearer ${gapi.auth.getToken().access_token}` }),
    body: form,
  });

  return response.json();
};

/**
 * Retrieves a specific quiz file from Google Drive.
 * @param {string} fileId - The ID of the file to retrieve.
 * @returns {Promise<SavedQuiz | null>} The parsed quiz data.
 */
export const getQuiz = async (fileId: string): Promise<SavedQuiz | null> => {
  const response = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });
  
  if (response.body) {
    const quizData = JSON.parse(response.body);
    return { ...quizData, id: fileId };
  }
  return null;
};

/**
 * Deletes a quiz file from Google Drive.
 * @param {string} fileId - The ID of the file to delete.
 * @returns {Promise<any>} The response from the Google Drive API.
 */
export const deleteQuiz = async (fileId: string): Promise<any> => {
  return gapi.client.drive.files.delete({
    fileId: fileId,
  });
};