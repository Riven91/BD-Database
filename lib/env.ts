export class MissingEnvError extends Error {
  envName: string;

  constructor(envName: string) {
    super(`${envName} missing`);
    this.name = "MissingEnvError";
    this.envName = envName;
  }
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new MissingEnvError(name);
  }
  return value;
}

export function getEnvErrorMessage(error: unknown) {
  if (error instanceof MissingEnvError) {
    return `Server misconfigured: missing ${error.envName}`;
  }
  if (error instanceof Error) {
    const match = error.message.match(/^(.*) missing$/);
    if (match) {
      return `Server misconfigured: missing ${match[1]}`;
    }
  }
  return null;
}
