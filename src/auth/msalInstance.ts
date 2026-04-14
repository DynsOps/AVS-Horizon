import { PublicClientApplication } from '@azure/msal-browser';
import { externalMsalConfig } from './authConfig';

export const externalMsalInstance = new PublicClientApplication(externalMsalConfig);
