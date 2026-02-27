/**
 * Centralized error messages for graph functionality
 * 
 * This utility provides user-friendly error messages in English (backend standard).
 * The frontend is responsible for translating these messages using react-i18next.
 * 
 * Structure prepared for future extension with multiple languages (see ADR-0009).
 */

export interface GraphErrorResponse {
  message: string;
  code: string;
  details?: string;
}

/**
 * Get a user-friendly error message for graph operations
 * 
 * @param errorCode - The error code (e.g., 'GRAPH_CONFIG_MISSING')
 * @param details - Optional details to replace placeholders in the message (e.g., { type: 'bar' })
 * @returns Object with message (user-friendly), code (for support), and optional details
 */
export function getGraphErrorMessage(
  errorCode: string,
  details?: Record<string, string>
): GraphErrorResponse {
  const baseMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.GRAPH_PROCESSING_ERROR;
  
  // Replace placeholders if details are provided
  let message = baseMessage;
  if (details) {
    Object.entries(details).forEach(([key, value]) => {
      message = message.replace(`{{${key}}}`, value);
    });
  }
  
  return {
    message,
    code: errorCode,
    details: details ? JSON.stringify(details) : undefined
  };
}

// Error messages in English (backend standard)
// Structure prepared for possible future extension with multiple languages (see ADR-0009):
// type ErrorMessagesByLang = Record<string, Record<string, string>>;
// const ERROR_MESSAGES: ErrorMessagesByLang = {
//   en: { ... },
//   pt_BR: { ... },
// };
const ERROR_MESSAGES: Record<string, string> = {
  GRAPH_CONFIG_MISSING: "Graph configuration not found. Please configure the graph before viewing it.",
  GRAPH_CONFIG_INVALID: "Graph configuration is incomplete. Please check the required fields.",
  GRAPH_CONFIG_TYPE_MISSING: "Graph type not specified. Please select a valid graph type.",
  GRAPH_CONFIG_AXIS_MISSING: "Graph axes are not configured correctly. Please configure X and Y axes for this graph type.",
  GRAPH_CONFIG_AXIS_X_MISSING: "X axis not configured. Please configure the X axis for {{type}} charts.",
  GRAPH_CONFIG_AXIS_Y_MISSING: "Y axis not configured. Please configure the Y axis for {{type}} charts.",
  GRAPH_CONFIG_CATEGORY_MISSING: "Category field not configured. Please configure the category field for pie charts.",
  GRAPH_FILTER_INVALID: "Applied filters are invalid. Please check the filters and try again.",
  GRAPH_FIELD_NOT_FOUND:
    "The selected field for this chart is no longer available. Please edit the chart and choose a different field.",
  GRAPH_PROCESSING_ERROR: "An error occurred while processing the graph. Please try again or contact support.",
  GRAPH_TIMEOUT: "Graph generation took too long. Please try again with a smaller dataset or more filters.",
  GRAPH_DATA_ERROR: "Could not load data for the graph. Please check your connection and try again.",
};
