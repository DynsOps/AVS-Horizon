import { PublicClientApplication } from '@azure/msal-browser';
import { externalMsalConfig, workforceMsalConfig } from './authConfig';

export const externalMsalInstance = new PublicClientApplication(externalMsalConfig);
export const workforceMsalInstance = new PublicClientApplication(workforceMsalConfig);
