const DEFAULT_API_BASE_PATH = "/api/v1";

function trimTrailingSlash(input: string) {
  return input.endsWith("/") ? input.slice(0, -1) : input;
}

export const API_BASE_PATH = trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_PATH || DEFAULT_API_BASE_PATH);

export function getDisplayApiBasePath() {
  return API_BASE_PATH;
}
