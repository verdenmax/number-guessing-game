export function feedback(secret: string, guess: string): number {
  let bulls = 0
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) bulls++
  }
  return bulls
}
