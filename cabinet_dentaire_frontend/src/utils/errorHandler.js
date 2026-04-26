/**
 * Error handler utility for standardizing error message extraction and logging
 * Handles API errors, network errors, and validation errors
 */

/**
 * Extract user-friendly error message from various error formats
 * Handles API responses, network errors, and validation errors
 */
export function extractErrorMessage(error) {
  // Network error (no response)
  if (!error.response) {
    if (error.message === 'Network Error') {
      return 'Network connection error. Please check your internet connection.';
    }
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.';
    }
    return error.message || 'An unexpected error occurred.';
  }

  const { data, status } = error.response;

  // API error with custom message
  if (data?.message) {
    return data.message;
  }

  // API error with detail field (DRF default)
  if (data?.detail) {
    return data.detail;
  }

  // API validation errors
  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors)
      .flat()
      .filter(Boolean)
      .map((e) => (typeof e === 'string' ? e : e.message || 'Invalid input'));
    if (messages.length > 0) {
      return messages[0];
    }
  }

  // Default messages by status code
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'You are not authenticated. Please log in.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This resource already exists or conflicts with another resource.';
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
      return 'Service unavailable. Please try again later.';
    default:
      return `Error ${status}: ${data?.statusText || "An error occurred"}`;
  }
}

/**
 * Check if error is a network error (offline, timeout, etc.)
 */
export function isNetworkError(error) {
  return !error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error';
}

/**
 * Check if error is authentication-related (401, 403)
 */
export function isAuthError(error) {
  return error.response?.status === 401 || error.response?.status === 403;
}

/**
 * Check if error is a validation error with field-level details
 */
export function isValidationError(error) {
  const { data } = error.response || {};
  return data?.errors && typeof data.errors === 'object';
}

/**
 * Format field-level validation errors into an object
 * Converts API validation response to { fieldName: 'error message' }
 */
export function formatFieldErrors(error) {
  if (!isValidationError(error)) {
    return {};
  }

  const { errors } = error.response.data;
  const formatted = {};

  Object.entries(errors).forEach(([field, messages]) => {
    const messageArray = Array.isArray(messages) ? messages : [messages];
    formatted[field] = messageArray
      .map((m) => (typeof m === 'string' ? m : m.message || 'Invalid'))
      .join(', ');
  });

  return formatted;
}

/**
 * Log error with context information (dev only)
 * Helps with debugging without polluting production logs
 */
export function logError(error, context = {}) {
  if (!import.meta.env.DEV) {
    return;
  }

  const timestamp = new Date().toISOString();
  const errorMsg = extractErrorMessage(error);

  console.group(`🔴 Error [${timestamp}]`);
  console.error('Context:', context);
  console.error('Message:', errorMsg);
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
    console.error('Headers:', error.response.headers);
  } else {
    console.error('Full error:', error);
  }
  console.groupEnd();
}
