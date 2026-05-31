import { customClient } from "../lib/custom-sdk.js";

// Export the custom client as base44 for compatibility
export const base44 = customClient;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
