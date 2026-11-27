/** Where an app's pages live, by path prefix: for the sign-in page's name and letter. */
export const APP_PATHS: { re: RegExp; name: string; letter: string }[] = [
  { re: /^\/(mosey|m)(\/|$|\?)/, name: "Mosey", letter: "M" },
  { re: /^\/(gyfte|g|j)(\/|$|\?)/, name: "Gyfte", letter: "G" },
  { re: /^\/(roomtune|rt)(\/|$|\?)/, name: "Room Tuner", letter: "R" },
  { re: /^\/jot(\/|$|\?)/, name: "Jot", letter: "J" },
];

export function appForPath(path: string) {
  return APP_PATHS.find((a) => a.re.test(path)) ?? null;
}
