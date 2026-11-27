/** "1 gift", "12 gifts", "No gifts yet". */
export function giftCount(n: number): string {
  return n === 0 ? "No gifts yet" : `${n} ${n === 1 ? "gift" : "gifts"}`;
}
