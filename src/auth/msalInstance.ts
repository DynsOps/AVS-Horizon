import { PublicClientApplication } from '@azure/msal-browser';
import { externalMsalConfig } from './authConfig';

export const msalInstance = new PublicClientApplication(externalMsalConfig);
